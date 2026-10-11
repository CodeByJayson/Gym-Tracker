/* =========================================================================
   app.js – GymTracker SPA (komplett)
   Features:
   - Tab-Steuerung
   - Workout-Auswahl-Modal (Push / Pull / Legs / Core & Unterarme)
   - Editierbarer Workout-Titel
   - Übungs-Picker während des Workouts
   - Notizfeld pro Workout
   - Ghost Data (historische Werte)
   - Seed-Init beim ersten Start
   - Übungs-Verwaltung mit eigenen Übungen
   - Verlauf & Körpergewicht mit Chart.js
   - Gewicht-Update-Toast
   - JSON Export/Import
   - PWA Service Worker
   ========================================================================= */

'use strict';

/* =========================================================================
   STORAGE-LAYER
   ========================================================================= */
const STORAGE_KEYS = {
  WORKOUTS:  'gymtracker.workouts',
  WEIGHTS:   'gymtracker.weights',
  EXERCISES: 'gymtracker.exercises',
  SEEDED:    'gymtracker.seeded',
};

const _memoryStore = new Map();

function isStorageAvailable() {
  try {
    const k = '__gymtracker_test__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch (_) {
    return false;
  }
}

const HAS_LOCALSTORAGE = isStorageAvailable();

function storageGet(key) {
  if (HAS_LOCALSTORAGE) {
    try { return window.localStorage.getItem(key); }
    catch (err) { console.warn('[Storage] Lesen fehlgeschlagen:', err); return null; }
  }
  return _memoryStore.has(key) ? _memoryStore.get(key) : null;
}

function storageSet(key, value) {
  if (HAS_LOCALSTORAGE) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (err) {
      console.error('[Storage] Schreiben fehlgeschlagen:', err);
      if (err && err.name === 'QuotaExceededError') {
        showToast?.('Speicher voll – bitte alte Daten exportieren & löschen');
      } else {
        showToast?.('Speichern fehlgeschlagen');
      }
      return false;
    }
  }
  _memoryStore.set(key, value);
  return true;
}

function storageRemove(key) {
  if (HAS_LOCALSTORAGE) {
    try { window.localStorage.removeItem(key); }
    catch (err) { console.warn('[Storage] Löschen fehlgeschlagen:', err); }
  } else {
    _memoryStore.delete(key);
  }
}

function safeParseArray(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[Storage] Korrupte JSON-Daten verworfen:', err);
    return [];
  }
}

/* =========================================================================
   KONSTANTEN
   ========================================================================= */
const MUSCLE_GROUPS = ['Push', 'Pull', 'Legs', 'Core'];

const DEFAULT_EXERCISES = [
  /* Push */
  { id: 'ex_1',  name: 'Bench Press (Maschine)',    muscle: 'Push' },
  { id: 'ex_2',  name: 'Schrägbankdrücken',         muscle: 'Push' },
  { id: 'ex_3',  name: 'Schulterdrücken (Hanteln)', muscle: 'Push' },
  { id: 'ex_4',  name: 'Seitheben (Hanteln)',       muscle: 'Push' },
  { id: 'ex_5',  name: 'Overhead Triceps (Kabel)',  muscle: 'Push' },
  { id: 'ex_6',  name: 'Trizeps einzeln (Kabel)',   muscle: 'Push' },
  { id: 'ex_7',  name: 'Dips',                      muscle: 'Push' },

  /* Pull */
  { id: 'ex_8',  name: 'Latzug (Kabel)',            muscle: 'Pull' },
  { id: 'ex_9',  name: 'Klimmzüge',                 muscle: 'Pull' },
  { id: 'ex_10', name: 'Seated Row (Kabel)',        muscle: 'Pull' },
  { id: 'ex_11', name: 'Single Arm Rows (Hantel)',  muscle: 'Pull' },
  { id: 'ex_12', name: 'Face Pulls (Kabel)',        muscle: 'Pull' },
  { id: 'ex_13', name: 'Biceps Curl (Maschine)',    muscle: 'Pull' },
  { id: 'ex_14', name: 'Hammer Curl (Kabel)',       muscle: 'Pull' },
  { id: 'ex_15', name: 'Rudern',                    muscle: 'Pull' },

  /* Legs */
  { id: 'ex_16', name: 'Kniebeugen',                muscle: 'Legs' },
  { id: 'ex_17', name: 'Beinpresse',                muscle: 'Legs' },
  { id: 'ex_18', name: 'Rumänisches Kreuzheben',    muscle: 'Legs' },
  { id: 'ex_19', name: 'Beinstrecker',              muscle: 'Legs' },
  { id: 'ex_20', name: 'Beinbeuger',                muscle: 'Legs' },
  { id: 'ex_21', name: 'Wadenheben',                muscle: 'Legs' },

  /* Core & Unterarme */
  { id: 'ex_22', name: 'Reverse Curls (Hanteln)',   muscle: 'Core' },
  { id: 'ex_23', name: 'Wrist Curls',               muscle: 'Core' },
  { id: 'ex_24', name: 'Reverse Wrist Curls',       muscle: 'Core' },
  { id: 'ex_25', name: 'Leg Raises',                muscle: 'Core' },
  { id: 'ex_26', name: 'Plank',                     muscle: 'Core' },
  { id: 'ex_27', name: 'Crunches',                  muscle: 'Core' },
  { id: 'ex_28', name: 'Russian Twist',             muscle: 'Core' },
  { id: 'ex_29', name: 'Hanging Leg Raise',         muscle: 'Core' },
];

const WORKOUT_TEMPLATES = {
  'Push Day': {
    label: 'Push Day',
    subtitle: 'Brust · Schultern · Trizeps',
    icon: 'push',
    exercises: [
      'Bench Press (Maschine)',
      'Schrägbankdrücken',
      'Schulterdrücken (Hanteln)',
      'Seitheben (Hanteln)',
      'Overhead Triceps (Kabel)',
      'Trizeps einzeln (Kabel)',
    ],
  },
  'Pull Day': {
    label: 'Pull Day',
    subtitle: 'Rücken · Bizeps · Hintere Schulter',
    icon: 'pull',
    exercises: [
      'Latzug (Kabel)',
      'Seated Row (Kabel)',
      'Single Arm Rows (Hantel)',
      'Face Pulls (Kabel)',
      'Biceps Curl (Maschine)',
      'Hammer Curl (Kabel)',
    ],
  },
  'Leg Day': {
    label: 'Leg Day',
    subtitle: 'Beine · Waden',
    icon: 'legs',
    exercises: [
      'Kniebeugen',
      'Beinpresse',
      'Rumänisches Kreuzheben',
      'Beinstrecker',
      'Beinbeuger',
      'Wadenheben',
    ],
  },
  'Core & Unterarme': {
    label: 'Core & Unterarme',
    subtitle: 'Extra-Block · Griffkraft · Bauch',
    icon: 'core',
    exercises: [
      'Reverse Curls (Hanteln)',
      'Wrist Curls',
      'Reverse Wrist Curls',
      'Leg Raises',
      'Plank',
      'Crunches',
    ],
  },
};

/* =========================================================================
   GLOBALER STATE
   ========================================================================= */
const AppState = {
  currentTab: 'dashboard',
  activeWorkout: null,
  workoutTimer: null,
  workoutSeconds: 0,
  selectedMuscle: 'Alle',
  searchQuery: '',
  ghostCache: {},
  workoutNote: '',
  exercisePickerFilter: 'Alle',
  exercisePickerSearch: '',
};

let weightChartInstance = null;

/* =========================================================================
   ID-GENERATOR
   ========================================================================= */
