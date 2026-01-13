import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================
   Firebase
========================= */
const firebaseConfig = {
  apiKey: "AIzaSyCOvBIrruUuuTrtF2sJP0CatLnhL1Y0jLQ",
  authDomain: "dormatec-app.firebaseapp.com",
  projectId: "dormatec-app",
  storageBucket: "dormatec-app.firebasestorage.app",
  messagingSenderId: "791495820876",
  appId: "1:791495820876:web:f3422d796717873624d6e9",
  measurementId: "G-E0SK14PML5"
};

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);

/* =========================
   Status flow (jouw flow)
========================= */
const STATUSES = [
  { key: "new", label: "Nieuw" },
  { key: "intake", label: "Intake" },
  { key: "prep", label: "Werkvoorbereiding" },
  { key: "planning", label: "Planning" },
  { key: "doing", label: "In uitvoering" },
  { key: "processing", label: "Gereed verwerking" },
  { key: "closing", label: "Afronding" }
];

/* =========================
   UI references
========================= */
const loginCard = document.getElementById("loginCard");
const appCard = document.getElementById("appCard");

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginError = document.getElementById("loginError");

const userInfo = document.getElementById("userInfo");
const logoutBtn = document.getElementById("logoutBtn");

/* Sidebar navigation */
const navButtons = Array.from(document.querySelectorAll(".nav-btn"));
const viewDashboard = document.getElementById("viewDashboard");
const viewTickets = document.getElementById("viewTickets");
const viewPlanning = document.getElementById("viewPlanning");
const viewIntake = document.getElementById("viewIntake");

/* Tickets view */
const newTicketBtn = document.getElementById("newTicketBtn");
const toggleViewBtn = document.getElementById("toggleViewBtn");
const searchInput = document.getElementById("searchInput");
const assigneeFilter = document.getElementById("assigneeFilter");
const priorityFilter = document.getElementById("priorityFilter");
const typeFilter = document.getElementById("typeFilter");

const kanbanWrap = document.getElementById("kanbanWrap");
const listWrap = document.getElementById("listWrap");
const listRows = document.getElementById("listRows");

/* Dashboard */
const kpiOpen = document.getElementById("kpiOpen");
const kpiOpenSub = document.getElementById("kpiOpenSub");
const kpiDoing = document.getElementById("kpiDoing");
const kpiPlanning = document.getElementById("kpiPlanning");
const kpiDoneWeek = document.getElementById("kpiDoneWeek");
const statusBars = document.getElementById("statusBars");
const loadBars = document.getElementById("loadBars");

/* Planning view */
const loadBarsPlanning = document.getElementById("loadBarsPlanning");
const planningQueue = document.getElementById("planningQueue");

/* Intake */
const intakeForm = document.getElementById("intakeForm");
const intakeCreateBtn = document.getElementById("intakeCreateBtn");
const inOrderNo = document.getElementById("inOrderNo");
const inCustomer = document.getElementById("inCustomer");
const inTitle = document.getElementById("inTitle");
const inType = document.getElementById("inType");
const inPriority = document.getElementById("inPriority");
const inHours = document.getElementById("inHours");
const inDesc = document.getElementById("inDesc");
const inLinkName = document.getElementById("inLinkName");
const inLinkUrl = document.getElementById("inLinkUrl");
const inAddLinkBtn = document.getElementById("inAddLinkBtn");
const inClearLinksBtn = document.getElementById("inClearLinksBtn");
const inLinksPreview = document.getElementById("inLinksPreview");
const intakeError = document.getElementById("intakeError");
const intakeOk = document.getElementById("intakeOk");

/* Ticket modal */
const modalBackdrop = document.getElementById("modalBackdrop");
const ticketModal = document.getElementById("ticketModal");
const ticketModalTitle = document.getElementById("ticketModalTitle");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelModalBtn = document.getElementById("cancelModalBtn");
const deleteTicketBtn = document.getElementById("deleteTicketBtn");

const ticketForm = document.getElementById("ticketForm");
const tTitle = document.getElementById("tTitle");
const tStatus = document.getElementById("tStatus");
const tCustomer = document.getElementById("tCustomer");
const tOrder = document.getElementById("tOrder");
const tType = document.getElementById("tType");
const tPriority = document.getElementById("tPriority");
const tAssignee = document.getElementById("tAssignee");
const tHours = document.getElementById("tHours");
const tDesc = document.getElementById("tDesc");
const tInternal = document.getElementById("tInternal");
const tLinkName = document.getElementById("tLinkName");
const tLinkUrl = document.getElementById("tLinkUrl");
const tAddLinkBtn = document.getElementById("tAddLinkBtn");
const tClearLinksBtn = document.getElementById("tClearLinksBtn");
const tLinksPreview = document.getElementById("tLinksPreview");
const ticketError = document.getElementById("ticketError");

