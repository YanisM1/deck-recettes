import { isCaloriesInfo, recipeFingerprint, type AnalysisInput, type CaloriesInfo } from "./calorieAnalysis.js";

export interface RecipeAiVariant {
  ingredients: string[];
  cookingNote: string;
  caloriesInfo?: CaloriesInfo;
}
export interface RecipeAiData {
  version: 1;
  fingerprint: string;
  source: "gemini" | "local";
  model: string;
  generatedAt: string;
  kind: "sale" | "sucre";
  caloriesInfo?: CaloriesInfo;
  note: string;
  servingsMap?: Record<string, RecipeAiVariant>;
  panSizesMap?: Record<string, RecipeAiVariant>;
}
export const SERVING_TARGETS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export const PAN_TARGETS = [20, 26, 28] as const;
export const recipeAiKind = (input: AnalysisInput): "sale" | "sucre" => input.isCake || input.category === "sucre" || (input.isCake == null && input.panSize != null) ? "sucre" : "sale";
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

export function recipeAiVariantInput(input: AnalysisInput, variant: RecipeAiVariant, target: number): AnalysisInput {
  return recipeAiKind(input) === "sucre"
    ? { ...input, ingredients: variant.ingredients, isCake: true, panSize: target as 20 | 26 | 28 }
    : { ...input, ingredients: variant.ingredients, servings: target };
}
export function hasFractionalIndivisible(line: string): boolean {
  const match = /^\s*(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?|[¼½¾⅓⅔⅛])\s*(?:de\s+|d[’']\s*)?(œufs?|oeufs?|steaks?|oignons?|filets?|escalopes?|tomates?|pommes(?: de terre)?|courgettes?|carottes?|gousses?)\b/i.exec(line);
  if (!match) return false;
  const text = match[1].replace(",", ".");
  const value = text.includes("/") ? text.split("/").map(Number).reduce((a, b) => a / b) : Number(text);
  return !Number.isInteger(value);
}
export function isRecipeAiData(value: unknown, input?: AnalysisInput): value is RecipeAiData {
  if (!record(value) || value.version !== 1 || !["gemini", "local"].includes(String(value.source)) || !["sale", "sucre"].includes(String(value.kind))) return false;
  if (typeof value.fingerprint !== "string" || !/^v1-[a-f0-9]{16}$/.test(value.fingerprint) || typeof value.generatedAt !== "string" || !Number.isFinite(Date.parse(value.generatedAt))) return false;
  if (typeof value.model !== "string" || !(value.source === "local" ? value.model === "local-v1" : /^gemini-[a-z0-9.-]{1,80}$/.test(value.model))) return false;
  if (typeof value.note !== "string" || value.note.length > 1000 || (value.caloriesInfo != null && !isCaloriesInfo(value.caloriesInfo))) return false;
  if (value.source === "gemini" && (!value.caloriesInfo || !String(value.caloriesInfo.model).startsWith("gemini-"))) return false;
  if (input && (value.fingerprint !== recipeFingerprint(input) || value.kind !== recipeAiKind(input) || (value.caloriesInfo && value.caloriesInfo.fingerprint !== recipeFingerprint(input)))) return false;
  const sweet = value.kind === "sucre", map = sweet ? value.panSizesMap : value.servingsMap;
  const validNutrition = (info: unknown): info is CaloriesInfo => isCaloriesInfo(info) && info.type === (sweet ? "gateau" : "plat_sale") && info.totalKcal / info.cookedWeightGrams * 100 <= 1000 && (value.source !== "gemini" || info.model === value.model);
  if (value.caloriesInfo != null && !validNutrition(value.caloriesInfo)) return false;
  const targets = sweet ? PAN_TARGETS : SERVING_TARGETS;
  if (!record(map) || Object.keys(map).length !== targets.length || (sweet ? value.servingsMap != null : value.panSizesMap != null)) return false;
  for (const target of targets) {
    const variant = map[String(target)];
    if (!record(variant) || !Array.isArray(variant.ingredients) || !variant.ingredients.length || variant.ingredients.length > 100 || variant.ingredients.some(line => typeof line !== "string" || !line.trim() || line.length > 500 || hasFractionalIndivisible(line))) return false;
    if (typeof variant.cookingNote !== "string" || variant.cookingNote.length > 1000 || (variant.caloriesInfo != null && !validNutrition(variant.caloriesInfo))) return false;
    if (value.source === "gemini" && (!variant.caloriesInfo || !String(variant.caloriesInfo.model).startsWith("gemini-"))) return false;
    if (input && (variant.ingredients.length !== input.ingredients.length || (variant.caloriesInfo && variant.caloriesInfo.fingerprint !== recipeFingerprint(recipeAiVariantInput(input, variant as unknown as RecipeAiVariant, target))))) return false;
  }
  return true;
}
export function hasFreshRecipeAi(recipe: AnalysisInput & { aiScalingData?: RecipeAiData | null }): boolean {
  return isRecipeAiData(recipe.aiScalingData, recipe);
}
