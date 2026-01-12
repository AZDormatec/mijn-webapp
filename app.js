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
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// Firebase config (jouw project)
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

// Tasks: lokaal per user
let tasks = [];
let currentFilter = "all";

// Agenda: gedeeld via Firestore
let calendarMonth = new Date();
calendarMonth.setDate(1);
let monthEvents = []; // events for current month (from Firestore)
let unsubscribeMonth = null;

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
function clampToStartOfDay(d){
  const x = new Date(d); x.setHours(0,0,0,0); return x;
}
function addDays(d, days){
  const x = new Date(d); x.setDate(x.getDate() + days); return x;
}
function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
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
   Tasks (localStorage per user)
========================= */
function storageKey() {
  return `dormatec_tasks_${currentUserId}`;
}
function loadTasks() {
  if (!currentUserId) return [];
  try {
    const raw = localStorage.getItem(storageKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveTasks() {
  if (!currentUserId) return;
  localStorage.setItem(storageKey(), JSON.stringify(tasks));
}
function getVisibleTasks() {
  if (currentFilter === "open") return tasks.filter(t => !t.done);
  if (currentFilter === "done") return tasks.filter(t => t.done);
  return tasks;
}
function renderTasks() {
  taskList.innerHTML = "";
  const visible = getVisibleTasks();

  for (const t of visible) {
    const li = document.createElement("li");
    li.className = "item" + (t.done ? " done" : "");

    const left = document.createElement("div");
    left.className = "item-left";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = t.done;
    checkbox.addEventListener("change", () => {
      t.done = checkbox.checked;
      saveTasks();
      renderTasks();
    });

    const text = document.createElement("div");
    text.className = "text";
    text.textContent = t.text;

    left.appendChild(checkbox);
    left.appendChild(text);

    const delBtn = document.createElement("button");
    delBtn.className = "icon-btn";
    delBtn.type = "button";
    delBtn.textContent = "🗑️";
    delBtn.addEventListener("click", () => {
      tasks = tasks.filter(x => x.id !== t.id);
      saveTasks();
      renderTasks();
    });

    li.appendChild(left);
    li.appendChild(delBtn);
    taskList.appendChild(li);
  }

  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;
  counter.textContent = `${total} taken • ${done} afgerond`;
}

filterButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    currentFilter = btn.dataset.filter;
    filterButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderTasks();
  });
});

taskForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!currentUserId) return;

  const text = taskInput.value.trim();
  if (!text) return;

  tasks.unshift({ id: uid(), text, done: false });
  taskInput.value = "";
  saveTasks();
  renderTasks();
});

clearDoneBtn.addEventListener("click", () => {
  if (!currentUserId) return;
  tasks = tasks.filter(t => !t.done);
  saveTasks();
  renderTasks();
});

