/* Dormatec Service Desk (localStorage demo)
   - Tickets (Kanban) + Planning velden -> auto Agenda item (ticket-linked)
   - Agenda maand view met klik -> lijst + edit
   - Planning & Belasting + Dashboard
   - Modals: body scrollt altijd (CSS), en JS scrollTop reset
*/

const STORAGE_KEY = "dormatec_service_desk_v1";

const STATUSES = [
  "Nieuw",
  "Intake",
  "Werkvoorbereiding",
  "Planning",
  "In uitvoering",
  "Gereed verwerking",
  "Afronding",
];

const ASSIGNEES = [
  "Iedereen",
  "a.zaalberg@dormatec.eu",
  "sales@dormatec.eu",
  "binnendienst@dormatec.eu",
  "monteur1@dormatec.eu",
  "monteur2@dormatec.eu",
];

const TYPES = ["Storing", "Installatie", "Project", "Intern", "Overig"];
const PRIORITIES = ["Laag", "Normaal", "Hoog", "Spoed"];

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function uid(prefix="id"){
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function todayISO(){
  const d = new Date();
  return d.toISOString().slice(0,10);
}

function parseISO(s){
  // "YYYY-MM-DD"
  const [y,m,dd] = s.split("-").map(Number);
  return new Date(y, m-1, dd);
}

function fmtDateNL(iso){
  if(!iso) return "—";
  const d = parseISO(iso);
  return d.toLocaleDateString("nl-NL", { year:"numeric", month:"short", day:"2-digit" });
}

function fmtMonthTitle(d){
  return d.toLocaleDateString("nl-NL", { year:"numeric", month:"long" });
}

function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }

function toast(msg){
  const wrap = $("#toastWrap");
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(()=> t.remove(), 2600);
}

/* ------------------ STATE ------------------ */

function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw){
    try{ return JSON.parse(raw); }catch(e){}
  }
  // seed demo
  const demo = {
    version: 1,
    tickets: [
      {
        id: uid("t"),
        title: "storing melding 1",
        customer: "Klant 1",
        orderNo: "12345",
        type: "Storing",
        priority: "Hoog",
        status: "Intake",
        assignee: "a.zaalberg@dormatec.eu",
        estimatedHours: 1,
        note: "Eerste intake. Controleer scope en onderdelen.",
        createdAt: new Date().toISOString(),
        planningStart: "",
        planningEnd: "",
        planningStartTime: "08:00",
        planningEndTime: "12:00",
        planningTech: "",
        planningIsDefinitive: false,
        technicianFields: {
          machine: "",
          serial: "",
          issue: "",
          fix: "",
          parts: "",
        }
      },
      {
        id: uid("t"),
        title: "installatie project 2",
        customer: "Klant 2",
        orderNo: "112345",
        type: "Installatie",
        priority: "Normaal",
        status: "In uitvoering",
        assignee: "a.zaalberg@dormatec.eu",
        estimatedHours: 3,
        note: "Werk in uitvoering, afstemming met klant.",
        createdAt: new Date().toISOString(),
        planningStart: todayISO(),
        planningEnd: todayISO(),
        planningStartTime: "09:00",
        planningEndTime: "16:00",
        planningTech: "monteur1@dormatec.eu",
        planningIsDefinitive: true,
        technicianFields: {
          machine: "UV330",
          serial: "—",
          issue: "—",
          fix: "—",
          parts: "—",
        }
      }
    ],
    agenda: [
      {
        id: uid("a"),
        kind: "Verlof",
        title: "Verlof",
        customer: "",
        orderNo: "",
        assignee: "monteur2@dormatec.eu",
        dateStart: todayISO(),
        dateEnd: todayISO(),
        timeStart: "",
        timeEnd: "",
        isDefinitive: true,
        note: "Hele dag",
        linkedTicketId: null,
        createdAt: new Date().toISOString(),
      }
    ],
    ui: {
      view: "dashboard",
      calMonth: new Date().toISOString().slice(0,7), // YYYY-MM
      selectedDay: todayISO(),
    }
  };
  // ensure ticket-linked agenda for demo ticket 2
  return normalizeAndSync(demo);
}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

/* ------------------ SYNC: Tickets <-> Agenda ------------------ */

