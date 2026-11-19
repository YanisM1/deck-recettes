import { handleRecipeAi } from "../server/recipeAi.js";

export const maxDuration = 60;
export async function POST(request: Request): Promise<Response> {
  return handleRecipeAi(request);
}