/* =========================
   State
========================= */
let currentUserId = null;
let currentUserEmail = null;

let tickets = [];
let unsubTickets = null;

let draftIntakeLinks = [];
let draftTicketLinks = [];

let editingTicketId = null;

let listMode = false; // false=kanban, true=list

/* Filters */
let fSearch = "";
let fAssignee = "__all__";
let fPriority = "__all__";
let fType = "__all__";

/* =========================
   Helpers
========================= */
function normalizeEmail(x){ return (x || "").trim().toLowerCase(); }
function safeUrl(url){
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch { return null; }
}
function numOr0(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function startOfWeek(d){
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // monday=0
  x.setDate(x.getDate() - day);
  x.setHours(0,0,0,0);
  return x;
}
function isSameWeek(a, b){
  return startOfWeek(a).getTime() === startOfWeek(b).getTime();
}
function statusLabel(key){
  return STATUSES.find(s => s.key === key)?.label || key;
}
function prioLabel(p){
  if (p === "urgent") return "Spoed";
  if (p === "high") return "Hoog";
  return "Normaal";
}

/* =========================
   Navigation
========================= */
function setView(viewKey){
  navButtons.forEach(b => b.classList.toggle("active", b.dataset.view === viewKey));
  viewDashboard.classList.toggle("hidden", viewKey !== "dashboard");
  viewTickets.classList.toggle("hidden", viewKey !== "tickets");
  viewPlanning.classList.toggle("hidden", viewKey !== "planning");
  viewIntake.classList.toggle("hidden", viewKey !== "intake");
}
navButtons.forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.view)));

/* =========================
   Auth
========================= */
function showLoggedOut(){
  loginCard.classList.remove("hidden");
  appCard.classList.add("hidden");

  userInfo.textContent = "Niet ingelogd";
  loginError.textContent = "";

  if (unsubTickets) { unsubTickets(); unsubTickets = null; }

  tickets = [];
  renderAll();
}

function showLoggedIn(user){
  loginCard.classList.add("hidden");
  appCard.classList.remove("hidden");

  currentUserId = user.uid;
  currentUserEmail = user.email || "";
  userInfo.textContent = `Ingelogd: ${currentUserEmail}`;

  setView("dashboard");
  listenTickets();
}

onAuthStateChanged(auth, (user) => {
  if (!user) showLoggedOut();
  else showLoggedIn(user);
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  try {
    await signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
    passwordInput.value = "";
  } catch {
    loginError.textContent = "Inloggen mislukt. Controleer e-mail en wachtwoord.";
  }
});

logoutBtn.addEventListener("click", async () => { await signOut(auth); });

/* =========================
   Firestore: Tickets live
========================= */
function listenTickets(){
  if (unsubTickets) unsubTickets();

  const q = query(collection(db, "tickets"), orderBy("createdAt", "desc"));
  unsubTickets = onSnapshot(q, (snap) => {
    tickets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    refreshAssigneeFilter();
    renderAll();
  });
}

/* =========================
   Filtering
========================= */
function matchesFilters(t){
  const s = (fSearch || "").trim().toLowerCase();
  if (s) {
    const hay = [
      t.title, t.customerName, t.orderNo, t.description
    ].join(" ").toLowerCase();
    if (!hay.includes(s)) return false;
  }

  if (fAssignee !== "__all__") {
    if (normalizeEmail(t.assigneeEmail) !== normalizeEmail(fAssignee)) return false;
  }
  if (fPriority !== "__all__") {
    if ((t.priority || "normal") !== fPriority) return false;
  }
  if (fType !== "__all__") {
    if ((t.type || "other") !== fType) return false;
  }
  return true;
}

searchInput.addEventListener("input", () => { fSearch = searchInput.value; renderTicketsViews(); });
assigneeFilter.addEventListener("change", () => { fAssignee = assigneeFilter.value; renderTicketsViews(); });
priorityFilter.addEventListener("change", () => { fPriority = priorityFilter.value; renderTicketsViews(); });
typeFilter.addEventListener("change", () => { fType = typeFilter.value; renderTicketsViews(); });

