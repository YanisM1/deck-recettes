import { recipeFingerprint, type AnalysisInput, type CaloriesInfo } from "./calorieAnalysis";
import { recipeAiKind } from "./recipeAiTypes";

type Food = { pattern: RegExp; kcal: number; density?: number; grams?: number; tablespoon?: number; teaspoon?: number; retain?: number };

// Broad food averages, deliberately identified as local estimates in the UI.
// Unrecognized caloric ingredients invalidate the estimate rather than being
// silently omitted and making the result look more precise than it is.
const foods: Food[] = [
  { pattern: /huile|huile d olive|huile de tournesol/, kcal: 884, density: .92, tablespoon: 13.8, teaspoon: 4.6, retain: .9 },
  { pattern: /beurre/, kcal: 717, density: .91, tablespoon: 14, teaspoon: 4.7, retain: .98 },
  { pattern: /margarine/, kcal: 717, density: .91, tablespoon: 14, teaspoon: 4.7, retain: .98 },
  { pattern: /chocolat/, kcal: 550, grams: 10 },
  { pattern: /sucre|cassonade|miel|sirop d erable/, kcal: 400, tablespoon: 12, teaspoon: 4 },
  { pattern: /farine|maizena|fecule/, kcal: 364, tablespoon: 8, teaspoon: 2.7 },
  { pattern: /oeufs?/, kcal: 143, grams: 60, tablespoon: 15, teaspoon: 5, retain: .98 },
  { pattern: /creme/, kcal: 300, density: 1, tablespoon: 15, teaspoon: 5, retain: .98 },
  { pattern: /lait|boisson vegetale/, kcal: 60, density: 1.03, tablespoon: 15, teaspoon: 5 },
  { pattern: /fromage|parmesan|gruyere|emmental|mozzarella/, kcal: 350, tablespoon: 10, teaspoon: 3.3 },
  { pattern: /poulet|dinde|canard/, kcal: 165, grams: 150, retain: .76 },
  { pattern: /steak|boeuf|veau|porc|agneau|jambon/, kcal: 220, grams: 125, retain: .76 },
  { pattern: /poisson|saumon|thon|cabillaud|crevette/, kcal: 150, grams: 140, retain: .8 },
  { pattern: /riz/, kcal: 360, retain: 1 },
  { pattern: /pates?|spaghetti|penne|nouilles/, kcal: 350, retain: 1 },
  { pattern: /lentilles|pois chiches|haricots secs/, kcal: 340, retain: 1 },
  { pattern: /pain|chapelure/, kcal: 265, grams: 30 },
  { pattern: /avoine|flocons/, kcal: 370, tablespoon: 5, teaspoon: 1.7 },
  { pattern: /amandes?|noix|noisettes?|noix de coco/, kcal: 600, tablespoon: 8, teaspoon: 2.7 },
  { pattern: /pomme de terre|patate/, kcal: 77, grams: 150, retain: .9 },
  { pattern: /banane/, kcal: 89, grams: 120, retain: .95 },
  { pattern: /pommes?|poires?/, kcal: 52, grams: 150, retain: .95 },
  { pattern: /avocat/, kcal: 160, grams: 150, retain: .95 },
  { pattern: /citron|orange/, kcal: 47, grams: 120, retain: .95 },
  { pattern: /tomates?/, kcal: 18, grams: 120, retain: .9 },
  { pattern: /courgette|concombre|aubergine/, kcal: 20, grams: 250, retain: .85 },
  { pattern: /carottes?/, kcal: 41, grams: 80, retain: .88 },
  { pattern: /oignons?/, kcal: 40, grams: 110, retain: .85 },
  { pattern: /poivron/, kcal: 31, grams: 150, retain: .85 },
  { pattern: /brocoli|chou fleur/, kcal: 34, grams: 300, retain: .9 },
  { pattern: /ail|gousse/, kcal: 149, grams: 3 },
  { pattern: /cacao/, kcal: 228, tablespoon: 6, teaspoon: 2 },
  { pattern: /levure/, kcal: 100, grams: 12, tablespoon: 9, teaspoon: 3 },
  { pattern: /yaourt|yogourt/, kcal: 63, density: 1, grams: 125, tablespoon: 15, teaspoon: 5 },
];
const number = String.raw`(?:\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])`;
const amountPrefix = new RegExp(`^\\s*(${number})\\s*(.*)$`, "i");
const fractions: Record<string, number> = { "¼": .25, "½": .5, "¾": .75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": .125, "⅜": .375, "⅝": .625, "⅞": .875 };

function quantity(text: string): number {
  const trimmed = text.trim();
  const fraction = fractions[trimmed.slice(-1)];
  if (fraction !== undefined) return Number(trimmed.slice(0, -1).trim()) + fraction;
  const mixed = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(trimmed);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  if (trimmed.includes("/")) { const [a, b] = trimmed.split("/").map(Number); return b > 0 ? a / b : NaN; }
  return Number(trimmed.replace(",", "."));
}

function normalize(text: string) {
  return text.toLowerCase().replace(/œ/g, "oe").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ").replace(/[^a-z0-9./\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function separator(line: string) { return /^\s*[-—–]{1,}\s*.+?\s*[-—–]{1,}\s*$/.test(line); }
function trivial(line: string) { return /^(?:eau|sel|poivre|herbes?|basilic|persil|thym|laurier|epices?|piment)(?:\b|$)/.test(line); }

function parseLine(line: string): { kcal: number; grams: number; retain: number } | null {
  if (separator(line)) return { kcal: 0, grams: 0, retain: 1 };
  const match = amountPrefix.exec(line);
  if (!match) return trivial(normalize(line)) ? { kcal: 0, grams: 0, retain: 1 } : null;
  const amount = quantity(match[1]);
  if (!Number.isFinite(amount) || amount < 0) return null;
  let rest = normalize(match[2]).replace(/^(?:de|du|des|d)\s+/, "");
  if (/^(?:a|une?)\s+(?:pincee|noisette)\b/.test(rest)) rest = rest.replace(/^(?:a|une?)\s+(?:pincee|noisette)\s+(?:de\s+)?/, "");
  const unit = /^(kg|kilogrammes?|g|grammes?|ml|millilitres?|cl|centilitres?|l|litres?|sachets?|pincees?|cuilleres?\s+a\s+(?:soupe|cafe)|c\.?\s*a\s*(soupe|cafe)|cas|cac)\b\s*(.*)$/i.exec(rest);
  let measure = "piece", item = rest;
  if (unit) { measure = unit[1].toLowerCase().replace(/\.$/, ""); item = unit[3] || ""; }
  item = item.replace(/^(?:de|du|des|d)\s+/, "");
  const food = foods.find(candidate => candidate.pattern.test(item));
  if (/^(?:eau|sel|poivre|herbes?|basilic|persil|thym|laurier|epices?|piment)(?:\b|$)/.test(item)) {
    const grams = measure === "ml" ? amount : measure === "cl" ? amount * 10 : measure === "l" ? amount * 1000 : measure === "kg" ? amount * 1000 : measure === "g" ? amount : 0;
    return { kcal: 0, grams, retain: 1 };
  }
  if (!food) return null;
  let grams: number;
  if (/^(?:kg|kilogrammes?)$/.test(measure)) grams = amount * 1000;
  else if (/^(?:g|grammes?)$/.test(measure)) grams = amount;
  else if (/^(?:ml|millilitres?)$/.test(measure)) grams = amount * (food.density ?? .95);
  else if (/^(?:cl|centilitres?)$/.test(measure)) grams = amount * 10 * (food.density ?? .95);
  else if (/^(?:l|litres?)$/.test(measure)) grams = amount * 1000 * (food.density ?? .95);
  else if (/^sachets?$/.test(measure)) grams = amount * (food.grams ?? 12);
  else if (/^pincees?$/.test(measure)) grams = amount * (food.grams ?? .5);
  else if (/^(?:cuilleres?|c\.?\s*a\s*(?:soupe|cafe)|cas|cac)$/.test(measure)) {
    const teaspoon = /cafe|cac/.test(measure);
    grams = amount * (teaspoon ? food.teaspoon ?? (food.density ?? .95) * 5 : food.tablespoon ?? (food.density ?? .95) * 15);
  } else grams = amount * (food.grams ?? 0);
  if (!(grams > 0) || !Number.isFinite(grams)) return null;
  return { kcal: grams * food.kcal / 100, grams, retain: food.retain ?? 1 };
}

export function estimateLocalNutrition(input: AnalysisInput): CaloriesInfo | undefined {
  const parsed = input.ingredients.map(parseLine);
  if (!parsed.length || parsed.some(item => item === null)) return undefined;
  const rows = parsed as { kcal: number; grams: number; retain: number }[];
  const totalKcal = rows.reduce((sum, item) => sum + item.kcal, 0);
  const rawWeight = rows.reduce((sum, item) => sum + item.grams, 0);
  if (!(totalKcal > 0 && totalKcal <= 10_000_000 && rawWeight > 0 && rawWeight <= 1_000_000)) return undefined;
  const steps = normalize(input.steps.join(" "));
  const cookingRetention = /bouillir|bouillon|mijoter|soupe|pocher|cuire a l eau/.test(steps) ? .96
    : /cuire|cuisson|four|rotir|griller|poele|frire|sauter/.test(steps) ? .89 : .94;
  const cookedWeightGrams = Math.max(1, rows.reduce((sum, item) => sum + item.grams * item.retain, 0) * cookingRetention);
  const cake = recipeAiKind(input) === "sucre";
  const info: CaloriesInfo = {
    type: cake ? "gateau" : "plat_sale", totalKcal, cookedWeightGrams,
    kcal: Math.round(cake ? totalKcal / 8 : totalKcal / cookedWeightGrams * 100),
    basis: cake ? "part" : "100g", ...(cake ? { parts: 8 as const } : {}), estimated: true,
    assumptions: ["Estimation locale à partir de valeurs moyennes d’ingrédients reconnus.", "Poids cuit estimé : les pertes d’eau et de gras varient selon la recette et la cuisson."],
    analyzedAt: "1970-01-01T00:00:00.000Z", model: "local-nutrition-v1", fingerprint: recipeFingerprint(input),
  };
  return info;
}
