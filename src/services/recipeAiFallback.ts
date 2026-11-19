import { hasFreshCalories, normalizeAnalysisInput, recipeFingerprint, type AnalysisInput, type CaloriesInfo } from "./calorieAnalysis.js";
import { PAN_TARGETS, SERVING_TARGETS, recipeAiKind, recipeAiVariantInput, type RecipeAiData, type RecipeAiVariant } from "./recipeAiTypes.js";
import { estimateLocalNutrition } from "./localNutrition";

const format = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const fractions: Record<string, number> = { "¼": .25, "½": .5, "¾": .75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": .125, "⅜": .375, "⅝": .625, "⅞": .875 };
const prefix = /^(\s*)(\d+\s+\d+\s*\/\s*\d+|\d+\s*[¼½¾⅓⅔⅛⅜⅝⅞]|\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])(\s*)(.*)$/;
const indivisible = /^(?:de\s+|d[’']\s*)?(?:(?:petit(?:e)?s?|gros(?:se)?s?|grand(?:e)?s?|moyen(?:ne)?s?)\s+)?(?:œufs?|oeufs?|steaks?|oignons?|filets?|escalopes?|tomates?|pommes(?: de terre)?|courgettes?|carottes?|gousses?|citrons?|avocats?|concombres?|poivrons?|brocolis?|oranges?|aubergines?)\b/i;
const egg = /^(?:de\s+|d[’']\s*)?(?:(?:petit(?:e)?s?|gros(?:se)?s?|grand(?:e)?s?|moyen(?:ne)?s?)\s+)?(?:œufs?|oeufs?)\b/i;
const seasoning = /\b(?:sel|poivre|huile|épices?|piment|paprika|cumin|muscade|herbes?)\b/i;
const spoon = /^(?:(?:c\.|cuil(?:l[èe]res?)?\.?)\s*(?:à\s*)?(?:soupe|caf[ée])|c[àa][sc]|c\.?\s*(?:à\s*)?[sc]\.?(?=\s|$))/i;
function quantity(text: string) {
  const unicode = fractions[text.slice(-1)];
  if (unicode !== undefined) return Number(text.slice(0, -1).trim()) + unicode;
  const mixed = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(text);
  if (mixed) return Number(mixed[3]) > 0 ? Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]) : NaN;
  const [n, d] = text.replace(",", ".").split("/").map(Number);
  return d === undefined ? n : d > 0 ? n / d : NaN;
}
function adapt(line: string, ratio: number, sweet: boolean) {
  const match = prefix.exec(line);
  if (!match || /^(?:[%×]|x\s*\d|\d|(?:à|au|–|—|-)\s*\d)/i.test(match[4]) || /\d+\s*(?:g|ml|cl|kg)\s+\d/i.test(line)) return line;
  const amount = quantity(match[2]);
  if (!Number.isFinite(amount) || amount <= 0) return line;
  const whole = indivisible.test(match[4]);
  if (ratio === 1 && !whole) return line;
  // The principal whole ingredient stays a piece even when the same line also
  // mentions seasoning (e.g. "1 citron, sel et poivre").
  const factor = !sweet && !whole && seasoning.test(match[4]) ? Math.pow(ratio, .65) : ratio;
  const scaled = amount * factor;
  const result = whole ? Math.max(1, Math.round(scaled)) : spoon.test(match[4]) ? Math.max(.25, Math.round(scaled * 4) / 4) : Math.max(.01, scaled);
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
export function createLocalRecipeAi(raw: AnalysisInput & { caloriesInfo?: CaloriesInfo | null }, options: { reason?: string } = {}): RecipeAiData {
  const input = normalizeAnalysisInput(raw);
  const sweet = recipeAiKind(input) === "sucre", basePan = input.panSize ?? 26, baseServings = input.servings ?? 2;
  const previous = hasFreshCalories(raw) && raw.caloriesInfo!.type === (sweet ? "gateau" : "plat_sale") && raw.caloriesInfo!.totalKcal / raw.caloriesInfo!.cookedWeightGrams * 100 <= 1000 ? raw.caloriesInfo! : undefined;
  const estimate = previous ?? estimateLocalNutrition(input);
  const map: Record<string, RecipeAiVariant> = {};
  for (const target of sweet ? PAN_TARGETS : SERVING_TARGETS) {
    const exact = sweet ? target === basePan : target === baseServings;
    const ratio = sweet ? target * target / (basePan * basePan) : target / baseServings;
    const variant: RecipeAiVariant = {
      ingredients: scaleRecipeIngredients(input, ratio, { pastry: sweet }),
      cookingNote: sweet ? `Adaptation locale indicative pour un moule de ${target} cm. Vérifiez la hauteur de pâte et la cuisson au centre ; le temps dépend du four.` : "Adaptation locale indicative ; goûtez et ajustez les assaisonnements. Les pièces entières sont arrondies.",
    };
    if (exact && estimate && variant.ingredients.every((line, index) => line === input.ingredients[index])) variant.caloriesInfo = { ...estimate, fingerprint: recipeFingerprint(recipeAiVariantInput(input, variant, target)) };
    else if (estimate?.model === "local-nutrition-v1") {
      const variantInput = recipeAiVariantInput(input, variant, target);
      variant.caloriesInfo = estimateLocalNutrition(variantInput);
    }
    map[String(target)] = variant;
  }
  const note = estimate
    ? `Estimation locale indicative fondée sur les ingrédients reconnus.${options.reason ? ` ${options.reason}` : " Les valeurs peuvent différer du plat cuisiné."}`
    : `Aucune estimation locale fiable : vérifiez que les quantités et ingrédients sont reconnus.${options.reason ? ` ${options.reason}` : " Réessayez le calcul IA avec une connexion."}`;
  return { version: 1, fingerprint: recipeFingerprint(input), source: "local", model: "local-v1", generatedAt: new Date(0).toISOString(), kind: recipeAiKind(input),
    note,
    ...(estimate ? { caloriesInfo: estimate } : {}), ...(sweet ? { panSizesMap: map } : { servingsMap: map }) };
}
