import { useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import {
  buildRecipeShareUrl,
  createRecipeShareToken,
  encodeRecipeShareSnapshot,
  readRecipeShareRoute,
  shareRecipeLink,
} from "../services/recipeShareLink";
import { getCollectionKey } from "../services/recipeSync";
import type { Recipe } from "../types";

export function RecipeLinkShare({
  recipe,
  synchronized,
  shared,
}: {
  recipe: Recipe;
  synchronized: boolean;
  shared?: boolean;
}) {
  const [url, setUrl] = useState<string | null>();
  const [status, setStatus] = useState("");
  const [manual, setManual] = useState(false);

  useEffect(() => {
    let active = true;
    async function prepare() {
      if (shared) {
        const route = readRecipeShareRoute();
        if (route?.token || route?.snapshot) return buildRecipeShareUrl(recipe.id, route);
      }
      const token = synchronized
        ? await createRecipeShareToken(recipe.id, getCollectionKey())
        : null;
      if (token) return buildRecipeShareUrl(recipe.id, { token });
      const snapshot = await encodeRecipeShareSnapshot(recipe);
      return snapshot ? buildRecipeShareUrl(recipe.id, { snapshot }) : null;
    }
    void prepare().then(
      (link) => { if (active) setUrl(link); },
      () => { if (active) setUrl(null); },
    );
    return () => { active = false; };
  }, [recipe, shared, synchronized]);

  return (
    <div className="recipe-link-share">
      <button
        className="secondary-button"
        disabled={!url}
        onClick={() => {
          if (!url) return;
          void shareRecipeLink(recipe, url).then(({ copied, shared }) => {
            setManual(!copied);
            setStatus(copied ? "✅ Lien copié !" : shared ? "Lien partagé." : "");
          });
        }}
      >
        <Link2 size={16} aria-hidden="true" /> Partager le lien de la recette
      </button>
      {url === null && (
        <p role="status">Le lien n’est pas disponible pour cette recette.</p>
      )}
      {status && <p role="status">{status}</p>}
      {manual && url && (
        <input
          aria-label="Lien de la recette à copier"
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
    </div>
  );
}
