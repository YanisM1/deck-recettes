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
  String.raw`^(\s*)(${amount})(?:(\s*(?:à|–|—|-)\s*)(${amount}))?(?![\d.,/]|\s*[%×]|\s*x\s*\d)`,
);
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
  return ingredients.map((ingredient) =>
    ingredient.replace(
      atStart,
      (match, whitespace: string, first: string, separator?: string, last?: string) => {
        const start = parseAmount(first) * ratio;
        const end = last ? parseAmount(last) * ratio : undefined;
        if (!Number.isFinite(start) || (end !== undefined && !Number.isFinite(end))) return match;
        return whitespace + numberFormat.format(start) +
          (end === undefined ? "" : separator + numberFormat.format(end));
      },
    ),
  );
}
