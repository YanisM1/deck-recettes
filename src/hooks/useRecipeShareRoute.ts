import { useEffect, useState } from "react";
import { fetchLinkedRecipe } from "../services/recipeSync";
import {
  clearRecipeShareRoute,
  decodeRecipeShareSnapshot,
  readRecipeShareRoute,
} from "../services/recipeShareLink";
import type { Recipe } from "../types";

export function useRecipeShareRoute(recipes: readonly Recipe[]) {
  const [route, setRoute] = useState(() => readRecipeShareRoute());
  const [resolved, setResolved] = useState<{
    route: NonNullable<typeof route>;
    recipe: Recipe | null;
  }>();
  const guest = !!(route?.token || route?.snapshot || route?.invalid);
  const cached = route && !guest ? recipes.find((r) => r.id === route.id) : null;

  useEffect(() => {
    if (!route || route.invalid || cached) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let active = true;

    async function resolve(link: NonNullable<typeof route>) {
      let recipe: Recipe | null = null;
      try {
        if (link.token || !link.snapshot) {
          recipe = await fetchLinkedRecipe(link.id, link.token, controller.signal);
        }
      } catch {
        // Le lien peut encore contenir une copie portable.
      }
      if (!recipe && link.snapshot && active) {
        recipe = await decodeRecipeShareSnapshot(link.snapshot, link.id);
      }
      if (active) setResolved({ route: link, recipe });
    }

    void resolve(route).finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [route, cached]);

  const result = resolved?.route === route ? resolved : undefined;
  return {
    route,
    recipe: cached ?? result?.recipe,
    editable: !guest && !!cached,
    loading: !!route && !route.invalid && !cached && !result,
    close() {
      if (route) clearRecipeShareRoute();
      setRoute(null);
    },
  };
}
