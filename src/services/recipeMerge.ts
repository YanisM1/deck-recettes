import { isPanSize, type Recipe, type RecipeInput, type PanSize } from "../types";

/** Build an independent, editable draft. Source recipe objects and arrays are never changed. */
export function buildMergedRecipeDraft(sources: readonly Recipe[]): RecipeInput {
  if (sources.length < 2) throw new Error("Choisissez au moins deux recettes à combiner.");
  const title = sources.map(recipe => recipe.title.trim()).filter(Boolean).join(" & ").slice(0, 160);
  if (!title) throw new Error("Les recettes choisies doivent avoir un nom.");

  const ingredients = sources.flatMap(recipe => [
    `— ${recipe.title} —`,
    ...recipe.ingredients.map(line => line.trim()).filter(Boolean),
  ]);
  const steps = sources.flatMap(recipe => [
    `— ${recipe.title} —`,
    ...recipe.steps.map(line => line.trim()).filter(Boolean),
  ]);
  steps.push(`Assemblage final : réunir les préparations ${sources.map(recipe => `« ${recipe.title} »`).join(" et ")}.`);

  const lead = sources[0];
  const isCake = lead.isCake === true || isPanSize(lead.panSize) || lead.category === "sucre";
  const category = isCake ? "sucre" : lead.category;
  const panSize = sources.find(recipe => isPanSize(recipe.panSize))?.panSize as PanSize | undefined;
  const servings = Number.isInteger(lead.servings) && (lead.servings ?? 0) > 0 ? lead.servings : 2;
  return {
    title,
    category,
    ingredients,
    steps,
    image_url: "",
    isCake,
    ...(isCake ? { panSize: panSize ?? 26 } : {}),
    servings,
    linkedRecipeIds: [],
  };
}
