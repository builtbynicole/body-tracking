const APP_VERSION = 4;
const STORAGE_KEY = "verdant-vault-v1";
const SALT_KEY = "verdant-salt-v1";
const ITERATIONS = 250000;
const PERIOD_DAYS = { week: 7, month: 30, quarter: 90 };

let vault = { version: APP_VERSION, entries: [] };
let cryptoKey = null;
let currentFilter = "all";
let currentPeriod = "week";
let inactivityTimer = null;
let resizeTimer = null;

const $ = (id) => document.getElementById(id);
const round = (value, places = 1) => {
  const factor = 10 ** places;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
};
const titleCase = (value) => String(value || "")
  .replace(/[-_]/g, " ")
  .replace(/\b\w/g, (char) => char.toUpperCase());

const icons = {
  body: "◍",
  weight: "◍",
  sleep: "☾",
  food: "⌁",
  exercise: "↗",
  reading: "▤",
  writing: "✎"
};

const mealLabels = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  supplement: "Supplement"
};

const foodCategoryLabels = {
  carbohydrate: "Carbohydrate",
  protein: "Protein",
  fiber: "Vegetables, fruit & fiber",
  fat: "Healthy fats",
  dairy: "Dairy",
  beverage: "Beverage",
  supplement: "Supplement",
  other: "Mixed / other"
};

const exerciseCategoryLabels = {
  strength: "Strength training",
  cardio: "Cardio",
  flexibility: "Flexibility",
  dance: "Dance",
  chinese: "Chinese practice"
};

const readingCategoryLabels = {
  fiction: "Fiction",
  nonfiction: "Nonfiction",
  biography: "Biography & memoir",
  health: "Health & wellbeing",
  business: "Business & work",
  history: "History",
  science: "Science & technology",
  "personal-growth": "Personal growth",
  poetry: "Poetry",
  other: "Other"
};

const writingCategoryLabels = {
  journal: "Journal",
  creative: "Creative writing",
  work: "Work",
  study: "Study & research",
  planning: "Planning",
  correspondence: "Correspondence",
  other: "Other"
};

const BODY_MEASUREMENTS = [
  { key: "waist", id: "waistValue", label: "Waist" },
  { key: "hips", id: "hipsValue", label: "Hips" },
  { key: "abdomen", id: "abdomenValue", label: "Abdomen" },
  { key: "chest", id: "chestValue", label: "Chest / bust" },
  { key: "upperArm", id: "upperArmValue", label: "Upper arm" },
  { key: "thigh", id: "thighValue", label: "Thigh" }
];

// Approximate food energy and household portion weights. Values are deliberately
// editable in the form because recipes, brands, and preparation methods vary.
const FOOD_REFERENCES = [
  { label: "fried rice", aliases: ["fried rice"], kcal: 174, cup: 198, serving: 198 },
  { label: "cooked white rice", aliases: ["white rice", "cooked rice", "rice"], kcal: 130, cup: 158, serving: 158 },
  { label: "cooked brown rice", aliases: ["brown rice"], kcal: 123, cup: 195, serving: 195 },
  { label: "cooked quinoa", aliases: ["quinoa"], kcal: 120, cup: 185, serving: 185 },
  { label: "cooked oats", aliases: ["oatmeal", "porridge", "cooked oats"], kcal: 71, cup: 234, serving: 234 },
  { label: "dry oats", aliases: ["rolled oats", "dry oats", "oats"], kcal: 379, cup: 81, serving: 40 },
  { label: "white bread", aliases: ["white bread", "bread", "toast"], kcal: 266, piece: 29, serving: 58 },
  { label: "whole-wheat bread", aliases: ["whole wheat bread", "whole-wheat bread"], kcal: 252, piece: 28, serving: 56 },
  { label: "cooked pasta", aliases: ["spaghetti", "cooked pasta", "pasta"], kcal: 157, cup: 140, serving: 140 },
  { label: "cooked noodles", aliases: ["noodles", "noodle"], kcal: 138, cup: 160, serving: 160 },
  { label: "rice noodles", aliases: ["rice noodles", "rice noodle"], kcal: 109, cup: 176, serving: 176 },
  { label: "breakfast cereal", aliases: ["breakfast cereal", "cereal"], kcal: 379, cup: 35, serving: 35 },
  { label: "corn tortilla", aliases: ["corn tortilla", "tortilla"], kcal: 218, piece: 28, serving: 56 },
  { label: "baked potato", aliases: ["baked potato", "potato"], kcal: 93, piece: 173, cup: 150, serving: 173 },
  { label: "sweet potato", aliases: ["sweet potato", "yam"], kcal: 90, piece: 130, cup: 200, serving: 130 },
  { label: "corn", aliases: ["sweet corn", "corn"], kcal: 96, piece: 90, cup: 164, serving: 90 },
  { label: "congee", aliases: ["congee", "rice porridge", "zhou"], kcal: 46, cup: 240, serving: 360 },
  { label: "steamed bun", aliases: ["steamed bun", "mantou"], kcal: 223, piece: 80, serving: 80 },
  { label: "dumplings", aliases: ["dumplings", "dumpling", "jiaozi", "gyoza"], kcal: 190, piece: 25, serving: 150 },
  { label: "bao", aliases: ["baozi", "bao bun", "bao"], kcal: 230, piece: 90, serving: 90 },
  { label: "skinless chicken breast", aliases: ["chicken breast", "chicken"], kcal: 165, cup: 140, serving: 120 },
  { label: "chicken thigh", aliases: ["chicken thigh"], kcal: 209, piece: 105, serving: 105 },
  { label: "lean beef", aliases: ["lean beef", "beef", "steak"], kcal: 250, cup: 150, serving: 120 },
  { label: "lean pork", aliases: ["pork tenderloin", "lean pork", "pork"], kcal: 242, serving: 120 },
  { label: "salmon", aliases: ["salmon"], kcal: 208, serving: 120 },
  { label: "tuna in water", aliases: ["tuna in water", "tuna"], kcal: 116, cup: 154, serving: 120 },
  { label: "shrimp", aliases: ["prawns", "prawn", "shrimp"], kcal: 99, piece: 12, cup: 145, serving: 120 },
  { label: "firm tofu", aliases: ["firm tofu", "tofu"], kcal: 144, cup: 248, serving: 126 },
  { label: "tempeh", aliases: ["tempeh"], kcal: 195, cup: 166, serving: 83 },
  { label: "egg", aliases: ["eggs", "egg"], kcal: 143, piece: 50, cup: 243, serving: 50 },
  { label: "cooked lentils", aliases: ["lentils", "lentil"], kcal: 116, cup: 198, serving: 198 },
  { label: "cooked black beans", aliases: ["black beans", "beans", "bean"], kcal: 132, cup: 172, serving: 172 },
  { label: "chickpeas", aliases: ["chickpeas", "chickpea", "garbanzo beans"], kcal: 164, cup: 164, serving: 164 },
  { label: "apple", aliases: ["apples", "apple"], kcal: 52, piece: 182, cup: 125, serving: 182 },
  { label: "banana", aliases: ["bananas", "banana"], kcal: 89, piece: 118, cup: 150, serving: 118 },
  { label: "orange", aliases: ["oranges", "orange"], kcal: 47, piece: 131, cup: 180, serving: 131 },
  { label: "berries", aliases: ["blueberries", "strawberries", "berries", "berry"], kcal: 45, cup: 145, serving: 145 },
  { label: "avocado", aliases: ["avocados", "avocado"], kcal: 160, piece: 150, cup: 150, serving: 75 },
  { label: "broccoli", aliases: ["broccoli"], kcal: 35, cup: 156, serving: 156 },
  { label: "spinach", aliases: ["spinach"], kcal: 23, cup: 30, serving: 90 },
  { label: "mixed vegetables", aliases: ["mixed vegetables", "vegetables", "veggies"], kcal: 65, cup: 180, serving: 180 },
  { label: "green salad", aliases: ["green salad", "side salad", "salad"], kcal: 25, cup: 55, serving: 110 },
  { label: "carrot", aliases: ["carrots", "carrot"], kcal: 41, piece: 61, cup: 128, serving: 61 },
  { label: "tomato", aliases: ["tomatoes", "tomato"], kcal: 18, piece: 123, cup: 180, serving: 123 },
  { label: "olive oil", aliases: ["olive oil", "cooking oil", "oil"], kcal: 884, cup: 216, tbsp: 13.5, tsp: 4.5, serving: 13.5, density: 0.91 },
  { label: "peanut butter", aliases: ["peanut butter"], kcal: 588, cup: 258, tbsp: 16, tsp: 5.3, serving: 32 },
  { label: "almonds", aliases: ["almonds", "almond"], kcal: 579, piece: 1.2, cup: 143, serving: 28 },
  { label: "mixed nuts", aliases: ["mixed nuts", "nuts"], kcal: 607, cup: 135, serving: 28 },
  { label: "whole milk", aliases: ["whole milk"], kcal: 61, cup: 244, serving: 244, density: 1.03 },
  { label: "low-fat milk", aliases: ["low fat milk", "low-fat milk", "skim milk", "milk"], kcal: 46, cup: 245, serving: 245, density: 1.03 },
  { label: "plain Greek yogurt", aliases: ["greek yogurt", "greek yoghurt"], kcal: 97, cup: 245, serving: 170 },
  { label: "plain yogurt", aliases: ["yogurt", "yoghurt"], kcal: 61, cup: 245, serving: 170 },
  { label: "cheddar cheese", aliases: ["cheddar cheese", "cheese"], kcal: 403, piece: 28, cup: 113, serving: 28 },
  { label: "black coffee", aliases: ["black coffee", "coffee"], kcal: 1, cup: 237, serving: 237, density: 1 },
  { label: "latte", aliases: ["cafe latte", "latte"], kcal: 52, cup: 240, serving: 360, density: 1.03 },
  { label: "orange juice", aliases: ["orange juice", "fruit juice", "juice"], kcal: 45, cup: 248, serving: 248, density: 1.04 },
  { label: "smoothie", aliases: ["smoothie"], kcal: 70, cup: 240, serving: 360, density: 1.05 },
  { label: "protein powder", aliases: ["protein powder", "whey protein", "protein shake"], kcal: 400, tbsp: 10, serving: 30 },
  { label: "collagen powder", aliases: ["collagen powder", "collagen"], kcal: 360, tbsp: 10, serving: 10 },
  { label: "creatine", aliases: ["creatine monohydrate", "creatine"], kcal: 0, tsp: 5, serving: 5 },
  { label: "pizza", aliases: ["pizza"], kcal: 266, piece: 107, serving: 214 },
  { label: "hamburger", aliases: ["hamburger", "burger"], kcal: 254, piece: 226, serving: 226 }
];

