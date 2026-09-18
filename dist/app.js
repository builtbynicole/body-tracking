const APP_VERSION = 7;
const STORAGE_KEY = "verdant-vault-v1";
const SALT_KEY = "verdant-salt-v1";
const ITERATIONS = 250000;
const PERIOD_DAYS = { week: 7, month: 30, quarter: 90 };

let vault = { version: APP_VERSION, entries: [], quickEntries: [], routineDrafts: {} };
let cryptoKey = null;
let currentFilter = "all";
let currentPeriod = "week";
let currentInsightGroup = "overview";
let currentLogGroup = "body";
let currentLogForm = "body";
let selectedLogFormsByGroup = { body: "body", nourish: "food", move: "exercise", focus: "reading", care: "care" };
let inactivityTimer = null;
let resizeTimer = null;
let activeFlow = null;
let activeFlowStep = 0;
let flowAnswers = {};
let flowAnswered = new Set();

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
  water: "💧",
  medication: "✦",
  event: "!",
  exercise: "↗",
  reading: "▤",
  writing: "✎",
  care: "✓",
  checkin: "○",
  morning: "☀",
  evening: "☾"
};

const mealLabels = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack"
};

const foodCategoryLabels = {
  carbohydrate: "Carbohydrate",
  protein: "Protein",
  fiber: "Vegetables, fruit & fiber",
  fat: "Healthy fats",
  dairy: "Dairy",
  beverage: "Beverage",
  other: "Mixed / other"
};

const medicationKindLabels = {
  supplement: "Supplement",
  prescription: "Prescription medication",
  otc: "Over-the-counter medication",
  traditional: "Traditional / herbal",
  other: "Other"
};

const medicationStatusLabels = {
  taken: "Taken",
  late: "Taken late",
  missed: "Missed",
  skipped: "Skipped intentionally"
};

const eventKindLabels = {
  bowel: "Bowel movement",
  "period-start": "Period started",
  "period-end": "Period ended",
  diarrhea: "Diarrhea",
  vomiting: "Vomiting",
  symptom: "Symptom or sudden change",
  other: "Other event"
};

const careItemLabels = {
  brush: "Brushed teeth",
  floss: "Flossed",
  "wash-face": "Washed face",
  skincare: "Skincare",
  shower: "Showered",
  "tidy-room": "Tidied room"
};

const CARE_INPUTS = [
  { id: "careBrush", key: "brush" },
  { id: "careFloss", key: "floss" },
  { id: "careFace", key: "wash-face" },
  { id: "careSkincare", key: "skincare" },
  { id: "careShower", key: "shower" },
  { id: "careRoom", key: "tidy-room" }
];

const RECORD_GROUPS = {
  body: ["body", "sleep", "event"],
  nourish: ["food", "water", "medication"],
  move: ["exercise"],
  focus: ["reading", "writing"],
  care: ["care", "checkin"]
};

const LOG_GROUP_DEFAULTS = {
  body: "body",
  nourish: "food",
  move: "exercise",
  focus: "reading",
  care: "care"
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
    const migrated = { ...entry, schemaVersion: Number(entry.schemaVersion) || 1 };
    if (entry.type === "weight") {
      migrated.type = "body";
      migrated.weight = entry.unit === "lb"
        ? round(Number(entry.value) * 0.45359237, 1)
        : Number(entry.value);
      migrated.weightUnit = entry.unit === "lb" ? "kg" : (entry.unit || "kg");
      migrated.measurements = {};
      migrated.measurementUnit = "cm";
      migrated.weightSession = (parseDate(entry.date)?.getHours() || 0) < 14 ? "morning" : "evening";
      if (entry.unit === "lb") migrated.migratedFromUnit = "lb";
      delete migrated.value;
      delete migrated.unit;
    } else if (entry.type === "body") {
      migrated.weight = entry.weight == null ? null : Number(entry.weight);
      migrated.weightUnit = entry.weightUnit || "kg";
      migrated.measurements = entry.measurements || {};
      migrated.measurementUnit = entry.measurementUnit || "cm";
      migrated.weightSession = entry.weightSession || (hasBodyWeight(entry) ? ((parseDate(entry.date)?.getHours() || 0) < 14 ? "morning" : "evening") : null);
    } else if (entry.type === "sleep") {
      migrated.hours = Number(entry.hours) || 0;
    } else if (entry.type === "food" && (entry.meal === "supplement" || entry.category === "supplement")) {
      migrated.type = "medication";
      migrated.kind = "supplement";
      migrated.name = entry.name || "Supplement";
      migrated.doseAmount = entry.amount == null ? null : Number(entry.amount);
      migrated.doseUnit = entry.unit || "dose";
      migrated.status = "taken";
      migrated.note = entry.appetiteNote || "";
      migrated.legacyFood = {
        calories: entry.calories ?? null,
        calorieSource: entry.calorieSource || null,
        appetiteRating: entry.appetiteRating ?? null
      };
      ["meal", "category", "amount", "unit", "calories", "calorieSource", "appetiteRating", "appetiteNote"].forEach((key) => delete migrated[key]);
    } else if (entry.type === "food") {
      migrated.meal = entry.meal || "snack";
      migrated.category = entry.category || "other";
    } else if (entry.type === "medication") {
      migrated.kind = medicationKindLabels[entry.kind] ? entry.kind : "other";
      migrated.name = String(entry.name || "Medication");
      migrated.doseAmount = entry.doseAmount == null ? null : Number(entry.doseAmount);
      migrated.doseUnit = entry.doseUnit || "dose";
      migrated.status = medicationStatusLabels[entry.status] ? entry.status : "taken";
      migrated.note = entry.note || "";
    } else if (entry.type === "event") {
      migrated.kind = eventKindLabels[entry.kind] ? entry.kind : "other";
      migrated.name = String(entry.name || "");
      migrated.severity = entry.severity == null ? null : Number(entry.severity);
      migrated.bowelForm = entry.bowelForm == null || entry.bowelForm === "" ? null : Number(entry.bowelForm);
      migrated.ease = ["easy", "neutral", "difficult"].includes(entry.ease) ? entry.ease : null;
      migrated.note = entry.note || "";
    } else if (entry.type === "care") {
      migrated.items = [...new Set((Array.isArray(entry.items) ? entry.items : []).map(String))];
      migrated.customItems = [...new Set((Array.isArray(entry.customItems) ? entry.customItems : []).map(String).filter(Boolean))];
      migrated.note = entry.note || "";
    } else if (entry.type === "exercise") {
      migrated.category = entry.category === "aerobic" ? "cardio" : (entry.category || "cardio");
      migrated.intensity = entry.intensity || "moderate";
    } else if (entry.type === "reading" || entry.type === "writing") {
      migrated.minutes = Number(entry.minutes) || 0;
    } else if (entry.type === "water") {
      const amount = Number(entry.amount) || 0;
      migrated.amount = amount;
      migrated.unit = ["ml", "cup", "oz"].includes(entry.unit) ? entry.unit : "ml";
      migrated.ml = Number(entry.ml) || (migrated.unit === "cup" ? amount * 240 : migrated.unit === "oz" ? amount * 29.5735 : amount);
    } else if (entry.type === "checkin") {
      ["overall", "mood", "energy", "stress", "appetite", "strength", "mobility", "breath"].forEach((key) => {
        migrated[key] = entry[key] == null || entry[key] === "" ? null : Number(entry[key]);
      });
      migrated.routine = entry.routine || "evening";
    }
    return migrated;
  });
  migratedEntries.sort((a, b) => (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0));
  return {
    ...data,
    version: APP_VERSION,
    entries: migratedEntries,
    quickEntries: Array.isArray(data?.quickEntries) ? data.quickEntries : [],
    routineDrafts: data?.routineDrafts && typeof data.routineDrafts === "object" ? data.routineDrafts : {}
  };
}

async function createVault(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(SALT_KEY, bytesToB64(salt));
  cryptoKey = await deriveKey(pin, salt);
  vault = { version: APP_VERSION, entries: [], quickEntries: [], routineDrafts: {} };
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
  vault = { version: APP_VERSION, entries: [], quickEntries: [], routineDrafts: {} };
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
  renderLogHome();
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
  $("careDate").value = todayKey(now);
  ["foodDate", "medicationDate", "exerciseDate", "eventDate"].forEach((id) => $(id).value = localDateTime);
  setDefaultSleepTimes();
  setDefaultTimedActivity("readingStart", "readingEnd");
  setDefaultTimedActivity("writingStart", "writingEnd");
  updateReadingDuration();
  updateWritingDuration();
  updateFoodEstimate();
  updateExerciseEstimate();
  updateEventFields();
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
  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    type,
    schemaVersion: 1,
    date,
    createdAt: new Date().toISOString(),
    ...payload
  };
  vault.entries.push(entry);
  vault.entries.sort((a, b) => (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0));
  return entry;
}

async function saveAndRender(message) {
  await encryptVault();
  renderAll();
  toast(message);
}

function renderAll() {
  renderDashboard();
  renderHistory();
  renderQuickEntries();
  renderRoutineHub();
  renderQuickEntrySettings();
  if (!$("insightsView").classList.contains("hidden")) renderInsights();
}

function recordGroup(type) {
  return Object.entries(RECORD_GROUPS).find(([, types]) => types.includes(type))?.[0] || "body";
}

