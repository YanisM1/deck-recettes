import { cakeFields, isPanSize, type PanSize, type Recipe } from "../types";
import { isRecipe } from "./recipeStore";
export type RecipeRow = {
  [Key in keyof Omit<Recipe, "isCake" | "panSize">]: Recipe[Key];
} & { sync_key: string; is_cake?: boolean | null; pan_size?: PanSize | null };
type DatabaseError = { code?: string; message?: string };
export const BASE_RECIPE_COLUMNS =
  "id,title,category,ingredients,steps,image_url,created_at,updated_at";
export function missingCakeColumns(error: DatabaseError | null) {
  return (
    !!error &&
    ["42703", "PGRST204"].includes(error.code || "") &&
    /is_cake|pan_size/.test(error.message || "")
  );
}
export function toRecipeRow(
  recipe: Recipe,
  key: string,
  includeCake = true,
): RecipeRow {
  const { isCake, panSize, ...legacy } = recipe;
  const normalized = cakeFields({ isCake, panSize });
  return includeCake
    ? {
        ...legacy,
        sync_key: key,
        is_cake: normalized.isCake,
        pan_size: normalized.panSize ?? null,
      }
    : { ...legacy, sync_key: key };
}
export function fromRecipeRow(row: unknown): Recipe {
  if (!isRecipe(row)) throw new Error("Réponse invalide");
  const raw = row as RecipeRow;
  const { is_cake, pan_size, sync_key, ...legacy } = raw;
  return {
    ...legacy,
    isCake: is_cake === true || isPanSize(pan_size),
    panSize: isPanSize(pan_size) ? pan_size : undefined,
  };
}
export async function readCompatible(
  read: (
    columns: string,
  ) => PromiseLike<{ data: unknown[] | null; error: DatabaseError | null }>,
): Promise<Recipe[]> {
  let result = await read(`${BASE_RECIPE_COLUMNS},is_cake,pan_size`);
  if (missingCakeColumns(result.error))
    result = await read(BASE_RECIPE_COLUMNS);
  if (result.error) throw result.error;
  if (!result.data) throw new Error("Réponse invalide");
  return result.data.map(fromRecipeRow);
}
export async function saveCompatible(
  recipe: Recipe,
  key: string,
  write: (row: RecipeRow) => PromiseLike<{ error: DatabaseError | null }>,
): Promise<void> {
  const result = await write(toRecipeRow(recipe, key));
  if (!result.error) return;
  if (!missingCakeColumns(result.error)) throw result.error;
  const fallback = await write(toRecipeRow(recipe, key, false));
  if (fallback.error) throw fallback.error;
  // Conserver la mutation et sa taille localement jusqu'à la migration.
  if (recipe.isCake || recipe.panSize)
    throw new Error(
      "Les informations de moule attendent la mise à jour de la base.",
    );
}