function normalizeAndSync(s){
  // Ensure required fields
  s.tickets = (s.tickets || []).map(t => ({
    customer: "",
    orderNo: "",
    type: "Overig",
    priority: "Normaal",
    status: "Nieuw",
    assignee: "Iedereen",
    estimatedHours: 0,
    note: "",
    planningStart: "",
    planningEnd: "",
    planningStartTime: "",
    planningEndTime: "",
    planningTech: "",
    planningIsDefinitive: false,
    technicianFields: {
      machine: "",
      serial: "",
      issue: "",
      fix: "",
      parts: "",
    },
    ...t,
    technicianFields: {
      machine: "",
      serial: "",
      issue: "",
      fix: "",
      parts: "",
      ...(t.technicianFields || {})
    }
  }));

  s.agenda = (s.agenda || []).map(a => ({
    kind: "Installatie",
    title: "",
    customer: "",
    orderNo: "",
    assignee: "Iedereen",
    dateStart: todayISO(),
    dateEnd: todayISO(),
    timeStart: "",
    timeEnd: "",
    isDefinitive: false,
    note: "",
    linkedTicketId: null,
    ...a
  }));

  s.ui = s.ui || { view:"dashboard", calMonth: new Date().toISOString().slice(0,7), selectedDay: todayISO() };

  // 1) Remove orphaned linked items (ticket deleted)
  const ticketIds = new Set(s.tickets.map(t => t.id));
  s.agenda = s.agenda.filter(a => !a.linkedTicketId || ticketIds.has(a.linkedTicketId));

  // 2) Upsert linked agenda items for tickets in Planning (and optionally In uitvoering)
  for(const t of s.tickets){
    const shouldLink = (t.status === "Planning" || t.status === "In uitvoering") && t.planningStart && t.planningEnd && t.planningTech;
    const existing = s.agenda.find(a => a.linkedTicketId === t.id);

    if(!shouldLink){
      // if existing linked item, keep it but mark as ticket? We remove to prevent confusion.
      if(existing){
        s.agenda = s.agenda.filter(a => a.linkedTicketId !== t.id);
      }
      continue;
    }

    const title = `${t.customer || "Klant"} · ${t.title}`;
    const kind = "Ticket";

    const payload = {
      kind,
      title,
      customer: t.customer || "",
      orderNo: t.orderNo || "",
      assignee: t.planningTech || "Iedereen",
      dateStart: t.planningStart,
      dateEnd: t.planningEnd,
      timeStart: t.planningStartTime || "",
      timeEnd: t.planningEndTime || "",
      isDefinitive: !!t.planningIsDefinitive,
      note: t.note || "",
      linkedTicketId: t.id,
    };

    if(existing){
      Object.assign(existing, payload);
    } else {
      s.agenda.push({
        id: uid("a"),
        createdAt: new Date().toISOString(),
        ...payload
      });
    }
  }

  return s;
}

/* ------------------ NAV / VIEWS ------------------ */

function setView(view){
  state.ui.view = view;
  saveState();

  $$(".nav__item").forEach(b => b.classList.toggle("is-active", b.dataset.view === view));
  $$(".view").forEach(v => v.classList.add("is-hidden"));
  $(`#view-${view}`).classList.remove("is-hidden");

  renderAll();
}

function initNav(){
  $$(".nav__item").forEach(btn=>{
    btn.addEventListener("click", ()=> setView(btn.dataset.view));
  });
}

/* ------------------ MODAL ------------------ */

function openModal({ title, subtitle="", bodyHTML="", footHTML="", onMount }){
  const overlay = $("#overlay");
  const modal = $("#modal");
  const modalTitle = $("#modalTitle");
  const modalSubtitle = $("#modalSubtitle");
  const modalBody = $("#modalBody");
  const modalFoot = $("#modalFoot");

  modalTitle.textContent = title;
  modalSubtitle.textContent = subtitle;
  modalBody.innerHTML = bodyHTML;
  modalFoot.innerHTML = footHTML;

  overlay.classList.remove("is-hidden");
  modal.classList.remove("is-hidden");
  document.body.style.overflow = "hidden";

  // reset scroll to top always
  modalBody.scrollTop = 0;

  const close = () => closeModal();
  $("#modalClose").onclick = close;
  overlay.onclick = close;

  // esc
  window.onkeydown = (e)=> {
    if(e.key === "Escape") closeModal();
  };

  if(typeof onMount === "function"){
    onMount({ modalBody, modalFoot });
  }
}

function closeModal(){
  $("#overlay").classList.add("is-hidden");
  $("#modal").classList.add("is-hidden");
  document.body.style.overflow = "";
  $("#overlay").onclick = null;
  window.onkeydown = null;
}

/* ------------------ RENDER: DASHBOARD ------------------ */

function renderDashboard(){
  const open = state.tickets.filter(t => t.status !== "Afronding" && t.status !== "Gereed verwerking").length;
  const doing = state.tickets.filter(t => t.status === "In uitvoering").length;

  // "afronding binnen 7 dagen" is demo: count afronding status, no due date yet -> just count
  const closing = state.tickets.filter(t => t.status === "Afronding").length;

  $("#kpiOpen").textContent = String(open);
  $("#kpiDoing").textContent = String(doing);
  $("#kpiClosing").textContent = String(closing);

  // status bars
  const perStatus = {};
  for(const s of STATUSES) perStatus[s] = 0;
  for(const t of state.tickets) perStatus[t.status] = (perStatus[t.status]||0) + 1;

  const maxStatus = Math.max(1, ...Object.values(perStatus));
  const statusBars = $("#statusBars");
  statusBars.innerHTML = "";
  for(const s of STATUSES){
    statusBars.appendChild(barRow(s, perStatus[s], maxStatus));
  }

  // workload bars: planning + in uitvoering
  const w = {};
  for(const a of ASSIGNEES.filter(x => x !== "Iedereen")) w[a] = 0;
  for(const t of state.tickets){
    if(t.status === "Planning" || t.status === "In uitvoering"){
      const who = t.assignee || "Iedereen";
      if(w[who] != null) w[who] += Number(t.estimatedHours || 0);
    }
  }
  const maxW = Math.max(1, ...Object.values(w));
  const wBars = $("#workloadBars");
  wBars.innerHTML = "";
  Object.entries(w).forEach(([name, val])=>{
    wBars.appendChild(barRow(name, val, maxW, "u"));
  });
}

