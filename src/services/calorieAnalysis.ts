export interface AnalysisInput {
  title: string;
  ingredients: string[];
  steps: string[];
  category: "sale" | "sucre";
  isCake?: boolean;
  panSize?: 20 | 26 | 28;
  servings?: number;
}

export interface CaloriesInfo {
  type: "gateau" | "plat_sale";
  totalKcal: number;
  cookedWeightGrams: number;
  kcal: number;
  basis: "part" | "100g";
  parts?: 8;
  estimated: true;
  assumptions: string[];
  analyzedAt: string;
  model: string;
  fingerprint: string;
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const positive = (value: unknown, max: number): value is number => typeof value === "number" && Number.isFinite(value) && value > 0 && value <= max;
export function normalizeAnalysisInput(value: unknown): AnalysisInput {
  if (!record(value) || typeof value.title !== "string" || !value.title.trim() || value.title.length > 160 || (value.category !== "sale" && value.category !== "sucre")) throw new Error("La recette à analyser est invalide.");
  const lines = (raw: unknown, maxLength: number) => {
    if (!Array.isArray(raw) || !raw.length || raw.length > 100 || raw.some(line => typeof line !== "string" || line.length > maxLength)) throw new Error("Ajoutez les ingrédients et toutes les étapes de la recette.");
    const cleaned = (raw as string[]).map(line => line.trim()).filter(Boolean);
    if (!cleaned.length) throw new Error("Ajoutez les ingrédients et toutes les étapes de la recette.");
    return cleaned;
  };
  if (value.isCake != null && typeof value.isCake !== "boolean") throw new Error("Le type de recette est invalide.");
  if (value.panSize != null && (typeof value.panSize !== "number" || ![20, 26, 28].includes(value.panSize))) throw new Error("La taille du moule est invalide.");
  if (value.servings != null && (typeof value.servings !== "number" || !Number.isSafeInteger(value.servings) || value.servings < 1 || value.servings > 1000)) throw new Error("Le nombre de portions est invalide.");
  const isCake = value.isCake === true || (value.isCake == null && value.panSize != null);
  return { title: value.title.trim(), category: value.category as AnalysisInput["category"], ingredients: lines(value.ingredients, 500), steps: lines(value.steps, 2000), isCake, panSize: !isCake || value.panSize == null ? undefined : value.panSize as AnalysisInput["panSize"], servings: (value.servings as number | undefined) ?? 2 };
}

// A cache/content identifier, never an authentication token. Image, timestamps,
// and links deliberately do not invalidate a recipe's own ingredient analysis.
export function recipeFingerprint(input: AnalysisInput): string {
  const isCake = input.isCake ?? input.panSize != null;
  const content = JSON.stringify([input.title.trim(), input.category, input.ingredients.map(line => line.trim()).filter(Boolean), input.steps.map(line => line.trim()).filter(Boolean), isCake, isCake ? input.panSize ?? null : null, input.servings ?? 2]);
  let hash = 14695981039346656037n;
  for (const byte of new TextEncoder().encode(content)) hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 1099511628211n);
  return `v1-${hash.toString(16).padStart(16, "0")}`;
}
export function isCaloriesInfo(value: unknown): value is CaloriesInfo {
  if (!record(value)) return false;
  const composite = value.model === "composite-v1";
  if ((value.type !== "gateau" && value.type !== "plat_sale") || !positive(value.totalKcal, composite ? 640_000_000 : 10_000_000) || !positive(value.cookedWeightGrams, composite ? 64_000_000 : 1_000_000) || typeof value.kcal !== "number" || !Number.isFinite(value.kcal) || value.kcal < 0 || value.kcal > 100_000 || value.estimated !== true) return false;
  const cake = value.type === "gateau";
  if (value.basis !== (cake ? "part" : "100g") || (cake ? value.parts !== 8 : value.parts != null)) return false;
  if (Math.round(cake ? value.totalKcal / 8 : value.totalKcal / value.cookedWeightGrams * 100) !== value.kcal) return false;
  return Array.isArray(value.assumptions) && value.assumptions.length <= 12 && value.assumptions.every(line => typeof line === "string" && line.length <= 500) && typeof value.analyzedAt === "string" && Number.isFinite(Date.parse(value.analyzedAt)) && typeof value.model === "string" && (composite || /^gemini-[a-z0-9.-]{1,80}$/.test(value.model)) && typeof value.fingerprint === "string" && /^v1-[a-f0-9]{16}$/.test(value.fingerprint);
}
export function hasFreshCalories(recipe: AnalysisInput & { caloriesInfo?: CaloriesInfo | null }): boolean {
  return isCaloriesInfo(recipe.caloriesInfo) && recipe.caloriesInfo.fingerprint === recipeFingerprint(recipe);
}