function generateId(prefix) {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${ts}_${rand}`;
}

/* =========================================================================
   SEED DATA
   ========================================================================= */
function seedInitialData() {
  const alreadySeeded = storageGet(STORAGE_KEYS.SEEDED) === '1';
  const existingRaw   = storageGet(STORAGE_KEYS.EXERCISES);
  const existing      = safeParseArray(existingRaw);

  if (existing.length > 0) {
    if (!alreadySeeded) storageSet(STORAGE_KEYS.SEEDED, '1');
    return { seeded: false, count: existing.length };
  }

  if (alreadySeeded) {
    return { seeded: false, count: 0 };
  }

  const ok = storageSet(STORAGE_KEYS.EXERCISES, JSON.stringify(DEFAULT_EXERCISES));
  if (ok) storageSet(STORAGE_KEYS.SEEDED, '1');

  return { seeded: ok, count: DEFAULT_EXERCISES.length };
}

/* =========================================================================
   TAB-STEUERUNG
   ========================================================================= */
function switchTab(tab) {
  if (!tab) return;
  AppState.currentTab = tab;

  document.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));
  document.getElementById(`page-${tab}`)?.classList.add('active');

  document.querySelectorAll('.nav-item').forEach((btn) => {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle('tab-active', isActive);
    btn.classList.toggle('tab-inactive', !isActive);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (tab === 'workout')   renderWorkoutPage();
  if (tab === 'dashboard') renderDashboard();
  if (tab === 'exercises') renderExercisesTab();
  if (tab === 'history')   refreshHistory();
}

/* =========================================================================
   ÜBUNGS-BIBLIOTHEK
   ========================================================================= */
function getStoredExercises() {
  const raw = storageGet(STORAGE_KEYS.EXERCISES);
  const parsed = safeParseArray(raw);
  if (parsed.length > 0) return parsed;

  const seeded = storageGet(STORAGE_KEYS.SEEDED) === '1';
  if (!seeded) return [...DEFAULT_EXERCISES];
  return [];
}

function saveExercisesToStorage(exercises) {
  return storageSet(STORAGE_KEYS.EXERCISES, JSON.stringify(exercises));
}

function addExerciseToLibrary(name, muscle) {
  const trimmed = String(name || '').trim();
  if (!trimmed) { showToast?.('Bitte einen Namen eingeben'); return false; }
  if (!MUSCLE_GROUPS.includes(muscle)) { showToast?.('Ungültige Muskelgruppe'); return false; }

  const all = getStoredExercises();
  const exists = all.some((e) => e.name.toLowerCase() === trimmed.toLowerCase());
  if (exists) { showToast?.(`"${trimmed}" existiert bereits`); return false; }

  const newExercise = {
    id:     generateId('ex'),
    name:   trimmed,
    muscle: muscle,
    custom: true,
  };
  all.push(newExercise);
  saveExercisesToStorage(all);
  return true;
}

function findExerciseByName(name) {
  const all = getStoredExercises();
  return all.find((e) => e.name.toLowerCase() === String(name).toLowerCase());
}

/* =========================================================================
   GHOST DATA
   ========================================================================= */
function buildGhostCache() {
  const cache = {};
  const workouts = getStoredWorkouts();

  for (const workout of workouts) {
    for (const ex of workout.exercises || []) {
      if (cache[ex.name]) continue;
      const best = (ex.sets || []).reduce((acc, s) => {
        if (!acc) return s;
        if (Number(s.weight) > Number(acc.weight)) return s;
        if (Number(s.weight) === Number(acc.weight) && Number(s.reps) > Number(acc.reps)) return s;
        return acc;
      }, null);
      if (best) {
        cache[ex.name] = {
          weight: Number(best.weight) || 0,
          reps:   Number(best.reps)   || 0,
          date:   workout.date,
        };
      }
    }
  }
  AppState.ghostCache = cache;
  return cache;
}

function getGhostData(exerciseName) {
  return AppState.ghostCache[exerciseName] || null;
}

/* =========================================================================
   WORKOUT-PICKER-MODAL
   ========================================================================= */
function openWorkoutPicker() {
  if (AppState.activeWorkout) {
    switchTab('workout');
    return;
  }

  const modal  = document.getElementById('workout-picker-modal');
  const sheet  = document.getElementById('workout-picker-sheet');
  const backd  = document.getElementById('workout-picker-backdrop');
  const list   = document.getElementById('workout-picker-list');
  if (!modal || !sheet || !backd || !list) return;

  list.innerHTML = Object.entries(WORKOUT_TEMPLATES).map(([key, tpl]) => {
    const icon = templateIcon(tpl.icon);
    return `
      <button
        type="button"
        onclick="pickWorkoutTemplate('${key}')"
        class="w-full card p-4 text-left flex items-center gap-3 active:scale-[0.98] transition-transform">
        <div class="w-11 h-11 rounded-xl bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
          ${icon}
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-white">${escapeHtml(tpl.label)}</p>
          <p class="text-zinc-500 text-xs mt-0.5">${escapeHtml(tpl.subtitle)}</p>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-zinc-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
        </svg>
      </button>
    `;
  }).join('');

  modal.classList.remove('hidden');
  modal.classList.add('flex');

  requestAnimationFrame(() => {
    backd.classList.remove('opacity-0');
    backd.classList.add('opacity-100');
    sheet.classList.remove('translate-y-full', 'sm:translate-y-4', 'sm:scale-95', 'opacity-0');
    sheet.classList.add('translate-y-0', 'sm:translate-y-0', 'sm:scale-100', 'opacity-100');
  });

  document.addEventListener('keydown', onPickerKeydown);
  backd.onclick = closeWorkoutPicker;
}

function closeWorkoutPicker() {
  const modal = document.getElementById('workout-picker-modal');
  const sheet = document.getElementById('workout-picker-sheet');
  const backd = document.getElementById('workout-picker-backdrop');
  if (!modal || !sheet || !backd) return;

  backd.classList.remove('opacity-100');
  backd.classList.add('opacity-0');
  sheet.classList.remove('translate-y-0', 'sm:translate-y-0', 'sm:scale-100', 'opacity-100');
  sheet.classList.add('translate-y-full', 'sm:translate-y-4', 'sm:scale-95', 'opacity-0');

  setTimeout(() => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }, 280);

  document.removeEventListener('keydown', onPickerKeydown);
}

function onPickerKeydown(event) {
  if (event.key === 'Escape') closeWorkoutPicker();
}

function pickWorkoutTemplate(templateName) {
  closeWorkoutPicker();
  setTimeout(() => startWorkout(templateName), 200);
}

function templateIcon(kind) {
  if (kind === 'push') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18"/>
      </svg>
    `;
  }
  if (kind === 'pull') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
      </svg>
    `;
  }
  if (kind === 'core') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
      </svg>
    `;
  }
  return `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
    </svg>
  `;
}

/* =========================================================================
   WORKOUT LIFECYCLE
   ========================================================================= */
function startWorkout(templateName = 'Push Day') {
  if (AppState.activeWorkout) { switchTab('workout'); return; }

  const template = WORKOUT_TEMPLATES[templateName];
  if (!template) {
    showToast?.(`Unbekannte Vorlage: ${templateName}`);
    return;
  }

  buildGhostCache();

  AppState.activeWorkout = {
    title: templateName,
    startedAt: new Date().toISOString(),
    exercises: template.exercises.map((name, idx) => {
      const libEx = findExerciseByName(name);
      return {
        id:     libEx?.id || `tmp_${idx}`,
        name:   name,
        muscle: libEx?.muscle || 'Push',
        sets:   [{ weight: 0, reps: 0, done: false }],
      };
    }),
  };

  AppState.workoutNote = '';
  const noteEl = document.getElementById('workout-note');
  if (noteEl) noteEl.value = '';

  AppState.workoutSeconds = 0;
  startWorkoutTimer();
  switchTab('workout');
  showToast?.(`${templateName} gestartet 💪`);
}

function startWorkoutTimer() {
  stopWorkoutTimer();
  AppState.workoutTimer = setInterval(() => {
    AppState.workoutSeconds += 1;
    updateWorkoutTimerDisplay();
  }, 1000);
  updateWorkoutTimerDisplay();
}

function stopWorkoutTimer() {
  if (AppState.workoutTimer) {
    clearInterval(AppState.workoutTimer);
    AppState.workoutTimer = null;
  }
}