const FOOD_FALLBACKS = {
  carbohydrate: { label: "carbohydrate-group average", kcal: 150, serving: 160, cup: 180, piece: 60 },
  protein: { label: "protein-group average", kcal: 170, serving: 120, cup: 150, piece: 80 },
  fiber: { label: "vegetable/fruit average", kcal: 55, serving: 150, cup: 150, piece: 120 },
  fat: { label: "fat-group average", kcal: 650, serving: 28, cup: 140, piece: 20 },
  dairy: { label: "dairy-group average", kcal: 100, serving: 200, cup: 240, piece: 28 },
  beverage: { label: "beverage average", kcal: 35, serving: 250, cup: 240, piece: 250, density: 1 },
  supplement: { label: "supplement average", kcal: 300, serving: 20, cup: 100, piece: 10 },
  other: { label: "mixed-meal average", kcal: 180, serving: 300, cup: 220, piece: 150 }
};

const CATEGORY_METS = {
  strength: { light: 3, moderate: 5, vigorous: 6.5 },
  cardio: { light: 3.5, moderate: 6, vigorous: 9 },
  flexibility: { light: 2.3, moderate: 3, vigorous: 4 },
  dance: { light: 3, moderate: 5, vigorous: 7.5 },
  chinese: { light: 2.5, moderate: 3.8, vigorous: 7.5 }
};

const EXERCISE_REFERENCES = [
  { label: "walking", category: "cardio", aliases: ["walk", "walking", "treadmill walking"], mets: { light: 2.8, moderate: 4.3, vigorous: 5.5 } },
  { label: "hiking", category: "cardio", aliases: ["hike", "hiking"], mets: { light: 4, moderate: 5.3, vigorous: 7.8 } },
  { label: "running", category: "cardio", aliases: ["run", "running", "jog", "jogging", "treadmill running", "running machine"], mets: { light: 6, moderate: 8.3, vigorous: 11 } },
  { label: "cycling", category: "cardio", aliases: ["cycling", "bike", "biking"], mets: { light: 4, moderate: 6.8, vigorous: 10 } },
  { label: "swimming", category: "cardio", aliases: ["swim", "swimming"], mets: { light: 4.8, moderate: 7, vigorous: 9.8 } },
  { label: "elliptical", category: "cardio", aliases: ["elliptical"], mets: { light: 4, moderate: 5, vigorous: 9 } },
  { label: "rowing", category: "cardio", aliases: ["rowing", "rower"], mets: { light: 4.8, moderate: 7, vigorous: 12 } },
  { label: "stair climbing", category: "cardio", aliases: ["stairs", "stair climbing", "stairmaster"], mets: { light: 4, moderate: 6.8, vigorous: 9.3 } },
  { label: "resistance training", category: "strength", aliases: ["weights", "weight lifting", "lifting", "resistance", "squats", "deadlift"], mets: { light: 3, moderate: 5, vigorous: 6 } },
  { label: "circuit training", category: "strength", aliases: ["circuit", "hiit"], mets: { light: 4.3, moderate: 6, vigorous: 8 } },
  { label: "bodyweight exercise", category: "strength", aliases: ["bodyweight", "pushups", "push ups", "calisthenics"], mets: { light: 3.5, moderate: 5, vigorous: 7.5 } },
  { label: "stretching", category: "flexibility", aliases: ["stretching", "stretch"], mets: { light: 2.3, moderate: 2.8, vigorous: 3.5 } },
  { label: "yoga", category: "flexibility", aliases: ["yoga"], mets: { light: 2.3, moderate: 3, vigorous: 4 } },
  { label: "Pilates", category: "flexibility", aliases: ["pilates"], mets: { light: 2.8, moderate: 3.5, vigorous: 4.8 } },
  { label: "ballet", category: "dance", aliases: ["ballet"], mets: { light: 3.5, moderate: 5, vigorous: 6.8 } },
  { label: "Zumba", category: "dance", aliases: ["zumba"], mets: { light: 4.5, moderate: 6.5, vigorous: 8 } },
  { label: "ballroom dance", category: "dance", aliases: ["ballroom", "waltz", "foxtrot"], mets: { light: 3, moderate: 5.5, vigorous: 8 } },
  { label: "Chinese square dance", category: "dance", aliases: ["chinese square dance", "square dance"], mets: { light: 4, moderate: 5.5, vigorous: 7.3 } },
  { label: "taiji", category: "chinese", aliases: ["taiji", "tai chi", "taijiquan"], mets: { light: 2.8, moderate: 3.3, vigorous: 4 } },
  { label: "qigong", category: "chinese", aliases: ["qigong", "qi gong", "baduanjin"], mets: { light: 2.3, moderate: 3, vigorous: 4 } },
  { label: "Chinese martial arts", category: "chinese", aliases: ["wushu", "kung fu", "martial arts"], mets: { light: 5.3, moderate: 7.8, vigorous: 10.3 } }
];

function hasVault() {
  return !!localStorage.getItem(STORAGE_KEY) && !!localStorage.getItem(SALT_KEY);
}

function bytesToB64(bytes) {
  let binary = "";
  bytes.forEach((byte) => binary += String.fromCharCode(byte));
  return btoa(binary);
}

