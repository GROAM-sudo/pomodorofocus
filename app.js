const DEFAULT_SETTINGS = {
  work: 25,
  short: 5,
  long: 15,
  longInterval: 4,
  autoStartBreaks: false,
  autoStartPomodoros: false,
  sound: true,
  visualTheme: "liquid",
  displayMode: "light",
  themeColor: "#ba4949"
};

const STORAGE_KEY = "pomodoro-focus-state-v1";

const state = loadState();
let intervalId = null;
let deferredInstallPrompt = null;

const phaseNames = {
  work: "Pomodoro",
  short: "Pause courte",
  long: "Pause longue"
};

const els = {
  body: document.body,
  installBanner: document.querySelector("#installBanner"),
  installBtn: document.querySelector("#installBtn"),
  reportOpen: document.querySelector("#reportOpen"),
  reportPanel: document.querySelector("#reportPanel"),
  reportClose: document.querySelector("#reportClose"),
  reportBars: document.querySelector("#reportBars"),
  reportTotalPomodoros: document.querySelector("#reportTotalPomodoros"),
  reportTotalMinutes: document.querySelector("#reportTotalMinutes"),
  reportNote: document.querySelector("#reportNote"),
  soundToggle: document.querySelector("#soundToggle"),
  settingsOpen: document.querySelector("#settingsOpen"),
  settingsPanel: document.querySelector("#settingsPanel"),
  settingsClose: document.querySelector("#settingsClose"),
  saveSettingsBtn: document.querySelector("#saveSettingsBtn"),
  timerDisplay: document.querySelector("#timerDisplay"),
  startPauseBtn: document.querySelector("#startPauseBtn"),
  skipBtn: document.querySelector("#skipBtn"),
  cycleLabel: document.querySelector("#cycleLabel"),
  activeTaskLabel: document.querySelector("#activeTaskLabel"),
  donePomodoros: document.querySelector("#donePomodoros"),
  focusMinutes: document.querySelector("#focusMinutes"),
  finishEstimate: document.querySelector("#finishEstimate"),
  taskForm: document.querySelector("#taskForm"),
  taskInput: document.querySelector("#taskInput"),
  taskEstimate: document.querySelector("#taskEstimate"),
  taskList: document.querySelector("#taskList"),
  clearDoneBtn: document.querySelector("#clearDoneBtn"),
  tabs: [...document.querySelectorAll(".phase-tab")],
  workDuration: document.querySelector("#workDuration"),
  shortDuration: document.querySelector("#shortDuration"),
  longDuration: document.querySelector("#longDuration"),
  longInterval: document.querySelector("#longInterval"),
  autoStartBreaks: document.querySelector("#autoStartBreaks"),
  autoStartPomodoros: document.querySelector("#autoStartPomodoros"),
  visualTheme: document.querySelector("#visualTheme"),
  displayMode: document.querySelector("#displayMode"),
  themeColor: document.querySelector("#themeColor"),
  colorPresets: [...document.querySelectorAll(".color-presets button")]
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) {
      return {
        settings: { ...DEFAULT_SETTINGS, ...saved.settings },
        phase: saved.phase || "work",
        remaining: Number.isFinite(saved.remaining) ? saved.remaining : DEFAULT_SETTINGS.work * 60,
        running: false,
        completedPomodoros: saved.completedPomodoros || 0,
        focusMinutes: saved.focusMinutes || 0,
        history: saved.history || {},
        tasks: Array.isArray(saved.tasks) ? saved.tasks : [],
        activeTaskId: saved.activeTaskId || null
      };
    }
  } catch (error) {
    console.warn("Etat local ignore", error);
  }

  return {
    settings: { ...DEFAULT_SETTINGS },
    phase: "work",
    remaining: DEFAULT_SETTINGS.work * 60,
    running: false,
    completedPomodoros: 0,
    focusMinutes: 0,
    history: {},
    tasks: [],
    activeTaskId: null
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, running: false }));
}

