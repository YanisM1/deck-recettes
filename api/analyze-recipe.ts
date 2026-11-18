import { handleAnalyzeRecipe } from "../server/gemini";

export const maxDuration = 60;
export async function POST(request: Request): Promise<Response> {
  return handleAnalyzeRecipe(request);
}
