const APP_VERSION = 9;
const STORAGE_KEY = "verdant-vault-v2";
const SALT_KEY = "verdant-salt-v2";
const LEGACY_KEYS = ["verdant-vault-v1", "verdant-salt-v1"];
const ITERATIONS = 250000;
const PERIOD_DAYS = { week: 7, month: 30, quarter: 90 };
const ENTRY_TYPES = new Set(["sleep", "food", "water", "medication", "exercise", "care", "body", "event", "function"]);

let vault = { version: APP_VERSION, entries: [], dailyReviews: {}, quickEntries: [], routineDrafts: {} };
let cryptoKey = null;
let currentFilter = "all";
let currentPeriod = "week";
let currentInsightGroup = "overview";
let currentLogGroup = "body";
let currentLogForm = "body";
let selectedLogFormsByGroup = { body: "body", nourish: "food", move: "exercise", care: "care" };
let inactivityTimer = null;
let resizeTimer = null;
let activeFlow = null;
let activeFlowStep = 0;
let flowAnswers = {};
let flowAnswered = new Set();
let flowSkippedSections = new Set();

// V9 intentionally starts a clean health-only database. The user explicitly
// chose to discard the incompatible V1–V8 schema instead of carrying it forward.
LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));

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
  care: "✓",
  checkin: "○",
  function: "↗",
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
  "face-care": "Face care",
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
  sleep: ["sleep"],
  intake: ["food", "water", "medication"],
  activity: ["exercise"],
  care: ["care"],
  body: ["body"],
  events: ["event"],
  function: ["function"],
};

const LOG_GROUP_DEFAULTS = {
  body: "body",
  nourish: "food",
  move: "exercise",
  care: "care"
};