function updateWorkoutTimerDisplay() {
  const el = document.getElementById('workout-timer');
  if (!el) return;
  const m = String(Math.floor(AppState.workoutSeconds / 60)).padStart(2, '0');
  const s = String(AppState.workoutSeconds % 60).padStart(2, '0');
  el.textContent = `${m}:${s}`;
}

function finishWorkout() {
  if (!AppState.activeWorkout) return;
  const workout = AppState.activeWorkout;

  const cleanedExercises = workout.exercises
    .map((ex) => ({
      id:     ex.id,
      name:   ex.name,
      muscle: ex.muscle,
      sets:   ex.sets
        .filter((s) => s.done)
        .map((s) => ({
          weight: Number(s.weight) || 0,
          reps:   Number(s.reps)   || 0,
        })),
    }))
    .filter((ex) => ex.sets.length > 0);

  const noteEl = document.getElementById('workout-note');
  const note = noteEl ? String(noteEl.value || '').trim().slice(0, 500) : '';

  if (cleanedExercises.length === 0) {
    if (!window.confirm('Du hast keinen Satz abgehakt. Workout wirklich verwerfen?')) return;
    AppState.activeWorkout = null;
    AppState.workoutNote = '';
    stopWorkoutTimer();
    AppState.workoutSeconds = 0;
    if (noteEl) noteEl.value = '';
    renderWorkoutPage();
    showToast?.('Workout verworfen');
    switchTab('dashboard');
    return;
  }

  const totalSets   = cleanedExercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const totalVolume = cleanedExercises.reduce(
    (sum, ex) => sum + ex.sets.reduce((s, set) => s + set.weight * set.reps, 0),
    0
  );
  const durationSec = AppState.workoutSeconds;
  const durationMin = Math.round(durationSec / 60);

  const entry = {
    id:         generateId('w'),
    date:       new Date().toISOString(),
    title:      workout.title,
    startedAt:  workout.startedAt,
    endedAt:    new Date().toISOString(),
    durationSec,
    durationMin,
    note:       note,
    exercises:  cleanedExercises,
    stats: {
      exerciseCount: cleanedExercises.length,
      setCount:      totalSets,
      volumeKg:      Math.round(totalVolume),
    },
  };

  const ok = saveWorkoutToStorage(entry);
  if (!ok) return;

  AppState.activeWorkout = null;
  AppState.workoutNote = '';
  stopWorkoutTimer();
  AppState.workoutSeconds = 0;
  if (noteEl) noteEl.value = '';
  buildGhostCache();
  renderWorkoutPage();
  showToast?.(`Workout gespeichert · ${durationMin} Min · ${totalSets} Sätze`);
  switchTab('dashboard');
}

function cancelWorkout() {
  if (!AppState.activeWorkout) return;
  if (!window.confirm('Workout wirklich abbrechen? Es wird nicht gespeichert.')) return;

  const noteEl = document.getElementById('workout-note');
  if (noteEl) noteEl.value = '';

  AppState.activeWorkout = null;
  AppState.workoutNote = '';
  stopWorkoutTimer();
  AppState.workoutSeconds = 0;
  renderWorkoutPage();
  showToast?.('Workout abgebrochen');
  switchTab('dashboard');
}

/* =========================================================================
   STORAGE – WORKOUTS & GEWICHTE
   ========================================================================= */
function getStoredWorkouts() {
  return safeParseArray(storageGet(STORAGE_KEYS.WORKOUTS));
}

function saveWorkoutToStorage(entry) {
  const all = getStoredWorkouts();
  all.unshift(entry);
  return storageSet(STORAGE_KEYS.WORKOUTS, JSON.stringify(all));
}

function getStoredWeights() {
  return safeParseArray(storageGet(STORAGE_KEYS.WEIGHTS));
}

function saveWeightToStorage(entry) {
  const all = getStoredWeights();
  const existingIdx = all.findIndex((w) => w.date === entry.date);
  const wasUpdate = existingIdx >= 0;

  if (wasUpdate) all[existingIdx] = entry;
  else all.push(entry);

  all.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  storageSet(STORAGE_KEYS.WEIGHTS, JSON.stringify(all));

  return { ok: true, wasUpdate };
}

/* =========================================================================
   DASHBOARD
   ========================================================================= */
function renderDashboard() {
  renderDashboardWeight();
  renderDashboardSessions();
  renderWeekDots();
  renderLastWorkoutWidget();
}

function renderDashboardWeight() {
  const weights = getStoredWeights().slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const valEl = document.getElementById('dash-weight');
  if (!valEl) return;

  if (weights.length === 0) {
    valEl.innerHTML = `— <span class="text-sm font-medium text-zinc-500">kg</span>`;
    const diffEl = valEl.nextElementSibling;
    if (diffEl) {
      diffEl.className = 'text-zinc-500 text-xs font-medium mt-1';
      diffEl.textContent = 'Noch keine Daten';
    }
    return;
  }

  const latest = weights[weights.length - 1];
  valEl.innerHTML = `${latest.value.toFixed(1).replace('.', ',')} <span class="text-sm font-medium text-zinc-500">kg</span>`;

  const diffEl = valEl.nextElementSibling;
  if (!diffEl) return;

  if (weights.length < 2) {
    diffEl.className = 'text-zinc-500 text-xs font-medium mt-1';
    diffEl.textContent = 'Erster Eintrag';
    return;
  }

  const prev = weights[weights.length - 2];
  const diff = latest.value - prev.value;
  const sign = diff > 0 ? '+' : '';
  const isDown = diff < 0;
  diffEl.className = `text-xs font-medium mt-1 flex items-center gap-1 ${isDown ? 'text-emerald-400' : (diff > 0 ? 'text-orange-400' : 'text-zinc-500')}`;
  diffEl.innerHTML = diff === 0
    ? 'unverändert'
    : `
      <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M${isDown ? '5 10l7-7m0 0l7 7m-7-7v18' : '19 14l-7 7m0 0l-7-7m7 7V3'}"/>
      </svg>
      ${sign}${diff.toFixed(1).replace('.', ',')} kg
    `;
}

function renderDashboardSessions() {
  const el = document.getElementById('dash-sessions');
  if (!el) return;
  el.textContent = countWeekSessions();
}

function countWeekSessions() {
  const workouts = getStoredWorkouts();
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);

  return workouts.filter((w) => {
    const d = new Date(w.date);
    return d >= monday && d < sunday;
  }).length;
}

function renderWeekDots() {
  const container = document.getElementById('week-dots');
  if (!container) return;

  const workouts = getStoredWorkouts();
  const now = new Date();
  const todayIdx = (now.getDay() + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - todayIdx);
  monday.setHours(0, 0, 0, 0);

  const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const doneDays = new Set();

  for (const w of workouts) {
    const d = new Date(w.date);
    if (d >= monday) {
      const diffDays = Math.floor((d - monday) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 7) doneDays.add(diffDays);
    }
  }

  container.innerHTML = days.map((d, i) => {
    let cls = 'day-dot';
    if (doneDays.has(i) && i <= todayIdx) cls += ' done';
    else if (i === todayIdx) cls += ' today';
    else if (i > todayIdx) cls += ' future';
    else cls += ' rest';
    return `<div class="${cls}">${d}</div>`;
  }).join('');
}

function renderLastWorkoutWidget() {
  const widget = document.getElementById('last-workout-widget');
  if (!widget) return;

  const workouts = getStoredWorkouts();
  if (workouts.length === 0) {
    widget.innerHTML = `<p class="text-sm text-zinc-500">Noch keine Workouts</p>`;
    return;
  }

  const last = workouts[0];
  const d = new Date(last.date);
  widget.innerHTML = `
    <div class="flex items-center gap-4">
      <div class="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-medium text-white truncate">${escapeHtml(last.title)}</p>
        <p class="text-zinc-500 text-xs mt-0.5">${formatDateRelative(d)} · ${last.durationMin} Min · ${last.stats?.exerciseCount || 0} Übungen</p>
      </div>
    </div>
  `;
}

