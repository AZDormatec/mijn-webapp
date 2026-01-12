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
  where,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================
   Firebase config (jouw project)
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
   UI refs
========================= */
const loginCard = document.getElementById("loginCard");
const appCard = document.getElementById("appCard");

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginError = document.getElementById("loginError");

const userInfo = document.getElementById("userInfo");
const logoutBtn = document.getElementById("logoutBtn");

// Tabs
const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const tabTasks = document.getElementById("tabTasks");
const tabAgenda = document.getElementById("tabAgenda");

// Tasks UI
const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const assigneeInput = document.getElementById("assigneeInput");
const assigneesList = document.getElementById("assigneesList");
const assigneeFilter = document.getElementById("assigneeFilter");

const taskList = document.getElementById("taskList");
const counter = document.getElementById("counter");
const clearDoneBtn = document.getElementById("clearDoneBtn");
const filterButtons = Array.from(document.querySelectorAll(".filter-btn"));

// Agenda UI
const monthTitle = document.getElementById("monthTitle");
const calendarGrid = document.getElementById("calendarGrid");
const prevMonthBtn = document.getElementById("prevMonthBtn");
const nextMonthBtn = document.getElementById("nextMonthBtn");
const addEventBtn = document.getElementById("addEventBtn");

// Modal UI
const modalBackdrop = document.getElementById("modalBackdrop");
const eventModal = document.getElementById("eventModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelModalBtn = document.getElementById("cancelModalBtn");
const modalTitle = document.getElementById("modalTitle");

const eventForm = document.getElementById("eventForm");
const eventType = document.getElementById("eventType");
const techInput = document.getElementById("techInput");
const orderWrap = document.getElementById("orderWrap");
const orderInput = document.getElementById("orderInput");
const startDate = document.getElementById("startDate");
const startTime = document.getElementById("startTime");
const endDate = document.getElementById("endDate");
const endTime = document.getElementById("endTime");
const statusSelect = document.getElementById("statusSelect");
const eventError = document.getElementById("eventError");

/* =========================
   State
========================= */
let currentUserId = null;

// Tasks (Firestore shared)
let allTasks = [];          // all tasks from Firestore
let taskStatusFilter = "all";
let taskAssigneeFilter = "__all__";
let unsubTasks = null;

// Agenda (Firestore shared)
let calendarMonth = new Date();
calendarMonth.setDate(1);
let monthEvents = [];
let unsubMonth = null;

/* =========================
   Helpers
========================= */
function pad2(n){ return String(n).padStart(2, "0"); }
function ymd(d){
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
function monthKey(d){
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
}
function parseLocalDateTime(dateStr, timeStr){
  const [y,m,da] = dateStr.split("-").map(Number);
  const [hh,mm] = timeStr.split(":").map(Number);
  return new Date(y, m-1, da, hh, mm, 0, 0);
}
function addDays(d, days){
  const x = new Date(d); x.setDate(x.getDate() + days); return x;
}

/* =========================
   Tabs
========================= */
function setTab(tabName){
  tabButtons.forEach(b => b.classList.toggle("active", b.dataset.tab === tabName));
  tabTasks.classList.toggle("hidden", tabName !== "tasks");
  tabAgenda.classList.toggle("hidden", tabName !== "agenda");
}
tabButtons.forEach(btn => btn.addEventListener("click", () => setTab(btn.dataset.tab)));

/* =========================
   AUTH
========================= */
function showLoggedOut(){
  loginCard.classList.remove("hidden");
  appCard.classList.add("hidden");
  loginError.textContent = "";
  userInfo.textContent = "Ingelogd";
  currentUserId = null;

  if (unsubTasks) { unsubTasks(); unsubTasks = null; }
  if (unsubMonth) { unsubMonth(); unsubMonth = null; }

  taskList.innerHTML = "";
  counter.textContent = "0 taken";
  calendarGrid.innerHTML = "";
}

function showLoggedIn(user){
  loginCard.classList.add("hidden");
  appCard.classList.remove("hidden");
  userInfo.textContent = `Ingelogd: ${user.email}`;
  currentUserId = user.uid;

  // default tab
  setTab("agenda");

  // Start listeners
  listenTasks();
  calendarMonth = new Date(); calendarMonth.setDate(1);
  listenMonth();
  renderCalendar();
}

onAuthStateChanged(auth, (user) => {
  if (!user) showLoggedOut();
  else showLoggedIn(user);
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    passwordInput.value = "";
  } catch {
    loginError.textContent = "Inloggen mislukt. Controleer e-mail en wachtwoord.";
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

/* =========================
   TASKS (shared via Firestore)
========================= */
function normalizeEmail(x){
  return (x || "").trim().toLowerCase();
}

function applyTaskFilters(tasks){
  let visible = tasks;

  if (taskStatusFilter === "open") visible = visible.filter(t => !t.done);
  if (taskStatusFilter === "done") visible = visible.filter(t => !!t.done);

  if (taskAssigneeFilter !== "__all__") {
    visible = visible.filter(t => normalizeEmail(t.assigneeEmail) === normalizeEmail(taskAssigneeFilter));
  }
  return visible;
}

function refreshAssigneeUI(){
  // Build unique assignees from allTasks
  const set = new Set();
  for (const t of allTasks) {
    const a = normalizeEmail(t.assigneeEmail);
    if (a) set.add(a);
  }
  const assignees = Array.from(set).sort();

  // datalist for quick entry
  assigneesList.innerHTML = "";
  for (const a of assignees) {
    const opt = document.createElement("option");
    opt.value = a;
    assigneesList.appendChild(opt);
  }

  // filter select
  const current = assigneeFilter.value || "__all__";
  assigneeFilter.innerHTML = `<option value="__all__">Iedereen</option>`;
  for (const a of assignees) {
    const opt = document.createElement("option");
    opt.value = a;
    opt.textContent = a;
    assigneeFilter.appendChild(opt);
  }
  // restore selection if possible
  assigneeFilter.value = assignees.includes(current) ? current : "__all__";
  taskAssigneeFilter = assigneeFilter.value;
}

function renderTasks(){
  const visible = applyTaskFilters(allTasks);

  taskList.innerHTML = "";
  for (const t of visible) {
    const li = document.createElement("li");
    li.className = "task" + (t.done ? " task-done" : "");

    const left = document.createElement("div");
    left.className = "task-left";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!t.done;
    checkbox.addEventListener("change", async () => {
      await updateDoc(doc(db, "tasks", t.id), { done: checkbox.checked });
    });

    const main = document.createElement("div");
    main.className = "task-main";

    const text = document.createElement("div");
    text.className = "task-text";
    text.textContent = t.text || "";

    const meta = document.createElement("div");
    meta.className = "task-meta";

    const assignee = normalizeEmail(t.assigneeEmail) ? t.assigneeEmail : "—";
    const pill = document.createElement("span");
    pill.className = "pill assignee";
    pill.textContent = `Toegewezen: ${assignee}`;

    const created = document.createElement("span");
    created.className = "pill";
    created.textContent = t.createdByEmail ? `Door: ${t.createdByEmail}` : "Door: —";

    meta.appendChild(pill);
    meta.appendChild(created);

    main.appendChild(text);
    main.appendChild(meta);

    left.appendChild(checkbox);
    left.appendChild(main);

    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-ghost";
    delBtn.type = "button";
    delBtn.textContent = "Verwijderen";
    delBtn.addEventListener("click", async () => {
      await deleteDoc(doc(db, "tasks", t.id));
    });

    li.appendChild(left);
    li.appendChild(delBtn);
    taskList.appendChild(li);
  }

  // Counter shows visible/total
  counter.textContent = `${visible.length} zichtbaar • ${allTasks.length} totaal`;
}

function listenTasks(){
  if (unsubTasks) unsubTasks();

  const col = collection(db, "tasks");
  const q = query(col, orderBy("createdAt", "desc"));

  unsubTasks = onSnapshot(q, (snap) => {
    allTasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    refreshAssigneeUI();
    renderTasks();
  });
}

filterButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    taskStatusFilter = btn.dataset.filter;
    filterButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderTasks();
  });
});