function getPhaseDuration(phase = state.phase) {
  return state.settings[phase] * 60;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function render() {
  els.body.dataset.phase = state.phase;
  els.body.dataset.theme = state.settings.visualTheme;
  els.body.dataset.mode = state.settings.displayMode;
  els.body.style.setProperty("--accent", state.settings.themeColor);
  els.timerDisplay.textContent = formatTime(state.remaining);
  document.title = `${formatTime(state.remaining)} - ${phaseNames[state.phase]}`;
  els.startPauseBtn.textContent = state.running ? "PAUSE" : "START";
  els.cycleLabel.textContent = `Session #${state.completedPomodoros + 1}`;
  els.donePomodoros.textContent = state.completedPomodoros;
  els.focusMinutes.textContent = state.focusMinutes;
  els.soundToggle.textContent = state.settings.sound ? "Son on" : "Son off";
  els.soundToggle.setAttribute("aria-pressed", String(state.settings.sound));

  els.tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.phaseTarget === state.phase);
  });

  const activeTask = state.tasks.find((task) => task.id === state.activeTaskId);
  els.activeTaskLabel.textContent = activeTask ? activeTask.title : "Choisis une tache pour commencer.";
  renderTasks();
  renderEstimate();
  renderReport();
  saveState();
}

function renderTasks() {
  els.taskList.innerHTML = "";

  if (state.tasks.length === 0) {
    const empty = document.createElement("li");
    empty.className = "task-item";
    empty.innerHTML = '<span></span><span class="task-title">Aucune tache pour le moment.</span><span class="task-count">0/0</span>';
    els.taskList.append(empty);
    return;
  }

  state.tasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = "task-item";
    item.classList.toggle("active", task.id === state.activeTaskId);
    item.classList.toggle("completed", task.done);

    const check = document.createElement("button");
    check.className = `task-check${task.done ? " done" : ""}`;
    check.type = "button";
    check.setAttribute("aria-label", task.done ? "Marquer comme non terminee" : "Marquer comme terminee");
    check.addEventListener("click", () => toggleTaskDone(task.id));

    const title = document.createElement("button");
    title.className = "task-title";
    title.type = "button";
    title.textContent = task.title;
    title.addEventListener("click", () => setActiveTask(task.id));

    const count = document.createElement("span");
    count.className = "task-count";
    count.textContent = `${task.donePomodoros}/${task.estimate}`;

    const remove = document.createElement("button");
    remove.className = "task-delete-trigger";
    remove.type = "button";
    remove.textContent = "x";
    remove.setAttribute("aria-label", `Supprimer ${task.title}`);
    remove.addEventListener("click", () => deleteTask(task.id));

    item.append(check, title, count, remove);
    els.taskList.append(item);
  });
}