function barRow(label, val, max, suffix=""){
  const row = document.createElement("div");
  row.className = "bar";
  row.innerHTML = `
    <div class="bar__label" title="${escapeHtml(label)}">${escapeHtml(label)}</div>
    <div class="bar__track"><div class="bar__fill" style="width:${(val/max)*100}%"></div></div>
    <div class="bar__val">${val}${suffix}</div>
  `;
  return row;
}

/* ------------------ RENDER: TICKETS ------------------ */

function renderTicketFilters(){
  const sel = $("#qAssignee");
  sel.innerHTML = "";
  const opts = ["", ...ASSIGNEES];
  for(const o of opts){
    const op = document.createElement("option");
    op.value = o;
    op.textContent = o === "" ? "Iedereen" : o;
    sel.appendChild(op);
  }
}

function getTicketFilter(){
  const q = ($("#qSearch").value || "").trim().toLowerCase();
  const ass = $("#qAssignee").value || "";
  const pr = $("#qPriority").value || "";
  const ty = $("#qType").value || "";

  return (t)=>{
    const blob = `${t.title} ${t.customer} ${t.orderNo} ${t.note}`.toLowerCase();
    if(q && !blob.includes(q)) return false;
    if(ass && t.assignee !== ass) return false;
    if(pr && t.priority !== pr) return false;
    if(ty && t.type !== ty) return false;
    return true;
  };
}

function renderKanban(){
  const kanban = $("#kanban");
  kanban.innerHTML = "";

  const filterFn = getTicketFilter();
  const filtered = state.tickets.filter(filterFn);

  for(const status of STATUSES){
    const col = document.createElement("div");
    col.className = "col";
    col.dataset.status = status;

    const list = filtered.filter(t => t.status === status);
    col.innerHTML = `
      <div class="col__head">
        <div class="col__title">${escapeHtml(status)}</div>
        <div class="col__count">${list.length}</div>
      </div>
      <div class="col__list"></div>
    `;

    const listEl = col.querySelector(".col__list");
    for(const t of list){
      listEl.appendChild(ticketCard(t));
    }

    // drag drop
    col.ondragover = (e)=> { e.preventDefault(); };
    col.ondrop = (e)=> {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain");
      const ticket = state.tickets.find(x=>x.id===id);
      if(!ticket) return;
      ticket.status = status;

      // sync agenda with planning rules
      state = normalizeAndSync(state);
      saveState();
      renderAll();
      toast(`Ticket → ${status}`);
    };

    kanban.appendChild(col);
  }
}