assigneeFilter.addEventListener("change", () => {
  taskAssigneeFilter = assigneeFilter.value;
  renderTasks();
});

taskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUserId) return;

  const text = taskInput.value.trim();
  if (!text) return;

  const assigneeEmail = assigneeInput.value.trim();

  // We pakken email uit het loginveld voor "createdByEmail" (makkelijk en bruikbaar)
  const createdByEmail = (userInfo.textContent || "").replace("Ingelogd: ", "").trim();

  await addDoc(collection(db, "tasks"), {
    text,
    done: false,
    assigneeEmail,
    createdBy: currentUserId,
    createdByEmail,
    createdAt: serverTimestamp()
  });

  taskInput.value = "";
  assigneeInput.value = "";
});

clearDoneBtn.addEventListener("click", async () => {
  // delete all done tasks (shared)
  // Let op: bij grote aantallen is dit zwaarder; voor nu prima.
  const q = query(collection(db, "tasks"), where("done", "==", true));
  const snap = await getDocs(q);
  const promises = snap.docs.map(d => deleteDoc(doc(db, "tasks", d.id)));
  await Promise.all(promises);
});

/* =========================
   MODAL (Agenda)
========================= */
function openModal(){
  modalBackdrop.classList.remove("hidden");
  eventModal.classList.remove("hidden");
}
function closeModal(){
  modalBackdrop.classList.add("hidden");
  eventModal.classList.add("hidden");
  eventError.textContent = "";
  eventForm.reset();
  eventType.value = "install";
  statusSelect.value = "temp";
  orderWrap.classList.remove("hidden");
}
function syncOrderVisibility(){
  if (eventType.value === "leave") {
    orderWrap.classList.add("hidden");
    orderInput.value = "";
  } else {
    orderWrap.classList.remove("hidden");
  }
}
eventType.addEventListener("change", syncOrderVisibility);