function b64ToBytes(b64) {
  const binary = atob(b64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
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

function migrateVault(data) {
  const entries = Array.isArray(data?.entries) ? data.entries : [];
  const migratedEntries = entries.map((entry) => {
    const migrated = { ...entry };
    if (entry.type === "weight") {
      migrated.type = "body";
      migrated.weight = entry.unit === "lb"
        ? round(Number(entry.value) * 0.45359237, 1)
        : Number(entry.value);
      migrated.weightUnit = entry.unit === "lb" ? "kg" : (entry.unit || "kg");
      migrated.measurements = {};
      migrated.measurementUnit = "cm";
      if (entry.unit === "lb") migrated.migratedFromUnit = "lb";
      delete migrated.value;
      delete migrated.unit;
    }
    if (entry.type === "body") {
      migrated.weight = entry.weight == null ? null : Number(entry.weight);
      migrated.weightUnit = entry.weightUnit || "kg";
      migrated.measurements = entry.measurements || {};
      migrated.measurementUnit = entry.measurementUnit || "cm";
    }
    if (entry.type === "sleep") migrated.hours = Number(entry.hours) || 0;
    if (entry.type === "food") {
      migrated.meal = entry.meal || "snack";
      migrated.category = entry.category || "other";
    }
    if (entry.type === "exercise") {
      migrated.category = entry.category === "aerobic" ? "cardio" : (entry.category || "cardio");
      migrated.intensity = entry.intensity || "moderate";
    }
    if (entry.type === "reading" || entry.type === "writing") {
      migrated.minutes = Number(entry.minutes) || 0;
    }
    return migrated;
  });
  migratedEntries.sort((a, b) => (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0));
  return {
    ...data,
    version: APP_VERSION,
    entries: migratedEntries
  };
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
  const needsMigration = data.version !== APP_VERSION;
  cryptoKey = key;
  vault = migrateVault(data);
  if (needsMigration) await encryptVault();
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

["click", "touchstart", "keydown"].forEach((eventName) => {
  document.addEventListener(eventName, resetInactivity, { passive: true });
});

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

function pad(number) {
  return String(number).padStart(2, "0");
}

function toLocalInputValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function setDefaultSleepTimes() {
  const wake = new Date();
  wake.setSeconds(0, 0);
  const asleep = new Date(wake.getTime() - 8 * 60 * 60 * 1000);
  $("sleepStart").value = toLocalInputValue(asleep);
  $("sleepEnd").value = toLocalInputValue(wake);
  updateSleepDuration();
}

function setDefaultTimedActivity(startId, endId, minutes = 30) {
  const end = new Date();
  end.setSeconds(0, 0);
  const start = new Date(end.getTime() - minutes * 60000);
  $(startId).value = toLocalInputValue(start);
  $(endId).value = toLocalInputValue(end);
}

function setDefaultDates() {
  const now = new Date();
  const localDateTime = toLocalInputValue(now);
  $("bodyDate").value = todayKey(now);
  ["foodDate", "exerciseDate"].forEach((id) => $(id).value = localDateTime);
  setDefaultSleepTimes();
  setDefaultTimedActivity("readingStart", "readingEnd");
  setDefaultTimedActivity("writingStart", "writingEnd");
  updateReadingDuration();
  updateWritingDuration();
  updateFoodEstimate();
  updateExerciseEstimate();
}

function parseDate(value) {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function todayKey(value = new Date()) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDateTime(value) {
  const date = parseDate(value);
  if (!date) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
  }).format(date);
}

function formatDateOnly(value) {
  const date = parseDate(value);
  if (!date) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    month: "short", day: "numeric", year: "numeric"
  }).format(date);
}

function formatShortDate(value) {
  const date = parseDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function addDays(date, number) {
  const next = new Date(date);
  next.setDate(next.getDate() + number);
  return next;
}

function addEntry(type, payload, date) {
  vault.entries.push({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    type,
    date,
    createdAt: new Date().toISOString(),
    ...payload
  });
  vault.entries.sort((a, b) => (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0));
}

async function saveAndRender(message) {
  await encryptVault();
  renderAll();
  toast(message);
}

function renderAll() {
  renderDashboard();
  renderHistory();
  if (!$("insightsView").classList.contains("hidden")) renderInsights();
}

function entriesByType(type) {
  return vault.entries.filter((entry) => entry.type === type);
}

function weightUnitLabel(unit) {
  return unit === "jin" ? "斤" : unit;
}

function bodyWeightValue(entry) {
  return entry.weight ?? entry.value;
}

function bodyWeightUnit(entry) {
  return entry.weightUnit || entry.unit || "kg";
}

function hasBodyWeight(entry) {
  const value = Number(bodyWeightValue(entry));
  return Number.isFinite(value) && value > 0;
}

function weightText(entry) {
  return hasBodyWeight(entry)
    ? `${round(bodyWeightValue(entry), 1)} ${weightUnitLabel(bodyWeightUnit(entry))}`
    : "";
}

function measurementCount(entry) {
  return BODY_MEASUREMENTS.filter(({ key }) => {
    const value = Number(entry.measurements?.[key]);
    return Number.isFinite(value) && value > 0;
  }).length;
}

function measurementToCm(entry, key) {
  const value = Number(entry.measurements?.[key]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return entry.measurementUnit === "in" ? value * 2.54 : value;
}

function measurementValue(entry, key, unit = "cm") {
  const cm = measurementToCm(entry, key);
  if (cm == null) return null;
  return unit === "in" ? cm / 2.54 : cm;
}

function measurementDetails(entry, limit = BODY_MEASUREMENTS.length) {
  const unit = entry.measurementUnit === "in" ? "in" : "cm";
  return BODY_MEASUREMENTS.map(({ key, label }) => {
    const value = measurementValue(entry, key, unit);
    return value == null ? "" : `${label} ${round(value, 1)} ${unit}`;
  }).filter(Boolean).slice(0, limit);
}

function renderDashboard() {
  const today = todayKey();
  $("heroDate").textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "long", month: "long", day: "numeric"
  }).format(new Date());

  const bodyEntries = entriesByType("body");
  const latestBody = bodyEntries[0];
  const latestSleep = entriesByType("sleep")[0];
  const todayFood = entriesByType("food").filter((entry) => todayKey(entry.date) === today);
  const todayExercise = entriesByType("exercise").filter((entry) => todayKey(entry.date) === today);
  const todayReading = entriesByType("reading").filter((entry) => todayKey(entry.date) === today);
  const todayWriting = entriesByType("writing").filter((entry) => todayKey(entry.date) === today);

  if (latestBody) {
    const count = measurementCount(latestBody);
    $("metricBody").textContent = hasBodyWeight(latestBody) ? weightText(latestBody) : `${count} measured`;
    $("metricBodySub").textContent = [
      count ? `${count} measurement${count === 1 ? "" : "s"}` : "",
      formatDateOnly(latestBody.date)
    ].filter(Boolean).join(" · ");
  } else {
    $("metricBody").textContent = "—";
    $("metricBodySub").textContent = "No entry yet";
  }

  if (latestSleep) {
    $("metricSleep").textContent = `${round(latestSleep.hours, 1)} h`;
    $("metricSleepSub").textContent = latestSleep.quality
      ? `Quality ${latestSleep.quality}/10 · ${formatDateOnly(latestSleep.date)}`
      : formatDateOnly(latestSleep.date);
  } else {
    $("metricSleep").textContent = "—";
    $("metricSleepSub").textContent = "No entry yet";
  }

  const calorieTotal = todayFood.reduce((sum, entry) => sum + (Number(entry.calories) || 0), 0);
  $("metricFood").textContent = calorieTotal ? `${Math.round(calorieTotal)} kcal` : `${todayFood.length}`;
  $("metricFoodSub").textContent = `${todayFood.length} ${todayFood.length === 1 ? "entry" : "entries"} today`;

  const minutes = todayExercise.reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0);
  $("metricExercise").textContent = minutes ? `${minutes} min` : "—";
  $("metricExerciseSub").textContent = `${todayExercise.length} ${todayExercise.length === 1 ? "session" : "sessions"} today`;

  const readingMinutes = todayReading.reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0);
  $("metricReading").textContent = readingMinutes ? formatDurationShort(readingMinutes) : "—";
  $("metricReadingSub").textContent = `${todayReading.length} ${todayReading.length === 1 ? "session" : "sessions"} today`;

  const writingMinutes = todayWriting.reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0);
  $("metricWriting").textContent = writingMinutes ? formatDurationShort(writingMinutes) : "—";
  $("metricWritingSub").textContent = `${todayWriting.length} ${todayWriting.length === 1 ? "session" : "sessions"} today`;

  renderEntryList($("recentEntries"), vault.entries.slice(0, 6), false);
}