function renderEstimate() {
  const remainingPomodoros = state.tasks
    .filter((task) => !task.done)
    .reduce((total, task) => total + Math.max(0, task.estimate - task.donePomodoros), 0);

  if (remainingPomodoros === 0) {
    els.finishEstimate.textContent = "--:--";
    return;
  }

  const work = state.settings.work;
  const short = state.settings.short;
  const long = state.settings.long;
  let minutes = state.phase === "work" ? Math.ceil(state.remaining / 60) : 0;
  const sessionsLeft = state.phase === "work" ? remainingPomodoros - 1 : remainingPomodoros;

  for (let i = 1; i <= sessionsLeft; i += 1) {
    const futureCount = state.completedPomodoros + i;
    minutes += futureCount % state.settings.longInterval === 0 ? long : short;
    minutes += work;
  }

  const end = new Date(Date.now() + minutes * 60 * 1000);
  els.finishEstimate.textContent = end.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function startTimer() {
  if (state.running) return;
  state.running = true;
  intervalId = window.setInterval(tick, 1000);
  render();
}

function pauseTimer() {
  state.running = false;
  window.clearInterval(intervalId);
  intervalId = null;
  render();
}

function tick() {
  state.remaining -= 1;
  if (state.remaining <= 0) {
    completePhase();
    return;
  }
  render();
}

function completePhase() {
  const completedPhase = state.phase;
  pauseTimer();

  if (completedPhase === "work") {
    state.completedPomodoros += 1;
    state.focusMinutes += state.settings.work;
    recordProgress(state.settings.work);
    creditActiveTask();
    switchPhase(state.completedPomodoros % state.settings.longInterval === 0 ? "long" : "short");
    notifyDone("Pomodoro termine", "C'est le moment de faire une pause.");
    if (state.settings.autoStartBreaks) startTimer();
  } else {
    switchPhase("work");
    notifyDone("Pause terminee", "Tu peux relancer une session de concentration.");
    if (state.settings.autoStartPomodoros) startTimer();
  }
}

function switchPhase(phase) {
  pauseTimer();
  state.phase = phase;
  state.remaining = getPhaseDuration(phase);
  render();
}

function skipPhase() {
  if (state.phase === "work") {
    const nextCount = state.completedPomodoros + 1;
    switchPhase(nextCount % state.settings.longInterval === 0 ? "long" : "short");
    return;
  }
  switchPhase("work");
}

function creditActiveTask() {
  const task = state.tasks.find((item) => item.id === state.activeTaskId);
  if (!task) return;

  task.donePomodoros += 1;
  if (task.donePomodoros >= task.estimate) {
    task.done = true;
  }
}

function recordProgress(minutes) {
  const key = new Date().toISOString().slice(0, 10);
  const today = state.history[key] || { pomodoros: 0, minutes: 0 };
  today.pomodoros += 1;
  today.minutes += minutes;
  state.history[key] = today;
}

function getLastDays(count = 7) {
  return [...Array(count)].map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (count - 1 - index));
    const key = date.toISOString().slice(0, 10);
    return {
      key,
      label: date.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", ""),
      pomodoros: 0,
      minutes: 0,
      ...(state.history[key] || {})
    };
  });
}

function renderReport() {
  const days = getLastDays();
  const totalPomodoros = days.reduce((sum, day) => sum + day.pomodoros, 0);
  const totalMinutes = days.reduce((sum, day) => sum + day.minutes, 0);
  const maxMinutes = Math.max(1, ...days.map((day) => day.minutes));

  els.reportTotalPomodoros.textContent = totalPomodoros;
  els.reportTotalMinutes.textContent = totalMinutes;
  els.reportNote.textContent = totalPomodoros
    ? "Continue comme ca : la regularite compte plus que la perfection."
    : "Termine une session pour voir ta progression ici.";
  els.reportBars.innerHTML = "";

  days.forEach((day) => {
    const item = document.createElement("div");
    item.className = "report-day";
    item.innerHTML = `
      <span>${day.label}</span>
      <div class="bar-track"><i style="height: ${Math.max(6, (day.minutes / maxMinutes) * 100)}%"></i></div>
      <strong>${day.pomodoros}</strong>
    `;
    els.reportBars.append(item);
  });
}

function notifyDone(title, body) {
  playTone();
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "icons/icon.svg" });
  }
}

function playTone() {
  if (!state.settings.sound) return;
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
  gain.gain.setValueAtTime(0.001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.35, audioContext.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.7);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.75);
}

function addTask(title, estimate) {
  const task = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    title,
    estimate,
    donePomodoros: 0,
    done: false
  };
  state.tasks.push(task);
  state.activeTaskId = state.activeTaskId || task.id;
  render();
}

function setActiveTask(id) {
  state.activeTaskId = id;
  render();
}

function toggleTaskDone(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  task.done = !task.done;
  if (task.done && task.donePomodoros < task.estimate) {
    task.donePomodoros = task.estimate;
  }
  render();
}

function deleteTask(id) {
  state.tasks = state.tasks.filter((task) => task.id !== id);
  if (state.activeTaskId === id) {
    state.activeTaskId = state.tasks[0]?.id || null;
  }
  render();
}

function clearCompletedTasks() {
  state.tasks = state.tasks.filter((task) => !task.done);
  if (!state.tasks.some((task) => task.id === state.activeTaskId)) {
    state.activeTaskId = state.tasks[0]?.id || null;
  }
  render();
}

