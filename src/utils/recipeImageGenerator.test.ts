import { afterEach, describe, expect, it, vi } from "vitest";
import type { Recipe } from "../types";
import {
  canShareRecipeImage,
  downloadRecipeImage,
  generateRecipeImage,
  shareRecipeImage,
} from "./recipeImageGenerator";

const recipe: Recipe = {
  id: "c1",
  title: "Gâteau aux pommes",
  category: "sucre",
  isCake: true,
  panSize: 20,
  image_url: "",
  ingredients: ["3 pommes", "200 g de farine"],
  steps: ["Coupez les pommes.", "Faites cuire à feu doux."],
  created_at: "2026-11-17T08:00:00Z",
  updated_at: "2026-11-17T08:00:00Z",
};

function canvasFixture() {
  const rendered: { value: string; font: string; ink: string; y: number }[] = [];
  const fills: string[] = [];
  const context = {
    fillStyle: "",
    font: "",
    fill() { fills.push(this.fillStyle); },
    fillRect() { fills.push(this.fillStyle); },
    fillText(value: string, _x: number, y: number) {
      rendered.push({ value, font: this.font, ink: this.fillStyle, y });
    },
    measureText: (value: string) => ({ width: Array.from(value).length * 8 }),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    roundRect: vi.fn(),
    clip: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    setLineDash: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    scale: vi.fn(),
  };
  const encoded = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
    this: HTMLCanvasElement,
    callback,
    type,
  ) {
    encoded(this.width, this.height, type);
    callback(new Blob(["png"], { type }));
  });
  const themeElement = document.createElement("article");
  for (const [property, color] of [
    ["--bg-main", "#282a36"],
    ["--bg-card", "#343645"],
    ["--text-main", "#f8f8f2"],
    ["--accent-primary", "#bd93f9"],
    ["--accent-secondary", "#ff79c6"],
  ]) {
    themeElement.style.setProperty(property, color);
  }
  return { context, encoded, fills, rendered, themeElement };
}