/* =========================================================================
   WORKOUT-PAGE
   ========================================================================= */
function renderWorkoutPage() {
  const emptyEl  = document.getElementById('workout-empty');
  const activeEl = document.getElementById('workout-active');
  if (!emptyEl || !activeEl) return;

  if (!AppState.activeWorkout) {
    emptyEl.classList.remove('hidden');
    activeEl.classList.add('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  activeEl.classList.remove('hidden');

  const titleEl = document.getElementById('workout-title');
  if (titleEl) titleEl.textContent = AppState.activeWorkout.title;

  const noteEl = document.getElementById('workout-note');
  if (noteEl && AppState.workoutNote && !noteEl.value) {
    noteEl.value = AppState.workoutNote;
  }

  updateWorkoutTimerDisplay();
  renderWorkoutExercises();
}

function renderWorkoutExercises() {
  const container = document.getElementById('workout-exercises');
  if (!container || !AppState.activeWorkout) return;

  container.innerHTML = AppState.activeWorkout.exercises
    .map((ex, exIdx) => renderExerciseCard(ex, exIdx))
    .join('');

  attachWorkoutListeners();
}

function renderExerciseCard(exercise, exIdx) {
  const ghost = getGhostData(exercise.name);

  const ghostBadge = ghost
    ? `
      <div class="mt-3 flex items-center gap-2 text-[11px] text-zinc-500 bg-zinc-900/40 rounded-lg px-3 py-1.5">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-cyan-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span>Letztes Mal: <span class="text-cyan-400/80 font-medium">${ghost.weight} kg × ${ghost.reps}</span></span>
      </div>
    `
    : '';

  const setsHtml = exercise.sets
    .map((set, setIdx) => renderSetRow(set, exIdx, setIdx, ghost))
    .join('');

  return `
    <div class="card p-4" data-exercise-index="${exIdx}">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 text-xs font-bold">
            ${exIdx + 1}
          </div>
          <div>
            <p class="font-medium text-white">${escapeHtml(exercise.name)}</p>
            ${exercise.muscle ? `<p class="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">${escapeHtml(exercise.muscle)}</p>` : ''}
          </div>
        </div>
        <button
          type="button"
          class="text-zinc-600 hover:text-red-400 p-1"
          data-action="remove-exercise"
          data-exercise-index="${exIdx}"
          aria-label="Übung entfernen">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      ${ghostBadge}

      <div class="space-y-1.5 mt-3">
        ${setsHtml}
        <button
          type="button"
          class="w-full text-cyan-400 text-xs font-medium py-2 hover:bg-cyan-500/5 rounded-lg transition-colors"
          data-action="add-set"
          data-exercise-index="${exIdx}">
          + Satz hinzufügen
        </button>
      </div>
    </div>
  `;
}

function renderSetRow(set, exIdx, setIdx, ghost) {
  const doneClass  = set.done
    ? 'bg-cyan-500/10 border-cyan-500/40'
    : 'bg-zinc-900/50 border-transparent';
  const checkClass = set.done
    ? 'bg-cyan-500 border-cyan-500 text-zinc-950'
    : 'bg-zinc-800 border-zinc-700 text-transparent';

  const showGhostPlaceholder = ghost && setIdx === 0 && !set.done && Number(set.weight) === 0;
  const weightPlaceholder = showGhostPlaceholder ? `z.B. ${ghost.weight}` : 'kg';
  const repsPlaceholder   = showGhostPlaceholder ? `z.B. ${ghost.reps}`   : 'Wdh';

  return `
    <div
      class="set-row flex items-center gap-2 rounded-lg px-3 py-2 border transition-all duration-200 ${doneClass}"
      data-exercise-index="${exIdx}"
      data-set-index="${setIdx}">

      <button
        type="button"
        class="set-checkbox w-7 h-7 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all active:scale-90 ${checkClass}"
        data-action="toggle-set"
        data-exercise-index="${exIdx}"
        data-set-index="${setIdx}"
        aria-label="Satz als erledigt markieren">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
      </button>

      <div class="flex items-center gap-1.5 flex-1 min-w-0">
        <input
          type="number"
          inputmode="decimal"
          step="0.5"
          min="0"
          value="${set.weight}"
          placeholder="${weightPlaceholder}"
          class="set-input w-16 bg-zinc-950/60 border border-zinc-800 rounded-lg px-2 py-1.5 text-white text-sm text-center placeholder-zinc-700 focus:outline-none focus:border-cyan-500 transition-colors"
          data-field="weight"
          data-exercise-index="${exIdx}"
          data-set-index="${setIdx}">
        <span class="text-zinc-600 text-xs">×</span>
        <input
          type="number"
          inputmode="numeric"
          step="1"
          min="0"
          value="${set.reps}"
          placeholder="${repsPlaceholder}"
          class="set-input w-16 bg-zinc-950/60 border border-zinc-800 rounded-lg px-2 py-1.5 text-white text-sm text-center placeholder-zinc-700 focus:outline-none focus:border-cyan-500 transition-colors"
          data-field="reps"
          data-exercise-index="${exIdx}"
          data-set-index="${setIdx}">
      </div>

      <button
        type="button"
        class="text-zinc-600 hover:text-red-400 p-1 flex-shrink-0"
        data-action="remove-set"
        data-exercise-index="${exIdx}"
        data-set-index="${setIdx}"
        aria-label="Satz entfernen">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4"/>
        </svg>
      </button>
    </div>
  `;
}

function attachWorkoutListeners() {
  const container = document.getElementById('workout-exercises');
  if (!container) return;
  if (container.dataset.listenersAttached === 'true') return;
  container.dataset.listenersAttached = 'true';

  container.addEventListener('click', (event) => {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;

    const action = actionEl.dataset.action;
    const exIdx  = parseInt(actionEl.dataset.exerciseIndex, 10);
    const setIdx = actionEl.dataset.setIndex !== undefined
      ? parseInt(actionEl.dataset.setIndex, 10)
      : null;

    switch (action) {
      case 'toggle-set':      toggleSetDone(exIdx, setIdx); break;
      case 'add-set':         addSetToExercise(exIdx); break;
      case 'remove-set':      removeSetFromExercise(exIdx, setIdx); break;
      case 'remove-exercise': removeExercise(exIdx); break;
    }
  });

  container.addEventListener('input', (event) => {
    const input = event.target.closest('.set-input');
    if (!input) return;

    const exIdx  = parseInt(input.dataset.exerciseIndex, 10);
    const setIdx = parseInt(input.dataset.setIndex, 10);
    const field  = input.dataset.field;

    const set = AppState.activeWorkout?.exercises[exIdx]?.sets[setIdx];
    if (!set) return;

    const raw = input.value.trim().replace(',', '.');
    set[field] = raw === '' ? 0 : Number(raw);
  });

  container.addEventListener('focusin', (event) => {
    const input = event.target.closest('.set-input');
    if (!input) return;
    input.select();
  });
}

function attachWorkoutNoteListener() {
  const noteEl = document.getElementById('workout-note');
  if (!noteEl) return;
  if (noteEl.dataset.listenerAttached === 'true') return;
  noteEl.dataset.listenerAttached = 'true';

  noteEl.addEventListener('input', (event) => {
    AppState.workoutNote = String(event.target.value || '').slice(0, 500);
  });
}

function toggleSetDone(exIdx, setIdx) {
  const set = AppState.activeWorkout?.exercises[exIdx]?.sets[setIdx];
  if (!set) return;

  set.done = !set.done;

  const row = document.querySelector(
    `.set-row[data-exercise-index="${exIdx}"][data-set-index="${setIdx}"]`
  );
  if (row) {
    row.classList.toggle('bg-cyan-500/10', set.done);
    row.classList.toggle('border-cyan-500/40', set.done);
    row.classList.toggle('bg-zinc-900/50', !set.done);
    row.classList.toggle('border-transparent', !set.done);

    const checkbox = row.querySelector('.set-checkbox');
    if (checkbox) {
      checkbox.classList.toggle('bg-cyan-500', set.done);
      checkbox.classList.toggle('border-cyan-500', set.done);
      checkbox.classList.toggle('text-zinc-950', set.done);
      checkbox.classList.toggle('bg-zinc-800', !set.done);
      checkbox.classList.toggle('border-zinc-700', !set.done);
      checkbox.classList.toggle('text-transparent', !set.done);
    }
  }

  if (set.done && (Number(set.weight) > 0 || Number(set.reps) > 0)) {
    showToast?.(`Satz erledigt · ${set.weight} kg × ${set.reps}`);
  }
}

function addSetToExercise(exIdx) {
  const exercise = AppState.activeWorkout?.exercises[exIdx];
  if (!exercise) return;

  exercise.sets.push({ weight: 0, reps: 0, done: false });
  renderWorkoutExercises();

  requestAnimationFrame(() => {
    const newRow = document.querySelector(
      `.set-row[data-exercise-index="${exIdx}"][data-set-index="${exercise.sets.length - 1}"]`
    );
    const input = newRow?.querySelector('.set-input');
    input?.focus();
    input?.select();
  });
}

function removeSetFromExercise(exIdx, setIdx) {
  const exercise = AppState.activeWorkout?.exercises[exIdx];
  if (!exercise) return;

  if (exercise.sets.length <= 1) { showToast?.('Mindestens ein Satz erforderlich'); return; }
  exercise.sets.splice(setIdx, 1);
  renderWorkoutExercises();
}

function removeExercise(exIdx) {
  const workout = AppState.activeWorkout;
  if (!workout) return;
  if (workout.exercises.length <= 1) { showToast?.('Mindestens eine Übung erforderlich'); return; }
  workout.exercises.splice(exIdx, 1);
  renderWorkoutExercises();
}

/* =========================================================================
   WORKOUT-TITEL EDITOR
   ========================================================================= */
function openTitleEditor() {
  if (!AppState.activeWorkout) return;

  const modal = document.getElementById('title-editor-modal');
  const sheet = document.getElementById('title-editor-sheet');
  const backd = document.getElementById('title-editor-backdrop');
  const input = document.getElementById('title-editor-input');
  if (!modal || !sheet || !backd || !input) return;

  input.value = AppState.activeWorkout.title || '';

  modal.classList.remove('hidden');
  modal.classList.add('flex');

  requestAnimationFrame(() => {
    backd.classList.remove('opacity-0');
    backd.classList.add('opacity-100');
    sheet.classList.remove('opacity-0', 'scale-95');
    sheet.classList.add('opacity-100', 'scale-100');
    input.focus();
    input.select();
  });

  document.addEventListener('keydown', onTitleEditorKeydown);
  backd.onclick = closeTitleEditor;
}

function closeTitleEditor() {
  const modal = document.getElementById('title-editor-modal');
  const sheet = document.getElementById('title-editor-sheet');
  const backd = document.getElementById('title-editor-backdrop');
  if (!modal || !sheet || !backd) return;

  backd.classList.remove('opacity-100');
  backd.classList.add('opacity-0');
  sheet.classList.remove('opacity-100', 'scale-100');
  sheet.classList.add('opacity-0', 'scale-95');

  setTimeout(() => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }, 180);

  document.removeEventListener('keydown', onTitleEditorKeydown);
}

function onTitleEditorKeydown(event) {
  if (event.key === 'Escape') closeTitleEditor();
  if (event.key === 'Enter') saveWorkoutTitle();
}

function saveWorkoutTitle() {
  const input = document.getElementById('title-editor-input');
  if (!input || !AppState.activeWorkout) return;

  const newTitle = String(input.value || '').trim().slice(0, 40);
  if (!newTitle) {
    showToast?.('Titel darf nicht leer sein');
    return;
  }

  AppState.activeWorkout.title = newTitle;

  const titleEl = document.getElementById('workout-title');
  if (titleEl) titleEl.textContent = newTitle;

  closeTitleEditor();
  showToast?.('Titel aktualisiert');
}

/* =========================================================================
   ÜBUNGS-PICKER
   ========================================================================= */
function openExercisePicker() {
  if (!AppState.activeWorkout) return;

  const modal = document.getElementById('exercise-picker-modal');
  const sheet = document.getElementById('exercise-picker-sheet');
  const backd = document.getElementById('exercise-picker-backdrop');
  if (!modal || !sheet || !backd) return;

  AppState.exercisePickerFilter = 'Alle';
  AppState.exercisePickerSearch = '';

  const searchEl = document.getElementById('exercise-picker-search');
  if (searchEl) searchEl.value = '';

  renderExercisePickerFilters();
  renderExercisePickerList();

  modal.classList.remove('hidden');
  modal.classList.add('flex');

  requestAnimationFrame(() => {
    backd.classList.remove('opacity-0');
    backd.classList.add('opacity-100');
    sheet.classList.remove('translate-y-full', 'sm:translate-y-4', 'sm:scale-95', 'opacity-0');
    sheet.classList.add('translate-y-0', 'sm:translate-y-0', 'sm:scale-100', 'opacity-100');
  });

  document.addEventListener('keydown', onExercisePickerKeydown);
  backd.onclick = closeExercisePicker;
}

function closeExercisePicker() {
  const modal = document.getElementById('exercise-picker-modal');
  const sheet = document.getElementById('exercise-picker-sheet');
  const backd = document.getElementById('exercise-picker-backdrop');
  if (!modal || !sheet || !backd) return;

  backd.classList.remove('opacity-100');
  backd.classList.add('opacity-0');
  sheet.classList.remove('translate-y-0', 'sm:translate-y-0', 'sm:scale-100', 'opacity-100');
  sheet.classList.add('translate-y-full', 'sm:translate-y-4', 'sm:scale-95', 'opacity-0');

  setTimeout(() => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }, 280);

  document.removeEventListener('keydown', onExercisePickerKeydown);
}

