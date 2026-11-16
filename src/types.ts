export type Category = "sale" | "sucre";
export type LayoutMode = "cards" | "book";
export interface Recipe {
  id: string;
  title: string;
  category: Category;
  ingredients: string[];
  steps: string[];
  image_url: string;
  created_at: string;
  updated_at: string;
}
export type RecipeInput = Pick<
  Recipe,
  "title" | "category" | "ingredients" | "steps" | "image_url"
>;
export type Filters = Record<Category, boolean>;
export const filterRecipes = (recipes: Recipe[], filters: Filters) =>
  recipes.filter((recipe) => filters[recipe.category]);
