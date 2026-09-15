const APP_VERSION = 1;
const STORAGE_KEY = "verdant-vault-v1";
const SALT_KEY = "verdant-salt-v1";
const ITERATIONS = 250000;
let vault = { version: APP_VERSION, entries: [] };
let cryptoKey = null;
let currentFilter = "all";
let inactivityTimer = null;

const $ = (id) => document.getElementById(id);

const icons = {
  weight: "◍",
  sleep: "☾",
  food: "⌁",
  exercise: "↗"
};

function hasVault() {
  return !!localStorage.getItem(STORAGE_KEY) && !!localStorage.getItem(SALT_KEY);
}

function bytesToB64(bytes) {
  let binary = "";
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}
function b64ToBytes(b64) {
  const binary = atob(b64);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function deriveKey(pin, saltBytes) {
  const material = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations: ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptVault() {
  if (!cryptoKey) throw new Error("Vault is locked");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(vault));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, plain);
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    iv: bytesToB64(iv),
    data: bytesToB64(new Uint8Array(encrypted))
  }));
}

async function decryptVault(key) {
  const wrapped = JSON.parse(localStorage.getItem(STORAGE_KEY));
  const iv = b64ToBytes(wrapped.iv);
  const data = b64ToBytes(wrapped.data);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

async function createVault(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(SALT_KEY, bytesToB64(salt));
  cryptoKey = await deriveKey(pin, salt);
  vault = { version: APP_VERSION, entries: [] };
  await encryptVault();
}

async function unlockVault(pin) {
  const salt = b64ToBytes(localStorage.getItem(SALT_KEY));
  const key = await deriveKey(pin, salt);
  const data = await decryptVault(key);
  cryptoKey = key;
  vault = data;
}

function lockApp() {
  cryptoKey = null;
  vault = { version: APP_VERSION, entries: [] };
  $("mainApp").classList.add("hidden");
  $("lockScreen").classList.remove("hidden");
  showAuthState();
}

function resetInactivity() {
  clearTimeout(inactivityTimer);
  if (cryptoKey) inactivityTimer = setTimeout(lockApp, 5 * 60 * 1000);
}

["click", "touchstart", "keydown"].forEach(ev => document.addEventListener(ev, resetInactivity, { passive: true }));

function showAuthState() {
  $("authError").textContent = "";
  $("firstRun").classList.toggle("hidden", hasVault());
  $("unlockRun").classList.toggle("hidden", !hasVault());
  if (hasVault()) setTimeout(() => $("unlockPin").focus(), 120);
}

function enterApp() {
  $("lockScreen").classList.add("hidden");
  $("mainApp").classList.remove("hidden");
  $("unlockPin").value = "";
  showView("dashboard");
  setDefaultDates();
  renderAll();
  resetInactivity();
}

function setDefaultDates() {
  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  const localDT = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const localD = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  ["weightDate", "foodDate", "exerciseDate"].forEach(id => $(id).value = localDT);
  $("sleepDate").value = localD;
}

function todayKey(d = new Date()) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`;
}
function formatDateTime(iso) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
  }).format(new Date(iso));
}
function formatDateOnly(iso) {
  const d = iso.includes("T") ? new Date(iso) : new Date(iso + "T12:00:00");
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(d);
}

function addEntry(type, payload, date) {
  vault.entries.push({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    type, date, createdAt: new Date().toISOString(), ...payload
  });
  vault.entries.sort((a,b) => new Date(b.date) - new Date(a.date));
}

async function saveAndRender(message) {
  await encryptVault();
  renderAll();
  toast(message);
}

function renderAll() {
  renderDashboard();
  renderHistory();
}

function renderDashboard() {
  const today = todayKey();
  $("heroDate").textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "long", month: "long", day: "numeric"
  }).format(new Date());

  const byType = (t) => vault.entries.filter(e => e.type === t);
  const latestWeight = byType("weight")[0];
  const latestSleep = byType("sleep")[0];
  const todayFood = byType("food").filter(e => todayKey(e.date) === today);
  const todayExercise = byType("exercise").filter(e => todayKey(e.date) === today);

  if (latestWeight) {
    $("metricWeight").textContent = `${latestWeight.value} ${latestWeight.unit}`;
    $("metricWeightSub").textContent = formatDateTime(latestWeight.date);
  } else {
    $("metricWeight").textContent = "—";
    $("metricWeightSub").textContent = "No entry yet";
  }

  if (latestSleep) {
    $("metricSleep").textContent = `${latestSleep.hours} h`;
    $("metricSleepSub").textContent = formatDateOnly(latestSleep.date);
  } else {
    $("metricSleep").textContent = "—";
    $("metricSleepSub").textContent = "No entry yet";
  }

  const calTotal = todayFood.reduce((sum, e) => sum + (Number(e.calories) || 0), 0);
  $("metricFood").textContent = calTotal ? `${calTotal} kcal` : `${todayFood.length}`;
  $("metricFoodSub").textContent = `${todayFood.length} ${todayFood.length === 1 ? "entry" : "entries"} today`;

  const minutes = todayExercise.reduce((sum, e) => sum + (Number(e.minutes) || 0), 0);
  $("metricExercise").textContent = minutes ? `${minutes} min` : "—";
  $("metricExerciseSub").textContent = `${todayExercise.length} ${todayExercise.length === 1 ? "session" : "sessions"} today`;

  renderEntryList($("recentEntries"), vault.entries.slice(0, 6), false);
}

function renderHistory() {
  document.querySelectorAll(".seg").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.filter === currentFilter);
  });
  const filtered = currentFilter === "all" ? vault.entries : vault.entries.filter(e => e.type === currentFilter);
  renderEntryList($("historyEntries"), filtered, true);
}

function entryText(e) {
  if (e.type === "weight") return { title: "Weight", value: `${e.value} ${e.unit}`, sub: formatDateTime(e.date) };
  if (e.type === "sleep") return { title: "Sleep", value: `${e.hours} h`, sub: formatDateOnly(e.date) };
  if (e.type === "food") return { title: e.name || "Food", value: e.calories ? `${e.calories} kcal` : "", sub: formatDateTime(e.date) };
  if (e.type === "exercise") return { title: e.name || "Exercise", value: `${e.minutes} min`, sub: formatDateTime(e.date) };
}

function renderEntryList(el, entries, withDelete) {
  if (!entries.length) {
    el.innerHTML = `<div class="empty">Nothing here yet.</div>`;
    return;
  }
  el.innerHTML = entries.map(e => {
    const t = entryText(e);
    return `
      <div class="entry">
        <div class="entry-left">
          <div class="entry-icon">${icons[e.type] || "•"}</div>
          <div style="min-width:0">
            <div class="entry-title">${escapeHtml(t.title)}</div>
            <div class="entry-sub">${escapeHtml(t.sub)}</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <div class="entry-value">${escapeHtml(t.value || "")}</div>
          ${withDelete ? `<button class="delete-btn" data-delete="${e.id}" aria-label="Delete">×</button>` : ""}
        </div>
      </div>`;
  }).join("");
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[c]));
}

function showView(name) {
  const map = { dashboard: "dashboardView", add: "addView", history: "historyView", settings: "settingsView" };
  Object.values(map).forEach(id => $(id).classList.add("hidden"));
  $(map[name]).classList.remove("hidden");
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.nav === name));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add("hidden"), 1800);
}

// Auth
$("createVaultBtn").addEventListener("click", async () => {
  const pin = $("newPin").value.trim();
  const confirm = $("confirmPin").value.trim();
  $("authError").textContent = "";
  if (pin.length < 4) return $("authError").textContent = "Use at least 4 digits.";
  if (pin !== confirm) return $("authError").textContent = "PINs do not match.";
  try {
    await createVault(pin);
    $("newPin").value = "";
    $("confirmPin").value = "";
    enterApp();
  } catch {
    $("authError").textContent = "Could not create vault.";
  }
});

$("unlockBtn").addEventListener("click", async () => {
  const pin = $("unlockPin").value.trim();
  $("authError").textContent = "";
  try {
    await unlockVault(pin);
    enterApp();
  } catch {
    $("authError").textContent = "Incorrect PIN or corrupted vault.";
  }
});
$("unlockPin").addEventListener("keydown", e => { if (e.key === "Enter") $("unlockBtn").click(); });
$("lockBtn").addEventListener("click", lockApp);

// Navigation
document.addEventListener("click", e => {
  const nav = e.target.closest("[data-nav]");
  if (nav) showView(nav.dataset.nav);

  const filter = e.target.closest("[data-filter]");
  if (filter) {
    currentFilter = filter.dataset.filter;
    renderHistory();
  }

  const del = e.target.closest("[data-delete]");
  if (del) {
    const id = del.dataset.delete;
    vault.entries = vault.entries.filter(x => x.id !== id);
    encryptVault().then(renderAll);
  }
});

// Save forms
$("saveWeight").addEventListener("click", async () => {
  const value = Number($("weightValue").value);
  const unit = $("weightUnit").value;
  const date = $("weightDate").value;
  if (!value || !date) return toast("Enter weight and date");
  addEntry("weight", { value, unit }, new Date(date).toISOString());
  $("weightValue").value = "";
  await saveAndRender("Weight saved");
});

$("saveSleep").addEventListener("click", async () => {
  const hours = Number($("sleepHours").value);
  const date = $("sleepDate").value;
  if (!hours || !date) return toast("Enter sleep and date");
  addEntry("sleep", { hours }, date);
  $("sleepHours").value = "";
  await saveAndRender("Sleep saved");
});

$("saveFood").addEventListener("click", async () => {
  const name = $("foodName").value.trim();
  const calories = $("foodCalories").value ? Number($("foodCalories").value) : null;
  const date = $("foodDate").value;
  if (!name || !date) return toast("Enter food and date");
  addEntry("food", { name, calories }, new Date(date).toISOString());
  $("foodName").value = "";
  $("foodCalories").value = "";
  await saveAndRender("Food saved");
});

$("saveExercise").addEventListener("click", async () => {
  const name = $("exerciseName").value.trim();
  const minutes = Number($("exerciseMinutes").value);
  const calories = $("exerciseCalories").value ? Number($("exerciseCalories").value) : null;
  const date = $("exerciseDate").value;
  if (!name || !minutes || !date) return toast("Enter exercise, minutes, and date");
  addEntry("exercise", { name, minutes, calories }, new Date(date).toISOString());
  $("exerciseName").value = "";
  $("exerciseMinutes").value = "";
  $("exerciseCalories").value = "";
  await saveAndRender("Exercise saved");
});

// Backup
$("exportBtn").addEventListener("click", () => {
  const payload = {
    app: "Verdant",
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    salt: localStorage.getItem(SALT_KEY),
    vault: localStorage.getItem(STORAGE_KEY)
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `verdant-backup-${todayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
});

$("importFile").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const obj = JSON.parse(await file.text());
    if (!obj.salt || !obj.vault) throw new Error();
    if (!confirm("Importing will replace the local vault on this device. Continue?")) return;
    localStorage.setItem(SALT_KEY, obj.salt);
    localStorage.setItem(STORAGE_KEY, obj.vault);
    lockApp();
    toast("Backup imported");
  } catch {
    toast("Invalid backup file");
  } finally {
    e.target.value = "";
  }
});

$("eraseBtn").addEventListener("click", () => {
  if (!confirm("Permanently erase all local Verdant data on this device?")) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SALT_KEY);
  cryptoKey = null;
  vault = { version: APP_VERSION, entries: [] };
  lockApp();
});

// PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

showAuthState();
