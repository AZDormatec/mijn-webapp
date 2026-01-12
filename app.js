import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

// JOUW CONFIG (geplakt uit Firebase)
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

// UI refs
const loginCard = document.getElementById("loginCard");
const appCard = document.getElementById("appCard");

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginError = document.getElementById("loginError");

const userInfo = document.getElementById("userInfo");
const logoutBtn = document.getElementById("logoutBtn");

const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const taskList = document.getElementById("taskList");
const counter = document.getElementById("counter");
const clearDoneBtn = document.getElementById("clearDoneBtn");

// Data
let currentUserId = null;
let tasks = [];
let currentFilter = "all";

// Filters
const filterButtons = Array.from(document.querySelectorAll(".filter-btn"));
filterButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    currentFilter = btn.dataset.filter;
    filterButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    render();
  });
});

function storageKey() {
  return `dormatec_tasks_${currentUserId}`;
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
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

function render() {
  taskList.innerHTML = "";
  const visibleTasks = getVisibleTasks();

  for (const t of visibleTasks) {
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
      render();
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
      render();
    });

    li.appendChild(left);
    li.appendChild(delBtn);
    taskList.appendChild(li);
  }

  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;
  counter.textContent = `${total} taken • ${done} afgerond`;
}

function showLoggedOut() {
  loginCard.classList.remove("hidden");
  appCard.classList.add("hidden");
  loginError.textContent = "";
  currentUserId = null;
  tasks = [];
  taskList.innerHTML = "";
  counter.textContent = "0 taken";
}

function showLoggedIn(user) {
  loginCard.classList.add("hidden");
  appCard.classList.remove("hidden");
  userInfo.textContent = `Ingelogd: ${user.email}`;
  currentUserId = user.uid;
  tasks = loadTasks();
  render();
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
  } catch (err) {
    loginError.textContent = "Inloggen mislukt. Controleer e-mail en wachtwoord.";
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

taskForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!currentUserId) return;

  const text = taskInput.value.trim();
  if (!text) return;

  tasks.unshift({ id: uid(), text, done: false });
  taskInput.value = "";
  saveTasks();
  render();
});

clearDoneBtn.addEventListener("click", () => {
  if (!currentUserId) return;
  tasks = tasks.filter(t => !t.done);
  saveTasks();
  render();
});
