import { hasFreshCalories, normalizeAnalysisInput, recipeFingerprint, type AnalysisInput, type CaloriesInfo } from "./calorieAnalysis.js";
import { PAN_TARGETS, SERVING_TARGETS, recipeAiKind, recipeAiVariantInput, type RecipeAiData, type RecipeAiVariant } from "./recipeAiTypes.js";

const format = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const fractions: Record<string, number> = { "¼": .25, "½": .5, "¾": .75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": .125 };
const prefix = /^(\s*)(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?|[¼½¾⅓⅔⅛])(\s*)(.*)$/;
const indivisible = /^(?:de\s+|d[’']\s*)?(?:œufs?|oeufs?|steaks?|oignons?|filets?|escalopes?|tomates?|pommes(?: de terre)?|courgettes?|carottes?|gousses?)\b/i;
const egg = /^(?:de\s+|d[’']\s*)?(?:œufs?|oeufs?)\b/i;
const seasoning = /\b(?:sel|poivre|huile|épices?|piment|paprika|cumin|muscade|herbes?)\b/i;
function quantity(text: string) {
  if (fractions[text] !== undefined) return fractions[text];
  const [n, d] = text.replace(",", ".").split("/").map(Number);
  return d ? n / d : n;
}
function adapt(line: string, ratio: number, sweet: boolean) {
  const match = prefix.exec(line);
  if (!match || /^(?:[%×]|x\s*\d|\d)/i.test(match[4]) || /\d+\s*(?:g|ml|cl|kg)\s+\d/i.test(line)) return line;
  const amount = quantity(match[2]);
  if (!Number.isFinite(amount) || amount <= 0) return line;
  const factor = !sweet && seasoning.test(match[4]) ? Math.pow(ratio, .65) : ratio;
  const result = indivisible.test(match[4]) ? Math.max(1, Math.round(amount * factor)) : Math.max(.01, amount * factor);
  return match[1] + format.format(result) + match[3] + match[4];
}
export function scaleRecipeIngredients(input: AnalysisInput, factor: number, options: { pastry?: boolean } = {}): string[] {
  if (!Number.isFinite(factor) || factor <= 0) return [...input.ingredients];
  const pastry = options.pastry ?? recipeAiKind(input) === "sucre";
  let ratio = factor;
  if (pastry && factor !== 1) {
    const eggs = input.ingredients.map(line => prefix.exec(line)).find(match => match && egg.test(match[4]));
    if (eggs) { const count = quantity(eggs[2]); if (count > 0) ratio = Math.max(1, Math.round(count * factor)) / count; }
  }
  return input.ingredients.map(line => adapt(line, ratio, pastry));
}
// Conservative offline arithmetic, explicitly not presented as an AI analysis.
// Unknown ingredients never produce invented nutritional values.
export function createLocalRecipeAi(raw: AnalysisInput & { caloriesInfo?: CaloriesInfo | null }): RecipeAiData {
  const input = normalizeAnalysisInput(raw);
  const sweet = recipeAiKind(input) === "sucre", basePan = input.panSize ?? 26, baseServings = input.servings ?? 2;
  const known = hasFreshCalories(raw) && raw.caloriesInfo!.type === (sweet ? "gateau" : "plat_sale") && raw.caloriesInfo!.totalKcal / raw.caloriesInfo!.cookedWeightGrams * 100 <= 1000 ? raw.caloriesInfo! : undefined;
  const map: Record<string, RecipeAiVariant> = {};
  for (const target of sweet ? PAN_TARGETS : SERVING_TARGETS) {
    const exact = sweet ? target === basePan : target === baseServings;
    const ratio = sweet ? target * target / (basePan * basePan) : target / baseServings;
    const variant: RecipeAiVariant = {
      ingredients: scaleRecipeIngredients(input, ratio, { pastry: sweet }),
      cookingNote: sweet ? `Adaptation locale indicative pour un moule de ${target} cm. Vérifiez la hauteur de pâte et la cuisson au centre ; le temps dépend du four.` : "Adaptation locale indicative ; goûtez et ajustez les assaisonnements. Les pièces entières sont arrondies.",
    };
    if (exact && known && variant.ingredients.every((line, index) => line === input.ingredients[index])) variant.caloriesInfo = { ...known, fingerprint: recipeFingerprint(recipeAiVariantInput(input, variant, target)) };
    map[String(target)] = variant;
  }
  return { version: 1, fingerprint: recipeFingerprint(input), source: "local", model: "local-v1", generatedAt: new Date(0).toISOString(), kind: recipeAiKind(input),
    note: "Mode local : quantités indicatives, sans nouvelle estimation calorique. Relancez l’IA avec une connexion pour enrichir la recette.",
    ...(known ? { caloriesInfo: known } : {}), ...(sweet ? { panSizesMap: map } : { servingsMap: map }) };
}