function mockPhoto(denied: boolean) {
  const instances: MockImage[] = [];
  class MockImage {
    naturalWidth = 640;
    naturalHeight = 480;
    crossOrigin = "";
    referrerPolicy = "";
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    source = "";

    constructor() {
      instances.push(this);
    }
    set src(url: string) {
      this.source = url;
      queueMicrotask(() => {
        if (denied) this.onerror?.();
        else this.onload?.();
      });
    }
    removeAttribute() {}
  }
  vi.stubGlobal("Image", MockImage);
  return instances;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Affiche PNG de recette", () => {
  it.each(["cards", "book"] as const)(
    "rend le contenu complet et la palette active en mode %s",
    async (layout) => {
      const { context, encoded, fills, rendered, themeElement } = canvasFixture();
      const longStep =
        "Mélangez les pommes et la farine puis ajoutez le beurre fondu doucement avant de garnir le moule.";
      const photo = mockPhoto(false);
      const file = await generateRecipeImage({
        recipe: {
          ...recipe,
          steps: [...recipe.steps, longStep],
          image_url: "/photos/pancakes.jpg",
        },
        layout,
        themeElement,
        ingredients: ["6 pommes", "400 g de farine"],
        servings: 8,
        calories: { value: 250.5, unit: "100g" },
      });

      expect(file.name).toBe("deckchef-gateau-aux-pommes.png");
      expect(file.type).toBe("image/png");
      expect(encoded).toHaveBeenCalledWith(786, expect.any(Number), "image/png");
      expect(context.scale).toHaveBeenCalledWith(2, 2);
      expect(context.drawImage).toHaveBeenCalledWith(photo[0], ...Array(8).fill(expect.any(Number)));
      expect(fills).toEqual(expect.arrayContaining([
        "#282a36", "#343645", "#bd93f9", "#ff79c6",
      ]));
      const text = rendered.map(({ value }) => value);
      expect(text).toEqual(expect.arrayContaining([
        "Gâteau aux pommes", "Sucré", "Moule 20 cm", "8 personnes",
        "250,5 kcal/100 g", "Ingrédients", "6 pommes", "400 g de farine",
        "Préparation", "1", recipe.steps[0], "2", recipe.steps[1],
        "3", "DeckChef",
      ]));
      expect(text.join(" ")).toContain(longStep);
      expect(text).not.toContain("3 pommes");
      const title = rendered.find(({ value }) => value === recipe.title);
      expect(title?.ink).toBe("#f8f8f2");
      expect(title?.font.startsWith("italic")).toBe(layout === "book");
      expect(context.setLineDash).toHaveBeenCalledTimes(layout === "book" ? 1 : 0);
    },
  );

  it("conserve la fin d’une longue recette dans les dimensions iOS", async () => {
    const { encoded, rendered, themeElement } = canvasFixture();
    const steps = Array.from({ length: 180 }, () =>
      "Laissez reposer la pâte puis mélangez jusqu’à ce qu’elle soit souple.",
    );
    await generateRecipeImage({
      recipe: { ...recipe, steps: [...steps, "Servez chaud."] },
      layout: "book",
      themeElement,
    });

    expect(encoded).toHaveBeenCalledWith(expect.any(Number), 8192, "image/png");
    expect(encoded.mock.calls[0][0]).toBeLessThan(786);
    expect(rendered.map(({ value }) => value)).toEqual(expect.arrayContaining([
      "181", "Servez chaud.", "DeckChef",
    ]));
  });

  it("dessine une photo intégrée sans demander CORS", async () => {
    const { context, themeElement } = canvasFixture();
    const photo = mockPhoto(false);
    await generateRecipeImage({
      recipe: { ...recipe, image_url: "data:image/jpeg;base64,abcd" },
      layout: "cards",
      themeElement,
    });

    expect(photo[0].crossOrigin).toBe("");
    expect(context.drawImage).toHaveBeenCalled();
  });

  it("préserve le PNG si le serveur de l’image refuse CORS", async () => {
    const { context, encoded, rendered, themeElement } = canvasFixture();
    const photo = mockPhoto(true);
    await generateRecipeImage({
      recipe: { ...recipe, image_url: "https://images.example.com/photo.jpg" },
      layout: "cards",
      themeElement,
    });

    expect(photo[0].crossOrigin).toBe("anonymous");
    expect(photo[0].referrerPolicy).toBe("no-referrer");
    expect(context.drawImage).not.toHaveBeenCalled();
    expect(rendered.map(({ value }) => value)).toContain("À savourer");
    expect(encoded).toHaveBeenCalled();
  });
});

describe("Envoi et téléchargement du PNG", () => {
  const file = new File(["png"], "deckchef-recette.png", { type: "image/png" });

  it("transmet le fichier natif et le titre à Web Share", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", { share, canShare });

    expect(canShareRecipeImage(file)).toBe(true);
    expect(canShare).toHaveBeenCalledWith({ files: [file] });
    await expect(shareRecipeImage(file, recipe.title)).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({ files: [file], title: recipe.title });
  });

  it("distingue l’annulation d’un partage indisponible", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("", "AbortError"));
    vi.stubGlobal("navigator", { share, canShare: () => true });
    await expect(shareRecipeImage(file, recipe.title)).resolves.toBe("dismissed");

    vi.stubGlobal("navigator", { share, canShare: () => {
      throw new DOMException("", "NotAllowedError");
    } });
    expect(canShareRecipeImage(file)).toBe(false);
    await expect(shareRecipeImage(file, recipe.title)).resolves.toBe("unavailable");
    expect(share).toHaveBeenCalledTimes(1);
  });

  it("télécharge le PNG et libère son URL après utilisation", () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => "blob:recette");
    const revokeObjectURL = vi.fn();
    class DownloadURL extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    }
    vi.stubGlobal("URL", DownloadURL);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function (this: HTMLAnchorElement) {
        expect(this.href).toBe("blob:recette");
        expect(this.download).toBe("deckchef-recette.png");
        expect(this.isConnected).toBe(true);
      },
    );

    downloadRecipeImage(file);
    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector("a[download]")).toBeNull();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runOnlyPendingTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:recette");
  });
});