function renderHistory() {
  document.querySelectorAll("#historyFilter .seg").forEach((button) => {
    const active = button.dataset.filter === currentFilter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const filtered = currentFilter === "all"
    ? vault.entries
    : vault.entries.filter((entry) => entry.type === currentFilter);
  renderEntryList($("historyEntries"), filtered, true);
}

function entryText(entry) {
  if (entry.type === "body" || entry.type === "weight") {
    const details = measurementDetails(entry);
    const count = details.length;
    return {
      title: "Body",
      value: weightText(entry) || `${count} measurement${count === 1 ? "" : "s"}`,
      sub: [formatDateOnly(entry.date), ...details].join(" · "),
      note: entry.note || ""
    };
  }
  if (entry.type === "sleep") {
    const timing = entry.start && entry.end
      ? `${formatDateTime(entry.start)} → ${formatDateTime(entry.end)}`
      : formatDateOnly(entry.date);
    const details = [
      entry.quality ? `Quality ${entry.quality}/10` : "",
      entry.trouble && entry.trouble !== "no" ? `Trouble: ${titleCase(entry.trouble)}` : ""
    ].filter(Boolean).join(" · ");
    return {
      title: "Sleep",
      value: `${round(entry.hours, 1)} h`,
      sub: details ? `${timing} · ${details}` : timing,
      note: entry.note || ""
    };
  }
  if (entry.type === "food") {
    const amount = entry.amount ? `${entry.amount} ${entry.unit || "serving"}` : "";
    const group = foodCategoryLabels[entry.category] || "Food";
    const meal = mealLabels[entry.meal] || "Food";
    return {
      title: entry.name || "Food",
      value: entry.calories != null ? `${Math.round(entry.calories)} kcal` : "",
      sub: [meal, group, amount, formatDateTime(entry.date)].filter(Boolean).join(" · "),
      note: [entry.appetiteRating ? `Appetite ${entry.appetiteRating}/10` : "", entry.appetiteNote].filter(Boolean).join(" — ")
    };
  }
  if (entry.type === "exercise") {
    const category = exerciseCategoryLabels[entry.category] || "Exercise";
    return {
      title: entry.name || category,
      value: `${entry.minutes} min${entry.calories != null ? ` · ${Math.round(entry.calories)} kcal` : ""}`,
      sub: `${category} · ${titleCase(entry.intensity || "moderate")} · ${formatDateTime(entry.date)}`,
      note: [entry.note, entry.muscleRating ? `Body ${entry.muscleRating}/10` : ""].filter(Boolean).join(" — ")
    };
  }
  if (entry.type === "reading") {
    return {
      title: entry.title || "Reading",
      value: formatDurationShort(entry.minutes),
      sub: `${readingCategoryLabels[entry.category] || "Reading"} · ${formatDateTime(entry.start || entry.date)} → ${formatDateTime(entry.end || entry.date)}`,
      note: entry.note || ""
    };
  }
  if (entry.type === "writing") {
    return {
      title: entry.topic || "Writing",
      value: formatDurationShort(entry.minutes),
      sub: `${writingCategoryLabels[entry.category] || "Writing"} · ${formatDateTime(entry.start || entry.date)} → ${formatDateTime(entry.end || entry.date)}`,
      note: entry.note || ""
    };
  }
  return { title: "Entry", value: "", sub: formatDateTime(entry.date), note: "" };
}

function renderEntryList(element, entries, withDelete) {
  if (!entries.length) {
    element.innerHTML = `<div class="empty">Nothing here yet.</div>`;
    return;
  }
  element.innerHTML = entries.map((entry) => {
    const text = entryText(entry);
    return `
      <div class="entry">
        <div class="entry-left">
          <div class="entry-icon" aria-hidden="true">${icons[entry.type] || "•"}</div>
          <div style="min-width:0">
            <div class="entry-title">${escapeHtml(text.title)}</div>
            <div class="entry-sub">${escapeHtml(text.sub)}</div>
            ${text.note ? `<div class="entry-note">${escapeHtml(text.note)}</div>` : ""}
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <div class="entry-value">${escapeHtml(text.value || "")}</div>
          ${withDelete ? `<button class="delete-btn" data-delete="${entry.id}" aria-label="Delete ${escapeHtml(text.title)} entry">×</button>` : ""}
        </div>
      </div>`;
  }).join("");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[character]));
}