function onExercisePickerKeydown(event) {
  if (event.key === 'Escape') closeExercisePicker();
}

function renderExercisePickerFilters() {
  const container = document.getElementById('exercise-picker-filters');
  if (!container) return;

  const filters = ['Alle', ...MUSCLE_GROUPS];
  container.innerHTML = filters.map((m) => {
    const isActive = m === AppState.exercisePickerFilter;
    const cls = isActive
      ? 'bg-cyan-500 text-zinc-950'
      : 'bg-zinc-800 text-zinc-400 border border-zinc-700';
    return `
      <button
        type="button"
        onclick="setExercisePickerFilter('${m}')"
        class="px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${cls}">
        ${m}
      </button>
    `;
  }).join('');
}

function setExercisePickerFilter(muscle) {
  AppState.exercisePickerFilter = muscle;
  renderExercisePickerFilters();
  renderExercisePickerList();
}

function renderExercisePickerList() {
  const container = document.getElementById('exercise-picker-list');
  if (!container) return;
  if (!AppState.activeWorkout) return;

  const all = getStoredExercises();
  const usedNames = new Set(
    AppState.activeWorkout.exercises.map((e) => e.name.toLowerCase())
  );

  let filtered = all;
  if (AppState.exercisePickerFilter !== 'Alle') {
    filtered = filtered.filter((e) => e.muscle === AppState.exercisePickerFilter);
  }
  if (AppState.exercisePickerSearch) {
    const q = AppState.exercisePickerSearch.toLowerCase();
    filtered = filtered.filter(
      (e) => e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q)
    );
  }

  filtered = filtered.slice().sort((a, b) => {
    const orderA = MUSCLE_GROUPS.indexOf(a.muscle);
    const orderB = MUSCLE_GROUPS.indexOf(b.muscle);
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name, 'de');
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="text-center py-10 text-zinc-600 text-sm">Keine Übungen gefunden</div>`;
    return;
  }

  const grouped = {};
  for (const ex of filtered) {
    if (!grouped[ex.muscle]) grouped[ex.muscle] = [];
    grouped[ex.muscle].push(ex);
  }

  container.innerHTML = Object.entries(grouped).map(([muscle, exercises]) => `
    <div class="mb-5">
      <h3 class="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2 px-1">${escapeHtml(muscle)}</h3>
      <div class="space-y-2">
        ${exercises.map((ex) => renderExercisePickerItem(ex, usedNames.has(ex.name.toLowerCase()))).join('')}
      </div>
    </div>
  `).join('');
}

function renderExercisePickerItem(ex, isUsed) {
  const ghost = getGhostData(ex.name);
  const ghostInfo = ghost
    ? `<p class="text-[10px] text-cyan-500/70 mt-0.5">zuletzt: ${ghost.weight} kg × ${ghost.reps}</p>`
    : '';

  const usedBadge = isUsed
    ? `<span class="text-[9px] font-semibold uppercase tracking-wider bg-zinc-700/60 text-zinc-400 px-1.5 py-0.5 rounded ml-2">bereits drin</span>`
    : '';

  const clickHandler = isUsed
    ? `onclick="event.stopPropagation()"`
    : `onclick="addExerciseFromPicker('${escapeHtml(ex.name).replace(/'/g, "\\'")}')"`;

  const itemClass = isUsed
    ? 'card p-3.5 flex items-center gap-3 opacity-50 cursor-not-allowed'
    : 'card p-3.5 flex items-center gap-3 cursor-pointer active:bg-zinc-800/40 transition-colors';

  const iconBg = isUsed ? 'bg-zinc-800/60' : 'bg-cyan-500/10';
  const iconColor = isUsed ? 'text-zinc-500' : 'text-cyan-400';

  return `
    <div class="${itemClass}" ${clickHandler}>
      <div class="w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 ${iconColor}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-medium text-white text-sm truncate">${escapeHtml(ex.name)}${usedBadge}</p>
        ${ghostInfo}
      </div>
      ${!isUsed ? `
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-zinc-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
        </svg>
      ` : ''}
    </div>
  `;
}