function ticketCard(t){
  const el = document.createElement("div");
  el.className = "carditem";
  el.draggable = true;

  const prClass =
    t.priority === "Hoog" ? "badge--prio-hi" :
    t.priority === "Spoed" ? "badge--prio-urg" :
    t.priority === "Laag" ? "badge--prio-low" : "";

  el.innerHTML = `
    <div class="carditem__title" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</div>
    <div class="row">
      <span class="badge ${prClass}">${escapeHtml(t.priority)}</span>
      <span class="badge">${escapeHtml(t.type)}</span>
      ${t.customer ? `<span class="badge">${escapeHtml(t.customer)}</span>` : ``}
      ${t.orderNo ? `<span class="badge">#${escapeHtml(t.orderNo)}</span>` : ``}
    </div>
    <div class="row" style="margin-top:8px">
      <span class="badge">${escapeHtml(t.assignee || "Iedereen")}</span>
      <span class="badge">${Number(t.estimatedHours||0)}.0u</span>
    </div>
    <div class="meta" style="margin-top:8px" title="${escapeHtml(t.note||"")}">${escapeHtml(t.note||"")}</div>
  `;

  el.ondragstart = (e)=> {
    e.dataTransfer.setData("text/plain", t.id);
  };

  el.onclick = ()=> openTicketModal(t.id);

  return el;
}

/* ------------------ TICKET MODAL ------------------ */

function openTicketModal(ticketId){
  const t = state.tickets.find(x=>x.id===ticketId);
  if(!t) return;

  const planningFieldsVisible = (t.status === "Planning" || t.status === "In uitvoering");
  const techFieldsVisible = (t.status === "Werkvoorbereiding" || t.status === "Planning" || t.status === "In uitvoering");

  openModal({
    title: "Ticket",
    subtitle: `${t.status} · ${t.type} · ${t.customer || "—"} · #${t.orderNo || "—"}`,
    bodyHTML: `
      <div class="form-grid">
        <div class="field field--full">
          <label>Titel</label>
          <input id="t_title" type="text" value="${escapeAttr(t.title)}" />
        </div>

        <div class="field">
          <label>Klant</label>
          <input id="t_customer" type="text" value="${escapeAttr(t.customer||"")}" />
        </div>
        <div class="field">
          <label>Ordernummer</label>
          <input id="t_orderNo" type="text" value="${escapeAttr(t.orderNo||"")}" />
        </div>

        <div class="field">
          <label>Status</label>
          <select id="t_status">${STATUSES.map(s=>`<option ${s===t.status?"selected":""}>${escapeHtml(s)}</option>`).join("")}</select>
        </div>
        <div class="field">
          <label>Assignee</label>
          <select id="t_assignee">${ASSIGNEES.map(a=>`<option value="${escapeAttr(a)}" ${a===t.assignee?"selected":""}>${escapeHtml(a)}</option>`).join("")}</select>
        </div>

        <div class="field">
          <label>Type</label>
          <select id="t_type">${TYPES.map(x=>`<option ${x===t.type?"selected":""}>${escapeHtml(x)}</option>`).join("")}</select>
        </div>
        <div class="field">
          <label>Prioriteit</label>
          <select id="t_priority">${PRIORITIES.map(x=>`<option ${x===t.priority?"selected":""}>${escapeHtml(x)}</option>`).join("")}</select>
        </div>

        <div class="field">
          <label>Estimated hours</label>
          <input id="t_hours" type="number" min="0" step="0.5" value="${escapeAttr(String(t.estimatedHours||0))}" />
        </div>
        <div class="field">
          <label>Planning definitief?</label>
          <select id="t_isDef">
            <option value="0" ${!t.planningIsDefinitive?"selected":""}>Tijdelijk</option>
            <option value="1" ${t.planningIsDefinitive?"selected":""}>Definitief</option>
          </select>
        </div>

        ${planningFieldsVisible ? `
          <div class="field">
            <label>Monteur (planning)</label>
            <select id="t_planningTech">${ASSIGNEES.map(a=>`<option value="${escapeAttr(a)}" ${a===t.planningTech?"selected":""}>${escapeHtml(a)}</option>`).join("")}</select>
          </div>
          <div class="field">
            <label>Start datum</label>
            <input id="t_planStart" type="date" value="${escapeAttr(t.planningStart||"")}" />
          </div>
          <div class="field">
            <label>Eind datum</label>
            <input id="t_planEnd" type="date" value="${escapeAttr(t.planningEnd||"")}" />
          </div>
          <div class="field">
            <label>Start tijd</label>
            <input id="t_planStartTime" type="time" value="${escapeAttr(t.planningStartTime||"")}" />
          </div>
          <div class="field">
            <label>Eind tijd</label>
            <input id="t_planEndTime" type="time" value="${escapeAttr(t.planningEndTime||"")}" />
          </div>
          <div class="field field--full">
            <label>Planning notitie</label>
            <textarea id="t_planNote" rows="4" placeholder="planning / afspraken / bijzonderheden...">${escapeHtml(t.planningTech ? "" : "")}</textarea>
          </div>
        ` : `
          <div class="field field--full">
            <label>Planning velden</label>
            <div class="muted">
              Zet status op <b>Planning</b> of <b>In uitvoering</b> om planning velden te tonen (monteur + datum/tijd).
            </div>
          </div>
        `}

        ${techFieldsVisible ? `
          <div class="divider"></div>
          <div class="field field--full">
            <label>Technische velden</label>
            <div class="muted">Deze velden ondersteunen werkvoorbereiding/techniek en blijven bij het ticket.</div>
          </div>
          <div class="field">
            <label>Machine</label>
            <input id="t_machine" type="text" value="${escapeAttr(t.technicianFields.machine||"")}" />
          </div>
          <div class="field">
            <label>Serienummer</label>
            <input id="t_serial" type="text" value="${escapeAttr(t.technicianFields.serial||"")}" />
          </div>
          <div class="field field--full">
            <label>Probleem / klacht</label>
            <textarea id="t_issue" rows="3">${escapeHtml(t.technicianFields.issue||"")}</textarea>
          </div>
          <div class="field field--full">
            <label>Oplossing / actie</label>
            <textarea id="t_fix" rows="3">${escapeHtml(t.technicianFields.fix||"")}</textarea>
          </div>
          <div class="field field--full">
            <label>Onderdelen</label>
            <textarea id="t_parts" rows="3">${escapeHtml(t.technicianFields.parts||"")}</textarea>
          </div>
        ` : ``}

        <div class="divider"></div>

        <div class="field field--full">
          <label>Notitie (intern)</label>
          <textarea id="t_note" rows="6" placeholder="notities, context, besluiten...">${escapeHtml(t.note||"")}</textarea>
        </div>
      </div>
    `,
    footHTML: `
      <button class="btn btn--ghost" id="btnDeleteTicket">Verwijderen</button>
      <button class="btn btn--primary" id="btnSaveTicket">Opslaan</button>
    `,
    onMount: () => {
      $("#btnDeleteTicket").onclick = ()=>{
        if(!confirm("Ticket verwijderen?")) return;
        state.tickets = state.tickets.filter(x=>x.id!==t.id);
        state = normalizeAndSync(state);
        saveState();
        closeModal();
        renderAll();
        toast("Ticket verwijderd");
      };

      $("#btnSaveTicket").onclick = ()=>{
        const updated = readTicketForm(t);
        Object.assign(t, updated);

        // if status moved into planning/in uitvoering -> ensure planning fields exist optionally
        state = normalizeAndSync(state);
        saveState();
        closeModal();
        renderAll();
        toast("Ticket opgeslagen");
      };
    }
  });
}

