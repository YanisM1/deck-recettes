import { describe, expect, it } from "vitest";
import type { Recipe } from "../types";
import { buildMergedRecipeDraft } from "./recipeMerge";

const cake: Recipe = {
  id: "11111111-1111-4111-8111-111111111111", title: "Gâteau au chocolat", category: "sucre",
  ingredients: ["200 g de farine", "2 œufs"], steps: ["Mélanger la pâte."], image_url: "data:image/jpeg;base64,original",
  created_at: "2026-01-01", updated_at: "2026-01-01", isCake: true, panSize: 28, servings: 8,
};
const ganache: Recipe = {
  id: "22222222-2222-4222-8222-222222222222", title: "Ganache montée", category: "sucre",
  ingredients: ["150 g de chocolat", "20 cl de crème"], steps: ["Chauffer la crème.", "Fouetter la ganache."], image_url: "",
  created_at: "2026-01-02", updated_at: "2026-01-02", servings: 4,
};

describe("nouvelle recette combinée indépendante", () => {
  it("prépare un nom éditable, une photo vierge et des ingrédients/étapes regroupés sans toucher aux sources", () => {
    const before = structuredClone([cake, ganache]);
    const draft = buildMergedRecipeDraft([cake, ganache]);
    expect(draft).toMatchObject({
      title: "Gâteau au chocolat & Ganache montée", category: "sucre", image_url: "", isCake: true,
      panSize: 28, servings: 8, linkedRecipeIds: [],
      ingredients: ["— Gâteau au chocolat —", "200 g de farine", "2 œufs", "— Ganache montée —", "150 g de chocolat", "20 cl de crème"],
    });
    expect(draft.steps?.slice(0, 5)).toEqual(["— Gâteau au chocolat —", "Mélanger la pâte.", "— Ganache montée —", "Chauffer la crème.", "Fouetter la ganache."]);
    expect(draft.steps?.at(-1)).toContain("Assemblage final");
    expect([cake, ganache]).toEqual(before);
    expect(draft).not.toHaveProperty("id");
    expect(draft).not.toHaveProperty("caloriesInfo");
    expect(draft).not.toHaveProperty("aiScalingData");
  });
  it("impose deux sources au minimum", () => {
    expect(() => buildMergedRecipeDraft([cake])).toThrow("au moins deux");
  });
});