function addExerciseFromPicker(name) {
  if (!AppState.activeWorkout) return;

  const libEx = findExerciseByName(name);
  if (!libEx) {
    showToast?.('Übung nicht gefunden');
    return;
  }

  const exists = AppState.activeWorkout.exercises.some(
    (e) => e.name.toLowerCase() === libEx.name.toLowerCase()
  );
  if (exists) {
    showToast?.('Übung ist bereits im Workout');
    return;
  }

  AppState.activeWorkout.exercises.push({
    id:     libEx.id,
    name:   libEx.name,
    muscle: libEx.muscle,
    sets:   [{ weight: 0, reps: 0, done: false }],
  });

  renderWorkoutExercises();
  showToast?.(`${libEx.name} hinzugefügt`);
  closeExercisePicker();
}

function setupExercisePickerSearch() {
  const input = document.getElementById('exercise-picker-search');
  if (!input) return;
  if (input.dataset.listenerAttached === 'true') return;
  input.dataset.listenerAttached = 'true';

  input.addEventListener('input', (event) => {
    AppState.exercisePickerSearch = event.target.value;
    renderExercisePickerList();
  });
}

/* =========================================================================
   ÜBUNGEN-TAB
   ========================================================================= */
function renderExercisesTab() {
  renderExerciseFilters();
  renderExerciseLibrary();
}

function renderExerciseFilters() {
  const container = document.getElementById('muscle-filters');
  if (!container) return;

  const filters = ['Alle', ...MUSCLE_GROUPS];
  container.innerHTML = filters.map((m) => {
    const isActive = m === AppState.selectedMuscle;
    const cls = isActive
      ? 'bg-cyan-500 text-zinc-950'
      : 'bg-zinc-900 text-zinc-400 border border-zinc-800';
    return `
      <button
        type="button"
        onclick="filterExerciseGroup('${m}')"
        class="px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${cls}">
        ${m}
      </button>
    `;
  }).join('');
}

function filterExerciseGroup(muscle) {
  AppState.selectedMuscle = muscle;
  renderExerciseFilters();
  renderExerciseLibrary();
}