function readTicketForm(orig){
  const status = $("#t_status").value;
  const planningVisible = (status === "Planning" || status === "In uitvoering");

  const out = {
    title: $("#t_title").value.trim(),
    customer: $("#t_customer").value.trim(),
    orderNo: $("#t_orderNo").value.trim(),
    status,
    assignee: $("#t_assignee").value,
    type: $("#t_type").value,
    priority: $("#t_priority").value,
    estimatedHours: Number($("#t_hours").value || 0),
    planningIsDefinitive: $("#t_isDef").value === "1",
    note: $("#t_note").value,
  };

  if(planningVisible){
    out.planningTech = $("#t_planningTech").value;
    out.planningStart = $("#t_planStart").value;
    out.planningEnd = $("#t_planEnd").value;
    out.planningStartTime = $("#t_planStartTime").value;
    out.planningEndTime = $("#t_planEndTime").value;

    // minimal validation
    if(out.planningStart && out.planningEnd){
      const a = parseISO(out.planningStart).getTime();
      const b = parseISO(out.planningEnd).getTime();
      if(b < a){
        toast("Einddatum is vóór startdatum — aangepast.");
        out.planningEnd = out.planningStart;
      }
    }
  } else {
    // clear planning linkage fields if not in planning/in uitvoering
    out.planningTech = orig.planningTech || "";
    out.planningStart = orig.planningStart || "";
    out.planningEnd = orig.planningEnd || "";
    out.planningStartTime = orig.planningStartTime || "";
    out.planningEndTime = orig.planningEndTime || "";
  }

  // tech fields (only present if rendered)
  if($("#t_machine")){
    out.technicianFields = {
      machine: $("#t_machine").value,
      serial: $("#t_serial").value,
      issue: $("#t_issue").value,
      fix: $("#t_fix").value,
      parts: $("#t_parts").value,
    };
  }

  return out;
}

/* ------------------ NEW TICKET ------------------ */

function newTicket(defaults={}){
  const t = {
    id: uid("t"),
    title: "Nieuw ticket",
    customer: "",
    orderNo: "",
    type: "Overig",
    priority: "Normaal",
    status: "Nieuw",
    assignee: "Iedereen",
    estimatedHours: 0,
    note: "",
    createdAt: new Date().toISOString(),
    planningStart: "",
    planningEnd: "",
    planningStartTime: "",
    planningEndTime: "",
    planningTech: "Iedereen",
    planningIsDefinitive: false,
    technicianFields: { machine:"", serial:"", issue:"", fix:"", parts:"" },
    ...defaults
  };
  state.tickets.unshift(t);
  state = normalizeAndSync(state);
  saveState();
  renderAll();
  return t;
}

/* ------------------ AGENDA ------------------ */

function getAgendaItemsForDay(iso){
  const day = parseISO(iso);
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0,0,0,0).getTime();
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23,59,59,999).getTime();

  return state.agenda.filter(a=>{
    const aStart = parseISO(a.dateStart).getTime();
    const aEnd = parseISO(a.dateEnd).getTime();
    return aStart <= end && aEnd >= start;
  }).sort((x,y)=>{
    const ax = (x.timeStart || "99:99");
    const ay = (y.timeStart || "99:99");
    return ax.localeCompare(ay);
  });
}

function renderAgenda(){
  const [y, m] = state.ui.calMonth.split("-").map(Number);
  const monthDate = new Date(y, m-1, 1);
  $("#calTitle").textContent = fmtMonthTitle(monthDate);

  const grid = $("#calGrid");
  grid.innerHTML = "";

  // Monday-based grid
  const firstDay = new Date(y, m-1, 1);
  const firstDow = (firstDay.getDay() + 6) % 7; // 0=Mon ... 6=Sun
  const daysInMonth = new Date(y, m, 0).getDate();

  // previous month tail
  const prevDays = firstDow;
  const prevMonthDays = new Date(y, m-1, 0).getDate();

  const cells = [];
  for(let i=prevDays-1; i>=0; i--){
    const dnum = prevMonthDays - i;
    const d = new Date(y, m-2, dnum);
    cells.push({ date: d, out:true });
  }
  // current month
  for(let dnum=1; dnum<=daysInMonth; dnum++){
    const d = new Date(y, m-1, dnum);
    cells.push({ date: d, out:false });
  }
  // next month head to fill 6 rows (42 cells)
  while(cells.length < 42){
    const last = cells[cells.length-1].date;
    const d = new Date(last);
    d.setDate(d.getDate()+1);
    cells.push({ date: d, out:true });
  }

  const today = todayISO();
  const selected = state.ui.selectedDay;

  for(const c of cells){
    const iso = c.date.toISOString().slice(0,10);

    const dayEl = document.createElement("div");
    dayEl.className = "day" + (c.out ? " is-out":"") + (iso===today ? " is-today":"");
    dayEl.dataset.iso = iso;

    const items = getAgendaItemsForDay(iso).slice(0,3); // show up to 3 chips
    const more = Math.max(0, getAgendaItemsForDay(iso).length - items.length);

    dayEl.innerHTML = `
      <div class="day__num">${c.date.getDate()}</div>
      <div class="day__chips">
        ${items.map(a => chipHTML(a)).join("")}
        ${more>0 ? `<div class="chip"><div class="chip__left"><span class="chip__dot" style="opacity:.35"></span><span class="chip__txt">+${more} meer</span></div><span class="chip__time"></span></div>` : ``}
      </div>
    `;

    dayEl.onclick = ()=>{
      state.ui.selectedDay = iso;
      saveState();
      renderAgendaDayPanel();
      // also visually hint: quick toast
      toast(`Dag geselecteerd: ${fmtDateNL(iso)}`);
    };

    // click chip -> edit item
    dayEl.querySelectorAll(".chip[data-id]").forEach(ch=>{
      ch.onclick = (e)=>{
        e.stopPropagation();
        const id = ch.dataset.id;
        openAgendaModal(id);
      };
    });

    grid.appendChild(dayEl);

    if(iso === selected){
      // no special border, but can be added later if desired
    }
  }

  renderAgendaDayPanel();
}

