const STORAGE_KEY = "mijn_taken_v1";

const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const taskList = document.getElementById("taskList");
const counter = document.getElementById("counter");
const clearDoneBtn = document.getElementById("clearDoneBtn");

let tasks = loadTasks();

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function render() {
  taskList.innerHTML = "";

  for (const t of tasks) {
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

taskForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = taskInput.value.trim();
  if (!text) return;

  tasks.unshift({ id: uid(), text, done: false });
  taskInput.value = "";
  saveTasks();
  render();
});

clearDoneBtn.addEventListener("click", () => {
  tasks = tasks.filter(t => !t.done);
  saveTasks();
  render();
});

render();