function selectLogGroup(group) {
  if (!RECORD_GROUPS[group]) return;
  currentLogGroup = group;
  currentLogForm = selectedLogFormsByGroup[group] || LOG_GROUP_DEFAULTS[group];
  document.querySelectorAll("[data-log-group]").forEach((button) => {
    const active = button.dataset.logGroup === group;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll("[data-log-parent]").forEach((button) => {
    button.classList.toggle("hidden", button.dataset.logParent !== group);
    const active = button.dataset.logFormSelect === currentLogForm;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll("[data-log-form]").forEach((form) => {
    form.classList.toggle("hidden", form.dataset.logForm !== currentLogForm);
  });
}

function selectLogForm(formName) {
  const group = recordGroup(formName);
  if (group !== currentLogGroup) return;
  currentLogForm = formName;
  selectedLogFormsByGroup[group] = formName;
  document.querySelectorAll("[data-log-form-select]").forEach((button) => {
    const active = button.dataset.logFormSelect === formName;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll("[data-log-form]").forEach((form) => {
    form.classList.toggle("hidden", form.dataset.logForm !== formName);
  });
}

function updateInsightVisibility() {
  document.querySelectorAll("[data-insight-group]").forEach((button) => {
    const active = button.dataset.insightGroup === currentInsightGroup;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll("[data-insight-section]").forEach((section) => {
    section.classList.toggle("hidden", section.dataset.insightSection !== currentInsightGroup);
  });
}

function updateEventFields() {
  const kind = $("eventKind").value;
  const custom = kind === "symptom" || kind === "other";
  $("eventBowelFields").classList.toggle("hidden", kind !== "bowel");
  $("eventNameField").classList.toggle("hidden", !custom);
  $("eventSeverityField").classList.toggle("hidden", !["diarrhea", "vomiting", "symptom", "other"].includes(kind));
  $("eventNamePrompt").textContent = kind === "symptom" ? "What did you notice?" : "Event name";
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

function careActionLabels(entry) {
  const standard = (Array.isArray(entry.items) ? entry.items : []).map((item) => careItemLabels[item] || titleCase(item));
  const custom = (Array.isArray(entry.customItems) ? entry.customItems : []).map((item) => String(item).trim()).filter(Boolean);
  return [...standard, ...custom];
}

function medicationDoseText(entry) {
  const amount = Number(entry.doseAmount);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  const unit = entry.doseUnit === "ml" ? "mL" : (entry.doseUnit || "dose");
  return `${round(amount, 2)} ${unit}`;
}

function eventTitle(entry) {
  if ((entry.kind === "symptom" || entry.kind === "other") && entry.name) return entry.name;
  return eventKindLabels[entry.kind] || entry.name || "Health event";
}

function routineEntry(kind, date = todayKey()) {
  return entriesByType("checkin").find((entry) => entry.routine === kind && todayKey(entry.date) === date);
}

function routineState(kind) {
  if (routineEntry(kind)) return "done";
  if (vault.routineDrafts?.[kind]) return "draft";
  return "ready";
}

function renderRoutineHub() {
  if (!vault || !$('routineList') || !$('todayRoutineCard')) return;
  const hour = new Date().getHours();
  const morningState = routineState("morning");
  const eveningState = routineState("evening");
  const recommended = hour < 15 && morningState !== "done"
    ? "morning"
    : eveningState !== "done" ? "evening" : morningState !== "done" ? "morning" : null;
  const data = {
    morning: { icon: "☀", title: "Morning check-in", cue: "After waking", detail: "Daily pulse · last night’s sleep" },
    evening: { icon: "☾", title: "Evening review", cue: "After dinner", detail: "Daily pulse · anything worth remembering" }
  };
  $('routineList').innerHTML = ["morning", "evening"].map((kind) => {
    const state = routineState(kind);
    const status = state === "done" ? "Done today" : state === "draft" ? "Continue" : data[kind].cue;
    return `<button type="button" class="routine-choice ${state === "done" ? "is-complete" : ""}" data-start-flow="${kind}">
      <span class="routine-icon" aria-hidden="true">${data[kind].icon}</span>
      <span><strong>${data[kind].title}</strong><small>${data[kind].detail}</small></span>
      <span class="routine-status">${status}</span>
    </button>`;
  }).join("");

  if (!recommended) {
    $('todayRoutineCard').innerHTML = `<div><p class="eyebrow">TODAY IS RECORDED</p><h2>You’re all caught up</h2><p>Both check-ins are safely in your timeline. Nothing else is required.</p></div><button type="button" class="secondary compact-action" data-nav="add">View today</button>`;
    return;
  }
  const item = data[recommended];
  const state = routineState(recommended);
  $('todayRoutineCard').innerHTML = `<div><p class="eyebrow">NEXT GENTLE STEP</p><h2>${item.title}</h2><p>${state === "draft" ? "Pick up where you left off." : `${item.cue}, Verdant will guide you one question at a time.`}</p><small>Only your first 1–10 pulse is required.</small></div><button type="button" class="primary compact-action" data-start-flow="${recommended}">${state === "draft" ? "Continue" : "Begin"}</button>`;
}

function renderDashboard() {
  const today = todayKey();
  $("heroDate").textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "long", month: "long", day: "numeric"
  }).format(new Date());

  const bodyEntries = entriesByType("body");
  const latestBody = bodyEntries[0];
  const latestWeight = bodyEntries.find(hasBodyWeight);
  const latestSleep = entriesByType("sleep")[0];
  const todayFood = entriesByType("food").filter((entry) => todayKey(entry.date) === today);
  const todayWater = entriesByType("water").filter((entry) => todayKey(entry.date) === today);
  const todayExercise = entriesByType("exercise").filter((entry) => todayKey(entry.date) === today);
  const todayReading = entriesByType("reading").filter((entry) => todayKey(entry.date) === today);
  const todayWriting = entriesByType("writing").filter((entry) => todayKey(entry.date) === today);
  const todayMedication = entriesByType("medication").filter((entry) => todayKey(entry.date) === today);
  const todayEvents = entriesByType("event").filter((entry) => todayKey(entry.date) === today);
  const todayCare = entriesByType("care").filter((entry) => todayKey(entry.date) === today);
  const todayCheckin = entriesByType("checkin").find((entry) => todayKey(entry.date) === today);

  renderRoutineHub();

  if (latestBody || latestWeight) {
    const count = measurementCount(latestBody);
    $("metricBody").textContent = latestWeight ? weightText(latestWeight) : `${count} measured`;
    $("metricBodySub").textContent = [
      latestWeight?.weightSession ? `${titleCase(latestWeight.weightSession)} · ${formatDateTime(latestWeight.date)}` : "",
      count ? `${count} measurement${count === 1 ? "" : "s"}` : "",
      !latestWeight && latestBody ? formatDateOnly(latestBody.date) : "",
      todayEvents.length ? `${todayEvents.length} event${todayEvents.length === 1 ? "" : "s"} today` : ""
    ].filter(Boolean).join(" · ");
  } else if (todayEvents.length) {
    $("metricBody").textContent = `${todayEvents.length} event${todayEvents.length === 1 ? "" : "s"}`;
    $("metricBodySub").textContent = "Logged today";
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
  const waterMl = todayWater.reduce((sum, entry) => sum + (Number(entry.ml) || 0), 0);
  $("metricFood").textContent = calorieTotal ? `${Math.round(calorieTotal)} kcal` : `${todayFood.length + todayMedication.length}`;
  $("metricFoodSub").textContent = `${waterMl ? `${round(waterMl / 1000, 2)} L water · ` : ""}${todayFood.length} food · ${todayMedication.length} dose${todayMedication.length === 1 ? "" : "s"}`;

  const minutes = todayExercise.reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0);
  $("metricExercise").textContent = minutes ? `${minutes} min` : "—";
  $("metricExerciseSub").textContent = `${todayExercise.length} ${todayExercise.length === 1 ? "session" : "sessions"} today`;

  const readingMinutes = todayReading.reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0);
  const writingMinutes = todayWriting.reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0);
  const focusMinutes = readingMinutes + writingMinutes;
  $("metricFocus").textContent = focusMinutes ? formatDurationShort(focusMinutes) : "—";
  $("metricFocusSub").textContent = `${todayReading.length} reading · ${todayWriting.length} writing`;

  const careActions = new Set(todayCare.flatMap(careActionLabels));
  $("metricCare").textContent = careActions.size ? `${careActions.size} done` : (todayCheckin ? `${round(mean([todayCheckin.overall, todayCheckin.appetite, todayCheckin.strength, todayCheckin.mobility, todayCheckin.breath]), 1)}/10` : "—");
  $("metricCareSub").textContent = [todayCare.length ? `${todayCare.length} care log${todayCare.length === 1 ? "" : "s"}` : "", todayCheckin ? "daily pulse recorded" : ""].filter(Boolean).join(" · ") || "Nothing logged today";

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
    : vault.entries.filter((entry) => recordGroup(entry.type) === currentFilter);
  renderEntryList($("historyEntries"), filtered, true);
}

function entryText(entry) {
  if (entry.type === "body" || entry.type === "weight") {
    const details = measurementDetails(entry);
    const count = details.length;
    return {
      title: "Body",
      value: weightText(entry) || `${count} measurement${count === 1 ? "" : "s"}`,
      sub: [hasBodyWeight(entry) ? formatDateTime(entry.date) : formatDateOnly(entry.date), entry.weightSession ? titleCase(entry.weightSession) : "", ...details].filter(Boolean).join(" · "),
      note: entry.note || ""
    };
  }
  if (entry.type === "event") {
    const details = [
      entry.kind === "bowel" && entry.bowelForm ? `Stool type ${entry.bowelForm}` : "",
      entry.kind === "bowel" && entry.ease ? titleCase(entry.ease) : "",
      entry.severity ? `Intensity ${entry.severity}/10` : ""
    ].filter(Boolean);
    return {
      title: eventTitle(entry),
      value: entry.kind === "bowel" && entry.bowelForm ? `Type ${entry.bowelForm}` : (entry.severity ? `${entry.severity}/10` : ""),
      sub: [eventKindLabels[entry.kind], ...details, formatDateTime(entry.date)].filter(Boolean).join(" · "),
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
      note: entry.note || entry.appetiteNote || ""
    };
  }
  if (entry.type === "water") {
    return {
      title: "Water",
      value: entry.ml >= 1000 ? `${round(entry.ml / 1000, 2)} L` : `${round(entry.ml, 0)} mL`,
      sub: `${round(entry.amount, 1)} ${entry.unit || "ml"} · ${formatDateTime(entry.date)}`,
      note: ""
    };
  }
  if (entry.type === "medication") {
    const dose = medicationDoseText(entry);
    const status = medicationStatusLabels[entry.status] || titleCase(entry.status || "taken");
    return {
      title: entry.name || "Medication or supplement",
      value: dose || status,
      sub: [medicationKindLabels[entry.kind] || "Other", status, formatDateTime(entry.date)].join(" · "),
      note: entry.note || ""
    };
  }
  if (entry.type === "exercise") {
    const category = exerciseCategoryLabels[entry.category] || "Exercise";
    return {
      title: entry.name || category,
      value: `${entry.minutes} min${entry.calories != null ? ` · ${Math.round(entry.calories)} kcal` : ""}`,
      sub: `${category} · ${titleCase(entry.intensity || "moderate")} · ${formatDateTime(entry.date)}`,
      note: entry.note || ""
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
  if (entry.type === "care") {
    const actions = careActionLabels(entry);
    return {
      title: "Care & upkeep",
      value: `${actions.length} done`,
      sub: [formatDateOnly(entry.date), ...actions].join(" · "),
      note: entry.note || ""
    };
  }
  if (entry.type === "checkin") {
    const average = mean([entry.overall, entry.mood, entry.energy, entry.appetite, entry.strength, entry.mobility, entry.breath]);
    const details = [
      entry.overall != null ? `Overall ${entry.overall}/10` : "",
      entry.mood != null ? `Mood ${entry.mood}/10` : "",
      entry.energy != null ? `Energy ${entry.energy}/10` : "",
      entry.appetite != null ? `Appetite ${entry.appetite}/10` : ""
    ].filter(Boolean);
    return {
      title: entry.routine === "morning" ? "Morning check-in" : "Evening review",
      value: average == null ? "" : `${round(average, 1)}/10`,
      sub: [...details, formatDateOnly(entry.date)].join(" · "),
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
  if (name === "add") renderLogHome();
  if (name === "settings") renderQuickEntrySettings();
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
  const valid = values.filter((value) => value != null && value !== "").map(Number).filter(Number.isFinite);
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

function periodTrackingSummary(entries = entriesByType("event")) {
  const periodEvents = entries
    .filter((entry) => entry.kind === "period-start" || entry.kind === "period-end")
    .sort((a, b) => (parseDate(a.date) || 0) - (parseDate(b.date) || 0));
  let openStart = null;
  let lastDuration = null;
  periodEvents.forEach((entry) => {
    const date = parseDate(entry.date);
    if (!date) return;
    if (entry.kind === "period-start") openStart = date;
    if (entry.kind === "period-end" && openStart && date >= openStart) {
      lastDuration = Math.max(1, Math.round((date - openStart) / 86400000) + 1);
      openStart = null;
    }
  });
  if (openStart) return { status: "started", text: `Period marked as started ${formatDateOnly(openStart)}` };
  if (lastDuration != null) return { status: "ended", text: `Last complete recorded period: ${lastDuration} days` };
  return { status: "none", text: "No complete period interval yet" };
}

function renderInsights() {
  const days = PERIOD_DAYS[currentPeriod];
  const dates = periodDates(days);
  const sleepEntries = entriesForPeriod("sleep", dates);
  const foodEntries = entriesForPeriod("food", dates);
  const waterEntries = entriesForPeriod("water", dates);
  const medicationEntries = entriesForPeriod("medication", dates);
  const exerciseEntries = entriesForPeriod("exercise", dates);
  const bodyEntries = entriesForPeriod("body", dates);
  const eventEntries = entriesForPeriod("event", dates);
  const careEntries = entriesForPeriod("care", dates);
  const checkinEntries = entriesForPeriod("checkin", dates);
  const weightEntries = bodyEntries.filter(hasBodyWeight);
  const measurementEntries = bodyEntries.filter((entry) => measurementCount(entry));
  const readingEntries = entriesForPeriod("reading", dates);
  const writingEntries = entriesForPeriod("writing", dates);

  updateInsightVisibility();
  document.querySelectorAll("#insightPeriod .seg").forEach((button) => {
    const active = button.dataset.period === currentPeriod;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  $("insightDateRange").textContent = `${formatPeriodRange(dates)} · ${days}-day view`;

  const avgSleep = mean(sleepEntries.map((entry) => entry.hours));
  const loggedFoodDays = new Set(foodEntries.map((entry) => todayKey(entry.date))).size;
  const foodCalories = foodEntries.reduce((sum, entry) => sum + (Number(entry.calories) || 0), 0);
  const waterMl = waterEntries.reduce((sum, entry) => sum + (Number(entry.ml) || 0), 0);
  const waterDays = new Set(waterEntries.map((entry) => todayKey(entry.date))).size;
  const activeMinutes = exerciseEntries.reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0);
  const activeDays = new Set(exerciseEntries.map((entry) => todayKey(entry.date))).size;
  const readingMinutes = readingEntries.reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0);
  const readingDays = new Set(readingEntries.map((entry) => todayKey(entry.date))).size;
  const writingMinutes = writingEntries.reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0);
  const writingDays = new Set(writingEntries.map((entry) => todayKey(entry.date))).size;
  const focusMinutes = readingMinutes + writingMinutes;
  const careActions = careEntries.reduce((sum, entry) => sum + careActionLabels(entry).length, 0);
  const careDays = new Set(careEntries.map((entry) => todayKey(entry.date))).size;
  const medicationTaken = medicationEntries.filter((entry) => entry.status === "taken" || entry.status === "late").length;
  const medicationMissed = medicationEntries.filter((entry) => entry.status === "missed" || entry.status === "skipped").length;
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
    { label: "Body", value: avgSleep == null ? (bodyEntries.length + eventEntries.length || "—") : `${round(avgSleep, 1)} h`, sub: `${sleepEntries.length} rest · ${bodyEntries.length} body · ${eventEntries.length} event` },
    { label: "Nourish", value: waterMl ? `${round(waterMl / 1000, 1)} L` : (loggedFoodDays ? `${Math.round(foodCalories / loggedFoodDays)} kcal` : (medicationEntries.length ? `${medicationEntries.length} doses` : "—")), sub: `${waterDays} water days · ${loggedFoodDays} food days · ${medicationEntries.length} dose logs` },
    { label: "Move", value: activeMinutes ? `${activeMinutes} min` : "—", sub: `${activeDays} active ${activeDays === 1 ? "day" : "days"}` },
    { label: "Focus", value: focusMinutes ? formatDurationShort(focusMinutes) : "—", sub: `${readingDays} reading · ${writingDays} writing days` },
    { label: "Care", value: checkinEntries.length ? `${round(mean(checkinEntries.flatMap((entry) => [entry.overall, entry.mood, entry.energy, entry.appetite, entry.strength, entry.mobility, entry.breath])), 1)}/10` : (careActions ? `${careActions} done` : "—"), sub: `${checkinEntries.length} daily pulses · ${careDays} care days` }
  ].map((item) => `
    <article class="summary-item">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
      <small>${escapeHtml(item.sub)}</small>
    </article>`).join("");

  const sleepHours = groupDaily(sleepEntries, dates, (entry) => entry.hours, "average");
  const sleepQuality = groupDaily(sleepEntries.filter((entry) => entry.quality), dates, (entry) => entry.quality, "average");
  const dailyFood = groupDaily(foodEntries, dates, (entry) => entry.calories);
  const dailyWater = groupDaily(waterEntries, dates, (entry) => entry.ml);
  const dailyMedication = groupDaily(medicationEntries, dates, () => 1);
  const dailyExercise = groupDaily(exerciseEntries, dates, (entry) => entry.minutes);
  const dailyMorningWeight = groupDaily(weightEntries.filter((entry) => entry.weightSession === "morning"), dates, displayWeightValue, "average");
  const dailyEveningWeight = groupDaily(weightEntries.filter((entry) => entry.weightSession === "evening"), dates, displayWeightValue, "average");
  const dailyWaist = groupDaily(measurementEntries, dates, (entry) => measurementValue(entry, "waist", preferredMeasurementUnit), "average");
  const dailyHips = groupDaily(measurementEntries, dates, (entry) => measurementValue(entry, "hips", preferredMeasurementUnit), "average");
  const dailyAbdomen = groupDaily(measurementEntries, dates, (entry) => measurementValue(entry, "abdomen", preferredMeasurementUnit), "average");
  const dailyReading = groupDaily(readingEntries, dates, (entry) => entry.minutes);
  const dailyWriting = groupDaily(writingEntries, dates, (entry) => entry.minutes);
  const dailyEvents = groupDaily(eventEntries, dates, () => 1);
  const dailyCare = groupDaily(careEntries, dates, (entry) => careActionLabels(entry).length);
  const dailyCheckin = groupDaily(checkinEntries, dates, (entry) => mean([entry.overall, entry.mood, entry.energy, entry.appetite, entry.strength, entry.mobility, entry.breath]), "average");
  const dailyAppetite = groupDaily(checkinEntries, dates, (entry) => entry.appetite, "average");

  drawChart($("sleepChart"), sleepHours, {
    type: "line", color: "#2f6e4f", secondary: sleepQuality, secondaryColor: "#d09a45", maxHint: 12,
    labels: ["Hours", "Quality"]
  });
  drawChart($("foodChart"), dailyFood, { type: "bar", color: "#7ca98b" });
  drawChart($("waterChart"), dailyWater, { type: "bar", color: "#6686a3" });
  drawChart($("medicationChart"), dailyMedication, { type: "bar", color: "#8f79a8" });
  drawChart($("exerciseChart"), dailyExercise, { type: "bar", color: "#4b8767" });
  drawChart($("weightChart"), dailyMorningWeight, { type: "line", color: "#7d6f9f", secondary: dailyEveningWeight, secondaryColor: "#b57d49", labels: ["Morning", "Evening"], tightScale: true });
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
  drawChart($("eventChart"), dailyEvents, { type: "bar", color: "#a06f62" });
  drawChart($("careChart"), dailyCare, { type: "bar", color: "#d09a45" });
  drawChart($("checkinChart"), dailyCheckin, { type: "line", color: "#2f6e4f", secondary: dailyAppetite, secondaryColor: "#d09a45", maxHint: 10, labels: ["Overall", "Appetite"] });

  $("sleepChartValue").textContent = avgSleep == null ? "No data" : `${round(avgSleep, 1)} h avg`;
  $("sleepChartSummary").textContent = avgSleep == null
    ? "Log sleep times to see duration and quality together."
    : `${sleepEntries.length} ${sleepEntries.length === 1 ? "night" : "nights"}; average quality ${formatAverage(sleepEntries.map((entry) => entry.quality), "/10")}.`;
  $("foodChartValue").textContent = foodCalories ? `${Math.round(foodCalories)} kcal` : "No data";
  $("foodChartSummary").textContent = foodEntries.length
    ? `${foodEntries.length} food ${foodEntries.length === 1 ? "entry" : "entries"} across ${loggedFoodDays} logged ${loggedFoodDays === 1 ? "day" : "days"}. Calories are estimates.`
    : "Log foods and portions to see estimated daily energy.";
  $("waterChartValue").textContent = waterMl ? `${round(waterMl / 1000, 2)} L` : "No data";
  $("waterChartSummary").textContent = waterEntries.length
    ? `${round(waterMl / 1000, 2)} litres across ${waterDays} ${waterDays === 1 ? "day" : "days"}; average ${Math.round(waterMl / Math.max(1, waterDays))} mL per logged day.`
    : "Log water in one tap or enter a custom amount to see hydration patterns.";
  const medicationNames = new Set(medicationEntries.map((entry) => entry.name?.trim().toLowerCase()).filter(Boolean));
  $("medicationChartValue").textContent = medicationEntries.length ? `${medicationTaken} taken` : "No data";
  $("medicationChartSummary").textContent = medicationEntries.length
    ? `${medicationTaken} taken or late · ${medicationMissed} missed or skipped · ${medicationNames.size} distinct ${medicationNames.size === 1 ? "item" : "items"}.`
    : "Log medication, supplements, or missed doses to see your intake rhythm.";
  $("exerciseChartValue").textContent = activeMinutes ? `${activeMinutes} min` : "No data";
  $("exerciseChartSummary").textContent = exerciseEntries.length
    ? `${exerciseEntries.length} ${exerciseEntries.length === 1 ? "session" : "sessions"}; estimated energy ${Math.round(exerciseEntries.reduce((sum, entry) => sum + (Number(entry.calories) || 0), 0))} kcal.`
    : "Log movement to see your active-time rhythm.";
  $("weightChartValue").textContent = sortedWeights.length ? `${round(displayWeightValue(sortedWeights.at(-1)), 1)} ${preferredWeightLabel}` : "No data";
  const morningCount = weightEntries.filter((entry) => entry.weightSession === "morning").length;
  const eveningCount = weightEntries.filter((entry) => entry.weightSession === "evening").length;
  $("weightChartSummary").textContent = sortedWeights.length > 1
    ? `${morningCount} morning · ${eveningCount} evening; ${Math.abs(round(weightChange, 1))} ${preferredWeightLabel} ${weightChange > 0 ? "increase" : weightChange < 0 ? "decrease" : "change"} across the period.`
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

  const eventCounts = eventEntries.reduce((counts, entry) => {
    counts[entry.kind] = (counts[entry.kind] || 0) + 1;
    return counts;
  }, {});
  const eventBreakdown = Object.entries(eventCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([kind, count]) => `${eventKindLabels[kind] || titleCase(kind)} ${count}`);
  const periodState = periodTrackingSummary();
  $("eventChartValue").textContent = eventEntries.length ? `${eventEntries.length} events` : "No data";
  $("eventChartSummary").textContent = eventEntries.length
    ? `${eventBreakdown.join(" · ")}${periodState.status !== "none" ? ` · ${periodState.text}` : ""}.`
    : "Log bowel movements, period boundaries, symptoms, or other events to see timing and frequency.";

  $("readingChartValue").textContent = readingMinutes ? formatDurationShort(readingMinutes) : "No data";
  $("readingChartSummary").textContent = readingEntries.length
    ? `${readingEntries.length} reading ${readingEntries.length === 1 ? "session" : "sessions"} across ${readingDays} ${readingDays === 1 ? "day" : "days"}.`
    : "Log reading sessions to see your learning rhythm.";
  $("writingChartValue").textContent = writingMinutes ? formatDurationShort(writingMinutes) : "No data";
  $("writingChartSummary").textContent = writingEntries.length
    ? `${writingEntries.length} writing ${writingEntries.length === 1 ? "session" : "sessions"} across ${writingDays} ${writingDays === 1 ? "day" : "days"}.`
    : "Log writing sessions to see your creative rhythm.";

  const careCounts = careEntries.reduce((counts, entry) => {
    careActionLabels(entry).forEach((label) => counts[label] = (counts[label] || 0) + 1);
    return counts;
  }, {});
  const topCare = Object.entries(careCounts).sort((a, b) => b[1] - a[1])[0];
  $("careChartValue").textContent = careActions ? `${careActions} done` : "No data";
  $("careChartSummary").textContent = careActions
    ? `${careActions} completed actions across ${careDays} ${careDays === 1 ? "day" : "days"}${topCare ? `; most frequent: ${topCare[0]} (${topCare[1]})` : ""}.`
    : "Log a care check-in to see which small routines are supporting you.";

  const checkinAverage = mean(checkinEntries.flatMap((entry) => [entry.overall, entry.mood, entry.energy, entry.appetite, entry.strength, entry.mobility, entry.breath]));
  $("checkinChartValue").textContent = checkinAverage == null ? "No data" : `${round(checkinAverage, 1)}/10`;
  $("checkinChartSummary").textContent = checkinEntries.length
    ? `${checkinEntries.length} daily ${checkinEntries.length === 1 ? "pulse" : "pulses"}; overall ${formatAverage(checkinEntries.map((entry) => entry.overall), "/10")}, mood ${formatAverage(checkinEntries.map((entry) => entry.mood), "/10")}, appetite ${formatAverage(checkinEntries.map((entry) => entry.appetite), "/10")}.`
    : "Daily feelings are asked once here instead of repeated inside food and exercise entries.";

  renderPatternInsights({ sleepEntries, foodEntries, waterEntries, medicationEntries, exerciseEntries, bodyEntries, eventEntries, careEntries, checkinEntries, readingEntries, writingEntries });
}

function formatAverage(values, suffix = "") {
  const average = mean(values);
  return average == null ? "not rated" : `${round(average, 1)}${suffix}`;
}

function renderPatternInsights({ sleepEntries, foodEntries, waterEntries, medicationEntries, exerciseEntries, bodyEntries, eventEntries, careEntries, checkinEntries, readingEntries, writingEntries }) {
  const patterns = [];

  const bodyParts = [];
  if (sleepEntries.length) {
    const average = mean(sleepEntries.map((entry) => entry.hours));
    const trouble = sleepEntries.filter((entry) => entry.trouble && entry.trouble !== "no").length;
    bodyParts.push(`${sleepEntries.length} ${sleepEntries.length === 1 ? "night" : "nights"} averaged ${round(average, 1)} hours${trouble ? `; trouble was noted ${trouble} times` : ""}`);
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
    bodyParts.push(`${definition.label} changed by ${difference > 0 ? "+" : ""}${round(difference, 1)} ${preferredMeasurementUnit}`);
  } else if (measurementEntries.length) {
    bodyParts.push(`${measurementEntries.length} body measurement ${measurementEntries.length === 1 ? "check-in" : "check-ins"}`);
  }
  if (eventEntries.length) {
    const eventCounts = eventEntries.reduce((counts, entry) => {
      counts[entry.kind] = (counts[entry.kind] || 0) + 1;
      return counts;
    }, {});
    const topEvent = Object.entries(eventCounts).sort((a, b) => b[1] - a[1])[0];
    bodyParts.push(`${eventEntries.length} health ${eventEntries.length === 1 ? "event" : "events"}; ${eventKindLabels[topEvent[0]] || titleCase(topEvent[0])} appeared most often`);
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
    bodyParts.push(`sleep was ${Math.abs(round(difference, 1))} hours ${difference >= 0 ? "longer" : "shorter"} after logged movement days—an observation, not proof of cause`);
  }
  patterns.push({
    symbol: "◍",
    title: "Body signals",
    text: bodyParts.length ? `${bodyParts.join(". ")}.` : "Log sleep, measurements, or a health event to start a body pattern without needing a separate daily form."
  });

  const nourishParts = [];
  if (foodEntries.length) {
    const counts = foodEntries.reduce((result, entry) => {
      result[entry.category || "other"] = (result[entry.category || "other"] || 0) + 1;
      return result;
    }, {});
    const topCategory = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    nourishParts.push(`${foodCategoryLabels[topCategory[0]] || "Mixed foods"} was the most logged food group`);
  }
  if (waterEntries.length) nourishParts.push(`${round(waterEntries.reduce((sum, entry) => sum + (Number(entry.ml) || 0), 0) / 1000, 2)} litres of water were logged`);
  if (medicationEntries.length) {
    const taken = medicationEntries.filter((entry) => entry.status === "taken" || entry.status === "late").length;
    const missed = medicationEntries.length - taken;
    nourishParts.push(`${taken} medication or supplement records were taken or late${missed ? ` and ${missed} were missed or skipped` : ""}`);
  }
  patterns.push({
    symbol: "⌁",
    title: "Nourish",
    text: nourishParts.length ? `${nourishParts.join(". ")}.` : "Food and medication or supplement records live together here, while remaining separate and analyzable."
  });

  if (exerciseEntries.length) {
    const counts = exerciseEntries.reduce((result, entry) => {
      result[entry.category || "cardio"] = (result[entry.category || "cardio"] || 0) + 1;
      return result;
    }, {});
    const topCategory = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const bodyScores = checkinEntries.flatMap((entry) => [entry.strength, entry.mobility, entry.breath]).filter(Boolean);
    patterns.push({
      symbol: "↗",
      title: "Move",
      text: `${exerciseCategoryLabels[topCategory[0]] || "Movement"} appeared most often across ${exerciseEntries.length} ${exerciseEntries.length === 1 ? "session" : "sessions"}.${bodyScores.length ? ` Daily movement-related feelings averaged ${formatAverage(bodyScores, "/10")}.` : ""}`
    });
  } else {
    patterns.push({ symbol: "↗", title: "Move", text: "Two movement sessions will start showing your preferred exercise and body response." });
  }

  const readingMinutes = readingEntries.reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0);
  const writingMinutes = writingEntries.reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0);
  patterns.push({
    symbol: "▤",
    title: "Focus",
    text: readingEntries.length || writingEntries.length
      ? `You spent ${formatDurationShort(readingMinutes)} reading and ${formatDurationShort(writingMinutes)} writing across ${readingEntries.length + writingEntries.length} focused ${readingEntries.length + writingEntries.length === 1 ? "session" : "sessions"}.`
      : "Reading and writing share one Focus area, while their time, subjects, and notes remain separate."
  });

  const careCounts = careEntries.reduce((counts, entry) => {
    careActionLabels(entry).forEach((label) => counts[label] = (counts[label] || 0) + 1);
    return counts;
  }, {});
  const topCare = Object.entries(careCounts).sort((a, b) => b[1] - a[1])[0];
  const careActions = Object.values(careCounts).reduce((sum, count) => sum + count, 0);
  patterns.push({
    symbol: "✓",
    title: "Care",
    text: careActions
      ? `${careActions} care and upkeep actions were logged${topCare ? `; ${topCare[0]} appeared most often (${topCare[1]})` : ""}. Room upkeep stays here so it does not create another top-level category.`
      : "A single Care check-in can hold personal care, skincare, showering, and room upkeep without creating more categories."
  });

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

const FLOW_LABELS = {
  morning: "Morning check-in", evening: "Evening review",
  water: "Water", food: "Food", medication: "Medication & supplements", weight: "Weight",
  measurements: "Body measurements", sleep: "Sleep", exercise: "Exercise", event: "Health event",
  reading: "Reading", writing: "Writing", care: "Care & upkeep", checkin: "Daily check-in"
};

const choice = (value, label) => ({ value, label });
const nowValue = () => toLocalInputValue(new Date());
const todayValue = () => todayKey();
const defaultWeightSession = () => new Date().getHours() < 14 ? "morning" : "evening";

function timedDefaults(minutes) {
  const end = new Date();
  end.setSeconds(0, 0);
  return { start: toLocalInputValue(new Date(end.getTime() - minutes * 60000)), end: toLocalInputValue(end) };
}

function sleepDefaults() {
  const end = new Date();
  end.setSeconds(0, 0);
  return { start: toLocalInputValue(new Date(end.getTime() - 8 * 3600000)), end: toLocalInputValue(end) };
}

function sectionSelected(answers, section) {
  return Array.isArray(answers.more) && answers.more.includes(section);
}

function makeLogFlows() {
  const readingTime = timedDefaults(30);
  const writingTime = timedDefaults(30);
  const sleepTime = sleepDefaults();
  return {
    morning: [
      { key: "overall", kind: "scale", label: "How are your body and mind feeling this morning?", hint: "This is the only required answer. 1 is very low; 10 is excellent.", default: 7 },
      { key: "sleep", kind: "choice", label: "Would you like to add last night’s sleep?", hint: "Best answered after waking, when the times are known.", optional: true, options: [choice("yes", "Yes, add sleep"), choice("not-now", "Not now")] },
      { key: "start", kind: "datetime", label: "When did you fall asleep?", optional: true, default: sleepTime.start, showIf: (a) => a.sleep === "yes" },
      { key: "end", kind: "datetime", label: "When did you wake up?", optional: true, default: sleepTime.end, showIf: (a) => a.sleep === "yes" },
      { key: "trouble", kind: "choice", label: "Was there trouble sleeping?", optional: true, default: "no", showIf: (a) => a.sleep === "yes", options: [choice("no", "No"), choice("a-little", "A little"), choice("yes", "Yes")] },
      { key: "quality", kind: "scale", label: "How was the sleep quality?", optional: true, default: 7, showIf: (a) => a.sleep === "yes" },
      { key: "mood", kind: "scale", label: "How is your mood right now?", hint: "Optional", optional: true },
      { key: "energy", kind: "scale", label: "How is your energy right now?", hint: "Optional", optional: true },
      { key: "note", kind: "note", label: "Anything else you want to remember?", hint: "Optional", optional: true }
    ],
    evening: [
      { key: "overall", kind: "scale", label: "Overall, how did your body and mind feel today?", hint: "This is the only required answer. 1 is very low; 10 is excellent.", default: 7 },
      { key: "mood", kind: "scale", label: "How was your mood today?", hint: "Optional", optional: true },
      { key: "energy", kind: "scale", label: "How was your energy today?", hint: "Optional", optional: true },
      { key: "stress", kind: "scale", label: "How manageable did stress feel?", hint: "Optional; 10 means very manageable.", optional: true },
      { key: "more", kind: "multi", label: "What else would you like to remember?", hint: "Choose any that matter today. Leave everything blank to finish now.", optional: true, options: [
        choice("nourish", "Food & appetite"), choice("hydration", "Water"), choice("movement", "Movement"), choice("medication", "Medication & supplements"),
        choice("care", "Care & upkeep"), choice("focus", "Reading or writing"), choice("signals", "Body signals"), choice("event", "Health event")
      ] },
      { key: "appetite", kind: "scale", label: "How well regulated did your appetite feel?", optional: true, showIf: (a) => sectionSelected(a, "nourish") },
      { key: "meal", kind: "choice", label: "Which meal would you like to remember?", optional: true, default: "dinner", showIf: (a) => sectionSelected(a, "nourish"), options: Object.entries(mealLabels).map(([value, label]) => choice(value, label)) },
      { key: "foodName", kind: "text", label: "What did you have?", hint: "Optional—leave blank if the appetite rating is enough.", optional: true, showIf: (a) => sectionSelected(a, "nourish"), placeholder: "e.g. salmon, rice and vegetables" },
      { key: "foodAmount", kind: "number", label: "About how much?", hint: "Optional", optional: true, default: 1, showIf: (a) => sectionSelected(a, "nourish") && Boolean(a.foodName) },
      { key: "foodUnit", kind: "choice", label: "Which unit?", optional: true, default: "serving", showIf: (a) => sectionSelected(a, "nourish") && Boolean(a.foodName), options: ["serving", "g", "ml", "oz", "cup", "tbsp", "tsp", "piece"].map((value) => choice(value, value)) },
      { key: "waterMl", kind: "number", label: "How much water should I add?", hint: "In mL. Skip if your quick water entries are already complete.", optional: true, showIf: (a) => sectionSelected(a, "hydration") },
      { key: "exerciseCategory", kind: "choice", label: "What kind of movement?", optional: true, default: "cardio", showIf: (a) => sectionSelected(a, "movement"), options: Object.entries(exerciseCategoryLabels).map(([value, label]) => choice(value, label)) },
      { key: "exerciseMinutes", kind: "number", label: "How many minutes?", optional: true, default: 30, showIf: (a) => sectionSelected(a, "movement") },
      { key: "exerciseIntensity", kind: "choice", label: "How intense was it?", optional: true, default: "moderate", showIf: (a) => sectionSelected(a, "movement"), options: [choice("light", "Light"), choice("moderate", "Moderate"), choice("vigorous", "Vigorous")] },
      { key: "medName", kind: "text", label: "What medication or supplement?", hint: "Optional—quick entries still work for routines such as Vitamin D.", optional: true, showIf: (a) => sectionSelected(a, "medication"), placeholder: "e.g. Vitamin D" },
      { key: "medStatus", kind: "choice", label: "What happened?", optional: true, default: "taken", showIf: (a) => sectionSelected(a, "medication") && Boolean(a.medName), options: Object.entries(medicationStatusLabels).map(([value, label]) => choice(value, label)) },
      { key: "careItems", kind: "multi", label: "What care did you do?", optional: true, showIf: (a) => sectionSelected(a, "care"), options: Object.entries(careItemLabels).map(([value, label]) => choice(value, label)) },
      { key: "focusKind", kind: "choice", label: "Reading or writing?", optional: true, showIf: (a) => sectionSelected(a, "focus"), options: [choice("reading", "Reading"), choice("writing", "Writing")] },
      { key: "focusMinutes", kind: "number", label: "How many minutes?", optional: true, showIf: (a) => sectionSelected(a, "focus") && Boolean(a.focusKind) },
      { key: "focusTitle", kind: "text", label: "What was it?", hint: "Optional book title or writing topic.", optional: true, showIf: (a) => sectionSelected(a, "focus") && Boolean(a.focusKind) },
      { key: "strength", kind: "scale", label: "How did muscles and stability feel?", optional: true, showIf: (a) => sectionSelected(a, "signals") },
      { key: "mobility", kind: "scale", label: "How did mobility and flexibility feel?", optional: true, showIf: (a) => sectionSelected(a, "signals") },
      { key: "breath", kind: "scale", label: "How did breathing and stamina feel?", optional: true, showIf: (a) => sectionSelected(a, "signals") },
      { key: "eventKind", kind: "choice", label: "What happened?", optional: true, showIf: (a) => sectionSelected(a, "event"), options: Object.entries(eventKindLabels).map(([value, label]) => choice(value, label)) },
      { key: "eventSeverity", kind: "scale", label: "How intense was it?", optional: true, showIf: (a) => sectionSelected(a, "event") && ["diarrhea", "vomiting", "symptom", "other"].includes(a.eventKind) },
      { key: "note", kind: "note", label: "Anything else you want to add?", hint: "Optional—the last page of today’s story.", optional: true }
    ],
    water: [
      { key: "preset", kind: "choice", label: "How much water?", hint: "Tap an amount and the next question appears.", options: [choice("250", "250 mL"), choice("350", "350 mL"), choice("500", "500 mL"), choice("750", "750 mL"), choice("custom", "Custom amount")] },
      { key: "amount", kind: "number", label: "Enter the amount", hint: "Use a number greater than zero.", default: 250, showIf: (a) => a.preset === "custom" },
      { key: "unit", kind: "choice", label: "Which unit?", default: "ml", showIf: (a) => a.preset === "custom", options: [choice("ml", "mL"), choice("cup", "Cups"), choice("oz", "fl oz")] },
      { key: "date", kind: "datetime", label: "When did you drink it?", default: nowValue }
    ],
    weight: [
      { key: "weight", kind: "number", label: "What is your weight?", hint: "Morning and evening entries stay separate.", step: "0.1" },
      { key: "unit", kind: "choice", label: "Which unit?", default: "kg", options: [choice("kg", "kg"), choice("jin", "斤")] },
      { key: "session", kind: "choice", label: "Morning or evening?", default: defaultWeightSession, options: [choice("morning", "Morning"), choice("evening", "Evening")] },
      { key: "date", kind: "datetime", label: "When was it measured?", default: nowValue },
      { key: "note", kind: "note", label: "Anything to remember?", hint: "Optional", optional: true }
    ],
    measurements: [
      { key: "unit", kind: "choice", label: "Which measurement unit?", default: "cm", options: [choice("cm", "cm"), choice("in", "inches")] },
      { key: "measurements", kind: "measurements", label: "Enter any measurements you took", hint: "You only need the ones you measured." },
      { key: "date", kind: "date", label: "Which day?", default: todayValue },
      { key: "note", kind: "note", label: "Anything to remember?", hint: "Optional", optional: true }
    ],
    food: [
      { key: "meal", kind: "choice", label: "Which meal?", options: Object.entries(mealLabels).map(([value, label]) => choice(value, label)) },
      { key: "category", kind: "choice", label: "What kind of food was it?", options: Object.entries(foodCategoryLabels).map(([value, label]) => choice(value, label)) },
      { key: "name", kind: "text", label: "What did you have?", placeholder: "e.g. cooked brown rice" },
      { key: "amount", kind: "number", label: "How much?", step: "0.1" },
      { key: "unit", kind: "choice", label: "Which unit?", default: "serving", options: ["serving", "g", "ml", "oz", "cup", "tbsp", "tsp", "piece"].map((value) => choice(value, value)) },
      { key: "date", kind: "datetime", label: "When did you have it?", default: nowValue },
      { key: "note", kind: "note", label: "Any note about this food?", hint: "Optional", optional: true }
    ],
    medication: [
      { key: "kind", kind: "choice", label: "What type is it?", options: Object.entries(medicationKindLabels).map(([value, label]) => choice(value, label)) },
      { key: "name", kind: "text", label: "What is its name?", placeholder: "e.g. Vitamin D" },
      { key: "doseAmount", kind: "number", label: "How much?", hint: "Optional for a missed dose", optional: true, step: "0.1" },
      { key: "doseUnit", kind: "choice", label: "Which dose unit?", default: "tablet", options: ["tablet", "capsule", "mg", "mcg", "g", "ml", "drop", "scoop", "dose"].map((value) => choice(value, value === "ml" ? "mL" : value)) },
      { key: "status", kind: "choice", label: "What happened?", default: "taken", options: Object.entries(medicationStatusLabels).map(([value, label]) => choice(value, label)) },
      { key: "date", kind: "datetime", label: "When?", default: nowValue },
      { key: "note", kind: "note", label: "Anything to remember?", hint: "Optional", optional: true }
    ],
    sleep: [
      { key: "start", kind: "datetime", label: "When did you fall asleep?", default: sleepTime.start },
      { key: "end", kind: "datetime", label: "When did you wake up?", default: sleepTime.end },
      { key: "trouble", kind: "choice", label: "Was there trouble sleeping?", default: "no", options: [choice("no", "No"), choice("a-little", "A little"), choice("yes", "Yes")] },
      { key: "quality", kind: "scale", label: "How was the sleep quality?", default: 7 },
      { key: "note", kind: "note", label: "What affected your sleep?", hint: "Optional", optional: true }
    ],
    exercise: [
      { key: "category", kind: "choice", label: "What kind of movement?", options: Object.entries(exerciseCategoryLabels).map(([value, label]) => choice(value, label)) },
      { key: "intensity", kind: "choice", label: "How intense was it?", default: "moderate", options: [choice("light", "Light"), choice("moderate", "Moderate"), choice("vigorous", "Vigorous")] },
      { key: "name", kind: "text", label: "What activity?", hint: "Optional—the category name can be used.", placeholder: "e.g. hiking or swimming", optional: true },
      { key: "minutes", kind: "number", label: "How many minutes?", default: 30, step: "1" },
      { key: "date", kind: "datetime", label: "When did you exercise?", default: nowValue },
      { key: "note", kind: "note", label: "Anything about this session?", hint: "Optional", optional: true }
    ],
    event: [
      { key: "kind", kind: "choice", label: "What happened?", options: Object.entries(eventKindLabels).map(([value, label]) => choice(value, label)) },
      { key: "name", kind: "text", label: "What did you notice?", showIf: (a) => a.kind === "symptom" || a.kind === "other" },
      { key: "bowelForm", kind: "choice", label: "What was the stool form?", optional: true, showIf: (a) => a.kind === "bowel", options: [1,2,3,4,5,6,7].map((value) => choice(String(value), `Type ${value}`)) },
      { key: "ease", kind: "choice", label: "How did it feel?", optional: true, showIf: (a) => a.kind === "bowel", options: [choice("easy", "Easy"), choice("neutral", "Neutral"), choice("difficult", "Difficult")] },
      { key: "severity", kind: "scale", label: "How intense was it?", default: 5, showIf: (a) => ["diarrhea", "vomiting", "symptom", "other"].includes(a.kind) },
      { key: "date", kind: "datetime", label: "When did it happen?", default: nowValue },
      { key: "note", kind: "note", label: "Any context or trigger?", hint: "Optional", optional: true }
    ],
    reading: [
      { key: "start", kind: "datetime", label: "When did you start reading?", default: readingTime.start },
      { key: "end", kind: "datetime", label: "When did you finish?", default: readingTime.end },
      { key: "title", kind: "text", label: "What book?", placeholder: "Book title" },
      { key: "category", kind: "choice", label: "What kind of reading?", options: Object.entries(readingCategoryLabels).map(([value, label]) => choice(value, label)) },
      { key: "note", kind: "note", label: "What do you want to remember?", hint: "Optional", optional: true }
    ],
    writing: [
      { key: "start", kind: "datetime", label: "When did you start writing?", default: writingTime.start },
      { key: "end", kind: "datetime", label: "When did you finish?", default: writingTime.end },
      { key: "topic", kind: "text", label: "What did you work on?", hint: "Optional", optional: true },
      { key: "category", kind: "choice", label: "What kind of writing?", options: Object.entries(writingCategoryLabels).map(([value, label]) => choice(value, label)) },
      { key: "note", kind: "note", label: "Anything to remember?", hint: "Optional", optional: true }
    ],
    care: [
      { key: "items", kind: "multi", label: "What did you do?", options: Object.entries(careItemLabels).map(([value, label]) => choice(value, label)) },
      { key: "custom", kind: "text", label: "Anything else?", hint: "Optional", placeholder: "e.g. changed sheets", optional: true },
      { key: "date", kind: "date", label: "Which day?", default: todayValue },
      { key: "note", kind: "note", label: "Anything to remember?", hint: "Optional", optional: true }
    ],
    checkin: [
      { key: "appetite", kind: "scale", label: "How well regulated did your appetite feel today?", default: 7 },
      { key: "strength", kind: "scale", label: "How did your muscles and stability feel?", default: 7 },
      { key: "mobility", kind: "scale", label: "How did mobility and flexibility feel?", default: 7 },
      { key: "breath", kind: "scale", label: "How did breathing and stamina feel?", default: 7 },
      { key: "note", kind: "note", label: "Anything that shaped today?", hint: "Optional", optional: true },
      { key: "date", kind: "date", label: "Which day is this check-in for?", default: todayValue }
    ]
  };
}

function visibleFlowSteps() {
  const steps = makeLogFlows()[activeFlow] || [];
  return steps.filter((step) => !step.showIf || step.showIf(flowAnswers));
}

function startFlow(type) {
  if (!makeLogFlows()[type]) return;
  activeFlow = type;
  const savedDraft = ["morning", "evening"].includes(type) ? vault.routineDrafts?.[type] : null;
  activeFlowStep = savedDraft?.step || 0;
  flowAnswers = savedDraft?.answers ? { ...savedDraft.answers } : {};
  flowAnswered = new Set(savedDraft?.answered || []);
  makeLogFlows()[type].forEach((step) => {
    const value = typeof step.default === "function" ? step.default() : step.default;
    if (value !== undefined && flowAnswers[step.key] === undefined) flowAnswers[step.key] = value;
  });
  $("logHome").classList.add("hidden");
  $("flowShell").classList.remove("hidden");
  renderFlowQuestion();
}

function renderLogHome() {
  activeFlow = null;
  activeFlowStep = 0;
  flowAnswers = {};
  flowAnswered = new Set();
  $("flowShell").classList.add("hidden");
  $("logHome").classList.remove("hidden");
  renderQuickEntries();
  renderRoutineHub();
}

function isRoutineFlow() {
  return activeFlow === "morning" || activeFlow === "evening";
}

function routineSaveNowButton() {
  return isRoutineFlow() && activeFlowStep > 0
    ? `<button type="button" class="routine-save-now" data-routine-save-now>Save here for today</button>`
    : "";
}

function persistRoutineDraft() {
  if (!isRoutineFlow()) return;
  vault.routineDrafts = vault.routineDrafts || {};
  vault.routineDrafts[activeFlow] = { step: activeFlowStep, answers: { ...flowAnswers }, answered: [...flowAnswered], updatedAt: new Date().toISOString() };
  encryptVault().catch(() => {});
}

function flowFieldValue(step) {
  const value = flowAnswers[step.key];
  return value == null ? "" : String(value);
}

function renderFlowQuestion() {
  const steps = visibleFlowSteps();
  $("flowBack").textContent = activeFlowStep === 0 ? "← All records" : "← Back";
  $("flowProgress").textContent = activeFlowStep >= steps.length ? "Ready" : `${activeFlowStep + 1} of ${steps.length}`;
  if (activeFlowStep >= steps.length) {
    renderFlowReview();
    return;
  }
  const step = steps[activeFlowStep];
  const hint = step.hint ? `<p>${escapeHtml(step.hint)}</p>` : "";
  let control = "";
  if (step.kind === "choice" || step.kind === "scale") {
    const options = step.kind === "scale"
      ? Array.from({ length: 10 }, (_, index) => choice(String(index + 1), String(index + 1)))
      : step.options;
    const selected = flowFieldValue(step);
    control = `<div class="${step.kind === "scale" ? "flow-scale" : "flow-options two-up"}">${options.map((option) => `
      <button type="button" class="flow-option" data-flow-choice="${escapeHtml(option.value)}" aria-pressed="${String(selected === String(option.value))}">${escapeHtml(option.label)}</button>`).join("")}</div>
      ${step.optional ? `<button type="button" class="flow-skip" data-flow-skip>Skip</button>` : ""}${routineSaveNowButton()}`;
  } else if (step.kind === "multi") {
    const selected = Array.isArray(flowAnswers[step.key]) ? flowAnswers[step.key] : [];
    control = `<div class="flow-multi">${step.options.map((option) => `<label><input type="checkbox" value="${escapeHtml(option.value)}" ${selected.includes(option.value) ? "checked" : ""}>${escapeHtml(option.label)}</label>`).join("")}</div>${flowContinueButton(step)}${routineSaveNowButton()}`;
  } else if (step.kind === "measurements") {
    const values = flowAnswers.measurements || {};
    control = `<div class="flow-measurements">${BODY_MEASUREMENTS.map(({ key, label }) => `<label>${escapeHtml(label)}<input type="number" inputmode="decimal" min="0" step="0.1" data-measurement-key="${key}" value="${escapeHtml(values[key] || "")}" /></label>`).join("")}</div>${flowContinueButton(step)}${routineSaveNowButton()}`;
  } else {
    const inputType = step.kind === "datetime" ? "datetime-local" : step.kind === "date" ? "date" : step.kind === "number" ? "number" : "text";
    const input = step.kind === "note"
      ? `<textarea id="flowInput" aria-label="${escapeHtml(step.label)}" placeholder="Optional">${escapeHtml(flowFieldValue(step))}</textarea>`
      : `<input id="flowInput" aria-label="${escapeHtml(step.label)}" type="${inputType}" ${step.kind === "number" ? `inputmode="decimal" min="0" step="${step.step || "0.1"}"` : ""} value="${escapeHtml(flowFieldValue(step))}" placeholder="${escapeHtml(step.placeholder || "")}" />`;
    control = `<div class="flow-control">${input}</div>${flowContinueButton(step)}${routineSaveNowButton()}`;
  }
  $("flowQuestion").innerHTML = `<p class="eyebrow">${escapeHtml(FLOW_LABELS[activeFlow])}</p><h3>${escapeHtml(step.label)}</h3>${hint}${control}`;
  requestAnimationFrame(() => ($("flowInput") || $("flowQuestion").querySelector(".flow-option, input, textarea"))?.focus());
}

function flowContinueButton(step) {
  return `<div class="flow-actions">${step.optional ? `<button type="button" class="flow-skip" data-flow-skip>Skip</button>` : ""}<button type="button" class="primary" data-flow-continue>Continue</button></div>`;
}

function storeCurrentFlowAnswer() {
  const step = visibleFlowSteps()[activeFlowStep];
  if (!step) return true;
  let value;
  if (step.kind === "multi") {
    value = [...$("flowQuestion").querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
  } else if (step.kind === "measurements") {
    value = {};
    $("flowQuestion").querySelectorAll("[data-measurement-key]").forEach((input) => {
      if (input.value.trim()) value[input.dataset.measurementKey] = Number(input.value);
    });
  } else {
    value = $("flowInput")?.value?.trim() ?? "";
    if (step.kind === "number" && value !== "") value = Number(value);
  }
  if (!step.optional) {
    if (step.kind === "number" && (!Number.isFinite(value) || value <= 0)) return toast("Enter a number greater than zero"), false;
    if (step.kind === "measurements" && !Object.keys(value).length) return toast("Enter at least one measurement"), false;
    if (step.kind === "multi" && !value.length) return toast("Choose at least one option"), false;
    if ((step.kind === "text" || step.kind === "datetime" || step.kind === "date") && !value) return toast("Answer this question to continue"), false;
  }
  flowAnswers[step.key] = value;
  flowAnswered.add(step.key);
  return true;
}

function moveFlowForward() {
  activeFlowStep += 1;
  persistRoutineDraft();
  renderFlowQuestion();
}

function renderFlowReview() {
  const quickAllowed = !["checkin", "measurements", "weight"].includes(activeFlow);
  $("flowQuestion").innerHTML = `
    <p class="eyebrow">READY TO SAVE</p>
    <h3>${escapeHtml(FLOW_LABELS[activeFlow])}</h3>
    <div class="flow-review">${escapeHtml(flowSummary())}</div>
    <div class="flow-actions">${quickAllowed ? `<button type="button" class="secondary" data-flow-save-quick>Save & add to Quick</button>` : ""}<button type="button" class="primary" data-flow-save>Save entry</button></div>`;
}

function flowSummary() {
  const a = flowAnswers;
  if (activeFlow === "morning" || activeFlow === "evening") return `Daily pulse ${a.overall}/10${activeFlow === "morning" && a.sleep === "yes" ? " · sleep added" : ""}${activeFlow === "evening" && a.more?.length ? ` · ${a.more.length} optional areas` : ""}`;
  if (activeFlow === "water") return `${waterAmountAndUnit(a).amount} ${waterAmountAndUnit(a).unit} water`;
  if (activeFlow === "weight") return `${a.weight} ${weightUnitLabel(a.unit)} · ${titleCase(a.session)}`;
  if (activeFlow === "measurements") return `${Object.keys(a.measurements || {}).length} measurements · ${a.unit}`;
  if (activeFlow === "food") return `${a.name} · ${a.amount} ${a.unit}`;
  if (activeFlow === "medication") return `${a.name}${a.doseAmount ? ` · ${a.doseAmount} ${a.doseUnit}` : ""} · ${medicationStatusLabels[a.status]}`;
  if (activeFlow === "exercise") return `${a.name || exerciseCategoryLabels[a.category]} · ${a.minutes} min`;
  if (activeFlow === "sleep") return `${round((parseDate(a.end) - parseDate(a.start)) / 3600000, 1)} hours · quality ${a.quality}/10`;
  if (activeFlow === "reading") return `${a.title} · ${formatDurationShort((parseDate(a.end) - parseDate(a.start)) / 60000)}`;
  if (activeFlow === "writing") return `${a.topic || writingCategoryLabels[a.category]} · ${formatDurationShort((parseDate(a.end) - parseDate(a.start)) / 60000)}`;
  if (activeFlow === "care") return `${(a.items || []).length + (a.custom ? 1 : 0)} care actions`;
  if (activeFlow === "checkin") return `Appetite ${a.appetite}/10 · Strength ${a.strength}/10 · Mobility ${a.mobility}/10 · Breath ${a.breath}/10`;
  return eventKindLabels[a.kind] || FLOW_LABELS[activeFlow];
}

function waterAmountAndUnit(a) {
  if (a.preset && a.preset !== "custom") return { amount: Number(a.preset), unit: "ml" };
  return { amount: Number(a.amount), unit: a.unit || "ml" };
}

function waterToMl(amount, unit) {
  if (unit === "cup") return amount * 240;
  if (unit === "oz") return amount * 29.5735;
  return amount;
}

function numericOrNull(value) {
  return value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
}

function saveRoutineRecords(kind, answers) {
  const key = todayKey();
  const sourceRoutine = `${kind}:${key}`;
  let sleepRecord = null;
  if (kind === "morning" && answers.sleep === "yes" && flowAnswered.has("start") && flowAnswered.has("end") && answers.start && answers.end) {
    const start = parseDate(answers.start);
    const end = parseDate(answers.end);
    const hours = start && end ? (end - start) / 3600000 : 0;
    if (!start || !end || hours <= 0 || hours > 24) return toast("Check the sleep and wake times"), false;
    sleepRecord = { start, end, hours };
  }
  vault.entries = vault.entries.filter((entry) => entry.sourceRoutine !== sourceRoutine);
  const pulse = {
    routine: kind,
    overall: Number(answers.overall),
    mood: numericOrNull(answers.mood),
    energy: numericOrNull(answers.energy),
    stress: numericOrNull(answers.stress),
    appetite: numericOrNull(answers.appetite),
    strength: numericOrNull(answers.strength),
    mobility: numericOrNull(answers.mobility),
    breath: numericOrNull(answers.breath),
    note: answers.note || ""
  };
  const existing = routineEntry(kind, key);
  const recordedAt = new Date().toISOString();
  if (existing) Object.assign(existing, pulse, { date: recordedAt });
  else addEntry("checkin", pulse, recordedAt);

  if (sleepRecord) {
    addEntry("sleep", {
      sourceRoutine, start: sleepRecord.start.toISOString(), end: sleepRecord.end.toISOString(), hours: round(sleepRecord.hours, 2),
      trouble: flowAnswered.has("trouble") ? (answers.trouble || "no") : null,
      quality: flowAnswered.has("quality") ? numericOrNull(answers.quality) : null, note: ""
    }, sleepRecord.end.toISOString());
  }

  if (kind === "evening") {
    if (sectionSelected(answers, "nourish") && answers.foodName && Number(answers.foodAmount) > 0) {
      $("foodName").value = answers.foodName;
      $("foodAmount").value = answers.foodAmount;
      $("foodUnit").value = answers.foodUnit || "serving";
      $("foodCategory").value = "other";
      const estimate = estimateFoodCalories();
      addEntry("food", {
        sourceRoutine, name: answers.foodName, meal: answers.meal || "dinner", category: "other",
        amount: Number(answers.foodAmount), unit: answers.foodUnit || "serving", calories: estimate?.calories ?? 0,
        calorieSource: estimate?.source || "food-group average", note: ""
      }, recordedAt);
    }
    if (sectionSelected(answers, "hydration") && Number(answers.waterMl) > 0) {
      addEntry("water", { sourceRoutine, amount: Number(answers.waterMl), unit: "ml", ml: Number(answers.waterMl) }, recordedAt);
    }
    if (sectionSelected(answers, "movement") && answers.exerciseCategory && Number(answers.exerciseMinutes) > 0) {
      $("exerciseCategory").value = answers.exerciseCategory;
      $("exerciseIntensity").value = answers.exerciseIntensity || "moderate";
      $("exerciseName").value = "";
      $("exerciseMinutes").value = answers.exerciseMinutes;
      const estimate = estimateExerciseCalories();
      addEntry("exercise", {
        sourceRoutine, name: exerciseCategoryLabels[answers.exerciseCategory], category: answers.exerciseCategory,
        intensity: answers.exerciseIntensity || "moderate", minutes: Number(answers.exerciseMinutes),
        calories: estimate?.calories ?? 0, met: estimate?.met || null, estimateWeightKg: estimate?.weight.kg || null, note: ""
      }, recordedAt);
    }
    if (sectionSelected(answers, "medication") && answers.medName) {
      addEntry("medication", { sourceRoutine, kind: "other", name: answers.medName, doseAmount: null, doseUnit: "dose", status: answers.medStatus || "taken", note: "" }, recordedAt);
    }
    if (sectionSelected(answers, "care") && Array.isArray(answers.careItems) && answers.careItems.length) {
      addEntry("care", { sourceRoutine, items: answers.careItems, customItems: [], note: "" }, recordedAt);
    }
    if (sectionSelected(answers, "focus") && answers.focusKind && Number(answers.focusMinutes) > 0) {
      const end = new Date();
      const start = new Date(end.getTime() - Number(answers.focusMinutes) * 60000);
      const payload = answers.focusKind === "reading"
        ? { sourceRoutine, start: start.toISOString(), end: end.toISOString(), minutes: Number(answers.focusMinutes), title: answers.focusTitle || "Reading", category: "other", note: "" }
        : { sourceRoutine, start: start.toISOString(), end: end.toISOString(), minutes: Number(answers.focusMinutes), topic: answers.focusTitle || "Writing", category: "other", note: "" };
      addEntry(answers.focusKind, payload, end.toISOString());
    }
    if (sectionSelected(answers, "event") && answers.eventKind) {
      addEntry("event", { sourceRoutine, kind: answers.eventKind, name: "", severity: numericOrNull(answers.eventSeverity), bowelForm: null, ease: null, note: "" }, recordedAt);
    }
  }
  vault.routineDrafts = vault.routineDrafts || {};
  delete vault.routineDrafts[kind];
  return true;
}

async function saveActiveFlow(makeQuick = false) {
  const a = flowAnswers;
  let entry;
  let date = parseDate(a.date)?.toISOString() || new Date().toISOString();
  if (activeFlow === "morning" || activeFlow === "evening") {
    if (!saveRoutineRecords(activeFlow, a)) return;
    await saveAndRender(activeFlow === "morning" ? "Morning check-in saved" : "Evening review saved");
    renderLogHome();
    showView("dashboard");
    return;
  } else if (activeFlow === "water") {
    const water = waterAmountAndUnit(a);
    entry = addEntry("water", { amount: water.amount, unit: water.unit, ml: round(waterToMl(water.amount, water.unit), 1) }, date);
  } else if (activeFlow === "weight") {
    entry = addEntry("body", { weight: Number(a.weight), weightUnit: a.unit, weightSession: a.session, measurements: {}, measurementUnit: "cm", note: a.note || "" }, date);
  } else if (activeFlow === "measurements") {
    entry = addEntry("body", { weight: null, weightUnit: "kg", weightSession: null, measurements: a.measurements, measurementUnit: a.unit, note: a.note || "" }, new Date(`${a.date}T12:00:00`).toISOString());
  } else if (activeFlow === "food") {
    $("foodName").value = a.name; $("foodAmount").value = a.amount; $("foodUnit").value = a.unit; $("foodCategory").value = a.category;
    const estimate = estimateFoodCalories();
    entry = addEntry("food", { name: a.name, meal: a.meal, category: a.category, amount: Number(a.amount), unit: a.unit, calories: estimate?.calories ?? 0, calorieSource: estimate?.source || "food-group average", note: a.note || "" }, date);
  } else if (activeFlow === "medication") {
    entry = addEntry("medication", { kind: a.kind, name: a.name, doseAmount: a.doseAmount ? Number(a.doseAmount) : null, doseUnit: a.doseUnit, status: a.status, note: a.note || "" }, date);
  } else if (activeFlow === "sleep") {
    const start = parseDate(a.start); const end = parseDate(a.end); const hours = (end - start) / 3600000;
    if (!start || !end || hours <= 0 || hours > 24) return toast("Check the sleep and wake times");
    entry = addEntry("sleep", { start: start.toISOString(), end: end.toISOString(), hours: round(hours, 2), trouble: a.trouble, quality: Number(a.quality), note: a.note || "" }, end.toISOString());
  } else if (activeFlow === "exercise") {
    $("exerciseCategory").value = a.category; $("exerciseIntensity").value = a.intensity; $("exerciseName").value = a.name || ""; $("exerciseMinutes").value = a.minutes;
    const estimate = estimateExerciseCalories();
    entry = addEntry("exercise", { name: a.name || exerciseCategoryLabels[a.category], category: a.category, intensity: a.intensity, minutes: Number(a.minutes), calories: estimate?.calories ?? 0, met: estimate?.met || null, estimateWeightKg: estimate?.weight.kg || null, note: a.note || "" }, date);
  } else if (activeFlow === "event") {
    entry = addEntry("event", { kind: a.kind, name: a.name || "", severity: a.severity ? Number(a.severity) : null, bowelForm: a.bowelForm ? Number(a.bowelForm) : null, ease: a.ease || null, note: a.note || "" }, date);
  } else if (activeFlow === "reading" || activeFlow === "writing") {
    const start = parseDate(a.start); const end = parseDate(a.end); const minutes = Math.round((end - start) / 60000);
    if (!start || !end || minutes <= 0 || minutes > 1440) return toast("Check the start and finish times");
    const payload = activeFlow === "reading"
      ? { start: start.toISOString(), end: end.toISOString(), minutes, title: a.title, category: a.category, note: a.note || "" }
      : { start: start.toISOString(), end: end.toISOString(), minutes, topic: a.topic || "", category: a.category, note: a.note || "" };
    entry = addEntry(activeFlow, payload, end.toISOString());
  } else if (activeFlow === "care") {
    entry = addEntry("care", { items: a.items || [], customItems: a.custom ? [a.custom] : [], note: a.note || "" }, new Date(`${a.date}T12:00:00`).toISOString());
  } else if (activeFlow === "checkin") {
    const existing = vault.entries.find((item) => item.type === "checkin" && todayKey(item.date) === a.date);
    const payload = { appetite: Number(a.appetite), strength: Number(a.strength), mobility: Number(a.mobility), breath: Number(a.breath), note: a.note || "" };
    if (existing) Object.assign(existing, payload, { date: new Date(`${a.date}T20:00:00`).toISOString() });
    else entry = addEntry("checkin", payload, new Date(`${a.date}T20:00:00`).toISOString());
    entry = entry || existing;
  }
  if (!entry) return;
  if (makeQuick && !["checkin", "measurements", "weight"].includes(entry.type)) addQuickTemplate(entry);
  await saveAndRender(makeQuick ? "Saved and added to Quick" : `${FLOW_LABELS[activeFlow]} saved`);
  renderLogHome();
}

function quickLabelForEntry(entry) {
  if (entry.type === "water") return `${round(entry.ml, 0)} mL water`;
  if (entry.type === "medication") return entry.name;
  if (entry.type === "food") return entry.name;
  if (entry.type === "exercise") return entry.name;
  return entryText(entry).title;
}

function addQuickTemplate(entry) {
  const { id, date, createdAt, schemaVersion, type, ...data } = entry;
  const signature = `${entry.type}:${quickLabelForEntry(entry).toLowerCase()}`;
  if (vault.quickEntries.some((item) => item.signature === signature)) return;
  vault.quickEntries.push({ id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-quick`, type, label: quickLabelForEntry(entry), signature, data });
}

function builtInQuickEntries() {
  return [
    { id: "builtin-water", type: "water", label: "250 mL water", icon: "💧", data: { amount: 250, unit: "ml", ml: 250 } },
    { id: "builtin-vitamin-d", type: "medication", label: "Vitamin D", icon: "✦", data: { kind: "supplement", name: "Vitamin D", doseAmount: 1, doseUnit: "tablet", status: "taken", note: "" } }
  ];
}

function renderQuickEntries() {
  const entries = [...builtInQuickEntries(), ...(vault.quickEntries || [])];
  $("quickEntryList").innerHTML = entries.map((item) => `<button type="button" class="quick-entry" data-quick-id="${escapeHtml(item.id)}"><span>${escapeHtml(item.icon || icons[item.type] || "＋")}</span><span><strong>${escapeHtml(item.label)}</strong><small>Log now</small></span></button>`).join("");
}

function renderQuickEntrySettings() {
  const custom = vault.quickEntries || [];
  $("quickEntrySettings").innerHTML = custom.length
    ? custom.map((item) => `<div class="quick-setting"><span>${escapeHtml(item.label)}</span><button type="button" data-delete-quick="${escapeHtml(item.id)}">Remove</button></div>`).join("")
    : `<p class="muted small">No custom quick entries yet.</p>`;
}

async function applyQuickEntry(id) {
  const template = [...builtInQuickEntries(), ...(vault.quickEntries || [])].find((item) => item.id === id);
  if (!template) return;
  const now = new Date();
  const data = typeof structuredClone === "function" ? structuredClone(template.data) : JSON.parse(JSON.stringify(template.data));
  if (data.start && data.end) {
    const duration = Math.max(60000, parseDate(data.end) - parseDate(data.start));
    data.end = now.toISOString(); data.start = new Date(now - duration).toISOString();
  }
  addEntry(template.type, data, now.toISOString());
  await saveAndRender(`${template.label} logged`);
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

  const logGroup = event.target.closest("[data-log-group]");
  if (logGroup) selectLogGroup(logGroup.dataset.logGroup);

  const logForm = event.target.closest("[data-log-form-select]");
  if (logForm) selectLogForm(logForm.dataset.logFormSelect);

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

  const insightGroup = event.target.closest("[data-insight-group]");
  if (insightGroup) {
    currentInsightGroup = insightGroup.dataset.insightGroup;
    renderInsights();
  }

  const remove = event.target.closest("[data-delete]");
  if (remove) {
    vault.entries = vault.entries.filter((entry) => entry.id !== remove.dataset.delete);
    encryptVault().then(renderAll).catch(() => toast("Could not delete entry"));
  }

  const flowStart = event.target.closest("[data-start-flow]");
  if (flowStart) {
    if ($("addView").classList.contains("hidden")) showView("add");
    startFlow(flowStart.dataset.startFlow);
  }

  const flowChoice = event.target.closest("[data-flow-choice]");
  if (flowChoice && activeFlow) {
    const step = visibleFlowSteps()[activeFlowStep];
    flowAnswers[step.key] = step.kind === "scale" ? Number(flowChoice.dataset.flowChoice) : flowChoice.dataset.flowChoice;
    flowAnswered.add(step.key);
    moveFlowForward();
  }

  if (event.target.closest("[data-flow-continue]") && activeFlow && storeCurrentFlowAnswer()) moveFlowForward();
  if (event.target.closest("[data-flow-skip]") && activeFlow) {
    const step = visibleFlowSteps()[activeFlowStep];
    flowAnswers[step.key] = step.kind === "multi" ? [] : "";
    flowAnswered.add(step.key);
    moveFlowForward();
  }
  if (event.target.closest("[data-flow-save]") && activeFlow) saveActiveFlow(false);
  if (event.target.closest("[data-flow-save-quick]") && activeFlow) saveActiveFlow(true);
  if (event.target.closest("[data-routine-save-now]") && isRoutineFlow() && storeCurrentFlowAnswer()) saveActiveFlow(false);

  const quick = event.target.closest("[data-quick-id]");
  if (quick) applyQuickEntry(quick.dataset.quickId);

  const deleteQuick = event.target.closest("[data-delete-quick]");
  if (deleteQuick) {
    vault.quickEntries = (vault.quickEntries || []).filter((item) => item.id !== deleteQuick.dataset.deleteQuick);
    encryptVault().then(() => { renderQuickEntrySettings(); renderQuickEntries(); toast("Quick entry removed"); });
  }
});

$("flowBack").addEventListener("click", () => {
  if (!activeFlow || activeFlowStep === 0) return renderLogHome();
  const steps = visibleFlowSteps();
  activeFlowStep = Math.min(activeFlowStep - 1, steps.length - 1);
  persistRoutineDraft();
  renderFlowQuestion();
});
$("flowCancel").addEventListener("click", renderLogHome);
$("flowQuestion").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && event.target.matches("input") && $("flowQuestion").querySelector("[data-flow-continue]")) {
    event.preventDefault();
    if (storeCurrentFlowAnswer()) moveFlowForward();
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
wireRange("eventSeverity", "eventSeverityOutput");
$("eventKind").addEventListener("change", updateEventFields);

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
  if (!start) return toast("Enter when you fell asleep");
  if (!end) return toast("Enter when you woke up");
  if (!hours) return toast("Wake-up time must be after sleep time");
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

$("saveEvent").addEventListener("click", async () => {
  const kind = $("eventKind").value;
  const date = $("eventDate").value;
  const name = $("eventName").value.trim();
  const needsName = kind === "symptom" || kind === "other";
  if (!date) return toast("Choose when the event happened");
  if (needsName && !name) return toast("Briefly name the event or symptom");
  addEntry("event", {
    kind,
    name: needsName ? name : "",
    severity: ["diarrhea", "vomiting", "symptom", "other"].includes(kind) ? Number($("eventSeverity").value) : null,
    bowelForm: kind === "bowel" && $("eventBowelForm").value ? Number($("eventBowelForm").value) : null,
    ease: kind === "bowel" ? ($("eventEase").value || null) : null,
    note: $("eventNote").value.trim()
  }, new Date(date).toISOString());
  $("eventName").value = "";
  $("eventNote").value = "";
  $("eventBowelForm").value = "";
  $("eventEase").value = "";
  $("eventSeverity").value = "5";
  $("eventSeverity").dispatchEvent(new Event("input"));
  $("eventDate").value = toLocalInputValue(new Date());
  await saveAndRender("Health event saved");
});

$("saveFood").addEventListener("click", async () => {
  const name = $("foodName").value.trim();
  const amountInput = $("foodAmount").value.trim();
  const amount = Number(amountInput);
  const date = $("foodDate").value;
  const calories = $("foodCalories").value === "" ? null : Number($("foodCalories").value);
  const estimate = estimateFoodCalories();
  if (!name) return toast("Enter what you had");
  if (!amountInput || !Number.isFinite(amount) || amount <= 0) return toast("Enter how much you had");
  if (!date) return toast("Choose when you had it");
  if (calories == null || !Number.isFinite(calories) || calories < 0) return toast("Check the calorie estimate");
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

$("saveMedication").addEventListener("click", async () => {
  const name = $("medicationName").value.trim();
  const amountInput = $("medicationAmount").value.trim();
  const doseAmount = amountInput === "" ? null : Number(amountInput);
  const date = $("medicationDate").value;
  if (!name) return toast("Enter the medication or supplement name");
  if (!date) return toast("Choose when it was scheduled or taken");
  if (amountInput && (!Number.isFinite(doseAmount) || doseAmount <= 0)) return toast("Check the dose amount");
  addEntry("medication", {
    kind: $("medicationKind").value,
    name,
    doseAmount,
    doseUnit: $("medicationUnit").value,
    status: $("medicationStatus").value,
    note: $("medicationNote").value.trim()
  }, new Date(date).toISOString());
  $("medicationName").value = "";
  $("medicationAmount").value = "";
  $("medicationNote").value = "";
  $("medicationDate").value = toLocalInputValue(new Date());
  await saveAndRender("Medication or supplement saved");
});

$("saveExercise").addEventListener("click", async () => {
  const category = $("exerciseCategory").value;
  const name = $("exerciseName").value.trim() || exerciseCategoryLabels[category];
  const minutesInput = $("exerciseMinutes").value.trim();
  const minutes = Number(minutesInput);
  const calories = $("exerciseCalories").value === "" ? null : Number($("exerciseCalories").value);
  const date = $("exerciseDate").value;
  const estimate = estimateExerciseCalories();
  if (!minutesInput || !Number.isFinite(minutes) || minutes <= 0) return toast("Enter the exercise duration in minutes");
  if (!date) return toast("Choose when you exercised");
  if (calories == null || !Number.isFinite(calories) || calories < 0) return toast("Check the calorie estimate");
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
  if (!start) return toast("Enter when you started reading");
  if (!end) return toast("Enter when you finished reading");
  if (!minutes) return toast("Reading end time must be after start time");
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
  if (!start) return toast("Enter when you started writing");
  if (!end) return toast("Enter when you finished writing");
  if (!minutes) return toast("Writing end time must be after start time");
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

$("saveCare").addEventListener("click", async () => {
  const items = CARE_INPUTS.filter(({ id }) => $(id).checked).map(({ key }) => key);
  const customItems = [...new Set($("careCustom").value.split(",").map((item) => item.trim()).filter(Boolean))];
  const date = $("careDate").value;
  if (!items.length && !customItems.length) return toast("Choose at least one care action");
  if (!date) return toast("Choose a care date");
  addEntry("care", {
    items,
    customItems,
    note: $("careNote").value.trim()
  }, new Date(`${date}T12:00:00`).toISOString());
  CARE_INPUTS.forEach(({ id }) => $(id).checked = false);
  $("careCustom").value = "";
  $("careNote").value = "";
  await saveAndRender("Care check-in saved");
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
  vault = { version: APP_VERSION, entries: [], quickEntries: [], routineDrafts: {} };
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