function refreshAssigneeFilter(){
  const set = new Set();
  for (const t of tickets) {
    const a = normalizeEmail(t.assigneeEmail);
    if (a) set.add(a);
  }
  const list = Array.from(set).sort();
  const current = assigneeFilter.value || "__all__";

  assigneeFilter.innerHTML = `<option value="__all__">Iedereen</option>`;
  for (const a of list) {
    const opt = document.createElement("option");
    opt.value = a;
    opt.textContent = a;
    assigneeFilter.appendChild(opt);
  }
  assigneeFilter.value = list.includes(current) ? current : "__all__";
  fAssignee = assigneeFilter.value;
}

/* =========================
   Dashboard + Planning
========================= */
function renderKPIs(){
  const now = new Date();
  const open = tickets.filter(t => !["closing"].includes(t.status));
  const doing = tickets.filter(t => t.status === "doing");
  const planning = tickets.filter(t => t.status === "planning");
  const doneWeek = tickets.filter(t => t.status === "closing" && t.updatedAt?.toDate && isSameWeek(t.updatedAt.toDate(), now));

  kpiOpen.textContent = String(open.length);
  kpiOpenSub.textContent = `Totaal tickets: ${tickets.length}`;
  kpiDoing.textContent = String(doing.length);
  kpiPlanning.textContent = String(planning.length);
  kpiDoneWeek.textContent = String(doneWeek.length);
}

function renderStatusBars(){
  const counts = {};
  for (const s of STATUSES) counts[s.key] = 0;
  for (const t of tickets) counts[t.status || "new"] = (counts[t.status || "new"] || 0) + 1;

  const max = Math.max(1, ...Object.values(counts));
  statusBars.innerHTML = "";
  for (const s of STATUSES) {
    const c = counts[s.key] || 0;
    statusBars.appendChild(makeBar(`${s.label}`, c, max));
  }
}

function computeLoadByAssignee(){
  const load = new Map();
  const relevant = tickets.filter(t => t.status === "planning" || t.status === "doing");
  for (const t of relevant) {
    const a = normalizeEmail(t.assigneeEmail) || "unassigned";
    const h = numOr0(t.estimatedHours);
    load.set(a, (load.get(a) || 0) + h);
  }
  return load;
}

function renderLoadBars(targetEl){
  const load = computeLoadByAssignee();
  const entries = Array.from(load.entries()).sort((a,b) => b[1]-a[1]);
  const max = Math.max(1, ...entries.map(e => e[1]));

  targetEl.innerHTML = "";
  if (!entries.length) {
    targetEl.innerHTML = `<div class="hint">Nog geen uren gepland (status Planning/In uitvoering).</div>`;
    return;
  }

  for (const [a, h] of entries) {
    const label = a === "unassigned" ? "Niet toegewezen" : a;
    targetEl.appendChild(makeBar(label, h, max, true));
  }
}

function renderPlanningQueue(){
  const queue = tickets
    .filter(t => t.status === "planning")
    .sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  planningQueue.innerHTML = "";
  if (!queue.length) {
    planningQueue.innerHTML = `<li class="queue-item hint">Geen tickets in status Planning.</li>`;
    return;
  }

  for (const t of queue.slice(0, 20)) {
    const li = document.createElement("li");
    li.className = "queue-item";
    li.innerHTML = `
      <div style="font-weight:950; font-size:13px;">${escapeHtml(t.title || "—")}</div>
      <div class="hint" style="margin-top:6px;">
        ${escapeHtml(t.customerName || "—")} • ${escapeHtml(t.orderNo || "—")} • Assignee: ${escapeHtml(t.assigneeEmail || "—")} • Uren: ${numOr0(t.estimatedHours)}
      </div>
    `;
    li.addEventListener("click", () => openTicketModal(t.id));
    planningQueue.appendChild(li);
  }
}

/* Bar UI helper */
function makeBar(label, value, max, hours=false){
  const row = document.createElement("div");
  row.className = "bar";

  const l = document.createElement("div");
  l.className = "label";
  l.textContent = label;

  const track = document.createElement("div");
  track.className = "track";

  const fill = document.createElement("div");
  fill.className = "fill";
  fill.style.width = `${Math.round((value / max) * 100)}%`;

  track.appendChild(fill);

  const v = document.createElement("div");
  v.className = "value";
  v.textContent = hours ? `${value.toFixed(1)}u` : String(value);

  row.appendChild(l);
  row.appendChild(track);
  row.appendChild(v);
  return row;
}

