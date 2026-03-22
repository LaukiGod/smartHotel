// utils/allergyChecker.js
// Gemini-powered allergy detection with local fallback

const { GoogleGenerativeAI } = require("@google/generative-ai");

// ─── Local fallback map ────────────────────────────────────────────────────────
// Covers common synonyms, derivatives, and cross-reactive groups.
// Used when Gemini is unavailable or for pre-screening.
const ALLERGY_MAP = {
  // Nut family
  peanut:    ["peanut", "groundnut", "arachis oil", "monkey nut", "mixed nuts", "satay", "peanut butter", "peanut oil"],
  nut:       ["peanut", "groundnut", "almond", "cashew", "walnut", "pistachio", "hazelnut", "pecan", "macadamia", "brazil nut", "pine nut", "praline", "marzipan", "frangipane", "nut oil", "mixed nuts"],
  treenut:   ["almond", "cashew", "walnut", "pistachio", "hazelnut", "pecan", "macadamia", "brazil nut", "pine nut", "praline", "marzipan", "frangipane"],
  almond:    ["almond", "marzipan", "frangipane", "almond oil", "almond milk", "almond flour"],
  cashew:    ["cashew", "cashew nut"],
  walnut:    ["walnut"],
  hazelnut:  ["hazelnut", "hazel", "nutella", "praline"],

  // Dairy / Lactose
  milk:      ["milk", "dairy", "lactose", "butter", "cream", "cheese", "yogurt", "yoghurt", "whey", "casein", "lactalbumin", "lactoglobulin", "ghee", "paneer", "curd", "skimmed milk", "whole milk", "condensed milk", "evaporated milk", "sour cream", "crème fraîche", "custard", "gelato", "ice cream"],
  dairy:     ["milk", "dairy", "lactose", "butter", "cream", "cheese", "yogurt", "yoghurt", "whey", "casein", "lactalbumin", "lactoglobulin", "ghee", "paneer", "curd"],
  lactose:   ["lactose", "milk", "dairy", "butter", "cream", "cheese", "whey"],
  cheese:    ["cheese", "paneer", "cheddar", "mozzarella", "parmesan", "brie", "feta", "ricotta", "gouda", "cream cheese"],
  butter:    ["butter", "ghee", "clarified butter"],

  // Gluten / Wheat
  gluten:    ["gluten", "wheat", "flour", "bread", "pasta", "noodle", "barley", "rye", "spelt", "semolina", "durum", "farro", "kamut", "triticale", "malt", "brewer's yeast", "breadcrumb", "crouton", "bulgur", "couscous", "seitan"],
  wheat:     ["wheat", "flour", "semolina", "durum", "spelt", "kamut", "farro", "bulgur", "couscous", "breadcrumb", "pasta", "noodle", "bread", "roti", "naan", "pita"],
  bread:     ["bread", "breadcrumb", "crouton", "roti", "naan", "pita", "wheat", "flour"],

  // Egg
  egg:       ["egg", "eggs", "mayonnaise", "mayo", "meringue", "albumin", "albumen", "lecithin", "ovalbumin", "ovomucin", "lysozyme", "hollandaise"],
  eggs:      ["egg", "eggs", "mayonnaise", "mayo", "meringue", "albumin", "albumen"],

  // Soy / Soya
  soy:       ["soy", "soya", "tofu", "tempeh", "miso", "edamame", "soybean", "soy sauce", "tamari", "textured vegetable protein", "tvp", "soy milk", "soy lecithin", "soy protein"],
  soya:      ["soy", "soya", "tofu", "tempeh", "miso", "edamame", "soybean", "soy sauce", "tamari", "textured vegetable protein", "tvp"],

  // Shellfish / Seafood
  shellfish: ["shrimp", "prawn", "crab", "lobster", "crayfish", "langoustine", "scallop", "mussel", "clam", "oyster", "squid", "octopus", "barnacle", "shellfish"],
  shrimp:    ["shrimp", "prawn"],
  prawn:     ["prawn", "shrimp"],
  crab:      ["crab", "crab meat", "imitation crab", "surimi"],
  lobster:   ["lobster", "langoustine", "crayfish"],

  // Fish
  fish:      ["fish", "salmon", "tuna", "cod", "haddock", "halibut", "mackerel", "anchovies", "anchovy", "sardine", "bass", "trout", "tilapia", "mahi", "swordfish", "fish sauce", "worcestershire", "caesar dressing", "fish stock"],
  salmon:    ["salmon", "smoked salmon", "lox"],
  tuna:      ["tuna", "albacore"],
  anchovy:   ["anchovy", "anchovies", "fish sauce", "worcestershire sauce", "caesar"],

  // Sesame
  sesame:    ["sesame", "sesame oil", "sesame seed", "tahini", "hummus", "til", "gingelly", "benne"],
  tahini:    ["tahini", "sesame", "sesame paste"],

  // Mustard
  mustard:   ["mustard", "mustard seed", "mustard oil", "mustard powder", "mustard leaves", "dijon", "wholegrain mustard"],

  // Celery
  celery:    ["celery", "celeriac", "celery salt", "celery seed", "celery oil"],

  // Sulphites / Sulphur dioxide
  sulphite:  ["sulphite", "sulfite", "sulphur dioxide", "sulfur dioxide", "e220", "e221", "e222", "e223", "e224", "e225", "e226", "e227", "e228", "dried fruit", "wine", "vinegar"],
  sulfite:   ["sulphite", "sulfite", "sulphur dioxide", "sulfur dioxide", "e220"],

  // Lupin
  lupin:     ["lupin", "lupin flour", "lupin seed", "lupin bean"],

  // Molluscs
  mollusc:   ["mussel", "clam", "oyster", "scallop", "squid", "octopus", "snail", "abalone", "cuttlefish"],
  molluscs:  ["mussel", "clam", "oyster", "scallop", "squid", "octopus", "snail", "abalone"],

  // Common spice sensitivities
  garlic:    ["garlic", "garlic powder", "garlic oil", "garlic salt"],
  onion:     ["onion", "onion powder", "shallot", "spring onion", "scallion", "chive"],
  chilli:    ["chilli", "chili", "cayenne", "paprika", "red pepper", "jalapeño", "habanero", "bird's eye", "sriracha"],
  pepper:    ["pepper", "black pepper", "white pepper", "peppercorn"],

  // Colour / additive sensitivities
  msg:       ["msg", "monosodium glutamate", "e621", "yeast extract", "hydrolyzed protein"],
};