function renderExerciseLibrary() {
  const container = document.getElementById('exercise-list');
  if (!container) return;

  const all = getStoredExercises();

  let filtered = all;
  if (AppState.selectedMuscle !== 'Alle') {
    filtered = filtered.filter((e) => e.muscle === AppState.selectedMuscle);
  }
  if (AppState.searchQuery) {
    const q = AppState.searchQuery.toLowerCase();
    filtered = filtered.filter(
      (e) => e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q)
    );
  }

  filtered = filtered.slice().sort((a, b) => {
    const orderA = MUSCLE_GROUPS.indexOf(a.muscle);
    const orderB = MUSCLE_GROUPS.indexOf(b.muscle);
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name, 'de');
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="text-center py-10 text-zinc-600 text-sm">Keine Übungen gefunden</div>`;
    return;
  }

  const grouped = {};
  for (const ex of filtered) {
    if (!grouped[ex.muscle]) grouped[ex.muscle] = [];
    grouped[ex.muscle].push(ex);
  }

  container.innerHTML = Object.entries(grouped).map(([muscle, exercises]) => `
    <div>
      <h3 class="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2 px-1">${escapeHtml(muscle)}</h3>
      <div class="space-y-2">
        ${exercises.map((ex) => renderExerciseLibraryItem(ex)).join('')}
      </div>
    </div>
  `).join('');
}

function renderExerciseLibraryItem(ex) {
  const ghost = getGhostData(ex.name);
  const ghostInfo = ghost
    ? `<p class="text-[10px] text-cyan-500/70 mt-0.5">zuletzt: ${ghost.weight} kg × ${ghost.reps}</p>`
    : '';

  const customBadge = ex.custom
    ? `<span class="text-[9px] font-semibold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded ml-2">eigen</span>`
    : '';

  const deleteBtn = ex.custom
    ? `
      <button
        type="button"
        onclick="event.stopPropagation(); removeCustomExercise('${ex.id}')"
        class="text-zinc-600 hover:text-red-400 p-2 flex-shrink-0"
        aria-label="Übung entfernen">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/>
        </svg>
      </button>
    `
    : `
      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-zinc-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
      </svg>
    `;

  return `
    <div
      class="card p-4 flex items-center gap-3 transition-colors cursor-pointer active:bg-zinc-800/40"
      onclick="showToast('${escapeHtml(ex.name)}')">
      <div class="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-medium text-white truncate">
          ${escapeHtml(ex.name)}${customBadge}
        </p>
        ${ghostInfo}
      </div>
      ${deleteBtn}
    </div>
  `;
}

function toggleExerciseForm() {
  const form = document.getElementById('exercise-form');
  if (!form) return;
  form.classList.toggle('hidden');
  if (!form.classList.contains('hidden')) {
    document.getElementById('new-exercise-name')?.focus();
  }
}

function saveNewExercise() {
  const nameEl   = document.getElementById('new-exercise-name');
  const muscleEl = document.getElementById('new-exercise-muscle');
  if (!nameEl || !muscleEl) return;

  const name   = nameEl.value.trim();
  const muscle = muscleEl.value;

  const ok = addExerciseToLibrary(name, muscle);
  if (!ok) return;

  nameEl.value = '';
  muscleEl.value = 'Push';
  toggleExerciseForm();
  renderExerciseLibrary();
  showToast?.(`"${name}" hinzugefügt`);
}

function removeCustomExercise(id) {
  const all = getStoredExercises();
  const ex  = all.find((e) => e.id === id);
  if (!ex) return;
  if (!window.confirm(`"${ex.name}" wirklich aus der Bibliothek entfernen?`)) return;

  const filtered = all.filter((e) => e.id !== id);
  saveExercisesToStorage(filtered);
  renderExerciseLibrary();
  showToast?.(`"${ex.name}" entfernt`);
}

function setupExerciseSearch() {
  const input = document.getElementById('exercise-search');
  if (!input) return;
  if (input.dataset.listenerAttached === 'true') return;
  input.dataset.listenerAttached = 'true';
  input.addEventListener('input', (event) => {
    AppState.searchQuery = event.target.value;
    renderExerciseLibrary();
  });
}

/* =========================================================================
   VERLAUF / GEWICHT
   ========================================================================= */
function saveWeight() {
  const dateEl   = document.getElementById('weight-date');
  const weightEl = document.getElementById('weight-input');
  if (!dateEl || !weightEl) return;

  const dateStr = dateEl.value || new Date().toISOString().slice(0, 10);
  const raw     = String(weightEl.value).trim().replace(',', '.');
  const value   = Number(raw);

  if (!raw || isNaN(value) || value <= 0 || value > 500) {
    showToast?.('Bitte gültiges Gewicht eingeben');
    return;
  }

  const result = saveWeightToStorage({ date: dateStr, value: Number(value.toFixed(1)) });
  if (!result.ok) return;

  if (result.wasUpdate) {
    const today = new Date().toISOString().slice(0, 10);
    const isToday = dateStr === today;
    showToast?.(isToday
      ? 'Gewicht für heute aktualisiert'
      : `Gewicht für ${formatDateShort(dateStr)} aktualisiert`
    );
  } else {
    showToast?.(`${value.toFixed(1)} kg gespeichert`);
  }

  weightEl.value = '';
  renderWeightTab();
  renderDashboardWeight();
}

function renderWeightTab() {
  renderWeightSummary();
  renderWeightChart();
  renderWeightHistoryList();
}

function renderWeightSummary() {
  const currentEl = document.getElementById('weight-current');
  const summaryEl = document.getElementById('weight-summary');
  if (!currentEl || !summaryEl) return;

  const weights = getStoredWeights().slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));

  if (weights.length === 0) {
    currentEl.textContent = '—';
    summaryEl.textContent = 'keine Einträge';
    return;
  }

  const latest = weights[weights.length - 1];
  const first  = weights[0];

  currentEl.textContent = `${latest.value.toFixed(1)} kg`;

  const diff = latest.value - first.value;
  const sign = diff > 0 ? '+' : '';
  const diffText = weights.length > 1
    ? `${sign}${diff.toFixed(1).replace('.', ',')} kg seit Start`
    : 'Erster Eintrag';
  summaryEl.textContent = `${weights.length} ${weights.length === 1 ? 'Eintrag' : 'Einträge'} · ${diffText}`;
}

function renderWeightChart() {
  const canvas = document.getElementById('weight-chart');
  const emptyEl = document.getElementById('weight-chart-empty');
  if (!canvas) return;

  const weights = getStoredWeights().slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));

  if (weights.length === 0) {
    if (emptyEl) emptyEl.style.display = 'flex';
    if (weightChartInstance) { weightChartInstance.destroy(); weightChartInstance = null; }
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  if (typeof Chart === 'undefined') return;

  if (weightChartInstance) { weightChartInstance.destroy(); weightChartInstance = null; }

  const labels = weights.map((w) => {
    const d = new Date(w.date);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
  });
  const data = weights.map((w) => w.value);

  const minV = Math.min(...data);
  const maxV = Math.max(...data);
  const span = Math.max(4, maxV - minV + 1);
  const yMin = Math.floor(minV - span * 0.15);
  const yMax = Math.ceil(maxV + span * 0.15);

  weightChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Körpergewicht (kg)',
        data,
        borderColor: '#22d3ee',
        backgroundColor: 'rgba(34, 211, 238, 0.12)',
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        pointBackgroundColor: '#22d3ee',
        pointBorderColor: '#0a0a0b',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1c1c1f',
          borderColor: '#2a2a2e',
          borderWidth: 1,
          titleColor: '#fafafa',
          bodyColor: '#22d3ee',
          titleFont: { family: 'Inter', size: 11, weight: '600' },
          bodyFont:  { family: 'Inter', size: 13, weight: '700' },
          padding: 10,
          displayColors: false,
          callbacks: { label: (ctx) => `${ctx.parsed.y.toFixed(1)} kg` },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: '#71717a',
            font: { family: 'Inter', size: 10 },
            maxRotation: 0,
            autoSkipPadding: 12,
          },
        },
        y: {
          min: yMin,
          max: yMax,
          grid: { color: 'rgba(113, 113, 122, 0.12)' },
          border: { display: false },
          ticks: {
            color: '#71717a',
            font: { family: 'Inter', size: 10 },
            callback: (v) => `${v}`,
            maxTicksLimit: 5,
          },
        },
      },
    },
  });
}

function renderWeightHistoryList() {
  const container = document.getElementById('weight-history-list');
  if (!container) return;

  const weights = getStoredWeights().slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));

  if (weights.length === 0) {
    container.innerHTML = `<div class="text-center py-6 text-zinc-600 text-xs">Noch keine Einträge</div>`;
    return;
  }

  container.innerHTML = weights.map((w, idx) => {
    const prev = weights[idx + 1];
    let diffHtml = '';
    if (prev) {
      const diff = w.value - prev.value;
      const sign = diff > 0 ? '+' : '';
      const color = diff > 0 ? 'text-orange-400' : (diff < 0 ? 'text-emerald-400' : 'text-zinc-500');
      diffHtml = `<span class="${color} text-[11px] font-medium">${sign}${diff.toFixed(1).replace('.', ',')} kg</span>`;
    }

    return `
      <div class="card px-4 py-2.5 flex items-center justify-between gap-3">
        <div class="flex-1 min-w-0">
          <p class="text-white text-sm font-medium">${formatDateShort(w.date)}</p>
        </div>
        <div class="flex items-center gap-3 flex-shrink-0">
          ${diffHtml}
          <p class="text-white font-semibold text-sm tabular-nums">${w.value.toFixed(1)} kg</p>
          <button
            type="button"
            onclick="deleteWeightEntry('${w.date}')"
            class="text-zinc-600 hover:text-red-400 p-1"
            aria-label="Eintrag löschen">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function deleteWeightEntry(dateStr) {
  const all = getStoredWeights();
  const filtered = all.filter((w) => w.date !== dateStr);
  const ok = storageSet(STORAGE_KEYS.WEIGHTS, JSON.stringify(filtered));
  if (!ok) return;
  renderWeightTab();
  renderDashboardWeight();
  showToast?.('Eintrag gelöscht');
}

function renderWorkoutHistory() {
  const container = document.getElementById('history-list');
  if (!container) return;

  const workouts = getStoredWorkouts();

  if (workouts.length === 0) {
    container.innerHTML = `
      <div class="card p-8 text-center">
        <p class="text-zinc-500 text-sm">Noch keine Workouts abgeschlossen</p>
        <p class="text-zinc-600 text-xs mt-1">Starte dein erstes Training im Workout-Tab</p>
      </div>
    `;
    return;
  }

  container.innerHTML = workouts.map((w) => {
    const d = new Date(w.date);
    const dateLabel = formatDateRelative(d);
    const noteHtml = w.note
      ? `
        <p class="text-[11px] text-zinc-500 mt-2 italic line-clamp-2 pl-1 border-l-2 border-zinc-700">
          ${escapeHtml(w.note)}
        </p>
      `
      : '';

    return `
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-white truncate">${escapeHtml(w.title || 'Workout')}</p>
            <p class="text-zinc-500 text-xs mt-0.5">
              ${dateLabel} · ${w.stats?.exerciseCount ?? 0} ${(w.stats?.exerciseCount === 1) ? 'Übung' : 'Übungen'} · ${w.durationMin ?? 0} Min
            </p>
          </div>
          <div class="text-right flex-shrink-0">
            <p class="text-cyan-400 text-sm font-semibold tabular-nums">${formatNumber(w.stats?.volumeKg || 0)} kg</p>
            <p class="text-zinc-600 text-[10px]">Volumen</p>
          </div>
        </div>
        ${noteHtml}
      </div>
    `;
  }).join('');
}

function refreshHistory() {
  renderWeightTab();
  renderWorkoutHistory();
}

function setupWeightForm() {
  const dateEl = document.getElementById('weight-date');
  if (!dateEl) return;
  if (!dateEl.value) dateEl.value = new Date().toISOString().slice(0, 10);
}

/* =========================================================================
   BACKUP – EXPORT / IMPORT
   ========================================================================= */
const BACKUP_VERSION = 1;

function exportData() {
  try {
    const payload = {
      app:         'GymTracker',
      version:     BACKUP_VERSION,
      exportedAt:  new Date().toISOString(),
      data: {
        workouts:  getStoredWorkouts(),
        weights:   getStoredWeights(),
        exercises: getStoredExercises(),
      },
    };

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    const date = new Date().toISOString().slice(0, 10);
    const filename = `gymtracker-backup-${date}.json`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);

    const totalCount =
      payload.data.workouts.length +
      payload.data.weights.length +
      payload.data.exercises.length;

    showToast?.(`Backup erstellt · ${totalCount} Einträge`);
  } catch (err) {
    console.error('Export fehlgeschlagen:', err);
    showToast?.('Export fehlgeschlagen');
  }
}

