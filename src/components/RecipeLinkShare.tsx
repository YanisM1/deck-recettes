import { useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import {
  buildRecipeShareUrl,
  encodeRecipeShareSnapshot,
  readRecipeShareRoute,
  shareRecipeLink,
} from "../services/recipeShareLink";
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
  const [prepared, setPrepared] = useState<{
    recipe: Recipe;
    synchronized: boolean;
    url: string | null;
    textOnly: boolean;
  }>();
  const [status, setStatus] = useState("");
  const [manual, setManual] = useState(false);
  const [sharing, setSharing] = useState(false);
  const url = prepared?.recipe === recipe && prepared.synchronized === synchronized
    ? prepared.url
    : undefined;

  useEffect(() => {
    let active = true;
    async function prepare() {
      if (synchronized) return { url: buildRecipeShareUrl(recipe.id), textOnly: false };
      if (shared) {
        const route = readRecipeShareRoute();
        if (route?.snapshot) {
          return { url: buildRecipeShareUrl(recipe.id, { snapshot: route.snapshot }), textOnly: false };
        }
      }
      const snapshot = await encodeRecipeShareSnapshot(recipe);
      return {
        url: snapshot ? buildRecipeShareUrl(recipe.id, { snapshot }) : null,
        textOnly: !!recipe.image_url && !recipe.image_url.startsWith("https://") &&
          !recipe.image_url.startsWith("/photos/"),
      };
    }
    void prepare().catch(() => ({ url: null, textOnly: false })).then((result) => {
      if (active) setPrepared({ recipe, synchronized, ...result });
    });
    return () => { active = false; };
  }, [recipe, shared, synchronized]);

  return (
    <div className="recipe-link-share">
      <button
        className="share-option"
        disabled={!url || sharing}
        onClick={() => {
          if (!url) return;
          setSharing(true);
          void shareRecipeLink(recipe, url).then(({ copied, shared }) => {
            setManual(!copied);
            setStatus(copied ? "✅ Lien copié !" : shared ? "Lien partagé." : "");
          }).finally(() => setSharing(false));
        }}
      >
        <span className="share-option-icon share-option-link">
          <Link2 size={20} aria-hidden="true" />
        </span>
        <span>Partager le lien de la recette</span>
      </button>
      {url && prepared?.textOnly && (
        <p className="share-link-note">
          Le lien contient le texte de la recette. Le partage en photo inclut aussi l’image du plat.
        </p>
      )}
      {url === null && (
        <p role="status">Le lien n’est pas disponible pour cette recette.</p>
      )}
      {status && <p className="share-link-toast" role="status">{status}</p>}
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
