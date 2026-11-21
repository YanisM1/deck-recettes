export const MANUAL_CALORIES_UNITS = ["per_serving", "per_100g", "total"] as const;
export type ManualCaloriesUnit = (typeof MANUAL_CALORIES_UNITS)[number];
export type ManualCaloriesFields = {
  caloriesValue?: number | null;
  caloriesUnit?: ManualCaloriesUnit | null;
};

export const MAX_MANUAL_CALORIES = 100_000;

export const MANUAL_CALORIES_LABELS: Record<ManualCaloriesUnit, string> = {
  per_serving: "Par part",
  per_100g: "Pour 100 g",
  total: "Au total",
};

export function readManualCalories(value: unknown, unit: unknown) {
  if (
    typeof value !== "number" || !Number.isInteger(value) ||
    value < 0 || value > MAX_MANUAL_CALORIES ||
    !MANUAL_CALORIES_UNITS.some(allowed => allowed === unit)
  ) return null;
  return { caloriesValue: value, caloriesUnit: unit as ManualCaloriesUnit };
}

export function validateManualCalories(value: unknown, unit: unknown) {
  if (value == null) return { caloriesValue: null, caloriesUnit: null };
  const calories = readManualCalories(value, unit);
  if (!calories) throw new Error("Saisissez un nombre entier de calories entre 0 et 100 000 et choisissez son unité.");
  return calories;
}

const kcalUnit: Record<ManualCaloriesUnit, string> = {
  per_serving: "kcal / part",
  per_100g: "kcal / 100 g",
  total: "kcal au total",
};
const numberFormat = new Intl.NumberFormat("fr-FR");

export function formatManualCalories(value: unknown, unit: unknown): string | undefined {
  const calories = readManualCalories(value, unit);
  return calories ? `${numberFormat.format(calories.caloriesValue)} ${kcalUnit[calories.caloriesUnit]}` : undefined;
}