/* =========================
   Tickets: Kanban + List
========================= */
toggleViewBtn.addEventListener("click", () => {
  listMode = !listMode;
  toggleViewBtn.textContent = listMode ? "Switch: List" : "Switch: Kanban";
  kanbanWrap.classList.toggle("hidden", listMode);
  listWrap.classList.toggle("hidden", !listMode);
  renderTicketsViews();
});

newTicketBtn.addEventListener("click", () => openTicketModal(null));

function renderKanban(){
  kanbanWrap.innerHTML = "";

  const filtered = tickets.filter(matchesFilters);

  for (const col of STATUSES) {
    const column = document.createElement("section");
    column.className = "column glass-soft";
    column.dataset.status = col.key;

    const inCol = filtered.filter(t => (t.status || "new") === col.key);

    const head = document.createElement("div");
    head.className = "column-head";

    const title = document.createElement("div");
    title.className = "column-title";
    title.textContent = col.label;

    const count = document.createElement("div");
    count.className = "column-count";
    count.textContent = String(inCol.length);

    head.appendChild(title);
    head.appendChild(count);

    const cards = document.createElement("div");
    cards.className = "cards";

    // Drop target
    column.addEventListener("dragover", (e) => { e.preventDefault(); });
    column.addEventListener("drop", async (e) => {
      e.preventDefault();
      const ticketId = e.dataTransfer.getData("text/plain");
      if (!ticketId) return;
      await updateDoc(doc(db, "tickets", ticketId), {
        status: col.key,
        updatedAt: serverTimestamp()
      });
    });

    for (const t of inCol) {
      const card = document.createElement("div");
      card.className = "card";
      card.draggable = true;

      card.addEventListener("dragstart", (e) => {
        card.classList.add("dragging");
        e.dataTransfer.setData("text/plain", t.id);
      });
      card.addEventListener("dragend", () => card.classList.remove("dragging"));

      card.addEventListener("click", () => openTicketModal(t.id));

      const top = document.createElement("div");
      top.className = "card-top";

      const tt = document.createElement("div");
      tt.className = "card-title";
      tt.textContent = t.title || "—";

      const badges = document.createElement("div");
      badges.className = "badges";

      const b1 = document.createElement("span");
      b1.className = `badge prio-${t.priority || "normal"}`;
      b1.textContent = prioLabel(t.priority || "normal");
      badges.appendChild(b1);

      top.appendChild(tt);
      top.appendChild(badges);

      const meta = document.createElement("div");
      meta.className = "card-meta";

      const pCust = document.createElement("span");
      pCust.className = "pill";
      pCust.textContent = t.customerName ? t.customerName : "—";
      meta.appendChild(pCust);

      if (t.orderNo) {
        const pOrd = document.createElement("span");
        pOrd.className = "pill";
        pOrd.textContent = t.orderNo;
        meta.appendChild(pOrd);
      }

      const pAs = document.createElement("span");
      pAs.className = "pill assignee";
      pAs.textContent = t.assigneeEmail ? t.assigneeEmail : "Niet toegewezen";
      meta.appendChild(pAs);

      if (numOr0(t.estimatedHours) > 0) {
        const pHr = document.createElement("span");
        pHr.className = "pill";
        pHr.textContent = `${numOr0(t.estimatedHours).toFixed(1)}u`;
        meta.appendChild(pHr);
      }

      card.appendChild(top);
      card.appendChild(meta);
      cards.appendChild(card);
    }

    column.appendChild(head);
    column.appendChild(cards);
    kanbanWrap.appendChild(column);
  }
}

function renderList(){
  const filtered = tickets.filter(matchesFilters);
  listRows.innerHTML = "";

  for (const t of filtered) {
    const row = document.createElement("div");
    row.className = "row";

    row.innerHTML = `
      <div style="font-weight:950;">${escapeHtml(t.title || "—")}</div>
      <div>${escapeHtml(t.customerName || "—")}</div>
      <div>${escapeHtml(t.orderNo || "—")}</div>
      <div>${escapeHtml(statusLabel(t.status || "new"))}</div>
      <div>${escapeHtml(t.assigneeEmail || "—")}</div>
      <div>${escapeHtml(prioLabel(t.priority || "normal"))}</div>
      <div>${numOr0(t.estimatedHours).toFixed(1)}</div>
      <div><button class="btn btn-ghost" type="button">Open</button></div>
    `;

    row.querySelector("button").addEventListener("click", () => openTicketModal(t.id));
    listRows.appendChild(row);
  }
}