// ─── Local matcher (instant, no API call) ─────────────────────────────────────
function localAllergyCheck(userAllergies, ingredientNames) {
  if (!userAllergies.length || !ingredientNames.length) {
    return { alert: false, matches: [] };
  }

  const ingredients = ingredientNames.map(i => i.trim().toLowerCase());
  const matches = [];
  const seen = new Set();

  for (const rawAllergy of userAllergies) {
    const allergy = rawAllergy.trim().toLowerCase();

    // Get synonyms from map, or fall back to just the allergy word itself
    const synonyms = ALLERGY_MAP[allergy] || [allergy];

    for (const ingredient of ingredients) {
      for (const synonym of synonyms) {
        if (ingredient.includes(synonym) || synonym.includes(ingredient)) {
          const key = `${allergy}::${ingredient}`;
          if (!seen.has(key)) {
            seen.add(key);
            matches.push({ allergy: rawAllergy, ingredient, matchedOn: synonym });
          }
          break; // one match per allergy+ingredient pair is enough
        }
      }
    }
  }

  return { alert: matches.length > 0, matches };
}

// ─── Gemini checker ───────────────────────────────────────────────────────────
async function geminiAllergyCheck(userAllergies, ingredientNames) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `You are a food allergy safety expert. A customer has the following allergies:
${userAllergies.map(a => `- ${a}`).join("\n")}

The dish contains these ingredients:
${ingredientNames.map(i => `- ${i}`).join("\n")}

Your job: identify every ingredient that could be harmful to this customer, including:
- Direct matches (e.g. "peanut oil" matches "peanut" allergy)
- Derivatives and synonyms (e.g. "ghee" matches "dairy/milk" allergy, "miso" matches "soy" allergy)
- Hidden sources (e.g. "worcestershire sauce" contains anchovies = fish allergy risk)
- Cross-reactive foods (e.g. "latex-fruit syndrome" - banana, kiwi for latex allergy)
- Scientific/technical names (e.g. "arachis oil" = peanut oil)

Respond ONLY with a valid JSON object, no markdown, no explanation, exactly this shape:
{
  "alert": true or false,
  "matches": [
    { "allergy": "the customer allergy", "ingredient": "the ingredient in the dish", "reason": "brief explanation" }
  ]
}

If no risks found, respond: {"alert":false,"matches":[]}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  // Strip any accidental markdown fences
  const clean = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

  const parsed = JSON.parse(clean);
  return {
    alert: parsed.alert === true,
    matches: parsed.matches || [],
  };
}

// ─── Main export — tries Gemini, falls back to local ─────────────────────────
exports.checkAllergyRisk = async (userAllergies = [], ingredientNames = []) => {
  if (!userAllergies.length || !ingredientNames.length) {
    return { alert: false, matches: [], engine: "none" };
  }

  // Always run local check first — instant
  const localResult = localAllergyCheck(userAllergies, ingredientNames);

  if (!process.env.GEMINI_API_KEY) {
    console.warn("[AllergyChecker] No GEMINI_API_KEY — using local matcher only");
    return { ...localResult, engine: "local" };
  }

  try {
    const geminiResult = await geminiAllergyCheck(userAllergies, ingredientNames);

    // Merge: take union of both results so we never miss something
    const allMatches = [...geminiResult.matches];
    const geminiKeys = new Set(
      geminiResult.matches.map(m => `${m.allergy}::${m.ingredient}`)
    );

    for (const lm of localResult.matches) {
      const key = `${lm.allergy}::${lm.ingredient}`;
      if (!geminiKeys.has(key)) {
        allMatches.push({ allergy: lm.allergy, ingredient: lm.ingredient, reason: "direct/synonym match" });
      }
    }

    return {
      alert: allMatches.length > 0,
      matches: allMatches,
      engine: "gemini",
    };
  } catch (err) {
    console.error("[AllergyChecker] Gemini failed, using local fallback:", err.message);
    return { ...localResult, engine: "local-fallback" };
  }
};