function importDataFromFile(file) {
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast?.('Datei zu groß (max. 5 MB)');
    return;
  }

  const reader = new FileReader();

  reader.onerror = () => { showToast?.('Datei konnte nicht gelesen werden'); };

  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);

      if (!parsed || typeof parsed !== 'object') {
        showToast?.('Ungültige Backup-Datei');
        return;
      }

      const data = parsed.data || parsed;
      if (!data || typeof data !== 'object') {
        showToast?.('Ungültige Backup-Datei');
        return;
      }

      const workouts  = Array.isArray(data.workouts)  ? data.workouts  : [];
      const weights   = Array.isArray(data.weights)   ? data.weights   : [];
      const exercises = Array.isArray(data.exercises) ? data.exercises : [];

      const totalNew = workouts.length + weights.length + exercises.length;

      if (totalNew === 0) {
        showToast?.('Backup enthält keine Daten');
        return;
      }

      const msg =
        `Backup gefunden:\n\n` +
        `• ${workouts.length} Workouts\n` +
        `• ${weights.length} Gewichtseinträge\n` +
        `• ${exercises.length} Übungen\n\n` +
        `Aktuelle Daten werden KOMPLETT überschrieben. Fortfahren?`;

      if (!window.confirm(msg)) {
        showToast?.('Import abgebrochen');
        return;
      }

      if (!storageSet(STORAGE_KEYS.WORKOUTS, JSON.stringify(workouts))) return;
      if (!storageSet(STORAGE_KEYS.WEIGHTS, JSON.stringify(weights))) return;
      if (exercises.length > 0) {
        if (!storageSet(STORAGE_KEYS.EXERCISES, JSON.stringify(exercises))) return;
      }
      storageSet(STORAGE_KEYS.SEEDED, '1');

      buildGhostCache();
      renderDashboard();
      renderExercisesTab();
      refreshHistory();

      showToast?.(`Import erfolgreich · ${totalNew} Einträge`);
    } catch (err) {
      console.error('Import fehlgeschlagen:', err);
      showToast?.('Import fehlgeschlagen – ungültiges Format');
    }
  };

  reader.readAsText(file);
}

function setupImportListener() {
  const input = document.getElementById('import-file');
  if (!input) return;
  if (input.dataset.listenerAttached === 'true') return;
  input.dataset.listenerAttached = 'true';

  input.addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    importDataFromFile(file);
    input.value = '';
  });
}

/* =========================================================================
   FORMAT-HELFER
   ========================================================================= */
function formatDateShort(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  return `${days[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function formatDateRelative(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return '—';

  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dateMidnight  = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((todayMidnight - dateMidnight) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Heute';
  if (diffDays === 1) return 'Gestern';
  if (diffDays < 7)   return `vor ${diffDays} Tagen`;

  const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  return `${days[date.getDay()]}, ${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
}

function formatNumber(n) {
  return Number(n || 0).toLocaleString('de-DE');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setGreeting() {
  const h = new Date().getHours();
  const el = document.getElementById('greeting');
  if (!el) return;
  if (h < 12) el.textContent = 'Guten Morgen';
  else if (h < 18) el.textContent = 'Guten Tag';
  else el.textContent = 'Guten Abend';
}

if (typeof window.showToast !== 'function') {
  let _toastTimeout;
  window.showToast = function (msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(_toastTimeout);
    _toastTimeout = setTimeout(() => toast.classList.remove('show'), 2200);
  };
}

/* =========================================================================
   GLOBAL EXPORTIEREN
   ========================================================================= */
window.switchTab              = switchTab;
window.startWorkout           = startWorkout;
window.finishWorkout          = finishWorkout;
window.cancelWorkout          = cancelWorkout;
window.renderWorkoutPage      = renderWorkoutPage;

/* Workout-Picker */
window.openWorkoutPicker      = openWorkoutPicker;
window.closeWorkoutPicker     = closeWorkoutPicker;
window.pickWorkoutTemplate    = pickWorkoutTemplate;

/* Titel-Editor */
window.openTitleEditor        = openTitleEditor;
window.closeTitleEditor       = closeTitleEditor;
window.saveWorkoutTitle       = saveWorkoutTitle;

/* Übungs-Picker */
window.openExercisePicker      = openExercisePicker;
window.closeExercisePicker     = closeExercisePicker;
window.setExercisePickerFilter = setExercisePickerFilter;
window.addExerciseFromPicker   = addExerciseFromPicker;

/* Übungen-Tab */
window.toggleExerciseForm     = toggleExerciseForm;
window.saveNewExercise        = saveNewExercise;
window.removeCustomExercise   = removeCustomExercise;
window.filterExerciseGroup    = filterExerciseGroup;

/* Verlauf */
window.saveWeight             = saveWeight;
window.deleteWeightEntry      = deleteWeightEntry;
window.refreshHistory         = refreshHistory;

/* Backup */
window.exportData             = exportData;
window.importDataFromFile     = importDataFromFile;

/* Dev */
window.seedInitialData        = seedInitialData;

window.GymStorage = {
  getWorkouts:     getStoredWorkouts,
  saveWorkout:     saveWorkoutToStorage,
  getWeights:      getStoredWeights,
  saveWeight:      saveWeightToStorage,
  getExercises:    getStoredExercises,
  saveExercises:   saveExercisesToStorage,
  addExercise:     addExerciseToLibrary,
  buildGhostCache: buildGhostCache,
  getGhostData:    getGhostData,
  KEYS:            STORAGE_KEYS,
  HAS_LOCALSTORAGE,
};

/* =========================================================================
   PWA – SERVICE WORKER
   ========================================================================= */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => console.log('[PWA] Service Worker registriert:', reg.scope))
      .catch((err) => console.warn('[PWA] Service Worker Registrierung fehlgeschlagen:', err));
  });
}

/* =========================================================================
   INITIALISIERUNG
   ========================================================================= */
document.addEventListener('DOMContentLoaded', () => {
  const seedResult = seedInitialData();
  if (seedResult.seeded) {
    console.log(`[GymTracker] Seed-Init: ${seedResult.count} Standard-Übungen angelegt.`);
  }

  buildGhostCache();
  setupExerciseSearch();
  setupExercisePickerSearch();
  setupWeightForm();
  setupImportListener();
  attachWorkoutNoteListener();
  setGreeting();

  renderWorkoutPage();
  renderExercisesTab();
  renderDashboard();

  switchTab(AppState.currentTab);
  refreshHistory();

  if (!HAS_LOCALSTORAGE) {
    console.warn('[GymTracker] localStorage nicht verfügbar.');
    setTimeout(() => {
      showToast?.('Hinweis: Daten werden nur temporär gespeichert');
    }, 1500);
  }
});