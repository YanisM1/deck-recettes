const fractions: Record<string, number> = {
  "¼": 1 / 4,
  "½": 1 / 2,
  "¾": 3 / 4,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 1 / 8,
  "⅜": 3 / 8,
  "⅝": 5 / 8,
  "⅞": 7 / 8,
};
const fractionCharacters = Object.keys(fractions).join("");
const amount = String.raw`(?:\d+\s+\d+/\d+|\d+/\d+|(?:\d+\s*)?[${fractionCharacters}]|\d+(?:[.,]\d+)?)`;
const atStart = new RegExp(
  String.raw`^(\s*)(${amount})(?:(\s*(?:à|–|—|-)\s*)(${amount}))?`,
);
const measurement = String.raw`${amount}\s*(?:kg|mg|g|ml|cl|dl|l)`;
const compoundMeasurement = new RegExp(
  String.raw`^\s*${measurement}(?:\s+${measurement})+(?=$|\s)`,
  "i",
);
const amounts = new RegExp(amount, "g");
const unscalableSuffix = /^(?:[\d.,/]|\s*[%×]|\s*x\s*\d|\s+\d)/;
const numberFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 });

function parseAmount(value: string) {
  const fraction = fractions[value.slice(-1)];
  if (fraction) return Number(value.slice(0, -1).trim()) + fraction;
  if (value.includes("/")) {
    const [numerator, denominator] = value.split("/");
    const [first, second] = numerator.split(/\s+/).map(Number);
    return second === undefined
      ? first / Number(denominator)
      : first + second / Number(denominator);
  }
  return Number(value.replace(",", "."));
}

export function scaleIngredients(
  ingredients: readonly string[],
  originalServings: number,
  servings: number,
) {
  if (!(originalServings > 0) || !(servings > 0) || originalServings === servings) {
    return [...ingredients];
  }
  const ratio = servings / originalServings;
  return ingredients.map((ingredient) => {
    const compound = compoundMeasurement.exec(ingredient);
    if (compound) {
      let valid = true;
      const scaled = compound[0].replace(amounts, (value) => {
        const result = parseAmount(value) * ratio;
        if (!Number.isFinite(result)) valid = false;
        return numberFormat.format(result);
      });
      return valid ? scaled + ingredient.slice(compound[0].length) : ingredient;
    }
    const match = atStart.exec(ingredient);
    if (!match || unscalableSuffix.test(ingredient.slice(match[0].length))) {
      return ingredient;
    }
    const [, whitespace, first, separator, last] = match;
    const start = parseAmount(first) * ratio;
    const end = last ? parseAmount(last) * ratio : undefined;
    if (!Number.isFinite(start) || (end !== undefined && !Number.isFinite(end))) {
      return ingredient;
    }
    return whitespace + numberFormat.format(start) +
      (end === undefined ? "" : separator + numberFormat.format(end)) +
      ingredient.slice(match[0].length);
  });
}