function renderTicketsViews(){
  if (listMode) renderList();
  else renderKanban();
}

/* =========================
   Ticket Modal (create/edit)
========================= */
function openModal(){
  modalBackdrop.classList.remove("hidden");
  ticketModal.classList.remove("hidden");
}
function closeModal(){
  modalBackdrop.classList.add("hidden");
  ticketModal.classList.add("hidden");

  ticketError.textContent = "";
  ticketForm.reset();

  editingTicketId = null;
  draftTicketLinks = [];
  renderTicketLinks();
}

closeModalBtn.addEventListener("click", closeModal);
cancelModalBtn.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", closeModal);

function fillStatusSelect(){
  tStatus.innerHTML = "";
  for (const s of STATUSES) {
    const opt = document.createElement("option");
    opt.value = s.key;
    opt.textContent = s.label;
    tStatus.appendChild(opt);
  }
}
fillStatusSelect();

function renderTicketLinks(){
  tLinksPreview.innerHTML = "";
  if (!draftTicketLinks.length) {
    tLinksPreview.innerHTML = `<div class="hint">Nog geen links toegevoegd.</div>`;
    return;
  }

  for (let i=0; i<draftTicketLinks.length; i++) {
    const a = draftTicketLinks[i];
    const row = document.createElement("div");
    row.className = "attachment";

    const link = document.createElement("a");
    link.href = a.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = a.name || "Bijlage";

    const del = document.createElement("button");
    del.className = "btn btn-ghost";
    del.type = "button";
    del.textContent = "Verwijder";
    del.addEventListener("click", () => {
      draftTicketLinks.splice(i, 1);
      renderTicketLinks();
    });

    row.appendChild(link);
    row.appendChild(del);
    tLinksPreview.appendChild(row);
  }
}

tAddLinkBtn.addEventListener("click", () => {
  ticketError.textContent = "";
  const name = (tLinkName.value || "").trim() || "Bijlage";
  const url = safeUrl((tLinkUrl.value || "").trim());
  if (!url) { ticketError.textContent = "Vul een geldige link in (https://...)."; return; }
  draftTicketLinks.push({ name, url });
  tLinkName.value = "";
  tLinkUrl.value = "";
  renderTicketLinks();
});

tClearLinksBtn.addEventListener("click", () => {
  draftTicketLinks = [];
  renderTicketLinks();
});

async function openTicketModal(ticketIdOrNull){
  ticketError.textContent = "";
  fillStatusSelect();

  if (!ticketIdOrNull) {
    editingTicketId = null;
    ticketModalTitle.textContent = "Nieuw ticket";
    deleteTicketBtn.classList.add("hidden");

    tStatus.value = "new";
    tPriority.value = "normal";
    tType.value = "project";
    tHours.value = "";
    tAssignee.value = "";
    tCustomer.value = "";
    tOrder.value = "";
    tInternal.value = "";
    draftTicketLinks = [];
    renderTicketLinks();

    openModal();
    return;
  }

  const t = tickets.find(x => x.id === ticketIdOrNull);
  if (!t) return;

  editingTicketId = t.id;
  ticketModalTitle.textContent = `Ticket wijzigen`;
  deleteTicketBtn.classList.remove("hidden");

  tTitle.value = t.title || "";
  tStatus.value = t.status || "new";
  tCustomer.value = t.customerName || "";
  tOrder.value = t.orderNo || "";
  tType.value = t.type || "project";
  tPriority.value = t.priority || "normal";
  tAssignee.value = t.assigneeEmail || "";
  tHours.value = (t.estimatedHours ?? "") === 0 ? "0" : (t.estimatedHours ?? "");
  tDesc.value = t.description || "";
  tInternal.value = t.internalNotes || "";
  draftTicketLinks = Array.isArray(t.attachments) ? t.attachments.slice() : [];
  renderTicketLinks();

  openModal();
}

ticketForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  ticketError.textContent = "";

  const payload = {
    title: tTitle.value.trim(),
    status: tStatus.value,
    customerName: tCustomer.value.trim(),
    orderNo: tOrder.value.trim(),
    type: tType.value,
    priority: tPriority.value,
    assigneeEmail: tAssignee.value.trim(),
    estimatedHours: numOr0(tHours.value),
    description: tDesc.value.trim(),
    internalNotes: tInternal.value.trim(),
    attachments: draftTicketLinks.slice(),
    updatedAt: serverTimestamp()
  };

  if (!payload.title || !payload.description) {
    ticketError.textContent = "Titel en omschrijving zijn verplicht.";
    return;
  }

  if (editingTicketId) {
    await updateDoc(doc(db, "tickets", editingTicketId), payload);
  } else {
    await addDoc(collection(db, "tickets"), {
      ...payload,
      createdAt: serverTimestamp(),
      createdBy: currentUserId,
      createdByEmail: currentUserEmail
    });
  }
  closeModal();
});

deleteTicketBtn.addEventListener("click", async () => {
  if (!editingTicketId) return;
  await deleteDoc(doc(db, "tickets", editingTicketId));
  closeModal();
});

/* =========================
   Intake -> Ticket (Sales → Binnendienst)
========================= */
function renderIntakeLinks(){
  inLinksPreview.innerHTML = "";
  if (!draftIntakeLinks.length) {
    inLinksPreview.innerHTML = `<div class="hint">Nog geen links toegevoegd.</div>`;
    return;
  }

  for (let i=0; i<draftIntakeLinks.length; i++) {
    const a = draftIntakeLinks[i];
    const row = document.createElement("div");
    row.className = "attachment";

    const link = document.createElement("a");
    link.href = a.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = a.name || "Bijlage";

    const del = document.createElement("button");
    del.className = "btn btn-ghost";
    del.type = "button";
    del.textContent = "Verwijder";
    del.addEventListener("click", () => {
      draftIntakeLinks.splice(i, 1);
      renderIntakeLinks();
    });

    row.appendChild(link);
    row.appendChild(del);
    inLinksPreview.appendChild(row);
  }
}

inAddLinkBtn.addEventListener("click", () => {
  intakeError.textContent = "";
  const name = (inLinkName.value || "").trim() || "Bijlage";
  const url = safeUrl((inLinkUrl.value || "").trim());
  if (!url) { intakeError.textContent = "Vul een geldige link in (https://...)."; return; }
  draftIntakeLinks.push({ name, url });
  inLinkName.value = "";
  inLinkUrl.value = "";
  renderIntakeLinks();
});

inClearLinksBtn.addEventListener("click", () => {
  draftIntakeLinks = [];
  renderIntakeLinks();
});

intakeCreateBtn.addEventListener("click", async () => {
  intakeError.textContent = "";
  intakeOk.textContent = "";

  // minimal validation
  const orderNo = inOrderNo.value.trim();
  const customerName = inCustomer.value.trim();
  const title = inTitle.value.trim();
  const description = inDesc.value.trim();

  if (!orderNo || !customerName || !title || !description) {
    intakeError.textContent = "Ordernummer, klantnaam, titel en omschrijving zijn verplicht.";
    return;
  }

  const payload = {
    title,
    status: "intake",
    customerName,
    orderNo,
    type: inType.value,
    priority: inPriority.value,
    assigneeEmail: "",
    estimatedHours: numOr0(inHours.value),
    description,
    internalNotes: "",
    attachments: draftIntakeLinks.slice(),
    createdAt: serverTimestamp(),
    createdBy: currentUserId,
    createdByEmail: currentUserEmail,
    updatedAt: serverTimestamp()
  };

  await addDoc(collection(db, "tickets"), payload);

  intakeForm.reset();
  draftIntakeLinks = [];
  renderIntakeLinks();
  intakeOk.textContent = "Ticket aangemaakt (status: Intake).";
  setTimeout(() => (intakeOk.textContent = ""), 2500);
});

/* =========================
   Render all
========================= */
function renderAll(){
  renderKPIs();
  renderStatusBars();
  renderLoadBars(loadBars);
  renderTicketsViews();
  renderLoadBars(loadBarsPlanning);
  renderPlanningQueue();
}

/* Utilities */
function escapeHtml(str){
  return String(str || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* Init */
toggleViewBtn.textContent = "Switch: Kanban";
kanbanWrap.classList.toggle("hidden", listMode);
listWrap.classList.toggle("hidden", !listMode);
renderIntakeLinks();
renderTicketLinks();