closeModalBtn.addEventListener("click", closeModal);
cancelModalBtn.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", closeModal);

addEventBtn.addEventListener("click", () => {
  modalTitle.textContent = "Planning toevoegen";
  const now = new Date();
  const today = ymd(now);
  startDate.value = today;
  endDate.value = today;
  startTime.value = "08:00";
  endTime.value = "17:00";
  eventType.value = "install";
  statusSelect.value = "temp";
  syncOrderVisibility();
  openModal();
});

/* =========================
   Firestore: Agenda
========================= */
function computeMonthKeys(start, end){
  const keys = new Set();
  const a = new Date(start); a.setDate(1); a.setHours(0,0,0,0);
  const b = new Date(end); b.setDate(1); b.setHours(0,0,0,0);

  let cur = new Date(a);
  while (cur <= b) {
    keys.add(monthKey(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return Array.from(keys);
}

function listenMonth(){
  if (!currentUserId) return;
  if (unsubMonth) unsubMonth();

  const mk = monthKey(calendarMonth);
  const col = collection(db, "scheduleEvents");
  const q = query(col, where("monthKeys", "array-contains", mk));

  unsubMonth = onSnapshot(q, (snap) => {
    monthEvents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCalendar();
  });
}

prevMonthBtn.addEventListener("click", () => {
  calendarMonth.setMonth(calendarMonth.getMonth() - 1);
  calendarMonth.setDate(1);
  listenMonth();
  renderCalendar();
});
nextMonthBtn.addEventListener("click", () => {
  calendarMonth.setMonth(calendarMonth.getMonth() + 1);
  calendarMonth.setDate(1);
  listenMonth();
  renderCalendar();
});

const MONTHS_NL = ["januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"];

function eventTouchesDay(ev, day){
  const start = ev.startTS?.toDate ? ev.startTS.toDate() : new Date(ev.startISO);
  const end = ev.endTS?.toDate ? ev.endTS.toDate() : new Date(ev.endISO);

  const dayStart = new Date(day); dayStart.setHours(0,0,0,0);
  const dayEnd = new Date(day); dayEnd.setHours(23,59,59,999);

  return (start <= dayEnd) && (end >= dayStart);
}

function formatTimeRange(ev){
  const start = ev.startTS?.toDate ? ev.startTS.toDate() : new Date(ev.startISO);
  const end = ev.endTS?.toDate ? ev.endTS.toDate() : new Date(ev.endISO);
  const s = `${pad2(start.getHours())}:${pad2(start.getMinutes())}`;
  const e = `${pad2(end.getHours())}:${pad2(end.getMinutes())}`;
  return `${s}–${e}`;
}

function renderCalendar(){
  monthTitle.textContent = `${MONTHS_NL[calendarMonth.getMonth()]} ${calendarMonth.getFullYear()}`;

  const first = new Date(calendarMonth);
  const dow = (first.getDay() + 6) % 7; // Mon=0..Sun=6
  const gridStart = addDays(first, -dow);

  const todayYmd = ymd(new Date());

  calendarGrid.innerHTML = "";
  for (let i=0; i<42; i++){
    const day = addDays(gridStart, i);
    const inMonth = day.getMonth() === calendarMonth.getMonth();

    const dayEl = document.createElement("div");
    dayEl.className = "day" + (inMonth ? "" : " muted-day") + (ymd(day) === todayYmd ? " today" : "");

    const head = document.createElement("div");
    head.className = "day-head";

    const num = document.createElement("div");
    num.className = "day-num";
    num.textContent = day.getDate();

    const chip = document.createElement("div");
    chip.className = "day-chip";
    chip.textContent = inMonth ? "" : " ";

    head.appendChild(num);
    head.appendChild(chip);

    const eventsWrap = document.createElement("div");
    eventsWrap.className = "events";

    const todays = monthEvents
      .filter(ev => eventTouchesDay(ev, day))
      .sort((a,b) => {
        const as = a.startTS?.toDate ? a.startTS.toDate() : new Date(a.startISO);
        const bs = b.startTS?.toDate ? b.startTS.toDate() : new Date(b.startISO);
        return as - bs;
      });

    for (const ev of todays.slice(0, 3)) {
      const block = document.createElement("div");
      block.className = `event ${ev.type} ${ev.status}`;

      const title = document.createElement("div");
      title.className = "event-title";

      title.textContent = ev.type === "leave"
        ? `Verlof • ${ev.tech}`
        : `${ev.tech} • ${ev.orderNo || "Geen order"}`;

      const meta = document.createElement("div");
      meta.className = "event-meta";
      const left = document.createElement("span");
      left.textContent = formatTimeRange(ev);
      const right = document.createElement("span");
      right.textContent = ev.status === "def" ? "Definitief" : "Tijdelijk";
      meta.appendChild(left);
      meta.appendChild(right);

      block.appendChild(title);
      block.appendChild(meta);

      eventsWrap.appendChild(block);
    }

    if (todays.length > 3) {
      const more = document.createElement("div");
      more.className = "hint";
      more.textContent = `+${todays.length - 3} meer…`;
      eventsWrap.appendChild(more);
    }

    dayEl.appendChild(head);
    dayEl.appendChild(eventsWrap);
    calendarGrid.appendChild(dayEl);
  }
}

eventForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUserId) return;

  eventError.textContent = "";

  const type = eventType.value;
  const tech = techInput.value.trim();
  const orderNo = orderInput.value.trim();
  const status = statusSelect.value;

  if (!tech) { eventError.textContent = "Vul een monteur/collega in."; return; }
  if (type === "install" && !orderNo) { eventError.textContent = "Vul een ordernummer in (installatie)."; return; }

  const start = parseLocalDateTime(startDate.value, startTime.value);
  const end = parseLocalDateTime(endDate.value, endTime.value);
  if (isNaN(start) || isNaN(end)) { eventError.textContent = "Begin/eind datum en tijd zijn verplicht."; return; }
  if (end < start) { eventError.textContent = "Eindmoment moet na beginmoment liggen."; return; }

  const mk = computeMonthKeys(start, end);

  await addDoc(collection(db, "scheduleEvents"), {
    type,
    tech,
    orderNo: type === "install" ? orderNo : "",
    status,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    monthKeys: mk,
    createdBy: currentUserId,
    createdAt: serverTimestamp()
  });

  closeModal();
});