/* =========================
   Modal (Agenda)
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
  // default
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
  // defaults: vandaag 08:00 - 17:00
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
   We slaan monthKeys array op zodat we per maand exact kunnen query-en.
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

  if (unsubscribeMonth) unsubscribeMonth();
  const mk = monthKey(calendarMonth);

  const col = collection(db, "scheduleEvents");
  const q = query(col, where("monthKeys", "array-contains", mk));

  unsubscribeMonth = onSnapshot(q, (snap) => {
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

/* =========================
   Calendar rendering
========================= */
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

  // Start day for grid (Monday as first day)
  const first = new Date(calendarMonth);
  const dow = (first.getDay() + 6) % 7; // Mon=0..Sun=6
  const gridStart = addDays(first, -dow);

  // 6 weeks grid
  calendarGrid.innerHTML = "";
  for (let i=0; i<42; i++){
    const day = addDays(gridStart, i);
    const inMonth = day.getMonth() === calendarMonth.getMonth();

    const dayEl = document.createElement("div");
    dayEl.className = "day" + (inMonth ? "" : " muted-day");

    const head = document.createElement("div");
    head.className = "day-head";

    const num = document.createElement("div");
    num.className = "day-num";
    num.textContent = day.getDate();

    const meta = document.createElement("div");
    meta.textContent = ""; // ruimte voor later (bijv bezetting)

    head.appendChild(num);
    head.appendChild(meta);

    const eventsWrap = document.createElement("div");
    eventsWrap.className = "events";

    // events for this day
    const todays = monthEvents
      .filter(ev => eventTouchesDay(ev, day))
      .sort((a,b) => {
        const as = a.startTS?.toDate ? a.startTS.toDate() : new Date(a.startISO);
        const bs = b.startTS?.toDate ? b.startTS.toDate() : new Date(b.startISO);
        return as - bs;
      });

    for (const ev of todays.slice(0, 3)) {
      const pill = document.createElement("div");
      pill.className = `event-pill ${ev.type} ${ev.status}`;
      const label = ev.type === "leave"
        ? `Verlof • ${ev.tech}`
        : `${ev.tech} • ${ev.orderNo || "Geen order"}`;

      pill.textContent = label;

      const metaLine = document.createElement("div");
      metaLine.className = "event-meta";
      metaLine.textContent = `${formatTimeRange(ev)} • ${ev.status === "def" ? "Def" : "Tmp"}`;

      const wrap = document.createElement("div");
      wrap.appendChild(pill);
      wrap.appendChild(metaLine);

      eventsWrap.appendChild(wrap);
    }

    if (todays.length > 3) {
      const more = document.createElement("div");
      more.className = "event-meta";
      more.textContent = `+${todays.length - 3} meer…`;
      eventsWrap.appendChild(more);
    }

    dayEl.appendChild(head);
    dayEl.appendChild(eventsWrap);
    calendarGrid.appendChild(dayEl);
  }
}

/* =========================
   Add event (shared for everyone)
========================= */
eventForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUserId) return;

  eventError.textContent = "";

  const type = eventType.value; // install | leave
  const tech = techInput.value.trim();
  const orderNo = orderInput.value.trim();
  const status = statusSelect.value; // temp | def

  if (!tech) {
    eventError.textContent = "Vul een monteur/collega in.";
    return;
  }

  if (type === "install" && !orderNo) {
    eventError.textContent = "Vul een ordernummer in (installatie).";
    return;
  }

  const start = parseLocalDateTime(startDate.value, startTime.value);
  const end = parseLocalDateTime(endDate.value, endTime.value);

  if (!(start instanceof Date) || isNaN(start) || !(end instanceof Date) || isNaN(end)) {
    eventError.textContent = "Begin/eind datum en tijd zijn verplicht.";
    return;
  }
  if (end < start) {
    eventError.textContent = "Eindmoment moet na beginmoment liggen.";
    return;
  }

  const mk = computeMonthKeys(start, end);

  await addDoc(collection(db, "scheduleEvents"), {
    type,            // install | leave
    tech,            // monteur/collega
    orderNo: type === "install" ? orderNo : "",
    status,          // temp | def
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    monthKeys: mk,   // voor maand-query
    createdBy: currentUserId,
    createdAt: serverTimestamp()
  });

  closeModal();
});

/* =========================
   Auth UI behavior
========================= */
function showLoggedOut() {
  loginCard.classList.remove("hidden");
  appCard.classList.add("hidden");
  loginError.textContent = "";
  currentUserId = null;
  tasks = [];
  taskList.innerHTML = "";
  counter.textContent = "0 taken";
  if (unsubscribeMonth) { unsubscribeMonth(); unsubscribeMonth = null; }
}

function showLoggedIn(user) {
  loginCard.classList.add("hidden");
  appCard.classList.remove("hidden");
  userInfo.textContent = `Ingelogd: ${user.email}`;
  currentUserId = user.uid;

  // tasks local
  tasks = loadTasks();
  renderTasks();

  // agenda shared
  calendarMonth = new Date();
  calendarMonth.setDate(1);
  listenMonth();
  renderCalendar();

  // default tab
  setTab("agenda");
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