function populateSettings() {
  els.workDuration.value = state.settings.work;
  els.shortDuration.value = state.settings.short;
  els.longDuration.value = state.settings.long;
  els.longInterval.value = state.settings.longInterval;
  els.autoStartBreaks.checked = state.settings.autoStartBreaks;
  els.autoStartPomodoros.checked = state.settings.autoStartPomodoros;
  els.visualTheme.value = state.settings.visualTheme;
  els.displayMode.value = state.settings.displayMode;
  els.themeColor.value = state.settings.themeColor;
}

function saveSettings() {
  state.settings.work = clampNumber(els.workDuration.value, 1, 120, DEFAULT_SETTINGS.work);
  state.settings.short = clampNumber(els.shortDuration.value, 1, 60, DEFAULT_SETTINGS.short);
  state.settings.long = clampNumber(els.longDuration.value, 1, 90, DEFAULT_SETTINGS.long);
  state.settings.longInterval = clampNumber(els.longInterval.value, 2, 12, DEFAULT_SETTINGS.longInterval);
  state.settings.autoStartBreaks = els.autoStartBreaks.checked;
  state.settings.autoStartPomodoros = els.autoStartPomodoros.checked;
  state.settings.visualTheme = els.visualTheme.value;
  state.settings.displayMode = els.displayMode.value;
  state.settings.themeColor = els.themeColor.value;
  state.remaining = Math.min(state.remaining, getPhaseDuration());
  els.settingsPanel.hidden = true;
  render();
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

els.startPauseBtn.addEventListener("click", () => {
  if (!state.running && "Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
  state.running ? pauseTimer() : startTimer();
});

els.skipBtn.addEventListener("click", skipPhase);

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => switchPhase(tab.dataset.phaseTarget));
});

els.taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = els.taskInput.value.trim();
  const estimate = clampNumber(els.taskEstimate.value, 1, 24, 1);
  if (!title) return;
  addTask(title, estimate);
  els.taskInput.value = "";
  els.taskEstimate.value = "1";
  els.taskInput.focus();
});

els.clearDoneBtn.addEventListener("click", clearCompletedTasks);

els.reportOpen.addEventListener("click", () => {
  renderReport();
  els.reportPanel.hidden = false;
});

els.reportClose.addEventListener("click", () => {
  els.reportPanel.hidden = true;
});

els.reportPanel.addEventListener("click", (event) => {
  if (event.target === els.reportPanel) {
    els.reportPanel.hidden = true;
  }
});

els.settingsOpen.addEventListener("click", () => {
  populateSettings();
  els.settingsPanel.hidden = false;
});

els.settingsClose.addEventListener("click", () => {
  els.settingsPanel.hidden = true;
});

els.settingsPanel.addEventListener("click", (event) => {
  if (event.target === els.settingsPanel) {
    els.settingsPanel.hidden = true;
  }
});

els.saveSettingsBtn.addEventListener("click", saveSettings);

els.visualTheme.addEventListener("change", () => {
  state.settings.visualTheme = els.visualTheme.value;
  render();
});

els.displayMode.addEventListener("change", () => {
  state.settings.displayMode = els.displayMode.value;
  render();
});

els.themeColor.addEventListener("input", () => {
  state.settings.themeColor = els.themeColor.value;
  render();
});

els.colorPresets.forEach((button) => {
  button.addEventListener("click", () => {
    state.settings.themeColor = button.dataset.color;
    els.themeColor.value = button.dataset.color;
    render();
  });
});

els.soundToggle.addEventListener("click", () => {
  state.settings.sound = !state.settings.sound;
  render();
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  els.installBanner.classList.add("visible");
});

els.installBtn.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  els.installBanner.classList.remove("visible");
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  els.installBanner.classList.remove("visible");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js");
  });
}

if (state.remaining <= 0 || state.remaining > getPhaseDuration()) {
  state.remaining = getPhaseDuration();
}

render();