const exerciseCategoryLabels = {
  strength: "Strength training",
  cardio: "Cardio",
  flexibility: "Flexibility",
  dance: "Dance",
  chinese: "Chinese practice"
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
  if (data?.version === APP_VERSION) {
    return {
      version: APP_VERSION,
      entries: Array.isArray(data.entries) ? data.entries.filter((entry) => entry?.schemaVersion === APP_VERSION) : [],
      quickEntries: Array.isArray(data.quickEntries) ? data.quickEntries : [],
      routineDrafts: data.routineDrafts && typeof data.routineDrafts === "object" ? data.routineDrafts : {},
      dailyReviews: data.dailyReviews && typeof data.dailyReviews === "object" ? data.dailyReviews : {}
    };
  }
  // No cross-version migration is performed: V9 is a deliberately clean schema.
  return { version: APP_VERSION, entries: [], dailyReviews: {}, quickEntries: [], routineDrafts: {} };
  /* istanbul ignore next -- retained below only so old encrypted backups fail safely */
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
  vault = { version: APP_VERSION, entries: [], dailyReviews: {}, quickEntries: [], routineDrafts: {} };
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
  vault = { version: APP_VERSION, entries: [], dailyReviews: {}, quickEntries: [], routineDrafts: {} };
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
  if (!ENTRY_TYPES.has(type)) throw new Error(`Unsupported entry type: ${type}`);
  const occurredAt = parseDate(date);
  if (!occurredAt) throw new Error(`Invalid entry date for ${type}`);
  const entry = {
    ...payload,
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    type,
    schemaVersion: APP_VERSION,
    date: occurredAt.toISOString(),
    createdAt: new Date().toISOString()
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

function waterTotalForEntries(entries) {
  const byDay = new Map();
  entries.forEach((entry) => {
    const key = todayKey(entry.date);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(entry);
  });
  return [...byDay.values()].reduce((total, dayEntries) => {
    const dailyTotal = dayEntries.find((entry) => entry.dailyTotal);
    return total + (dailyTotal ? Number(dailyTotal.ml) || 0 : dayEntries.reduce((sum, entry) => sum + (Number(entry.ml) || 0), 0));
  }, 0);
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
  return kind === "daily" ? vault.dailyReviews?.[date] || null : null;
}

function routineState(kind) {
  if (routineEntry(kind)) return "done";
  if (vault.routineDrafts?.[kind]) return "draft";
  return "ready";
}

function renderRoutineHub() {
  if (!vault || !$('routineList') || !$('todayRoutineCard')) return;
  const state = routineState("daily");
  const status = state === "done" ? "Done today" : state === "draft" ? "Continue" : "Start review";
  $('routineList').innerHTML = `<button type="button" class="routine-choice ${state === "done" ? "is-complete" : ""}" data-start-flow="daily">
    <span class="routine-icon" aria-hidden="true">○</span>
    <span><strong>Daily body review</strong><small>Sleep · intake · activity · care · weight · body events</small></span>
    <span class="routine-status">${status}</span>
  </button>`;

  if (state === "done") {
    $('todayRoutineCard').innerHTML = `<div><p class="eyebrow">TODAY IS RECORDED</p><h2>Your daily review is complete</h2><p>Every body category was visited. You can reopen it if something changes.</p></div><button type="button" class="secondary compact-action" data-start-flow="daily">Review again</button>`;
    return;
  }
  $('todayRoutineCard').innerHTML = `<div><p class="eyebrow">TODAY’S REVIEW</p><h2>Let Verdant ask the questions</h2><p>${state === "draft" ? "Pick up where you left off." : "One sequence covers every body category you chose—nothing generic, nothing left to remember."}</p><small>Answer one compact card at a time, or take a section shortcut.</small></div><button type="button" class="primary compact-action" data-start-flow="daily">${state === "draft" ? "Continue" : "Begin"}</button>`;
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
  const latestFunction = entriesByType("function")[0];
  const todayMedication = entriesByType("medication").filter((entry) => todayKey(entry.date) === today);
  const todayEvents = entriesByType("event").filter((entry) => todayKey(entry.date) === today);
  const todayCare = entriesByType("care").filter((entry) => todayKey(entry.date) === today);
  const todayCheckin = routineEntry("daily", today);

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
  const waterMl = waterTotalForEntries(todayWater);
  $("metricFood").textContent = calorieTotal ? `${Math.round(calorieTotal)} kcal` : `${todayFood.length + todayMedication.length}`;
  $("metricFoodSub").textContent = `${waterMl ? `${round(waterMl / 1000, 2)} L water · ` : ""}${todayFood.length} food · ${todayMedication.length} dose${todayMedication.length === 1 ? "" : "s"}`;

  const minutes = todayExercise.reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0);
  $("metricExercise").textContent = minutes ? `${minutes} min` : "—";
  $("metricExerciseSub").textContent = `${todayExercise.length} ${todayExercise.length === 1 ? "session" : "sessions"} today`;

  $("metricFocus").textContent = latestFunction ? `${latestFunction.chairStands} stands` : "—";
  $("metricFocusSub").textContent = latestFunction
    ? `TUG ${round(latestFunction.tugSeconds, 1)}s · balance ${latestFunction.balanceStage}/4 · ${formatDateOnly(latestFunction.date)}`
    : "No assessment yet";

  const careActions = new Set(todayCare.flatMap(careActionLabels));
  $("metricCare").textContent = careActions.size ? `${careActions.size} done` : (todayCheckin ? "Reviewed" : "—");
  $("metricCareSub").textContent = [todayCare.length ? `${todayCare.length} care log${todayCare.length === 1 ? "" : "s"}` : "", todayCheckin ? "daily review saved" : ""].filter(Boolean).join(" · ") || "Nothing logged today";

  renderEntryList($("recentEntries"), vault.entries.filter((entry) => !["reading", "writing"].includes(entry.type)).slice(0, 6), false);
}

function renderHistory() {
  document.querySelectorAll("#historyFilter .seg").forEach((button) => {
    const active = button.dataset.filter === currentFilter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const visibleEntries = vault.entries.filter((entry) => !["reading", "writing"].includes(entry.type));
  const filtered = currentFilter === "all"
    ? visibleEntries
    : visibleEntries.filter((entry) => recordGroup(entry.type) === currentFilter);
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
      entry.kind === "bowel" && entry.difficulty != null ? `Difficulty ${entry.difficulty}/10` : "",
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
      entry.awakeningCount ? `${entry.awakeningCount} awakening${entry.awakeningCount === 1 ? "" : "s"}` : "",
      entry.awakeMinutes ? `${entry.awakeMinutes} min awake` : "",
      entry.sleepLatencyMinutes != null ? `${entry.sleepLatencyMinutes} min to fall asleep` : "",
      entry.sleepEfficiency != null ? `${entry.sleepEfficiency}% sleep efficiency` : "",
      entry.wakeRested ? `Rested ${entry.wakeRested}/10` : "",
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
      title: entry.routine === "daily" ? "Daily body review" : entry.routine === "morning" ? "Morning check-in" : "Evening review",
      value: entry.routine === "daily" ? "Complete" : (average == null ? "" : `${round(average, 1)}/10`),
      sub: entry.routine === "daily" ? `All body categories reviewed · ${formatDateOnly(entry.date)}` : [...details, formatDateOnly(entry.date)].join(" · "),
      note: entry.note || ""
    };
  }
  if (entry.type === "function") {
    return {
      title: "Physical function",
      value: `${entry.chairStands} chair stands`,
      sub: `TUG ${round(entry.tugSeconds, 1)}s · balance ${entry.balanceStage}/4 for ${round(entry.balanceSeconds, 1)}s · reach ${round(entry.sitReachCm, 1)} cm · breathing ${entry.respiratoryRate}/min · ${formatDateOnly(entry.date)}`,
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
  const dateKeys = new Set(dates.map(todayKey));
  const dailyReviews = Object.entries(vault.dailyReviews || {}).filter(([date]) => dateKeys.has(date)).map(([, review]) => review);
  const functionEntries = entriesForPeriod("function", dates);
  const weightEntries = bodyEntries.filter(hasBodyWeight);
  const measurementEntries = bodyEntries.filter((entry) => measurementCount(entry));

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
  const waterMl = waterTotalForEntries(waterEntries);
  const waterDays = new Set(waterEntries.map((entry) => todayKey(entry.date))).size;
  const activeMinutes = exerciseEntries.reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0);
  const activeDays = new Set(exerciseEntries.map((entry) => todayKey(entry.date))).size;
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
    { label: "Intake", value: waterMl ? `${round(waterMl / 1000, 1)} L` : (loggedFoodDays ? `${Math.round(foodCalories / loggedFoodDays)} kcal` : (medicationEntries.length ? `${medicationEntries.length} doses` : "—")), sub: `${waterDays} water days · ${loggedFoodDays} food days · ${medicationEntries.length} dose logs` },
    { label: "Activity", value: activeMinutes ? `${activeMinutes} min` : "—", sub: `${activeDays} active ${activeDays === 1 ? "day" : "days"}` },
    { label: "Function", value: functionEntries.length ? `${functionEntries[0].chairStands} stands` : "—", sub: `${functionEntries.length} objective ${functionEntries.length === 1 ? "check" : "checks"}` },
    { label: "Care", value: careActions ? `${careActions} done` : "—", sub: `${dailyReviews.length} daily reviews · ${careDays} care days` }
  ].map((item) => `
    <article class="summary-item">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
      <small>${escapeHtml(item.sub)}</small>
    </article>`).join("");

  const sleepHours = groupDaily(sleepEntries, dates, (entry) => entry.hours, "average");
  const sleepQuality = groupDaily(sleepEntries.filter((entry) => entry.quality), dates, (entry) => entry.quality, "average");
  const dailyFood = groupDaily(foodEntries, dates, (entry) => entry.calories);
  const dailyWater = dates.map((date) => {
    const key = todayKey(date);
    const dayEntries = waterEntries.filter((entry) => todayKey(entry.date) === key);
    return { date, value: dayEntries.length ? waterTotalForEntries(dayEntries) : null };
  });
  const dailyMedication = groupDaily(medicationEntries, dates, () => 1);
  const dailyExercise = groupDaily(exerciseEntries, dates, (entry) => entry.minutes);
  const dailyMorningWeight = groupDaily(weightEntries.filter((entry) => entry.weightSession === "morning"), dates, displayWeightValue, "average");
  const dailyEveningWeight = groupDaily(weightEntries.filter((entry) => entry.weightSession === "evening"), dates, displayWeightValue, "average");
  const dailyWaist = groupDaily(measurementEntries, dates, (entry) => measurementValue(entry, "waist", preferredMeasurementUnit), "average");
  const dailyHips = groupDaily(measurementEntries, dates, (entry) => measurementValue(entry, "hips", preferredMeasurementUnit), "average");
  const dailyAbdomen = groupDaily(measurementEntries, dates, (entry) => measurementValue(entry, "abdomen", preferredMeasurementUnit), "average");
  const dailyEvents = groupDaily(eventEntries, dates, () => 1);
  const dailyCare = groupDaily(careEntries, dates, (entry) => careActionLabels(entry).length);
  const dailyFunction = groupDaily(functionEntries, dates, (entry) => entry.chairStands, "average");

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
  drawChart($("eventChart"), dailyEvents, { type: "bar", color: "#a06f62" });
  drawChart($("careChart"), dailyCare, { type: "bar", color: "#d09a45" });
  drawChart($("checkinChart"), dailyFunction, { type: "line", color: "#2f6e4f", labels: ["30-second chair stands"] });

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

  const careCounts = careEntries.reduce((counts, entry) => {
    careActionLabels(entry).forEach((label) => counts[label] = (counts[label] || 0) + 1);
    return counts;
  }, {});
  const topCare = Object.entries(careCounts).sort((a, b) => b[1] - a[1])[0];
  $("careChartValue").textContent = careActions ? `${careActions} done` : "No data";
  $("careChartSummary").textContent = careActions
    ? `${careActions} completed actions across ${careDays} ${careDays === 1 ? "day" : "days"}${topCare ? `; most frequent: ${topCare[0]} (${topCare[1]})` : ""}.`
    : "Log a care check-in to see which small routines are supporting you.";

  const latestFunction = [...functionEntries].sort((a, b) => (parseDate(b.date) || 0) - (parseDate(a.date) || 0))[0];
  $("checkinChartValue").textContent = latestFunction ? `${latestFunction.chairStands} stands` : "No data";
  $("checkinChartSummary").textContent = latestFunction
    ? `Latest: TUG ${round(latestFunction.tugSeconds, 1)} seconds · balance stage ${latestFunction.balanceStage}/4 for ${round(latestFunction.balanceSeconds, 1)} seconds · chair reach ${round(latestFunction.sitReachCm, 1)} cm · resting breathing ${latestFunction.respiratoryRate}/min${latestFunction.peakFlow ? ` · peak flow ${latestFunction.peakFlow} L/min` : ""}.`
    : "Run a periodic Physical function check to trend repeatable measurements instead of subjective feelings.";

  renderPatternInsights({ sleepEntries, foodEntries, waterEntries, medicationEntries, exerciseEntries, bodyEntries, eventEntries, careEntries });
}

function formatAverage(values, suffix = "") {
  const average = mean(values);
  return average == null ? "not rated" : `${round(average, 1)}${suffix}`;
}

function renderPatternInsights({ sleepEntries, foodEntries, waterEntries, medicationEntries, exerciseEntries, bodyEntries, eventEntries, careEntries }) {
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
    title: "Body patterns",
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
  if (waterEntries.length) nourishParts.push(`${round(waterTotalForEntries(waterEntries) / 1000, 2)} litres of water were logged`);
  if (medicationEntries.length) {
    const taken = medicationEntries.filter((entry) => entry.status === "taken" || entry.status === "late").length;
    const missed = medicationEntries.length - taken;
    nourishParts.push(`${taken} medication or supplement records were taken or late${missed ? ` and ${missed} were missed or skipped` : ""}`);
  }
  patterns.push({
    symbol: "⌁",
    title: "Intake",
    text: nourishParts.length ? `${nourishParts.join(". ")}.` : "Food and medication or supplement records live together here, while remaining separate and analyzable."
  });

  if (exerciseEntries.length) {
    const counts = exerciseEntries.reduce((result, entry) => {
      result[entry.category || "cardio"] = (result[entry.category || "cardio"] || 0) + 1;
      return result;
    }, {});
    const topCategory = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    patterns.push({
      symbol: "↗",
      title: "Activity",
      text: `${exerciseCategoryLabels[topCategory[0]] || "Activity"} appeared most often across ${exerciseEntries.length} ${exerciseEntries.length === 1 ? "session" : "sessions"}.`
    });
  } else {
    patterns.push({ symbol: "↗", title: "Activity", text: "Two activity sessions will start showing your most frequent exercise type." });
  }

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
  daily: "Daily body review", function: "Physical function",
  water: "Water", food: "Food", medication: "Medication & supplements", weight: "Weight",
  measurements: "Body measurements", sleep: "Sleep", exercise: "Exercise", event: "Health event",
  care: "Care & upkeep"
};

const DAILY_SECTIONS = ["Sleep", "Intake", "Activity", "Care & upkeep", "Body measurements", "Body events", "Anything else"];

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

function clockValue(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultSleepClocks() {
  return { asleep: "23:30", wake: "07:30" };
}

function dailyBowelSteps() {
  const count = Math.min(10, Math.max(0, Number(flowAnswers.bowelCount) || 0));
  return Array.from({ length: count }, (_, index) => ({
    key: `bowel${index + 1}`, kind: "bowel", section: "Body events",
    label: `Bowel movement ${index + 1}`, hint: "Time, Bristol type 1–7, and difficulty 0–10—all on one card."
  }));
}

function dailyMedicationSteps() {
  return [];
}

function makeLogFlows() {
  const sleepTime = sleepDefaults();
  const sleepClocks = defaultSleepClocks();
  return {
    _retiredDaily: [
      { key: "bedTime", kind: "time", section: "Sleep", label: "What time did you get into bed?", default: sleepClocks.bed },
      { key: "attemptSleepTime", kind: "time", section: "Sleep", label: "What time did you try to fall asleep?", default: sleepClocks.attempt },
      { key: "fallAsleepTime", kind: "time", section: "Sleep", label: "About what time did you fall asleep?", default: sleepClocks.asleep },
      { key: "nightAwakened", kind: "yesno", section: "Sleep", label: "Did you wake during the night?" },
      { key: "awakeningCount", kind: "number", section: "Sleep", label: "How many times did you wake?", min: 1, max: 30, step: "1", showIf: (a) => a.nightAwakened === "yes" },
      { key: "awakeMinutes", kind: "number", section: "Sleep", label: "About how many minutes were you awake in total?", min: 1, max: 1440, step: "1", showIf: (a) => a.nightAwakened === "yes" },
      { key: "finalWakeTime", kind: "time", section: "Sleep", label: "What time did you wake for the final time?", default: sleepClocks.wake },
      { key: "outOfBedTime", kind: "time", section: "Sleep", label: "What time did you get out of bed?", default: sleepClocks.out },
      { key: "sleepQuality", kind: "number", section: "Sleep", label: "How would you rate the sleep quality?", hint: "Enter 1–10.", min: 1, max: 10, step: "1" },
      { key: "dreamed", kind: "yesno", section: "Sleep", label: "Do you remember dreaming?" },
      { key: "dreamNote", kind: "text", section: "Sleep", label: "What do you remember about the dream?", showIf: (a) => a.dreamed === "yes" },
      { key: "dreamIntensity", kind: "number", section: "Sleep", label: "How vivid or intense was it?", hint: "Enter 1–10.", min: 1, max: 10, step: "1", showIf: (a) => a.dreamed === "yes" },
      { key: "dreamTone", kind: "number", section: "Sleep", label: "What was the emotional tone?", hint: "Enter −5 for very distressing, 0 for neutral, or +5 for very pleasant.", min: -5, max: 5, allowNegative: true, allowZero: true, step: "1", showIf: (a) => a.dreamed === "yes" },
      { key: "wakeRested", kind: "number", section: "Sleep", label: "How rested did you feel on waking?", hint: "Enter 1–10.", min: 1, max: 10, step: "1" },

      { key: "appetite", kind: "number", section: "Intake", label: "How well regulated was your appetite today?", hint: "Enter 1–10.", min: 1, max: 10, step: "1" },
      { key: "breakfast", kind: "yesno", section: "Intake", label: "Did you eat breakfast?" },
      { key: "breakfastFood", kind: "text", section: "Intake", label: "What and how much did you have for breakfast?", placeholder: "e.g. 2 eggs and 1 slice toast", showIf: (a) => a.breakfast === "yes" },
      { key: "lunch", kind: "yesno", section: "Intake", label: "Did you eat lunch?" },
      { key: "lunchFood", kind: "text", section: "Intake", label: "What and how much did you have for lunch?", showIf: (a) => a.lunch === "yes" },
      { key: "dinner", kind: "yesno", section: "Intake", label: "Did you eat dinner?" },
      { key: "dinnerFood", kind: "text", section: "Intake", label: "What and how much did you have for dinner?", showIf: (a) => a.dinner === "yes" },
      { key: "snacks", kind: "yesno", section: "Intake", label: "Did you have snacks?" },
      { key: "snackFood", kind: "text", section: "Intake", label: "What and how much did you snack on?", showIf: (a) => a.snacks === "yes" },
      { key: "waterTotalMl", kind: "number", section: "Intake", label: "How much water did you drink in total?", hint: "Enter the day’s total in mL.", min: 0, max: 15000, allowZero: true, step: "1" },
      { key: "vitaminD", kind: "yesno", section: "Intake", label: "Did you take Vitamin D?" },
      { key: "otherMedication", kind: "yesno", section: "Intake", label: "Did you take any other medication or supplement?" },
      { key: "otherMedicationCount", kind: "number", section: "Intake", label: "How many other medications or supplements did you take?", min: 1, max: 10, step: "1", showIf: (a) => a.otherMedication === "yes" },
      ...dailyMedicationSteps(),

      { key: "strengthDone", kind: "yesno", section: "Activity", label: "Did you do strength training today?" },
      { key: "strengthDetail", kind: "text", section: "Activity", label: "What strength training did you do?", showIf: (a) => a.strengthDone === "yes" },
      { key: "strengthMinutes", kind: "number", section: "Activity", label: "How many minutes of strength training?", min: 1, max: 600, step: "1", showIf: (a) => a.strengthDone === "yes" },
      { key: "strengthRpe", kind: "number", section: "Activity", label: "How hard was it?", hint: "Enter exertion from 1–10.", min: 1, max: 10, step: "1", showIf: (a) => a.strengthDone === "yes" },
      { key: "cardioDone", kind: "yesno", section: "Activity", label: "Did you do cardio today?" },
      { key: "cardioDetail", kind: "text", section: "Activity", label: "What cardio did you do?", placeholder: "e.g. hiking, swimming, treadmill", showIf: (a) => a.cardioDone === "yes" },
      { key: "cardioMinutes", kind: "number", section: "Activity", label: "How many minutes of cardio?", min: 1, max: 600, step: "1", showIf: (a) => a.cardioDone === "yes" },
      { key: "cardioRpe", kind: "number", section: "Activity", label: "How hard was it?", hint: "Enter exertion from 1–10.", min: 1, max: 10, step: "1", showIf: (a) => a.cardioDone === "yes" },
      { key: "stretchDone", kind: "yesno", section: "Activity", label: "Did you stretch or work on flexibility?" },
      { key: "stretchMinutes", kind: "number", section: "Activity", label: "How many minutes?", min: 1, max: 600, step: "1", showIf: (a) => a.stretchDone === "yes" },
      { key: "danceDone", kind: "yesno", section: "Activity", label: "Did you dance today?" },
      { key: "danceMinutes", kind: "number", section: "Activity", label: "How many minutes did you dance?", min: 1, max: 600, step: "1", showIf: (a) => a.danceDone === "yes" },
      { key: "chineseDone", kind: "yesno", section: "Activity", label: "Did you do a Chinese movement practice today?" },
      { key: "chineseDetail", kind: "text", section: "Activity", label: "What practice did you do?", placeholder: "e.g. tai chi, qigong, baduanjin", showIf: (a) => a.chineseDone === "yes" },
      { key: "chineseMinutes", kind: "number", section: "Activity", label: "How many minutes?", min: 1, max: 600, step: "1", showIf: (a) => a.chineseDone === "yes" },

      { key: "careBrush", kind: "yesno", section: "Care & upkeep", label: "Did you brush your teeth?" },
      { key: "careFloss", kind: "yesno", section: "Care & upkeep", label: "Did you floss?" },
      { key: "careFace", kind: "yesno", section: "Care & upkeep", label: "Did you wash your face?" },
      { key: "careSkincare", kind: "yesno", section: "Care & upkeep", label: "Did you do skincare?" },
      { key: "careShower", kind: "yesno", section: "Care & upkeep", label: "Did you shower?" },
      { key: "careRoom", kind: "yesno", section: "Care & upkeep", label: "Did you tidy your room?" },

      { key: "morningWeightDone", kind: "yesno", section: "Body measurements", label: "Did you weigh yourself this morning?" },
      { key: "morningWeightText", kind: "text", section: "Body measurements", label: "What was your morning weight?", hint: "Write the number and unit: kg or 斤.", placeholder: "e.g. 62.4 kg", showIf: (a) => a.morningWeightDone === "yes" },
      { key: "morningWeightTime", kind: "time", section: "Body measurements", label: "What time did you weigh yourself?", showIf: (a) => a.morningWeightDone === "yes" },
      { key: "eveningWeightDone", kind: "yesno", section: "Body measurements", label: "Did you weigh yourself this evening?" },
      { key: "eveningWeightText", kind: "text", section: "Body measurements", label: "What was your evening weight?", hint: "Write the number and unit: kg or 斤.", placeholder: "e.g. 125 斤", showIf: (a) => a.eveningWeightDone === "yes" },
      { key: "eveningWeightTime", kind: "time", section: "Body measurements", label: "What time did you weigh yourself?", showIf: (a) => a.eveningWeightDone === "yes" },

      { key: "bowelToday", kind: "yesno", section: "Body events", label: "Did you have a bowel movement today?" },
      { key: "bowelCount", kind: "number", section: "Body events", label: "How many bowel movements?", min: 1, max: 10, step: "1", showIf: (a) => a.bowelToday === "yes" },
      ...dailyBowelSteps(),
      { key: "periodStart", kind: "yesno", section: "Body events", label: "Did your period start today?" },
      { key: "periodEnd", kind: "yesno", section: "Body events", label: "Did your period end today?" },
      { key: "unwell", kind: "yesno", section: "Body events", label: "Did anything unusual or illness-related happen today?" },
      { key: "diarrhea", kind: "yesno", section: "Body events", label: "Did you have diarrhea?", showIf: (a) => a.unwell === "yes" },
      { key: "vomiting", kind: "yesno", section: "Body events", label: "Did you vomit?", showIf: (a) => a.unwell === "yes" },
      { key: "otherSymptom", kind: "yesno", section: "Body events", label: "Did you have another symptom or sudden change?", showIf: (a) => a.unwell === "yes" },
      { key: "symptomDetail", kind: "text", section: "Body events", label: "What did you notice?", showIf: (a) => a.unwell === "yes" && a.otherSymptom === "yes" },
      { key: "symptomSeverity", kind: "number", section: "Body events", label: "How intense was the illness or symptom?", hint: "Enter 1–10.", min: 1, max: 10, step: "1", showIf: (a) => a.unwell === "yes" },
      { key: "note", kind: "note", section: "Anything else", label: "Anything else you want in today’s body record?", optional: true }
    ],
    daily: [
      { key: "fallAsleepTime", kind: "time", section: "Sleep", label: "About what time did you fall asleep?", default: sleepClocks.asleep },
      { key: "finalWakeTime", kind: "time", section: "Sleep", label: "What time did you wake for the day?", default: sleepClocks.wake },
      { key: "sleepLatencyMinutes", kind: "number", section: "Sleep", label: "About how many minutes did it take to fall asleep?", hint: "This replaces a separate bedtime and try-to-sleep question.", min: 0, max: 600, allowZero: true, step: "1", default: 0 },
      { key: "awakeMinutes", kind: "number", section: "Sleep", label: "About how many minutes were you awake during the night in total?", hint: "Enter 0 if you did not wake or fell back asleep immediately.", min: 0, max: 600, allowZero: true, step: "1", default: 0 },
      { key: "sleepQuality", kind: "number", section: "Sleep", label: "How would you rate the sleep quality?", hint: "Enter 1–10.", min: 1, max: 10, step: "1", default: 7 },

      { key: "appetite", kind: "number", section: "Intake", label: "How well regulated was your appetite today?", hint: "Enter 1–10.", min: 1, max: 10, step: "1", default: 7 },
      { key: "meals", kind: "meals", section: "Intake", label: "What did you eat today?", hint: "Add what and how much for each meal. Leave a line blank if none.", optional: true },
      { key: "waterTotalMl", kind: "number", section: "Intake", label: "How much water did you drink in total?", hint: "Today’s total in mL. Quick water logs are already added here.", min: 0, max: 15000, allowZero: true, step: "1", default: 0 },
      { key: "vitaminD", kind: "yesno", section: "Intake", label: "Did you take Vitamin D?" },
      { key: "otherMedicationList", kind: "note", section: "Intake", label: "Any other medication or supplements?", hint: "Optional. One per line: name — dose — time. Example: Magnesium — 200 mg — 21:00", optional: true },

      { key: "strengthActivity", kind: "activity", category: "strength", section: "Activity", label: "Strength training", hint: "Leave blank if none." , optional: true },
      { key: "cardioActivity", kind: "activity", category: "cardio", section: "Activity", label: "Cardio", hint: "Hiking, swimming, treadmill, running, cycling, or similar. Leave blank if none.", optional: true },
      { key: "flexibilityActivity", kind: "activity", category: "flexibility", section: "Activity", label: "Flexibility or stretching", hint: "Leave blank if none.", optional: true },
      { key: "danceActivity", kind: "activity", category: "dance", section: "Activity", label: "Dance", hint: "Leave blank if none.", optional: true },
      { key: "chineseActivity", kind: "activity", category: "chinese", section: "Activity", label: "Chinese movement practice", hint: "Tai chi, qigong, baduanjin, or similar. Leave blank if none.", optional: true },

      { key: "careBrush", kind: "yesno", section: "Care & upkeep", label: "Did you brush your teeth?" },
      { key: "careFloss", kind: "yesno", section: "Care & upkeep", label: "Did you floss?" },
      { key: "careFace", kind: "yesno", section: "Care & upkeep", label: "Did you complete your face care?", hint: "Face washing and/or skincare." },
      { key: "careShower", kind: "yesno", section: "Care & upkeep", label: "Did you shower?" },
      { key: "careRoom", kind: "yesno", section: "Care & upkeep", label: "Did you tidy your room?" },

      { key: "morningWeight", kind: "weightRecord", session: "morning", section: "Body measurements", label: "Morning weight", hint: "Leave blank if you did not weigh yourself." , optional: true },
      { key: "eveningWeight", kind: "weightRecord", session: "evening", section: "Body measurements", label: "Evening weight", hint: "Leave blank if you did not weigh yourself." , optional: true },

      { key: "bowelCount", kind: "number", section: "Body events", label: "How many bowel movements did you have?", hint: "Enter 0 if none.", min: 0, max: 10, allowZero: true, step: "1", default: 0 },
      ...dailyBowelSteps(),
      { key: "periodStart", kind: "yesno", section: "Body events", label: "Did your period start today?" },
      { key: "periodEnd", kind: "yesno", section: "Body events", label: "Did your period end today?" },
      { key: "symptom", kind: "symptom", section: "Body events", label: "Any illness or sudden symptom?", hint: "Optional. Describe diarrhea, vomiting, pain, or anything unusual and rate its intensity.", optional: true },
      { key: "note", kind: "note", section: "Anything else", label: "Anything else you want in today’s body record?", optional: true }
    ],
    function: [
      { key: "date", kind: "date", section: "Physical function", label: "What date are you testing?", default: todayValue },
      { key: "chairStands", kind: "number", section: "Strength", label: "How many chair stands can you complete in 30 seconds?", hint: "Use a firm chair. Cross your arms over your chest; count full stands.", min: 0, max: 100, allowZero: true, step: "1" },
      { key: "tugSeconds", kind: "number", section: "Mobility", label: "How many seconds is your Timed Up and Go?", hint: "Stand from a chair, walk 3 metres, turn, return, and sit. Use your normal safe pace.", min: 0.1, max: 300, step: "0.1" },
      { key: "balanceStage", kind: "number", section: "Balance", label: "What is the highest 4-stage balance position you can hold for 10 seconds?", hint: "Enter 1–4: side-by-side, semi-tandem, tandem, then one-leg stance. Stop if unsafe.", min: 1, max: 4, step: "1" },
      { key: "balanceSeconds", kind: "number", section: "Balance", label: "How many seconds did you hold that position?", min: 0, max: 10, allowZero: true, step: "0.1" },
      { key: "sitReachCm", kind: "number", section: "Flexibility", label: "What was your chair sit-and-reach distance?", hint: "Record centimetres from fingertips to toes. Negative is short of the toes; positive is past them.", min: -100, max: 100, allowNegative: true, allowZero: true, step: "0.1" },
      { key: "respiratoryRate", kind: "number", section: "Breathing", label: "What was your resting breathing rate?", hint: "Sit quietly, then count breaths for one full minute.", min: 1, max: 100, step: "1" },
      { key: "peakFlowDone", kind: "yesno", section: "Breathing", label: "Do you have a peak-flow meter reading?" },
      { key: "peakFlow", kind: "number", section: "Breathing", label: "What was your peak expiratory flow?", hint: "Enter L/min.", min: 1, max: 1000, step: "1", showIf: (a) => a.peakFlowDone === "yes" },
      { key: "note", kind: "note", section: "Physical function", label: "Any testing context to remember?", optional: true }
    ],
    water: [
      { key: "preset", kind: "choice", label: "How much water?", hint: "Tap an amount and the next question appears.", options: [choice("250", "250 mL"), choice("350", "350 mL"), choice("500", "500 mL"), choice("750", "750 mL"), choice("custom", "Custom amount")] },
      { key: "amount", kind: "number", label: "Enter the amount", hint: "Use a number greater than zero.", default: 250, showIf: (a) => a.preset === "custom" },
      { key: "unit", kind: "choice", label: "Which unit?", default: "ml", showIf: (a) => a.preset === "custom", options: [choice("ml", "mL"), choice("cup", "Cups"), choice("oz", "fl oz")] },
      { key: "date", kind: "datetime", label: "When did you drink it?", default: nowValue }
    ],
    weight: [
      { key: "weightText", kind: "text", label: "What is your weight?", hint: "Write the number and unit: kg or 斤.", placeholder: "e.g. 62.4 kg" },
      { key: "morning", kind: "yesno", label: "Is this your morning weight?", hint: "Choose No for an evening weight." },
      { key: "date", kind: "datetime", label: "When was it measured?", default: nowValue },
      { key: "note", kind: "note", label: "Anything to remember?", hint: "Optional", optional: true }
    ],
    measurements: [
      { key: "unit", kind: "text", label: "Which measurement unit?", hint: "Type cm or in.", default: "cm" },
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
    care: [
      { key: "items", kind: "multi", label: "What did you do?", options: Object.entries(careItemLabels).map(([value, label]) => choice(value, label)) },
      { key: "custom", kind: "text", label: "Anything else?", hint: "Optional", placeholder: "e.g. changed sheets", optional: true },
      { key: "date", kind: "date", label: "Which day?", default: todayValue },
      { key: "note", kind: "note", label: "Anything to remember?", hint: "Optional", optional: true }
    ]
  };
}

function visibleFlowSteps() {
  const steps = makeLogFlows()[activeFlow] || [];
  return steps.filter((step) => !step.showIf || step.showIf(flowAnswers));
}

function timeOnly(value) {
  const date = parseDate(value);
  return date ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : "";
}

function prefillDailyAnswers() {
  const key = todayKey();
  const today = (type) => entriesByType(type).filter((entry) => todayKey(entry.date) === key);
  const answers = {};
  const sleep = today("sleep")[0];
  if (sleep) {
    answers.fallAsleepTime = timeOnly(sleep.start);
    answers.finalWakeTime = timeOnly(sleep.end);
    answers.sleepLatencyMinutes = Number(sleep.sleepLatencyMinutes) || 0;
    answers.awakeMinutes = Number(sleep.awakeMinutes) || 0;
    answers.sleepQuality = Number(sleep.quality) || 7;
  }
  const review = routineEntry("daily", key);
  if (review?.appetite != null) answers.appetite = Number(review.appetite);
  if (review?.note) answers.note = review.note;

  const meals = {};
  today("food").forEach((entry) => {
    const meal = entry.meal === "snack" ? "snack" : entry.meal;
    if (!meal) return;
    meals[meal] = [meals[meal], entry.name].filter(Boolean).join("; ");
  });
  if (Object.keys(meals).length) answers.meals = meals;
  const water = today("water");
  if (water.length) answers.waterTotalMl = round(waterTotalForEntries(water), 0);
  const medications = today("medication");
  const vitaminD = medications.find((entry) => String(entry.name).trim().toLowerCase() === "vitamin d");
  if (vitaminD) answers.vitaminD = vitaminD.status === "taken" || vitaminD.status === "late" ? "yes" : "no";
  const others = medications.filter((entry) => String(entry.name).trim().toLowerCase() !== "vitamin d");
  if (others.length) answers.otherMedicationList = others.map((entry) => `${entry.name} — ${entry.note?.replace(/^Dose:\s*/i, "") || medicationDoseText(entry) || "dose not entered"} — ${timeOnly(entry.date)}`).join("\n");

  const activities = today("exercise");
  [["strength", "strengthActivity"], ["cardio", "cardioActivity"], ["flexibility", "flexibilityActivity"], ["dance", "danceActivity"], ["chinese", "chineseActivity"]].forEach(([category, answerKey]) => {
    const matches = activities.filter((entry) => entry.category === category);
    if (!matches.length) return;
    answers[answerKey] = {
      name: matches.map((entry) => entry.name).filter(Boolean).join("; "),
      minutes: String(matches.reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0)),
      rpe: String(Math.round(mean(matches.map((entry) => entry.rpe || ({ light: 3, moderate: 6, vigorous: 9 }[entry.intensity] || 5)))))
    };
  });

  const care = today("care").flatMap((entry) => entry.items || []);
  if (care.length || review) {
    answers.careBrush = care.includes("brush") ? "yes" : "no";
    answers.careFloss = care.includes("floss") ? "yes" : "no";
    answers.careFace = care.includes("wash-face") || care.includes("skincare") ? "yes" : "no";
    answers.careShower = care.includes("shower") ? "yes" : "no";
    answers.careRoom = care.includes("tidy-room") ? "yes" : "no";
  }

  const weights = today("body").filter(hasBodyWeight);
  ["morning", "evening"].forEach((session) => {
    const entry = weights.find((item) => item.weightSession === session);
    if (entry) answers[`${session}Weight`] = { weight: weightText(entry), time: timeOnly(entry.date) };
  });

  const events = today("event");
  const bowels = events.filter((entry) => entry.kind === "bowel");
  if (bowels.length) {
    answers.bowelCount = bowels.length;
    bowels.slice(0, 10).forEach((entry, index) => answers[`bowel${index + 1}`] = { time: timeOnly(entry.date), form: String(entry.bowelForm || ""), difficulty: String(entry.difficulty ?? "") });
  }
  if (events.some((entry) => entry.kind === "period-start")) answers.periodStart = "yes";
  if (events.some((entry) => entry.kind === "period-end")) answers.periodEnd = "yes";
  const symptoms = events.filter((entry) => !["bowel", "period-start", "period-end"].includes(entry.kind));
  if (symptoms.length) answers.symptom = { description: symptoms.map((entry) => entry.name || eventKindLabels[entry.kind] || entry.kind).join("; "), severity: String(Math.max(...symptoms.map((entry) => Number(entry.severity) || 1))) };
  return answers;
}

function startFlow(type) {
  if (!makeLogFlows()[type]) return;
  activeFlow = type;
  const savedDraft = type === "daily" ? vault.routineDrafts?.[type] : null;
  activeFlowStep = savedDraft?.step || 0;
  flowAnswers = type === "daily" ? { ...prefillDailyAnswers(), ...(savedDraft?.answers || {}) } : {};
  flowAnswered = new Set(savedDraft?.answered || []);
  flowSkippedSections = new Set(savedDraft?.skippedSections || []);
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
  flowSkippedSections = new Set();
  $("flowShell").classList.add("hidden");
  $("logHome").classList.remove("hidden");
  renderQuickEntries();
  renderRoutineHub();
}

function isRoutineFlow() {
  return activeFlow === "daily";
}

function routineSaveNowButton() {
  return "";
}

function persistRoutineDraft() {
  if (!isRoutineFlow()) return;
  vault.routineDrafts = vault.routineDrafts || {};
  vault.routineDrafts[activeFlow] = { step: activeFlowStep, answers: { ...flowAnswers }, answered: [...flowAnswered], skippedSections: [...flowSkippedSections], updatedAt: new Date().toISOString() };
  encryptVault().catch(() => {});
}

function flowFieldValue(step) {
  const value = flowAnswers[step.key];
  return value == null ? "" : String(value);
}

function renderFlowMap(step) {
  const map = $("flowMap");
  if (activeFlow !== "daily") {
    map.classList.add("hidden");
    map.innerHTML = "";
    return;
  }
  map.classList.remove("hidden");
  const steps = visibleFlowSteps();
  const currentSection = step?.section || "";
  map.innerHTML = DAILY_SECTIONS.map((section) => {
    const sectionSteps = steps.filter((item) => item.section === section);
    const answered = sectionSteps.length && sectionSteps.every((item) => flowAnswered.has(item.key));
    const classes = ["flow-map-step", section === currentSection ? "is-current" : "", answered ? "is-done" : "", flowSkippedSections.has(section) ? "is-skipped" : ""].filter(Boolean).join(" ");
    const mark = answered ? " ✓" : flowSkippedSections.has(section) ? " ↷" : "";
    return `<button type="button" class="${classes}" data-jump-section="${escapeHtml(section)}">${escapeHtml(section.replace("Body measurements", "Body").replace("Body events", "Events").replace("Anything else", "Note"))}${mark}</button>`;
  }).join("");
}

function jumpToDailySection(section, markShortcut = false) {
  const steps = visibleFlowSteps();
  const target = steps.findIndex((step) => step.section === section);
  if (target < 0) return;
  const currentSection = steps[activeFlowStep]?.section;
  const from = DAILY_SECTIONS.indexOf(currentSection);
  const to = DAILY_SECTIONS.indexOf(section);
  if (markShortcut && from >= 0 && to > from) DAILY_SECTIONS.slice(from, to).forEach((name) => flowSkippedSections.add(name));
  flowSkippedSections.delete(section);
  activeFlowStep = target;
  persistRoutineDraft();
  renderFlowQuestion();
}

function skipCurrentDailySection() {
  const steps = visibleFlowSteps();
  const section = steps[activeFlowStep]?.section;
  const index = DAILY_SECTIONS.indexOf(section);
  if (index < 0) return;
  flowSkippedSections.add(section);
  const next = DAILY_SECTIONS.slice(index + 1).find((name) => steps.some((step) => step.section === name));
  if (next) jumpToDailySection(next);
  else {
    activeFlowStep = steps.length;
    persistRoutineDraft();
    renderFlowQuestion();
  }
}

function renderFlowQuestion() {
  const steps = visibleFlowSteps();
  $("flowBack").textContent = activeFlowStep === 0 ? "← All records" : "← Back";
  if (activeFlowStep >= steps.length) {
    $("flowProgress").textContent = "Ready";
    renderFlowMap(null);
    renderFlowReview();
    return;
  }
  const step = steps[activeFlowStep];
  const sectionSteps = activeFlow === "daily" ? steps.filter((item) => item.section === step.section) : steps;
  const sectionPosition = sectionSteps.findIndex((item) => item.key === step.key) + 1;
  $("flowProgress").textContent = activeFlow === "daily" ? `${step.section} · ${sectionPosition} of ${sectionSteps.length}` : `${step.section || FLOW_LABELS[activeFlow]} · ${activeFlowStep + 1} of ${steps.length}`;
  renderFlowMap(step);
  const hint = step.hint ? `<p>${escapeHtml(step.hint)}</p>` : "";
  let control = "";
  if (step.kind === "choice" || step.kind === "scale" || step.kind === "yesno") {
    const options = step.kind === "scale"
      ? Array.from({ length: 10 }, (_, index) => choice(String(index + 1), String(index + 1)))
      : step.kind === "yesno" ? [choice("yes", "Yes"), choice("no", "No")] : step.options;
    const selected = flowFieldValue(step);
    control = `<div class="${step.kind === "scale" ? "flow-scale" : "flow-options two-up"}">${options.map((option) => `
      <button type="button" class="flow-option" data-flow-choice="${escapeHtml(option.value)}" aria-pressed="${String(selected === String(option.value))}">${escapeHtml(option.label)}</button>`).join("")}</div>
      ${selected ? flowContinueButton(step) : ""}${routineSaveNowButton()}`;
  } else if (step.kind === "multi") {
    const selected = Array.isArray(flowAnswers[step.key]) ? flowAnswers[step.key] : [];
    control = `<div class="flow-multi">${step.options.map((option) => `<label><input type="checkbox" value="${escapeHtml(option.value)}" ${selected.includes(option.value) ? "checked" : ""}>${escapeHtml(option.label)}</label>`).join("")}</div>${flowContinueButton(step)}${routineSaveNowButton()}`;
  } else if (step.kind === "measurements") {
    const values = flowAnswers.measurements || {};
    control = `<div class="flow-measurements">${BODY_MEASUREMENTS.map(({ key, label }) => `<label>${escapeHtml(label)}<input type="number" inputmode="decimal" min="0" step="0.1" data-measurement-key="${key}" value="${escapeHtml(values[key] || "")}" /></label>`).join("")}</div>${flowContinueButton(step)}${routineSaveNowButton()}`;
  } else if (step.kind === "meals") {
    const value = flowAnswers[step.key] || {};
    control = `<div class="flow-cluster">${[["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"], ["snack", "Snacks"]].map(([key, label]) => `<label>${label}<input type="text" data-cluster-key="${key}" value="${escapeHtml(value[key] || "")}" placeholder="What and how much?" /></label>`).join("")}</div>${flowContinueButton(step)}`;
  } else if (step.kind === "activity") {
    const value = flowAnswers[step.key] || {};
    control = `<div class="flow-cluster"><label>What did you do?<input type="text" data-cluster-key="name" value="${escapeHtml(value.name || "")}" placeholder="Optional" /></label><div class="flow-cluster two-col"><label>Minutes<input type="number" inputmode="numeric" min="1" max="600" data-cluster-key="minutes" value="${escapeHtml(value.minutes || "")}" /></label><label>Effort 1–10<input type="number" inputmode="numeric" min="1" max="10" data-cluster-key="rpe" value="${escapeHtml(value.rpe || "")}" /></label></div></div>${flowContinueButton(step)}`;
  } else if (step.kind === "weightRecord") {
    const value = flowAnswers[step.key] || {};
    control = `<div class="flow-cluster two-col"><label>Weight (kg or 斤)<input type="text" data-cluster-key="weight" value="${escapeHtml(value.weight || "")}" placeholder="e.g. 62.4 kg" /></label><label>Time<input type="time" data-cluster-key="time" value="${escapeHtml(value.time || "")}" /></label></div>${flowContinueButton(step)}`;
  } else if (step.kind === "bowel") {
    const value = flowAnswers[step.key] || {};
    control = `<div class="flow-cluster"><label>Time<input type="time" data-cluster-key="time" value="${escapeHtml(value.time || "")}" /></label><div class="flow-cluster two-col"><label>Bristol type 1–7<input type="number" inputmode="numeric" min="1" max="7" data-cluster-key="form" value="${escapeHtml(value.form || "")}" /></label><label>Difficulty 0–10<input type="number" inputmode="numeric" min="0" max="10" data-cluster-key="difficulty" value="${escapeHtml(value.difficulty ?? "")}" /></label></div></div>${flowContinueButton(step)}`;
  } else if (step.kind === "symptom") {
    const value = flowAnswers[step.key] || {};
    control = `<div class="flow-cluster"><label>What happened?<textarea data-cluster-key="description" placeholder="Leave blank if nothing unusual happened">${escapeHtml(value.description || "")}</textarea></label><label>Intensity 1–10<input type="number" inputmode="numeric" min="1" max="10" data-cluster-key="severity" value="${escapeHtml(value.severity || "")}" /></label></div>${flowContinueButton(step)}`;
  } else {
    const inputType = step.kind === "datetime" ? "datetime-local" : step.kind === "date" ? "date" : step.kind === "time" ? "time" : step.kind === "number" ? "number" : "text";
    const input = step.kind === "note"
      ? `<textarea id="flowInput" aria-label="${escapeHtml(step.label)}" placeholder="Optional">${escapeHtml(flowFieldValue(step))}</textarea>`
      : `<input id="flowInput" aria-label="${escapeHtml(step.label)}" type="${inputType}" ${step.kind === "number" ? `inputmode="decimal" min="${step.min ?? (step.allowNegative ? "" : 0)}" ${step.max != null ? `max="${step.max}"` : ""} step="${step.step || "0.1"}"` : ""} value="${escapeHtml(flowFieldValue(step))}" placeholder="${escapeHtml(step.placeholder || "")}" />`;
    control = `<div class="flow-control">${input}</div>${flowContinueButton(step)}${routineSaveNowButton()}`;
  }
  const sectionSkip = activeFlow === "daily" && step.section !== "Anything else" ? `<button type="button" class="flow-section-skip" data-skip-section>Skip ${escapeHtml(step.section)} →</button>` : "";
  $("flowQuestion").innerHTML = `<p class="eyebrow">${escapeHtml(step.section || FLOW_LABELS[activeFlow])}</p><h3>${escapeHtml(step.label)}</h3>${hint}${control}${sectionSkip}`;
  requestAnimationFrame(() => ($("flowInput") || $("flowQuestion").querySelector(".flow-option, input, textarea"))?.focus());
}

function flowContinueButton(step) {
  const skip = step.optional && activeFlow !== "daily" ? `<button type="button" class="flow-skip" data-flow-skip>Skip</button>` : "";
  return `<div class="flow-actions">${skip}<button type="button" class="primary" data-flow-continue>Continue</button></div>`;
}

function storeCurrentFlowAnswer() {
  const step = visibleFlowSteps()[activeFlowStep];
  if (!step) return true;
  let value;
  if (["choice", "scale", "yesno"].includes(step.kind)) {
    value = flowAnswers[step.key] ?? "";
  } else if (step.kind === "multi") {
    value = [...$("flowQuestion").querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
  } else if (step.kind === "measurements") {
    value = {};
    $("flowQuestion").querySelectorAll("[data-measurement-key]").forEach((input) => {
      if (input.value.trim()) value[input.dataset.measurementKey] = Number(input.value);
    });
  } else if (["meals", "activity", "weightRecord", "bowel", "symptom"].includes(step.kind)) {
    value = {};
    $("flowQuestion").querySelectorAll("[data-cluster-key]").forEach((input) => {
      value[input.dataset.clusterKey] = input.value.trim();
    });
    if (step.kind === "activity" && Object.values(value).some(Boolean)) {
      if (!value.minutes || Number(value.minutes) <= 0) return toast("Add the activity minutes"), false;
      if (!value.rpe || Number(value.rpe) < 1 || Number(value.rpe) > 10) return toast("Rate effort from 1 to 10"), false;
    }
    if (step.kind === "weightRecord" && value.weight) {
      if (!parseWeightAnswer(value.weight)) return toast("Use a weight with kg or 斤"), false;
      if (!value.time) return toast("Add the measurement time"), false;
    }
    if (step.kind === "bowel") {
      if (!value.time) return toast("Add the bowel movement time"), false;
      if (Number(value.form) < 1 || Number(value.form) > 7) return toast("Use a Bristol type from 1 to 7"), false;
      if (value.difficulty === "" || Number(value.difficulty) < 0 || Number(value.difficulty) > 10) return toast("Rate difficulty from 0 to 10"), false;
    }
    if (step.kind === "symptom" && value.description && (Number(value.severity) < 1 || Number(value.severity) > 10)) return toast("Rate symptom intensity from 1 to 10"), false;
  } else {
    value = $("flowInput")?.value?.trim() ?? "";
    if (step.kind === "number" && value !== "") value = Number(value);
  }
  if (!step.optional) {
    if (step.kind === "number") {
      if (!Number.isFinite(value)) return toast("Enter a number"), false;
      if (!step.allowZero && !step.allowNegative && value <= 0) return toast("Enter a number greater than zero"), false;
      if (step.min != null && value < step.min) return toast(`Enter ${step.min} or higher`), false;
      if (step.max != null && value > step.max) return toast(`Enter ${step.max} or lower`), false;
    }
    if (step.kind === "measurements" && !Object.keys(value).length) return toast("Enter at least one measurement"), false;
    if (step.kind === "multi" && !value.length) return toast("Choose at least one option"), false;
    if ((step.kind === "text" || step.kind === "datetime" || step.kind === "date" || step.kind === "time") && !value) return toast("Answer this question to continue"), false;
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
  const quickAllowed = !["daily", "function", "checkin", "measurements", "weight"].includes(activeFlow);
  $("flowQuestion").innerHTML = `
    <p class="eyebrow">READY TO SAVE</p>
    <h3>${escapeHtml(FLOW_LABELS[activeFlow])}</h3>
    <div class="flow-review">${escapeHtml(flowSummary())}</div>
    <div class="flow-actions">${quickAllowed ? `<button type="button" class="secondary" data-flow-save-quick>Save & add to Quick</button>` : ""}<button type="button" class="primary" data-flow-save>Save entry</button></div>`;
}

function flowSummary() {
  const a = flowAnswers;
  if (activeFlow === "daily") return `Sleep, intake, activity, care, body measurements, and body events reviewed for ${formatDateOnly(new Date())}`;
  if (activeFlow === "function") return `${a.chairStands} chair stands · TUG ${a.tugSeconds}s · balance stage ${a.balanceStage}`;
  if (activeFlow === "water") return `${waterAmountAndUnit(a).amount} ${waterAmountAndUnit(a).unit} water`;
  if (activeFlow === "weight") return `${a.weightText} · ${a.morning === "yes" ? "Morning" : "Evening"}`;
  if (activeFlow === "measurements") return `${Object.keys(a.measurements || {}).length} measurements · ${a.unit}`;
  if (activeFlow === "food") return `${a.name} · ${a.amount} ${a.unit}`;
  if (activeFlow === "medication") return `${a.name}${a.doseAmount ? ` · ${a.doseAmount} ${a.doseUnit}` : ""} · ${medicationStatusLabels[a.status]}`;
  if (activeFlow === "exercise") return `${a.name || exerciseCategoryLabels[a.category]} · ${a.minutes} min`;
  if (activeFlow === "sleep") return `${round((parseDate(a.end) - parseDate(a.start)) / 3600000, 1)} hours · quality ${a.quality}/10`;
  if (activeFlow === "care") return `${(a.items || []).length + (a.custom ? 1 : 0)} care actions`;
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

function dateForClock(clock, previousIfAfternoon = false) {
  if (!/^\d{2}:\d{2}$/.test(String(clock || ""))) return null;
  const date = new Date(`${todayKey()}T${clock}:00`);
  if (previousIfAfternoon && Number(clock.slice(0, 2)) >= 12) date.setDate(date.getDate() - 1);
  return date;
}

function parseWeightAnswer(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!/(?:kg|斤|jin)\b|斤/.test(text)) return null;
  const amount = Number(text.replace(/[^0-9.+-]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { weight: amount, weightUnit: text.includes("斤") || text.includes("jin") ? "jin" : "kg" };
}

function rpeIntensity(value) {
  const rpe = Number(value);
  return rpe >= 8 ? "vigorous" : rpe >= 5 ? "moderate" : "light";
}

function addDailyFood(sourceRoutine, meal, description, date) {
  if (!description) return;
  $("foodName").value = description;
  $("foodAmount").value = 1;
  $("foodUnit").value = "serving";
  $("foodCategory").value = "other";
  const estimate = estimateFoodCalories();
  addEntry("food", {
    sourceRoutine, name: description, meal, category: "other", amount: 1, unit: "serving",
    calories: estimate?.calories ?? 0, calorieSource: estimate?.source || "description estimate", note: ""
  }, date);
}

function addDailyExercise(sourceRoutine, category, name, minutes, rpe, date) {
  if (!(Number(minutes) > 0)) return;
  const intensity = rpeIntensity(rpe || 5);
  $("exerciseCategory").value = category;
  $("exerciseIntensity").value = intensity;
  $("exerciseName").value = name || exerciseCategoryLabels[category];
  $("exerciseMinutes").value = minutes;
  const estimate = estimateExerciseCalories();
  addEntry("exercise", {
    sourceRoutine, name: name || exerciseCategoryLabels[category], category, intensity,
    rpe: numericOrNull(rpe), minutes: Number(minutes), calories: estimate?.calories ?? 0,
    met: estimate?.met || null, estimateWeightKg: estimate?.weight.kg || null, note: ""
  }, date);
}

function saveDailyReviewLegacy(answers) {
  const key = todayKey();
  const sourceRoutine = `daily:${key}`;
  const recordedAt = new Date().toISOString();
  const morningWeight = answers.morningWeightDone === "yes" ? parseWeightAnswer(answers.morningWeightText) : null;
  const eveningWeight = answers.eveningWeightDone === "yes" ? parseWeightAnswer(answers.eveningWeightText) : null;
  if (answers.morningWeightDone === "yes" && !morningWeight) return toast("Check the morning weight and include kg or 斤"), false;
  if (answers.eveningWeightDone === "yes" && !eveningWeight) return toast("Check the evening weight and include kg or 斤"), false;
  const bed = dateForClock(answers.bedTime, true);
  const attemptSleep = dateForClock(answers.attemptSleepTime, true);
  const asleep = dateForClock(answers.fallAsleepTime, true);
  const finalWake = dateForClock(answers.finalWakeTime, false);
  const outOfBed = dateForClock(answers.outOfBedTime, false);
  if (!bed || !attemptSleep || !asleep || !finalWake || !outOfBed || attemptSleep < bed || asleep < attemptSleep || finalWake <= asleep || outOfBed < finalWake) {
    return toast("Check the order of the sleep timeline"), false;
  }
  const awakeMinutes = answers.nightAwakened === "yes" ? Number(answers.awakeMinutes) : 0;
  const sleepWindowMinutes = (finalWake - asleep) / 60000;
  if (!Number.isFinite(awakeMinutes) || awakeMinutes < 0 || awakeMinutes >= sleepWindowMinutes) return toast("Check the minutes awake during the night"), false;
  const hours = (sleepWindowMinutes - awakeMinutes) / 60;
  if (hours <= 0 || hours > 24) return toast("Check the sleep duration"), false;
  const timeInBedHours = (outOfBed - bed) / 3600000;
  const sleepEfficiency = timeInBedHours > 0 ? round(hours / timeInBedHours * 100, 1) : null;

  vault.entries = vault.entries.filter((entry) => entry.sourceRoutine !== sourceRoutine);
  const existing = routineEntry("daily", key);
  const pulse = { routine: "daily", appetite: Number(answers.appetite), note: answers.note || "" };
  if (existing) Object.assign(existing, pulse, { date: recordedAt });
  else addEntry("checkin", pulse, recordedAt);

  addEntry("sleep", {
    sourceRoutine,
    bedTime: bed.toISOString(), attemptSleepTime: attemptSleep.toISOString(),
    start: asleep.toISOString(), end: finalWake.toISOString(), hours: round(hours, 2),
    awakeningCount: answers.nightAwakened === "yes" ? Number(answers.awakeningCount) : 0,
    awakeMinutes, outOfBedTime: outOfBed.toISOString(),
    sleepLatencyMinutes: Math.round((asleep - attemptSleep) / 60000),
    timeInBedHours: round(timeInBedHours, 2), sleepEfficiency,
    quality: Number(answers.sleepQuality), dreamed: answers.dreamed === "yes",
    dreamNote: answers.dreamed === "yes" ? answers.dreamNote : "",
    dreamIntensity: answers.dreamed === "yes" ? Number(answers.dreamIntensity) : null,
    dreamTone: answers.dreamed === "yes" ? Number(answers.dreamTone) : null,
    wakeRested: Number(answers.wakeRested), note: ""
  }, finalWake.toISOString());

  if (answers.breakfast === "yes") addDailyFood(sourceRoutine, "breakfast", answers.breakfastFood, recordedAt);
  if (answers.lunch === "yes") addDailyFood(sourceRoutine, "lunch", answers.lunchFood, recordedAt);
  if (answers.dinner === "yes") addDailyFood(sourceRoutine, "dinner", answers.dinnerFood, recordedAt);
  if (answers.snacks === "yes") addDailyFood(sourceRoutine, "snack", answers.snackFood, recordedAt);
  addEntry("water", { sourceRoutine, dailyTotal: true, amount: Number(answers.waterTotalMl), unit: "ml", ml: Number(answers.waterTotalMl) }, recordedAt);
  addEntry("medication", { sourceRoutine, kind: "supplement", name: "Vitamin D", doseAmount: 1, doseUnit: "dose", status: answers.vitaminD === "yes" ? "taken" : "missed", note: "" }, recordedAt);
  if (answers.otherMedication === "yes") {
    for (let index = 1; index <= Number(answers.otherMedicationCount); index += 1) {
      const medicationTime = dateForClock(answers[`medication${index}Time`], false)?.toISOString() || recordedAt;
      addEntry("medication", {
        sourceRoutine, kind: "other", name: answers[`medication${index}Name`], doseAmount: null,
        doseUnit: "dose", status: "taken", note: `Dose: ${answers[`medication${index}Dose`]}`
      }, medicationTime);
    }
  }

  if (answers.strengthDone === "yes") addDailyExercise(sourceRoutine, "strength", answers.strengthDetail, answers.strengthMinutes, answers.strengthRpe, recordedAt);
  if (answers.cardioDone === "yes") addDailyExercise(sourceRoutine, "cardio", answers.cardioDetail, answers.cardioMinutes, answers.cardioRpe, recordedAt);
  if (answers.stretchDone === "yes") addDailyExercise(sourceRoutine, "flexibility", "Stretching / flexibility", answers.stretchMinutes, 3, recordedAt);
  if (answers.danceDone === "yes") addDailyExercise(sourceRoutine, "dance", "Dance", answers.danceMinutes, 5, recordedAt);
  if (answers.chineseDone === "yes") addDailyExercise(sourceRoutine, "chinese", answers.chineseDetail, answers.chineseMinutes, 3, recordedAt);

  const careMap = { careBrush: "brush", careFloss: "floss", careFace: "wash-face", careSkincare: "skincare", careShower: "shower", careRoom: "tidy-room" };
  const careItems = Object.entries(careMap).filter(([keyName]) => answers[keyName] === "yes").map(([, value]) => value);
  addEntry("care", { sourceRoutine, items: careItems, customItems: [], note: "" }, recordedAt);

  [["morning", answers.morningWeightDone, morningWeight, answers.morningWeightTime], ["evening", answers.eveningWeightDone, eveningWeight, answers.eveningWeightTime]].forEach(([session, done, parsed, time]) => {
    if (done !== "yes") return;
    addEntry("body", { sourceRoutine, ...parsed, weightSession: session, measurements: {}, measurementUnit: "cm", note: "" }, dateForClock(time, false)?.toISOString() || recordedAt);
  });

  if (answers.bowelToday === "yes") {
    for (let index = 1; index <= Number(answers.bowelCount); index += 1) {
      addEntry("event", {
        sourceRoutine, kind: "bowel", name: "", bowelForm: Number(answers[`bowel${index}Form`]),
        ease: null, difficulty: Number(answers[`bowel${index}Difficulty`]), severity: null, note: ""
      }, dateForClock(answers[`bowel${index}Time`], false)?.toISOString() || recordedAt);
    }
  }
  if (answers.periodStart === "yes") addEntry("event", { sourceRoutine, kind: "period-start", name: "", severity: null, note: "" }, recordedAt);
  if (answers.periodEnd === "yes") addEntry("event", { sourceRoutine, kind: "period-end", name: "", severity: null, note: "" }, recordedAt);
  if (answers.unwell === "yes" && answers.diarrhea === "yes") addEntry("event", { sourceRoutine, kind: "diarrhea", name: "", severity: Number(answers.symptomSeverity), note: "" }, recordedAt);
  if (answers.unwell === "yes" && answers.vomiting === "yes") addEntry("event", { sourceRoutine, kind: "vomiting", name: "", severity: Number(answers.symptomSeverity), note: "" }, recordedAt);
  if (answers.unwell === "yes" && answers.otherSymptom === "yes") addEntry("event", { sourceRoutine, kind: "symptom", name: answers.symptomDetail, severity: Number(answers.symptomSeverity), note: "" }, recordedAt);

  vault.routineDrafts = vault.routineDrafts || {};
  delete vault.routineDrafts.daily;
  return true;
}

function sectionWasSkipped(section) {
  return flowSkippedSections.has(section);
}

function removeTodayTypes(types, predicate = () => true) {
  const key = todayKey();
  vault.entries = vault.entries.filter((entry) => !(types.includes(entry.type) && todayKey(entry.date) === key && predicate(entry)));
}

function parseMedicationLines(value) {
  return String(value || "").split(/\n+/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [name = "Medication", dose = "", time = ""] = line.split(/\s*(?:—|\|)\s*|\s+-\s+/);
    return { name: name.trim() || "Medication", dose: dose.trim(), time: /^\d{1,2}:\d{2}$/.test(time.trim()) ? time.trim().padStart(5, "0") : "" };
  });
}

function saveDailyReview(answers) {
  const key = todayKey();
  const sourceRoutine = `daily:${key}`;
  const recordedAt = new Date().toISOString();

  let sleepRecord = null;
  if (!sectionWasSkipped("Sleep")) {
    const asleep = dateForClock(answers.fallAsleepTime, true);
    const finalWake = dateForClock(answers.finalWakeTime, false);
    const awakeMinutes = Number(answers.awakeMinutes);
    const latencyMinutes = Number(answers.sleepLatencyMinutes);
    const windowMinutes = asleep && finalWake ? (finalWake - asleep) / 60000 : 0;
    if (!asleep || !finalWake || windowMinutes <= 0 || windowMinutes > 1440) return toast("Check the sleep and wake times"), false;
    if (!Number.isFinite(awakeMinutes) || awakeMinutes < 0 || awakeMinutes >= windowMinutes) return toast("Check the minutes awake during the night"), false;
    if (!Number.isFinite(latencyMinutes) || latencyMinutes < 0 || latencyMinutes > 600) return toast("Check the time it took to fall asleep"), false;
    const hours = (windowMinutes - awakeMinutes) / 60;
    const attemptSleep = new Date(asleep.getTime() - latencyMinutes * 60000);
    const timeInBedHours = (finalWake - attemptSleep) / 3600000;
    sleepRecord = {
      sourceRoutine, start: asleep.toISOString(), end: finalWake.toISOString(), hours: round(hours, 2),
      sleepLatencyMinutes: latencyMinutes, awakeMinutes, timeInBedHours: round(timeInBedHours, 2),
      sleepEfficiency: round(hours / timeInBedHours * 100, 1), quality: Number(answers.sleepQuality), note: ""
    };
  }

  const weightRecords = [];
  let invalidWeightSession = "";
  if (!sectionWasSkipped("Body measurements")) {
    [["morning", answers.morningWeight], ["evening", answers.eveningWeight]].forEach(([session, value]) => {
      if (!value?.weight) return;
      const parsed = parseWeightAnswer(value.weight);
      if (!parsed || !value.time) { invalidWeightSession = session; return; }
      weightRecords.push({ session, parsed, time: value.time });
    });
  }
  if (invalidWeightSession) return toast(`Check the ${invalidWeightSession} weight and time`), false;

  const existing = routineEntry("daily", key);
  const pulse = {
    routine: "daily", appetite: sectionWasSkipped("Intake") ? (existing?.appetite ?? null) : Number(answers.appetite),
    note: answers.note || existing?.note || "", reviewedSections: DAILY_SECTIONS.filter((section) => section !== "Anything else" && !sectionWasSkipped(section)),
    skippedSections: [...flowSkippedSections], completedAt: recordedAt, schemaVersion: APP_VERSION
  };
  vault.dailyReviews = vault.dailyReviews || {};
  vault.dailyReviews[key] = pulse;

  if (!sectionWasSkipped("Sleep")) {
    removeTodayTypes(["sleep"]);
    addEntry("sleep", sleepRecord, sleepRecord.end);
  }

  if (!sectionWasSkipped("Intake")) {
    removeTodayTypes(["food", "water", "medication"]);
    const meals = answers.meals || {};
    addDailyFood(sourceRoutine, "breakfast", meals.breakfast, recordedAt);
    addDailyFood(sourceRoutine, "lunch", meals.lunch, recordedAt);
    addDailyFood(sourceRoutine, "dinner", meals.dinner, recordedAt);
    addDailyFood(sourceRoutine, "snack", meals.snack, recordedAt);
    addEntry("water", { sourceRoutine, dailyTotal: true, amount: Number(answers.waterTotalMl) || 0, unit: "ml", ml: Number(answers.waterTotalMl) || 0 }, recordedAt);
    addEntry("medication", { sourceRoutine, kind: "supplement", name: "Vitamin D", doseAmount: 1, doseUnit: "dose", status: answers.vitaminD === "yes" ? "taken" : "missed", note: "" }, recordedAt);
    parseMedicationLines(answers.otherMedicationList).forEach((item) => {
      const time = item.time ? dateForClock(item.time, false)?.toISOString() : recordedAt;
      addEntry("medication", { sourceRoutine, kind: "other", name: item.name, doseAmount: null, doseUnit: "dose", status: "taken", note: item.dose ? `Dose: ${item.dose}` : "" }, time || recordedAt);
    });
  }

  if (!sectionWasSkipped("Activity")) {
    removeTodayTypes(["exercise"]);
    [["strength", answers.strengthActivity], ["cardio", answers.cardioActivity], ["flexibility", answers.flexibilityActivity], ["dance", answers.danceActivity], ["chinese", answers.chineseActivity]].forEach(([category, value]) => {
      if (!value?.minutes) return;
      addDailyExercise(sourceRoutine, category, value.name || exerciseCategoryLabels[category], Number(value.minutes), Number(value.rpe), recordedAt);
    });
  }

  if (!sectionWasSkipped("Care & upkeep")) {
    removeTodayTypes(["care"]);
    const items = [];
    if (answers.careBrush === "yes") items.push("brush");
    if (answers.careFloss === "yes") items.push("floss");
    if (answers.careFace === "yes") items.push("face-care");
    if (answers.careShower === "yes") items.push("shower");
    if (answers.careRoom === "yes") items.push("tidy-room");
    addEntry("care", { sourceRoutine, items, customItems: [], note: "" }, recordedAt);
  }

  if (!sectionWasSkipped("Body measurements")) {
    removeTodayTypes(["body"], hasBodyWeight);
    weightRecords.forEach(({ session, parsed, time }) => addEntry("body", { sourceRoutine, ...parsed, weightSession: session, measurements: {}, measurementUnit: "cm", note: "" }, dateForClock(time, false)?.toISOString() || recordedAt));
  }

  if (!sectionWasSkipped("Body events")) {
    removeTodayTypes(["event"]);
    for (let index = 1; index <= Number(answers.bowelCount || 0); index += 1) {
      const value = answers[`bowel${index}`] || {};
      addEntry("event", { sourceRoutine, kind: "bowel", name: "", bowelForm: Number(value.form), difficulty: Number(value.difficulty), severity: null, note: "" }, dateForClock(value.time, false)?.toISOString() || recordedAt);
    }
    if (answers.periodStart === "yes") addEntry("event", { sourceRoutine, kind: "period-start", name: "", severity: null, note: "" }, recordedAt);
    if (answers.periodEnd === "yes") addEntry("event", { sourceRoutine, kind: "period-end", name: "", severity: null, note: "" }, recordedAt);
    if (answers.symptom?.description) {
      const text = answers.symptom.description;
      const kind = /diarrh/i.test(text) && !/vomit/i.test(text) ? "diarrhea" : /vomit/i.test(text) && !/diarrh/i.test(text) ? "vomiting" : "symptom";
      addEntry("event", { sourceRoutine, kind, name: text, severity: Number(answers.symptom.severity), note: "" }, recordedAt);
    }
  }

  vault.routineDrafts = vault.routineDrafts || {};
  delete vault.routineDrafts.daily;
  return true;
}

async function saveActiveFlow(makeQuick = false) {
  const a = flowAnswers;
  let entry;
  let date = parseDate(a.date)?.toISOString() || new Date().toISOString();
  if (activeFlow === "daily") {
    if (!saveDailyReview(a)) return;
    await saveAndRender("Daily body review saved");
    renderLogHome();
    showView("dashboard");
    return;
  } else if (activeFlow === "function") {
    const testDate = new Date(`${a.date}T12:00:00`).toISOString();
    entry = addEntry("function", {
      chairStands: Number(a.chairStands), tugSeconds: Number(a.tugSeconds),
      balanceStage: Number(a.balanceStage), balanceSeconds: Number(a.balanceSeconds),
      sitReachCm: Number(a.sitReachCm), respiratoryRate: Number(a.respiratoryRate),
      peakFlow: a.peakFlowDone === "yes" ? Number(a.peakFlow) : null, note: a.note || ""
    }, testDate);
  } else if (activeFlow === "water") {
    const water = waterAmountAndUnit(a);
    entry = addEntry("water", { amount: water.amount, unit: water.unit, ml: round(waterToMl(water.amount, water.unit), 1) }, date);
  } else if (activeFlow === "weight") {
    const parsed = parseWeightAnswer(a.weightText);
    if (!parsed) return toast("Enter a weight with kg or 斤");
    const weightSession = a.morning === "yes" ? "morning" : "evening";
    const existingWeight = vault.entries.find((item) => item.type === "body" && hasBodyWeight(item) && item.weightSession === weightSession && todayKey(item.date) === todayKey(date));
    if (existingWeight) {
      Object.assign(existingWeight, parsed, { weightSession, measurements: {}, measurementUnit: "cm", note: a.note || "", date, schemaVersion: APP_VERSION });
      entry = existingWeight;
    } else {
      entry = addEntry("body", { ...parsed, weightSession, measurements: {}, measurementUnit: "cm", note: a.note || "" }, date);
    }
  } else if (activeFlow === "measurements") {
    const measurementUnit = String(a.unit || "cm").trim().toLowerCase().startsWith("in") ? "in" : "cm";
    entry = addEntry("body", { weight: null, weightUnit: "kg", weightSession: null, measurements: a.measurements, measurementUnit, note: a.note || "" }, new Date(`${a.date}T12:00:00`).toISOString());
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
  } else if (activeFlow === "care") {
    entry = addEntry("care", { items: a.items || [], customItems: a.custom ? [a.custom] : [], note: a.note || "" }, new Date(`${a.date}T12:00:00`).toISOString());
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
  const entries = [...builtInQuickEntries(), ...(vault.quickEntries || [])].filter((item) => !["reading", "writing"].includes(item.type));
  $("quickEntryList").innerHTML = entries.map((item) => `<button type="button" class="quick-entry" data-quick-id="${escapeHtml(item.id)}"><span>${escapeHtml(item.icon || icons[item.type] || "＋")}</span><span><strong>${escapeHtml(item.label)}</strong><small>Log now</small></span></button>`).join("");
}

function renderQuickEntrySettings() {
  const custom = (vault.quickEntries || []).filter((item) => !["reading", "writing"].includes(item.type));
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
  if (template.type === "water") {
    const dailyTotal = vault.entries.find((entry) => entry.type === "water" && entry.dailyTotal && todayKey(entry.date) === todayKey(now));
    if (dailyTotal) {
      dailyTotal.ml = round((Number(dailyTotal.ml) || 0) + (Number(data.ml) || 0), 1);
      dailyTotal.amount = dailyTotal.ml;
      dailyTotal.unit = "ml";
      dailyTotal.date = now.toISOString();
    } else addEntry(template.type, data, now.toISOString());
  } else if (template.type === "medication" && String(data.name).trim().toLowerCase() === "vitamin d") {
    const existing = vault.entries.find((entry) => entry.type === "medication" && String(entry.name).trim().toLowerCase() === "vitamin d" && todayKey(entry.date) === todayKey(now));
    if (existing) Object.assign(existing, data, { date: now.toISOString(), schemaVersion: APP_VERSION });
    else addEntry(template.type, data, now.toISOString());
  } else addEntry(template.type, data, now.toISOString());
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

  const sectionJump = event.target.closest("[data-jump-section]");
  if (sectionJump && activeFlow === "daily") jumpToDailySection(sectionJump.dataset.jumpSection, true);

  if (event.target.closest("[data-skip-section]") && activeFlow === "daily") skipCurrentDailySection();

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
  vault = { version: APP_VERSION, entries: [], dailyReviews: {}, quickEntries: [], routineDrafts: {} };
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
