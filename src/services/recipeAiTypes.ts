import { isPanSize, type Category, type PanSize } from "../types";

export interface RecipeAdaptationInput {
  title: string;
  ingredients: string[];
  steps: string[];
  category: Category;
  isCake?: boolean;
  panSize?: PanSize;
  servings?: number;
  aiScalingData?: unknown;
}

export interface RecipeAiVariant {
  ingredients: string[];
  cookingNote: string;
}
// Format of the adaptation-only portion of the historical ai_scaling_data column.
export interface RecipeAiData {
  version: 1;
  fingerprint: string;
  source: "gemini" | "local";
  model: string;
  generatedAt: string;
  kind: "sale" | "sucre";
  servingsMap?: Record<string, RecipeAiVariant>;
  panSizesMap?: Record<string, RecipeAiVariant>;
}
export const SERVING_TARGETS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export const PAN_TARGETS = [20, 26, 28] as const;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

function fingerprintForKind(input: RecipeAdaptationInput, usesPan: boolean): string {
  const lines = (values: string[]) => values.map(line => line.trim()).filter(Boolean);
  const content = JSON.stringify([
    input.title.trim(), input.category, lines(input.ingredients), lines(input.steps),
    usesPan, usesPan ? input.panSize ?? 26 : null, input.servings ?? 2,
  ]);
  let hash = 14695981039346656037n;
  for (const byte of new TextEncoder().encode(content))
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 1099511628211n);
  return `v1-${hash.toString(16).padStart(16, "0")}`;
}

export function recipeAiKind(input: RecipeAdaptationInput): Category {
  const usesPan = input.isCake ?? (isPanSize(input.panSize) || input.category === "sucre");
  if (usesPan) return "sucre";
  // Older versions chose a mould for all sweet recipes even when Supabase
  // recorded them as is_cake=false. Preserve a matching historical mould cache.
  const cached = input.aiScalingData;
  return input.category === "sucre" && record(cached) && cached.version === 1 &&
    cached.kind === "sucre" && cached.fingerprint === fingerprintForKind(input, true) ? "sucre" : "sale";
}

/** Keeps the existing content identifier for stored variants of the same kind. */
export function recipeFingerprint(input: RecipeAdaptationInput): string {
  return fingerprintForKind(input, recipeAiKind(input) === "sucre");
}

export function recipeAiVariantInput(
  input: RecipeAdaptationInput,
  variant: RecipeAiVariant,
  target: number,
): Pick<RecipeAdaptationInput, "ingredients" | "isCake" | "panSize" | "servings"> {
  return recipeAiKind(input) === "sucre"
    ? { ingredients: variant.ingredients, isCake: true, panSize: target as 20 | 26 | 28 }
    : { ingredients: variant.ingredients, servings: target };
}
export function hasFractionalIndivisible(line: string): boolean {
  const match = /^\s*(\d+\s+\d+\s*\/\s*\d+|\d+\s*[¼½¾⅓⅔⅛⅜⅝⅞]|\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])\s*(?:de\s+|d[’']\s*)?(?:(?:petit(?:e)?s?|gros(?:se)?s?|grand(?:e)?s?|moyen(?:ne)?s?)\s+)?(œufs?|oeufs?|steaks?|oignons?|filets?|escalopes?|tomates?|pommes(?: de terre)?|courgettes?|carottes?|gousses?|citrons?|avocats?|concombres?|poivrons?|brocolis?|oranges?|aubergines?)\b/i.exec(line);
  if (!match) return false;
  const text = match[1].replace(",", ".");
  const fraction = ({ "¼": .25, "½": .5, "¾": .75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": .125, "⅜": .375, "⅝": .625, "⅞": .875 } as Record<string, number>)[text.slice(-1)];
  const mixed = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(text);
  const value = fraction !== undefined ? Number(text.slice(0, -1).trim()) + fraction
    : mixed ? (Number(mixed[3]) > 0 ? Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]) : NaN)
    : text.includes("/") ? text.split("/").map(Number).reduce((a, b) => a / b) : Number(text);
  const strictlyWhole = /^(?:œufs?|oeufs?|steaks?|oignons?|filets?|escalopes?|gousses?)$/i.test(match[2]);
  // A half avocado/lemon is a useful culinary amount. Protein pieces, eggs,
  // onions and garlic stay whole; other matched vegetables allow halves only.
  return !Number.isInteger(value * (strictlyWhole ? 1 : 2));
}
/**
 * Reads saved quantities and cooking notes from older recipes. Copy only the
 * keys used by the adaptation so legacy estimates never enter the recipe model.
 */
export function readRecipeAdaptations(value: unknown, input?: RecipeAdaptationInput): RecipeAiData | undefined {
  if (!record(value) || value.version !== 1 || (value.source !== "gemini" && value.source !== "local") || (value.kind !== "sale" && value.kind !== "sucre")) return;
  if (typeof value.fingerprint !== "string" || !/^v1-[a-f0-9]{16}$/.test(value.fingerprint) || typeof value.generatedAt !== "string" || !Number.isFinite(Date.parse(value.generatedAt))) return;
  if (typeof value.model !== "string" || !(value.source === "local" ? ["local-v1", "local-nutrition-v1"].includes(value.model) : /^gemini-[a-z0-9.-]{1,80}$/.test(value.model))) return;
  if (input && (value.kind !== recipeAiKind({ ...input, aiScalingData: value }) ||
    value.fingerprint !== fingerprintForKind(input, value.kind === "sucre"))) return;
  const sweet = value.kind === "sucre", map = sweet ? value.panSizesMap : value.servingsMap;
  const targets = sweet ? PAN_TARGETS : SERVING_TARGETS;
  if (!record(map) || Object.keys(map).length !== targets.length || (sweet ? value.servingsMap != null : value.panSizesMap != null)) return;
  const variants: Record<string, RecipeAiVariant> = {};
  for (const target of targets) {
    const variant = map[String(target)];
    if (!record(variant) || !Array.isArray(variant.ingredients) || !variant.ingredients.length || variant.ingredients.length > 100) return;
    const { ingredients, cookingNote } = variant;
    const baseTarget = input && (sweet ? input.panSize ?? 26 : input.servings ?? 2);
    if (ingredients.some((line, index) => typeof line !== "string" || !line.trim() || line.length > 500 ||
      (hasFractionalIndivisible(line) && !(input && target === baseTarget && line === input.ingredients[index])))) return;
    if (typeof cookingNote !== "string" || cookingNote.length > 1000 || (input && ingredients.length !== input.ingredients.length)) return;
    variants[String(target)] = { ingredients: [...ingredients], cookingNote };
  }
  return {
    version: 1, fingerprint: value.fingerprint, source: value.source,
    model: value.model, generatedAt: value.generatedAt, kind: value.kind,
    ...(sweet ? { panSizesMap: variants } : { servingsMap: variants }),
  };
}

export function isRecipeAiData(value: unknown, input?: RecipeAdaptationInput): value is RecipeAiData {
  return readRecipeAdaptations(value, input) !== undefined;
}

export function hasFreshRecipeAi(recipe: RecipeAdaptationInput & { aiScalingData?: RecipeAiData | null }): boolean {
  return isRecipeAiData(recipe.aiScalingData, recipe);
}