function chipHTML(a){
  const kindClass =
    a.kind === "Verlof" ? "chip--leave" :
    a.kind === "Installatie" ? "chip--install" :
    a.kind === "Ticket" ? "chip--ticket" : "";

  const planClass = a.isDefinitive ? "chip--fixed" : "chip--temp";

  const cls = `${kindClass} ${a.kind !== "Verlof" ? planClass : ""}`.trim();

  const time = (a.timeStart || a.timeEnd) ? `${a.timeStart||""}${a.timeStart && a.timeEnd ? "–":""}${a.timeEnd||""}` : "";
  const title = a.kind === "Verlof"
    ? `${a.assignee} · Verlof`
    : `${a.customer || "Klant"} · ${a.title || a.kind}`;

  return `
    <div class="chip ${cls}" data-id="${escapeAttr(a.id)}" title="${escapeAttr(title)}">
      <div class="chip__left">
        <span class="chip__dot"></span>
        <span class="chip__txt">${escapeHtml(title)}</span>
      </div>
      <span class="chip__time">${escapeHtml(time)}</span>
    </div>
  `;
}

function renderAgendaDayPanel(){
  const iso = state.ui.selectedDay || todayISO();
  const list = $("#dayList");
  const hint = $("#dayHint");

  const items = getAgendaItemsForDay(iso);
  hint.textContent = `Geselecteerd: ${fmtDateNL(iso)} · ${items.length} item(s)`;

  list.innerHTML = "";
  if(items.length === 0){
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "Geen items op deze dag.";
    list.appendChild(empty);
    return;
  }

  for(const a of items){
    const wrap = document.createElement("div");
    wrap.className = "dayitem";
    const time = (a.timeStart || a.timeEnd) ? `${a.timeStart||""}${a.timeStart && a.timeEnd ? "–":""}${a.timeEnd||""}` : "—";
    const badgeKind =
      a.kind === "Installatie" ? `<span class="badge badge--install">Installatie</span>` :
      a.kind === "Verlof" ? `<span class="badge badge--leave">Verlof</span>` :
      `<span class="badge badge--ticket">Ticket</span>`;

    const badgePlan = a.kind === "Verlof" ? "" : (a.isDefinitive ? `<span class="badge badge--fixed">Definitief</span>` : `<span class="badge badge--temp">Tijdelijk</span>`);

    wrap.innerHTML = `
      <div class="dayitem__top">
        <div class="dayitem__title">${escapeHtml(a.title || a.kind)}</div>
        <div class="row">
          ${badgeKind}
          ${badgePlan}
        </div>
      </div>
      <div class="dayitem__meta">
        <b>${escapeHtml(time)}</b> · ${escapeHtml(a.assignee || "Iedereen")}
        ${a.customer ? ` · ${escapeHtml(a.customer)}` : ``}
        ${a.orderNo ? ` · #${escapeHtml(a.orderNo)}` : ``}
      </div>
      ${a.note ? `<div class="meta" style="margin-top:8px">${escapeHtml(a.note)}</div>` : ``}
    `;

    wrap.onclick = ()=> openAgendaModal(a.id);
    list.appendChild(wrap);
  }
}

/* ------------------ AGENDA MODAL ------------------ */

function openAgendaModal(agendaId=null){
  const isNew = !agendaId;
  const a = isNew
    ? {
        id: uid("a"),
        kind: "Installatie",
        title: "",
        customer: "",
        orderNo: "",
        assignee: "Iedereen",
        dateStart: state.ui.selectedDay || todayISO(),
        dateEnd: state.ui.selectedDay || todayISO(),
        timeStart: "",
        timeEnd: "",
        isDefinitive: false,
        note: "",
        linkedTicketId: null,
        createdAt: new Date().toISOString(),
      }
    : state.agenda.find(x=>x.id===agendaId);

  if(!a) return;

  const locked = !!a.linkedTicketId; // ticket-linked: edit via ticket
  const title = locked ? "Agenda-item (ticket-linked)" : (isNew ? "Agenda-item toevoegen" : "Agenda-item wijzigen");

  openModal({
    title,
    subtitle: locked ? "Wijzig planning via het gekoppelde ticket" : "Installaties of verlof zichtbaar voor iedereen",
    bodyHTML: `
      <div class="form-grid">
        <div class="field">
          <label>Soort</label>
          <select id="a_kind" ${locked ? "disabled":""}>
            <option value="Installatie" ${a.kind==="Installatie"?"selected":""}>Installatie</option>
            <option value="Verlof" ${a.kind==="Verlof"?"selected":""}>Verlof</option>
          </select>
        </div>

        <div class="field">
          <label>Definitief?</label>
          <select id="a_def" ${locked ? "disabled":""}>
            <option value="0" ${!a.isDefinitive?"selected":""}>Tijdelijk</option>
            <option value="1" ${a.isDefinitive?"selected":""}>Definitief</option>
          </select>
        </div>

        <div class="field field--full">
          <label>Titel</label>
          <input id="a_title" type="text" value="${escapeAttr(a.title||"")}" ${locked ? "disabled":""} placeholder="bijv. Installatie UV330" />
        </div>

        <div class="field">
          <label>Klantnaam</label>
          <input id="a_customer" type="text" value="${escapeAttr(a.customer||"")}" ${locked ? "disabled":""} placeholder="bijv. KLM" />
        </div>

        <div class="field">
          <label>Ordernummer</label>
          <input id="a_orderNo" type="text" value="${escapeAttr(a.orderNo||"")}" ${locked ? "disabled":""} placeholder="bijv. 12345" />
        </div>

        <div class="field">
          <label>Monteur / medewerker</label>
          <select id="a_assignee" ${locked ? "disabled":""}>
            ${ASSIGNEES.map(x=>`<option value="${escapeAttr(x)}" ${x===a.assignee?"selected":""}>${escapeHtml(x)}</option>`).join("")}
          </select>
        </div>

        <div class="field">
          <label>Start datum</label>
          <input id="a_start" type="date" value="${escapeAttr(a.dateStart)}" ${locked ? "disabled":""} />
        </div>

        <div class="field">
          <label>Eind datum</label>
          <input id="a_end" type="date" value="${escapeAttr(a.dateEnd)}" ${locked ? "disabled":""} />
        </div>

        <div class="field">
          <label>Start tijd</label>
          <input id="a_tstart" type="time" value="${escapeAttr(a.timeStart||"")}" ${locked ? "disabled":""} />
        </div>

        <div class="field">
          <label>Eind tijd</label>
          <input id="a_tend" type="time" value="${escapeAttr(a.timeEnd||"")}" ${locked ? "disabled":""} />
        </div>

        <div class="field field--full">
          <label>Notities</label>
          <textarea id="a_note" rows="6" ${locked ? "disabled":""} placeholder="details, adres, contact, bijzonderheden...">${escapeHtml(a.note||"")}</textarea>
        </div>

        ${locked ? `
          <div class="field field--full">
            <label>Gekoppeld ticket</label>
            <div class="muted">Ticket ID: <b>${escapeHtml(a.linkedTicketId)}</b> · open het ticket om planning te wijzigen.</div>
          </div>
        ` : ``}
      </div>
    `,
    footHTML: `
      ${locked ? `<button class="btn btn--ghost" id="btnOpenLinked">Open ticket</button>` : (isNew ? `` : `<button class="btn btn--ghost" id="btnDeleteAgenda">Verwijderen</button>`)}
      <button class="btn btn--primary" id="btnSaveAgenda">${locked ? "Sluiten" : "Opslaan"}</button>
    `,
    onMount: ()=>{
      if(locked){
        $("#btnSaveAgenda").onclick = ()=> closeModal();
        $("#btnOpenLinked").onclick = ()=>{
          closeModal();
          setView("tickets");
          openTicketModal(a.linkedTicketId);
        };
        return;
      }

      $("#btnSaveAgenda").onclick = ()=>{
        const kind = $("#a_kind").value;
        const payload = {
          kind,
          isDefinitive: $("#a_def").value === "1",
          title: $("#a_title").value.trim() || (kind === "Verlof" ? "Verlof" : "Installatie"),
          customer: $("#a_customer").value.trim(),
          orderNo: $("#a_orderNo").value.trim(),
          assignee: $("#a_assignee").value,
          dateStart: $("#a_start").value || todayISO(),
          dateEnd: $("#a_end").value || ($("#a_start").value || todayISO()),
          timeStart: $("#a_tstart").value,
          timeEnd: $("#a_tend").value,
          note: $("#a_note").value,
        };

        // validate date order
        const aS = parseISO(payload.dateStart).getTime();
        const aE = parseISO(payload.dateEnd).getTime();
        if(aE < aS){
          payload.dateEnd = payload.dateStart;
          toast("Einddatum aangepast (was vóór startdatum).");
        }

        if(isNew){
          state.agenda.unshift({ ...a, ...payload });
        } else {
          Object.assign(a, payload);
        }

        saveState();
        closeModal();
        renderAll();
        toast("Agenda opgeslagen");
      };

      if(!isNew){
        $("#btnDeleteAgenda").onclick = ()=>{
          if(!confirm("Agenda-item verwijderen?")) return;
          state.agenda = state.agenda.filter(x=>x.id!==a.id);
          saveState();
          closeModal();
          renderAll();
          toast("Agenda-item verwijderd");
        };
      }
    }
  });
}

/* ------------------ PLANNING & WORKLOAD ------------------ */

function renderPlanning(){
  // workload bars
  const w = {};
  for(const a of ASSIGNEES.filter(x => x !== "Iedereen")) w[a] = 0;

  for(const t of state.tickets){
    if(t.status === "Planning" || t.status === "In uitvoering"){
      const who = t.assignee || "Iedereen";
      if(w[who] != null) w[who] += Number(t.estimatedHours || 0);
    }
  }
  const maxW = Math.max(1, ...Object.values(w));
  const wBars2 = $("#workloadBars2");
  wBars2.innerHTML = "";
  Object.entries(w).forEach(([name, val])=>{
    wBars2.appendChild(barRow(name, val, maxW, "u"));
  });

  // planning queue
  const queue = $("#planningQueue");
  queue.innerHTML = "";
  const list = state.tickets.filter(t => t.status === "Planning");
  if(list.length === 0){
    const m = document.createElement("div");
    m.className = "muted";
    m.textContent = "Geen tickets in status Planning.";
    queue.appendChild(m);
    return;
  }

  for(const t of list){
    const q = document.createElement("div");
    q.className = "queueItem";
    q.innerHTML = `
      <div class="queueItem__title">${escapeHtml(t.customer || "Klant")} · ${escapeHtml(t.title)}</div>
      <div class="queueItem__meta">
        #${escapeHtml(t.orderNo||"—")} · ${escapeHtml(t.assignee||"Iedereen")} · ${Number(t.estimatedHours||0)}u
        ${t.planningStart ? ` · ${fmtDateNL(t.planningStart)} → ${fmtDateNL(t.planningEnd||t.planningStart)}` : ``}
      </div>
    `;
    q.onclick = ()=> openTicketModal(t.id);
    queue.appendChild(q);
  }
}

/* ------------------ INTAKE ------------------ */

function createFromIntake(){
  const customer = $("#inCustomer").value.trim();
  const orderNo = $("#inOrder").value.trim();
  const type = $("#inType").value;
  const priority = $("#inPriority").value;
  const title = $("#inTitle").value.trim() || "Nieuwe intake";
  const note = $("#inNotes").value;
  const start = $("#inStart").value;
  const end = $("#inEnd").value;

  const t = newTicket({
    title,
    customer,
    orderNo,
    type,
    priority,
    status: "Intake",
    assignee: "binnendienst@dormatec.eu",
    note,
    planningStart: start || "",
    planningEnd: end || (start || ""),
    planningTech: "Iedereen",
    planningIsDefinitive: false,
  });

  toast("Intake ticket aangemaakt");
  // go to tickets and open it
  setView("tickets");
  openTicketModal(t.id);
}

/* ------------------ HELPERS ------------------ */

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}
function escapeAttr(s){ return escapeHtml(s).replaceAll("\n"," "); }

/* ------------------ EVENTS ------------------ */

function initEvents(){
  // buttons
  $("#btnNewTicket").onclick = ()=> {
    const t = newTicket({ title: "Nieuw ticket", status: "Nieuw" });
    openTicketModal(t.id);
  };
  $("#btnNewTicketDash").onclick = ()=> {
    const t = newTicket({ title: "Nieuw ticket", status: "Nieuw" });
    setView("tickets");
    openTicketModal(t.id);
  };

  $("#btnAddAgenda").onclick = ()=> openAgendaModal(null);

  $("#calPrev").onclick = ()=>{
    const [y,m] = state.ui.calMonth.split("-").map(Number);
    const d = new Date(y, m-2, 1);
    state.ui.calMonth = d.toISOString().slice(0,7);
    saveState();
    renderAgenda();
  };
  $("#calNext").onclick = ()=>{
    const [y,m] = state.ui.calMonth.split("-").map(Number);
    const d = new Date(y, m, 1);
    state.ui.calMonth = d.toISOString().slice(0,7);
    saveState();
    renderAgenda();
  };

  $("#btnFocusPlanning").onclick = ()=>{
    setView("tickets");
    // set filter to show planning only
    $("#qSearch").value = "";
    $("#qAssignee").value = "";
    $("#qPriority").value = "";
    $("#qType").value = "";
    renderKanban();
    toast("Ga naar kolom Planning");
  };

  $("#btnCreateFromIntake").onclick = createFromIntake;

  // filters change -> rerender
  ["#qSearch","#qAssignee","#qPriority","#qType"].forEach(sel=>{
    $(sel).addEventListener("input", ()=> renderKanban());
    $(sel).addEventListener("change", ()=> renderKanban());
  });

  // Export / Reset
  $("#btnExport").onclick = ()=>{
    const data = JSON.stringify(state, null, 2);
    navigator.clipboard.writeText(data).then(()=>{
      toast("Export gekopieerd naar clipboard");
    }).catch(()=>{
      toast("Export niet gelukt (clipboard)");
    });
  };

  $("#btnReset").onclick = ()=>{
    if(!confirm("Reset demo data? Dit overschrijft de opgeslagen state.")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = loadState();
    saveState();
    renderAll();
    toast("Demo gereset");
  };
}

/* ------------------ RENDER ALL ------------------ */

function renderAll(){
  // keep state synced
  state = normalizeAndSync(state);
  saveState();

  // update assignee filter options once
  renderTicketFilters();

  // set current view
  const v = state.ui.view || "dashboard";
  $$(".view").forEach(x=>x.classList.add("is-hidden"));
  $(`#view-${v}`).classList.remove("is-hidden");
  $$(".nav__item").forEach(b => b.classList.toggle("is-active", b.dataset.view === v));

  // render per view
  renderDashboard();
  renderKanban();
  renderAgenda();
  renderPlanning();
}

/* ------------------ BOOT ------------------ */

function boot(){
  initNav();
  initEvents();

  // Default calendar month to current month
  if(!state.ui.calMonth) state.ui.calMonth = new Date().toISOString().slice(0,7);
  if(!state.ui.selectedDay) state.ui.selectedDay = todayISO();

  // Ensure state synced and render
  state = normalizeAndSync(state);
  saveState();

  // set view
  setView(state.ui.view || "dashboard");
}

boot();