function showView(name) {
  const map = {
    dashboard: "dashboardView",
    add: "addView",
    insights: "insightsView",
    history: "historyView",
    settings: "settingsView"
  };
  Object.values(map).forEach((id) => $(id).classList.add("hidden"));
  $(map[name]).classList.remove("hidden");
  document.querySelectorAll(".tab").forEach((tab) => {
    const active = tab.dataset.nav === name;
    tab.classList.toggle("active", active);
    if (active) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  });
  if (name === "insights") requestAnimationFrame(renderInsights);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toast(message) {
  const element = $("toast");
  element.textContent = message;
  element.classList.remove("hidden");
  clearTimeout(element._timer);
  element._timer = setTimeout(() => element.classList.add("hidden"), 1800);
}

function updateSleepDuration() {
  const start = parseDate($("sleepStart").value);
  const end = parseDate($("sleepEnd").value);
  if (!start || !end || end <= start) {
    $("sleepDurationPreview").textContent = "Check times";
    $("sleepDurationHelp").textContent = "Wake time must be after sleep time.";
    return null;
  }
  const hours = (end - start) / 3600000;
  if (hours > 24) {
    $("sleepDurationPreview").textContent = "Over 24 h";
    $("sleepDurationHelp").textContent = "Please check the dates and times.";
    return null;
  }
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  $("sleepDurationPreview").textContent = `${round(hours, 1)} h`;
  $("sleepDurationHelp").textContent = `${wholeHours} hr ${minutes} min, calculated from your times.`;
  return round(hours, 2);
}

function formatDurationShort(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function updateTimedDuration(startId, endId, previewId, helpId) {
  const start = parseDate($(startId).value);
  const end = parseDate($(endId).value);
  if (!start || !end || end <= start) {
    $(previewId).textContent = "Check times";
    $(helpId).textContent = "End time must be after start time.";
    return null;
  }
  const minutes = Math.round((end - start) / 60000);
  if (minutes < 1 || minutes > 24 * 60) {
    $(previewId).textContent = minutes > 24 * 60 ? "Over 24 h" : "Check times";
    $(helpId).textContent = "Please check the dates and times.";
    return null;
  }
  const formatted = formatDurationShort(minutes);
  $(previewId).textContent = formatted;
  $(helpId).textContent = `${formatted}, calculated from your times.`;
  return minutes;
}

function updateReadingDuration() {
  return updateTimedDuration("readingStart", "readingEnd", "readingDurationPreview", "readingDurationHelp");
}

function updateWritingDuration() {
  return updateTimedDuration("writingStart", "writingEnd", "writingDurationPreview", "writingDurationHelp");
}

function normalizeSearch(value) {
  return ` ${String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

function findFoodReference(name) {
  const search = normalizeSearch(name);
  let best = null;
  let bestLength = 0;
  FOOD_REFERENCES.forEach((item) => {
    item.aliases.forEach((alias) => {
      const normalizedAlias = normalizeSearch(alias).trim();
      if (search.includes(` ${normalizedAlias} `) && normalizedAlias.length > bestLength) {
        best = item;
        bestLength = normalizedAlias.length;
      }
    });
  });
  return best;
}

function amountToGrams(amount, unit, reference) {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (unit === "g") return amount;
  if (unit === "oz") return amount * 28.3495;
  if (unit === "ml") return amount * (reference.density || 1);
  if (unit === "cup") return amount * (reference.cup || (reference.density || 1) * 240);
  if (unit === "tbsp") return amount * (reference.tbsp || (reference.cup ? reference.cup / 16 : (reference.density || 1) * 15));
  if (unit === "tsp") return amount * (reference.tsp || (reference.tbsp ? reference.tbsp / 3 : (reference.density || 1) * 5));
  if (unit === "piece") return amount * (reference.piece || reference.serving || 100);
  return amount * (reference.serving || 100);
}

function estimateFoodCalories() {
  const name = $("foodName").value.trim();
  const amount = Number($("foodAmount").value);
  const unit = $("foodUnit").value;
  const category = $("foodCategory").value;
  if (!name || !amount) return null;
  const match = findFoodReference(name);
  const reference = match || FOOD_FALLBACKS[category] || FOOD_FALLBACKS.other;
  const grams = amountToGrams(amount, unit, reference);
  if (!grams) return null;
  return {
    calories: Math.max(0, Math.round(reference.kcal * grams / 100)),
    grams: Math.round(grams),
    source: reference.label,
    confidence: match ? "matched food" : "food-group average"
  };
}

function updateFoodEstimate() {
  const estimate = estimateFoodCalories();
  if (!estimate) {
    if (!$("foodCalories").dataset.manual) $("foodCalories").value = "";
    $("foodCaloriePreview").textContent = "Add details";
    $("foodEstimateMeta").textContent = "Enter a food and amount. You can correct the estimate before saving.";
    return;
  }
  if (!$("foodCalories").dataset.manual) $("foodCalories").value = estimate.calories;
  $("foodCaloriePreview").textContent = `~${estimate.calories} kcal`;
  $("foodEstimateMeta").textContent = `${estimate.confidence}: ${estimate.source}, about ${estimate.grams} g. Recipes and brands vary; adjust if needed.`;
}

function latestWeightKg() {
  const entry = entriesByType("body").find(hasBodyWeight);
  if (!entry) return { kg: 70, label: "70 kg reference weight", isDefault: true };
  const kg = kgValue(entry);
  if (!Number.isFinite(kg) || kg <= 0) return { kg: 70, label: "70 kg reference weight", isDefault: true };
  return { kg, label: `latest weight ${weightText(entry)} (${round(kg, 1)} kg)`, isDefault: false };
}

function findExerciseReference(name, category) {
  const search = normalizeSearch(name);
  let best = null;
  let bestLength = 0;
  EXERCISE_REFERENCES.filter((item) => item.category === category).forEach((item) => {
    item.aliases.forEach((alias) => {
      const normalizedAlias = normalizeSearch(alias).trim();
      if (search.includes(` ${normalizedAlias} `) && normalizedAlias.length > bestLength) {
        best = item;
        bestLength = normalizedAlias.length;
      }
    });
  });
  return best;
}

function estimateExerciseCalories() {
  const category = $("exerciseCategory").value;
  const intensity = $("exerciseIntensity").value;
  const name = $("exerciseName").value.trim();
  const minutes = Number($("exerciseMinutes").value);
  if (!minutes || minutes <= 0) return null;
  const match = findExerciseReference(name, category);
  const met = match?.mets[intensity] || CATEGORY_METS[category]?.[intensity] || 4;
  const weight = latestWeightKg();
  return {
    calories: Math.max(0, Math.round(met * weight.kg * minutes / 60)),
    met,
    weight,
    source: match?.label || exerciseCategoryLabels[category]
  };
}

function updateExerciseEstimate() {
  const estimate = estimateExerciseCalories();
  if (!estimate) {
    if (!$("exerciseCalories").dataset.manual) $("exerciseCalories").value = "";
    $("exerciseCaloriePreview").textContent = "Add details";
    $("exerciseEstimateMeta").textContent = "Based on activity, intensity, time, and your latest weight.";
    return;
  }
  if (!$("exerciseCalories").dataset.manual) $("exerciseCalories").value = estimate.calories;
  $("exerciseCaloriePreview").textContent = `~${estimate.calories} kcal`;
  $("exerciseEstimateMeta").textContent = `${estimate.source}, ${estimate.met} MET · ${estimate.weight.label}. This is an estimate; individual energy use varies.`;
}

function wireRange(inputId, outputId) {
  const input = $(inputId);
  const output = $(outputId);
  const sync = () => output.textContent = `${input.value} / 10`;
  input.addEventListener("input", sync);
  sync();
}

function periodDates(days) {
  const end = new Date();
  end.setHours(12, 0, 0, 0);
  return Array.from({ length: days }, (_, index) => addDays(end, index - days + 1));
}

function entriesForPeriod(type, dates) {
  const keys = new Set(dates.map(todayKey));
  return entriesByType(type).filter((entry) => keys.has(todayKey(entry.date)));
}

function mean(values) {
  const valid = values.map(Number).filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function groupDaily(entries, dates, valueForEntry, mode = "sum") {
  const grouped = new Map();
  entries.forEach((entry) => {
    const key = todayKey(entry.date);
    const rawValue = valueForEntry(entry);
    if (rawValue == null || rawValue === "") return;
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(value);
  });
  return dates.map((date) => {
    const values = grouped.get(todayKey(date));
    if (!values?.length) return { date, value: null };
    return {
      date,
      value: mode === "average" ? mean(values) : values.reduce((sum, value) => sum + value, 0)
    };
  });
}

function kgValue(entry) {
  const unit = bodyWeightUnit(entry);
  const value = Number(bodyWeightValue(entry));
  if (unit === "jin") return value * 0.5;
  if (unit === "lb") return value * 0.45359237;
  return value;
}

function formatPeriodRange(dates) {
  return `${formatShortDate(dates[0])}–${formatShortDate(dates[dates.length - 1])}`;
}

function renderInsights() {
  const days = PERIOD_DAYS[currentPeriod];
  const dates = periodDates(days);
  const sleepEntries = entriesForPeriod("sleep", dates);
  const foodEntries = entriesForPeriod("food", dates);
  const exerciseEntries = entriesForPeriod("exercise", dates);
  const bodyEntries = entriesForPeriod("body", dates);
  const weightEntries = bodyEntries.filter(hasBodyWeight);
  const measurementEntries = bodyEntries.filter((entry) => measurementCount(entry));
  const readingEntries = entriesForPeriod("reading", dates);
  const writingEntries = entriesForPeriod("writing", dates);

  document.querySelectorAll("#insightPeriod .seg").forEach((button) => {
    const active = button.dataset.period === currentPeriod;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  $("insightDateRange").textContent = `${formatPeriodRange(dates)} · ${days}-day view`;

  const avgSleep = mean(sleepEntries.map((entry) => entry.hours));
  const loggedFoodDays = new Set(foodEntries.map((entry) => todayKey(entry.date))).size;
  const foodCalories = foodEntries.reduce((sum, entry) => sum + (Number(entry.calories) || 0), 0);
  const activeMinutes = exerciseEntries.reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0);
  const activeDays = new Set(exerciseEntries.map((entry) => todayKey(entry.date))).size;
  const readingMinutes = readingEntries.reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0);
  const readingDays = new Set(readingEntries.map((entry) => todayKey(entry.date))).size;
  const writingMinutes = writingEntries.reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0);
  const writingDays = new Set(writingEntries.map((entry) => todayKey(entry.date))).size;
  const sortedWeights = [...weightEntries].sort((a, b) => (parseDate(a.date) || 0) - (parseDate(b.date) || 0));
  const preferredWeightUnit = bodyWeightUnit(entriesByType("body").find(hasBodyWeight) || {}) === "jin" ? "jin" : "kg";
  const preferredWeightLabel = weightUnitLabel(preferredWeightUnit);
  const displayWeightValue = (entry) => preferredWeightUnit === "jin" ? kgValue(entry) * 2 : kgValue(entry);
  const weightChange = sortedWeights.length > 1
    ? displayWeightValue(sortedWeights.at(-1)) - displayWeightValue(sortedWeights[0])
    : null;
  const latestMeasurement = entriesByType("body").find((entry) => measurementCount(entry));
  const preferredMeasurementUnit = latestMeasurement?.measurementUnit === "in" ? "in" : "cm";

  $("summaryMetrics").innerHTML = [
    { label: "Average sleep", value: avgSleep == null ? "—" : `${round(avgSleep, 1)} h`, sub: `${sleepEntries.length} nights logged` },
    { label: "Food energy", value: loggedFoodDays ? `${Math.round(foodCalories / loggedFoodDays)} kcal` : "—", sub: loggedFoodDays ? "per logged day" : "No food days logged" },
    { label: "Active time", value: activeMinutes ? `${activeMinutes} min` : "—", sub: `${activeDays} active ${activeDays === 1 ? "day" : "days"}` },
    { label: "Weight change", value: weightChange == null ? "—" : `${weightChange > 0 ? "+" : ""}${round(weightChange, 1)} ${preferredWeightLabel}`, sub: sortedWeights.length > 1 ? "first to latest" : "Need two entries" },
    { label: "Reading time", value: readingMinutes ? formatDurationShort(readingMinutes) : "—", sub: `${readingDays} reading ${readingDays === 1 ? "day" : "days"}` },
    { label: "Writing time", value: writingMinutes ? formatDurationShort(writingMinutes) : "—", sub: `${writingDays} writing ${writingDays === 1 ? "day" : "days"}` }
  ].map((item) => `
    <article class="summary-item">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
      <small>${escapeHtml(item.sub)}</small>
    </article>`).join("");

  const sleepHours = groupDaily(sleepEntries, dates, (entry) => entry.hours, "average");
  const sleepQuality = groupDaily(sleepEntries.filter((entry) => entry.quality), dates, (entry) => entry.quality, "average");
  const dailyFood = groupDaily(foodEntries, dates, (entry) => entry.calories);
  const dailyExercise = groupDaily(exerciseEntries, dates, (entry) => entry.minutes);
  const dailyWeight = groupDaily(weightEntries, dates, displayWeightValue, "average");
  const dailyWaist = groupDaily(measurementEntries, dates, (entry) => measurementValue(entry, "waist", preferredMeasurementUnit), "average");
  const dailyHips = groupDaily(measurementEntries, dates, (entry) => measurementValue(entry, "hips", preferredMeasurementUnit), "average");
  const dailyAbdomen = groupDaily(measurementEntries, dates, (entry) => measurementValue(entry, "abdomen", preferredMeasurementUnit), "average");
  const dailyReading = groupDaily(readingEntries, dates, (entry) => entry.minutes);
  const dailyWriting = groupDaily(writingEntries, dates, (entry) => entry.minutes);

  drawChart($("sleepChart"), sleepHours, {
    type: "line", color: "#2f6e4f", secondary: sleepQuality, secondaryColor: "#d09a45", maxHint: 12,
    labels: ["Hours", "Quality"]
  });
  drawChart($("foodChart"), dailyFood, { type: "bar", color: "#7ca98b" });
  drawChart($("exerciseChart"), dailyExercise, { type: "bar", color: "#4b8767" });
  drawChart($("weightChart"), dailyWeight, { type: "line", color: "#7d6f9f", tightScale: true });
  drawChart($("bodyChart"), dailyWaist, {
    type: "line",
    color: "#2f6e4f",
    secondary: dailyHips,
    secondaryColor: "#b57d49",
    tertiary: dailyAbdomen,
    tertiaryColor: "#6686a3",
    labels: ["Waist", "Hips", "Abdomen"],
    tightScale: true
  });
  drawChart($("readingChart"), dailyReading, { type: "bar", color: "#6686a3" });
  drawChart($("writingChart"), dailyWriting, { type: "bar", color: "#a06f62" });

  $("sleepChartValue").textContent = avgSleep == null ? "No data" : `${round(avgSleep, 1)} h avg`;
  $("sleepChartSummary").textContent = avgSleep == null
    ? "Log sleep times to see duration and quality together."
    : `${sleepEntries.length} ${sleepEntries.length === 1 ? "night" : "nights"}; average quality ${formatAverage(sleepEntries.map((entry) => entry.quality), "/10")}.`;
  $("foodChartValue").textContent = foodCalories ? `${Math.round(foodCalories)} kcal` : "No data";
  $("foodChartSummary").textContent = foodEntries.length
    ? `${foodEntries.length} food ${foodEntries.length === 1 ? "entry" : "entries"} across ${loggedFoodDays} logged ${loggedFoodDays === 1 ? "day" : "days"}. Calories are estimates.`
    : "Log foods and portions to see estimated daily energy.";
  $("exerciseChartValue").textContent = activeMinutes ? `${activeMinutes} min` : "No data";
  $("exerciseChartSummary").textContent = exerciseEntries.length
    ? `${exerciseEntries.length} ${exerciseEntries.length === 1 ? "session" : "sessions"}; estimated energy ${Math.round(exerciseEntries.reduce((sum, entry) => sum + (Number(entry.calories) || 0), 0))} kcal.`
    : "Log movement to see your active-time rhythm.";
  $("weightChartValue").textContent = sortedWeights.length ? `${round(displayWeightValue(sortedWeights.at(-1)), 1)} ${preferredWeightLabel}` : "No data";
  $("weightChartSummary").textContent = sortedWeights.length > 1
    ? `${sortedWeights.length} weight entries; ${Math.abs(round(weightChange, 1))} ${preferredWeightLabel} ${weightChange > 0 ? "increase" : weightChange < 0 ? "decrease" : "change"} in this period.`
    : "Two or more weight entries are needed to show a trend.";

  const latestPeriodMeasurement = [...measurementEntries].sort((a, b) => (parseDate(b.date) || 0) - (parseDate(a.date) || 0))[0];
  const latestCoreDetails = latestPeriodMeasurement
    ? ["waist", "hips", "abdomen"].map((key) => {
      const definition = BODY_MEASUREMENTS.find((item) => item.key === key);
      const value = measurementValue(latestPeriodMeasurement, key, preferredMeasurementUnit);
      return value == null ? "" : `${definition.label} ${round(value, 1)} ${preferredMeasurementUnit}`;
    }).filter(Boolean)
    : [];
  $("bodyChartValue").textContent = measurementEntries.length
    ? `${measurementEntries.length} check-in${measurementEntries.length === 1 ? "" : "s"}`
    : "No data";
  $("bodyChartSummary").textContent = latestCoreDetails.length
    ? `Latest: ${latestCoreDetails.join(", ")}. Monthly measurements are usually enough for a useful long-term trend.`
    : measurementEntries.length
      ? `${measurementEntries.length} body check-in${measurementEntries.length === 1 ? "" : "s"}; add waist, hips, or abdomen to chart core measurements.`
      : "Log a monthly waist, hips, or abdomen measurement to see changes over time.";

  $("readingChartValue").textContent = readingMinutes ? formatDurationShort(readingMinutes) : "No data";
  $("readingChartSummary").textContent = readingEntries.length
    ? `${readingEntries.length} reading ${readingEntries.length === 1 ? "session" : "sessions"} across ${readingDays} ${readingDays === 1 ? "day" : "days"}.`
    : "Log reading sessions to see your learning rhythm.";
  $("writingChartValue").textContent = writingMinutes ? formatDurationShort(writingMinutes) : "No data";
  $("writingChartSummary").textContent = writingEntries.length
    ? `${writingEntries.length} writing ${writingEntries.length === 1 ? "session" : "sessions"} across ${writingDays} ${writingDays === 1 ? "day" : "days"}.`
    : "Log writing sessions to see your creative rhythm.";

  renderPatternInsights({ dates, sleepEntries, foodEntries, exerciseEntries, bodyEntries, readingEntries, writingEntries });
}

function formatAverage(values, suffix = "") {
  const average = mean(values);
  return average == null ? "not rated" : `${round(average, 1)}${suffix}`;
}

function renderPatternInsights({ dates, sleepEntries, foodEntries, exerciseEntries, bodyEntries, readingEntries, writingEntries }) {
  const patterns = [];
  if (sleepEntries.length >= 3) {
    const average = mean(sleepEntries.map((entry) => entry.hours));
    const trouble = sleepEntries.filter((entry) => entry.trouble && entry.trouble !== "no").length;
    patterns.push({
      symbol: "☾",
      title: "Sleep consistency",
      text: `You averaged ${round(average, 1)} hours across ${sleepEntries.length} nights${trouble ? `, with some trouble reported on ${trouble}` : " and reported no trouble"}.`
    });
  } else {
    patterns.push({ symbol: "☾", title: "Sleep pattern forming", text: "Three nights of sleep times will make the first useful rest pattern visible." });
  }

  if (foodEntries.length >= 3) {
    const counts = foodEntries.reduce((result, entry) => {
      result[entry.category || "other"] = (result[entry.category || "other"] || 0) + 1;
      return result;
    }, {});
    const topCategory = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const appetite = mean(foodEntries.map((entry) => entry.appetiteRating));
    patterns.push({
      symbol: "⌁",
      title: "Nourishment mix",
      text: `${foodCategoryLabels[topCategory[0]] || "Mixed foods"} is your most logged group (${topCategory[1]} entries). Appetite regulation averaged ${appetite == null ? "not yet rated" : `${round(appetite, 1)}/10`}.`
    });
  } else {
    patterns.push({ symbol: "⌁", title: "Nourishment pattern forming", text: "Log at least three foods with amounts to compare food groups and appetite." });
  }

  if (exerciseEntries.length >= 2) {
    const counts = exerciseEntries.reduce((result, entry) => {
      result[entry.category || "cardio"] = (result[entry.category || "cardio"] || 0) + 1;
      return result;
    }, {});
    const topCategory = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const bodyScores = exerciseEntries.flatMap((entry) => [entry.muscleRating, entry.mobilityRating, entry.breathRating]).filter(Boolean);
    patterns.push({
      symbol: "↗",
      title: "Movement balance",
      text: `${exerciseCategoryLabels[topCategory[0]] || "Movement"} appears most often. Your combined body-feel rating averaged ${formatAverage(bodyScores, "/10")}.`
    });
  } else {
    patterns.push({ symbol: "↗", title: "Movement pattern forming", text: "Two sessions will start showing your preferred movement and body response." });
  }

  const measurementEntries = [...bodyEntries]
    .filter((entry) => measurementCount(entry))
    .sort((a, b) => (parseDate(a.date) || 0) - (parseDate(b.date) || 0));
  const preferredMeasurementUnit = entriesByType("body").find((entry) => measurementCount(entry))?.measurementUnit === "in" ? "in" : "cm";
  const comparableMeasurement = ["waist", "hips", "abdomen"].map((key) => ({
    key,
    entries: measurementEntries.filter((entry) => measurementValue(entry, key, preferredMeasurementUnit) != null)
  })).find((item) => item.entries.length >= 2);
  if (comparableMeasurement) {
    const definition = BODY_MEASUREMENTS.find((item) => item.key === comparableMeasurement.key);
    const first = measurementValue(comparableMeasurement.entries[0], comparableMeasurement.key, preferredMeasurementUnit);
    const latest = measurementValue(comparableMeasurement.entries.at(-1), comparableMeasurement.key, preferredMeasurementUnit);
    const difference = latest - first;
    patterns.push({
      symbol: "◍",
      title: `${definition.label} trend`,
      text: `${definition.label} changed by ${difference > 0 ? "+" : ""}${round(difference, 1)} ${preferredMeasurementUnit} from the first to latest check-in in this period. Monthly check-ins will make this trend steadier.`
    });
  } else {
    patterns.push({
      symbol: "◍",
      title: "Body trend forming",
      text: "Two check-ins of the same core measurement will show your first body-dimension trend. Once a month is a useful rhythm."
    });
  }

  if (readingEntries.length >= 2) {
    const counts = readingEntries.reduce((result, entry) => {
      result[entry.category || "other"] = (result[entry.category || "other"] || 0) + 1;
      return result;
    }, {});
    const topCategory = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const titles = new Set(readingEntries.map((entry) => entry.title?.trim()).filter(Boolean));
    const total = readingEntries.reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0);
    patterns.push({
      symbol: "▤",
      title: "Reading rhythm",
      text: `${readingCategoryLabels[topCategory[0]] || "Other"} is your most-read category. You spent ${formatDurationShort(total)} across ${titles.size || readingEntries.length} ${titles.size === 1 ? "book" : "books or sessions"}.`
    });
  } else {
    patterns.push({ symbol: "▤", title: "Reading pattern forming", text: "Two reading sessions will start showing your preferred subjects and reading rhythm." });
  }

  if (writingEntries.length >= 2) {
    const counts = writingEntries.reduce((result, entry) => {
      result[entry.category || "other"] = (result[entry.category || "other"] || 0) + 1;
      return result;
    }, {});
    const topCategory = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const total = writingEntries.reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0);
    patterns.push({
      symbol: "✎",
      title: "Writing rhythm",
      text: `${writingCategoryLabels[topCategory[0]] || "Other"} appears most often. You spent ${formatDurationShort(total)} writing across ${writingEntries.length} ${writingEntries.length === 1 ? "session" : "sessions"}.`
    });
  } else {
    patterns.push({ symbol: "✎", title: "Writing pattern forming", text: "Two writing sessions will start showing where your creative or focused time goes." });
  }

  const exerciseDays = new Set(exerciseEntries.map((entry) => todayKey(entry.date)));
  const paired = sleepEntries.map((sleep) => {
    const wakeDate = parseDate(sleep.date);
    const priorDay = wakeDate ? todayKey(addDays(wakeDate, -1)) : "";
    return { activePriorDay: exerciseDays.has(priorDay), hours: Number(sleep.hours) };
  }).filter((pair) => Number.isFinite(pair.hours));
  const afterMovement = paired.filter((pair) => pair.activePriorDay).map((pair) => pair.hours);
  const withoutMovement = paired.filter((pair) => !pair.activePriorDay).map((pair) => pair.hours);
  if (afterMovement.length >= 2 && withoutMovement.length >= 2) {
    const difference = mean(afterMovement) - mean(withoutMovement);
    patterns.push({
      symbol: "≈",
      title: "Movement and next-night sleep",
      text: `Sleep was ${Math.abs(round(difference, 1))} hours ${difference >= 0 ? "longer" : "shorter"} after logged movement days. This is an observation, not proof of cause.`
    });
  }

  $("patternInsights").innerHTML = patterns.map((pattern) => `
    <div class="pattern-item">
      <div class="pattern-symbol" aria-hidden="true">${pattern.symbol}</div>
      <div><strong>${escapeHtml(pattern.title)}</strong><p>${escapeHtml(pattern.text)}</p></div>
    </div>`).join("");
}

function drawChart(canvas, primary, options = {}) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = rect.width;
  const height = rect.height || 178;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const context = canvas.getContext("2d");
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  const primaryValues = primary.map((point) => point.value).filter(Number.isFinite);
  const secondaryValues = (options.secondary || []).map((point) => point.value).filter(Number.isFinite);
  const tertiaryValues = (options.tertiary || []).map((point) => point.value).filter(Number.isFinite);
  if (!primaryValues.length && !secondaryValues.length && !tertiaryValues.length) {
    context.fillStyle = "#718078";
    context.font = "13px -apple-system, BlinkMacSystemFont, sans-serif";
    context.textAlign = "center";
    context.fillText("Your chart will appear after you log entries.", width / 2, height / 2);
    return;
  }

  const padding = { top: options.labels ? 28 : 14, right: 8, bottom: 25, left: 35 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const allValues = [...primaryValues, ...secondaryValues, ...tertiaryValues];
  let min = options.tightScale ? Math.min(...allValues) : 0;
  let max = Math.max(...allValues, options.maxHint || 0);
  if (options.tightScale) {
    const spread = Math.max(max - min, 1);
    min -= spread * 0.2;
    max += spread * 0.2;
  } else {
    max = max <= 0 ? 1 : max * 1.12;
  }
  const yFor = (value) => padding.top + plotHeight - ((value - min) / (max - min || 1)) * plotHeight;
  const xFor = (index) => padding.left + (primary.length === 1 ? plotWidth / 2 : index * plotWidth / Math.max(primary.length - 1, 1));

  context.strokeStyle = "#e5ece7";
  context.fillStyle = "#718078";
  context.font = "10px -apple-system, BlinkMacSystemFont, sans-serif";
  context.lineWidth = 1;
  [0, 0.5, 1].forEach((fraction) => {
    const y = padding.top + plotHeight * fraction;
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(width - padding.right, y);
    context.stroke();
    const value = max - (max - min) * fraction;
    context.textAlign = "right";
    context.fillText(`${round(value, max > 100 ? 0 : 1)}`, padding.left - 6, y + 3);
  });

  const labelIndexes = [...new Set([0, Math.floor((primary.length - 1) / 2), primary.length - 1])];
  context.textAlign = "center";
  labelIndexes.forEach((index) => {
    context.fillText(formatShortDate(primary[index].date), xFor(index), height - 5);
  });

  if (options.type === "bar") {
    const slot = plotWidth / Math.max(primary.length, 1);
    const barWidth = Math.max(2, Math.min(18, slot * 0.66));
    context.fillStyle = options.color;
    primary.forEach((point, index) => {
      if (!Number.isFinite(point.value)) return;
      const x = padding.left + slot * index + slot / 2 - barWidth / 2;
      const y = yFor(point.value);
      context.beginPath();
      context.roundRect(x, y, barWidth, Math.max(2, padding.top + plotHeight - y), Math.min(4, barWidth / 2));
      context.fill();
    });
  } else {
    drawLineSeries(context, primary, xFor, yFor, options.color || "#2f6e4f", false);
  }

  if (options.secondary?.length) {
    drawLineSeries(context, options.secondary, xFor, yFor, options.secondaryColor || "#d09a45", true);
  }

  if (options.tertiary?.length) {
    drawLineSeries(context, options.tertiary, xFor, yFor, options.tertiaryColor || "#6686a3", true);
  }

  if (options.labels) {
    const labelColors = [options.color, options.secondaryColor, options.tertiaryColor];
    let labelX = padding.left;
    options.labels.forEach((label, index) => {
      context.fillStyle = labelColors[index] || options.color;
      context.fillRect(labelX, 8, 9, 3);
      context.fillStyle = "#607169";
      context.textAlign = "left";
      context.fillText(label, labelX + 13, 12);
      labelX += context.measureText(label).width + 35;
    });
  }
}

function drawLineSeries(context, points, xFor, yFor, color, dashed) {
  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 2.5;
  context.lineJoin = "round";
  context.lineCap = "round";
  if (dashed) context.setLineDash([5, 5]);
  let drawing = false;
  context.beginPath();
  points.forEach((point, index) => {
    if (!Number.isFinite(point.value)) {
      drawing = false;
      return;
    }
    const x = xFor(index);
    const y = yFor(point.value);
    if (drawing) context.lineTo(x, y);
    else context.moveTo(x, y);
    drawing = true;
  });
  context.stroke();
  context.setLineDash([]);
  points.forEach((point, index) => {
    if (!Number.isFinite(point.value)) return;
    context.beginPath();
    context.arc(xFor(index), yFor(point.value), 3, 0, Math.PI * 2);
    context.fill();
  });
  context.restore();
}

// Authentication
$("createVaultBtn").addEventListener("click", async () => {
  const pin = $("newPin").value.trim();
  const confirmPin = $("confirmPin").value.trim();
  $("authError").textContent = "";
  if (pin.length < 4) {
    $("authError").textContent = "Use at least 4 digits.";
    return;
  }
  if (pin !== confirmPin) {
    $("authError").textContent = "PINs do not match.";
    return;
  }
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

$("unlockPin").addEventListener("keydown", (event) => {
  if (event.key === "Enter") $("unlockBtn").click();
});
$("lockBtn").addEventListener("click", lockApp);

// Navigation and entry actions
document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-nav]");
  if (nav) showView(nav.dataset.nav);

  const filter = event.target.closest("[data-filter]");
  if (filter) {
    currentFilter = filter.dataset.filter;
    renderHistory();
  }

  const period = event.target.closest("[data-period]");
  if (period) {
    currentPeriod = period.dataset.period;
    renderInsights();
  }

  const remove = event.target.closest("[data-delete]");
  if (remove) {
    vault.entries = vault.entries.filter((entry) => entry.id !== remove.dataset.delete);
    encryptVault().then(renderAll).catch(() => toast("Could not delete entry"));
  }
});

// Live calculations and ratings
["sleepStart", "sleepEnd"].forEach((id) => $(id).addEventListener("input", updateSleepDuration));
["readingStart", "readingEnd"].forEach((id) => $(id).addEventListener("input", updateReadingDuration));
["writingStart", "writingEnd"].forEach((id) => $(id).addEventListener("input", updateWritingDuration));
wireRange("sleepQuality", "sleepQualityOutput");
wireRange("appetiteRating", "appetiteRatingOutput");
wireRange("muscleRating", "muscleRatingOutput");
wireRange("mobilityRating", "mobilityRatingOutput");
wireRange("breathRating", "breathRatingOutput");

["foodName", "foodAmount", "foodUnit", "foodCategory"].forEach((id) => {
  $(id).addEventListener("input", () => {
    delete $("foodCalories").dataset.manual;
    updateFoodEstimate();
  });
  $(id).addEventListener("change", () => {
    delete $("foodCalories").dataset.manual;
    updateFoodEstimate();
  });
});
$("foodCalories").addEventListener("input", () => $("foodCalories").dataset.manual = "true");

["exerciseCategory", "exerciseIntensity", "exerciseName", "exerciseMinutes"].forEach((id) => {
  $(id).addEventListener("input", () => {
    delete $("exerciseCalories").dataset.manual;
    updateExerciseEstimate();
  });
  $(id).addEventListener("change", () => {
    delete $("exerciseCalories").dataset.manual;
    updateExerciseEstimate();
  });
});
$("exerciseCalories").addEventListener("input", () => $("exerciseCalories").dataset.manual = "true");

// Save forms
$("saveBody").addEventListener("click", async () => {
  const weightInput = $("bodyWeightValue").value.trim();
  const weight = weightInput === "" ? null : Number(weightInput);
  const measurements = {};
  let invalidMeasurement = false;
  BODY_MEASUREMENTS.forEach(({ key, id }) => {
    const input = $(id).value.trim();
    if (input === "") return;
    const value = Number(input);
    if (!Number.isFinite(value) || value <= 0) invalidMeasurement = true;
    else measurements[key] = value;
  });
  const date = $("bodyDate").value;
  if (weightInput && (!Number.isFinite(weight) || weight <= 0)) return toast("Check the weight value");
  if (invalidMeasurement) return toast("Body measurements must be greater than zero");
  if (weight == null && !Object.keys(measurements).length) return toast("Enter weight, a body measurement, or both");
  if (!date) return toast("Choose a measurement date");
  addEntry("body", {
    weight,
    weightUnit: $("bodyWeightUnit").value,
    measurements,
    measurementUnit: $("measurementUnit").value,
    note: $("bodyNote").value.trim()
  }, new Date(`${date}T12:00:00`).toISOString());
  $("bodyWeightValue").value = "";
  BODY_MEASUREMENTS.forEach(({ id }) => $(id).value = "");
  $("bodyNote").value = "";
  await saveAndRender("Body entry saved");
  updateExerciseEstimate();
});

$("saveSleep").addEventListener("click", async () => {
  const start = parseDate($("sleepStart").value);
  const end = parseDate($("sleepEnd").value);
  const hours = updateSleepDuration();
  if (!start || !end || !hours) return toast("Check your sleep and wake times");
  addEntry("sleep", {
    start: start.toISOString(),
    end: end.toISOString(),
    hours,
    trouble: $("sleepTrouble").value,
    quality: Number($("sleepQuality").value),
    note: $("sleepNote").value.trim()
  }, end.toISOString());
  $("sleepTrouble").value = "no";
  $("sleepQuality").value = "7";
  $("sleepQuality").dispatchEvent(new Event("input"));
  $("sleepNote").value = "";
  setDefaultSleepTimes();
  await saveAndRender("Sleep saved");
});

$("saveFood").addEventListener("click", async () => {
  const name = $("foodName").value.trim();
  const amount = Number($("foodAmount").value);
  const date = $("foodDate").value;
  const calories = $("foodCalories").value === "" ? null : Number($("foodCalories").value);
  const estimate = estimateFoodCalories();
  if (!name || !amount || amount <= 0 || !date) return toast("Enter the food, amount, and time");
  if (calories == null || !Number.isFinite(calories)) return toast("Check the calorie estimate");
  addEntry("food", {
    name,
    meal: $("foodMeal").value,
    category: $("foodCategory").value,
    amount,
    unit: $("foodUnit").value,
    calories,
    calorieSource: estimate?.source || "manual",
    appetiteRating: Number($("appetiteRating").value),
    appetiteNote: $("appetiteNote").value.trim()
  }, new Date(date).toISOString());
  $("foodName").value = "";
  $("foodAmount").value = "";
  $("foodCalories").value = "";
  delete $("foodCalories").dataset.manual;
  $("appetiteNote").value = "";
  updateFoodEstimate();
  await saveAndRender("Food saved");
});

$("saveExercise").addEventListener("click", async () => {
  const category = $("exerciseCategory").value;
  const name = $("exerciseName").value.trim() || exerciseCategoryLabels[category];
  const minutes = Number($("exerciseMinutes").value);
  const calories = $("exerciseCalories").value === "" ? null : Number($("exerciseCalories").value);
  const date = $("exerciseDate").value;
  const estimate = estimateExerciseCalories();
  if (!minutes || minutes <= 0 || !date) return toast("Enter exercise time and date");
  if (calories == null || !Number.isFinite(calories)) return toast("Check the calorie estimate");
  addEntry("exercise", {
    name,
    category,
    intensity: $("exerciseIntensity").value,
    minutes,
    calories,
    met: estimate?.met || null,
    estimateWeightKg: estimate?.weight.kg || null,
    muscleRating: Number($("muscleRating").value),
    mobilityRating: Number($("mobilityRating").value),
    breathRating: Number($("breathRating").value),
    note: $("exerciseNote").value.trim()
  }, new Date(date).toISOString());
  $("exerciseName").value = "";
  $("exerciseMinutes").value = "";
  $("exerciseCalories").value = "";
  delete $("exerciseCalories").dataset.manual;
  $("exerciseNote").value = "";
  updateExerciseEstimate();
  await saveAndRender("Exercise saved");
});

$("saveReading").addEventListener("click", async () => {
  const start = parseDate($("readingStart").value);
  const end = parseDate($("readingEnd").value);
  const minutes = updateReadingDuration();
  const title = $("readingTitle").value.trim();
  if (!start || !end || !minutes) return toast("Check your reading start and end times");
  if (!title) return toast("Enter the book title");
  addEntry("reading", {
    start: start.toISOString(),
    end: end.toISOString(),
    minutes,
    title,
    category: $("readingCategory").value,
    note: $("readingNote").value.trim()
  }, end.toISOString());
  $("readingTitle").value = "";
  $("readingNote").value = "";
  setDefaultTimedActivity("readingStart", "readingEnd");
  updateReadingDuration();
  await saveAndRender("Reading saved");
});

$("saveWriting").addEventListener("click", async () => {
  const start = parseDate($("writingStart").value);
  const end = parseDate($("writingEnd").value);
  const minutes = updateWritingDuration();
  if (!start || !end || !minutes) return toast("Check your writing start and end times");
  addEntry("writing", {
    start: start.toISOString(),
    end: end.toISOString(),
    minutes,
    topic: $("writingTopic").value.trim(),
    category: $("writingCategory").value,
    note: $("writingNote").value.trim()
  }, end.toISOString());
  $("writingTopic").value = "";
  $("writingNote").value = "";
  setDefaultTimedActivity("writingStart", "writingEnd");
  updateWritingDuration();
  await saveAndRender("Writing saved");
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
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `verdant-backup-${todayKey()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
});

$("importFile").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!imported.salt || !imported.vault) throw new Error("Invalid backup");
    if (!confirm("Importing will replace the local vault on this device. Continue?")) return;
    localStorage.setItem(SALT_KEY, imported.salt);
    localStorage.setItem(STORAGE_KEY, imported.vault);
    lockApp();
    toast("Backup imported");
  } catch {
    toast("Invalid backup file");
  } finally {
    event.target.value = "";
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

window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  if (!$("insightsView").classList.contains("hidden")) {
    resizeTimer = setTimeout(renderInsights, 120);
  }
});

// Progressive web app
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

showAuthState();
