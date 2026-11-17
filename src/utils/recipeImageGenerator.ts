import { isPanSize, type LayoutMode, type Recipe } from "../types";

const WIDTH = 393;
const MAX_CANVAS_EDGE = 8192;
const ROW_HEIGHT = 22;
const ROW_GAP = 10;
const BADGE_FONT = "600 12px Arial, sans-serif";
const BODY_FONT = "16px Arial, sans-serif";
const BOOK_BODY_FONT = "17px Georgia, serif";
const NUMBER_FORMAT = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
});

interface RecipeImageOptions {
  recipe: Recipe;
  layout: LayoutMode;
  themeElement: HTMLElement;
  ingredients?: readonly string[];
  servings?: number;
  calories?: { value: number; unit: "portion" | "100g" };
}

function readColors(element: HTMLElement, book: boolean) {
  const style = getComputedStyle(element);
  const get = (name: string) => style.getPropertyValue(name).trim();
  const background = get("--bg-main") || get("--bg") || "#faf6f0";
  const panel = get("--bg-card") || get(book ? "--paper" : "--surface");
  const text = get("--text-main") || get("--text") || "#36342f";
  const primary = get("--accent-primary") || "#e07a5f";
  const secondary = get("--accent-secondary") || "#3d405b";
  const binding = get("--binding") || secondary;
  return { background, panel, text, primary, secondary, binding };
}

function loadPhoto(url: string): Promise<HTMLImageElement | null> {
  const embedded = /^data:image\/(?:jpeg|png|webp|gif);base64,/i.test(url);
  if (!embedded && !url.startsWith("/photos/") && !url.startsWith("https://"))
    return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    if (!embedded) image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    const timeout = window.setTimeout(() => finish(null), 8000);
    function finish(photo: HTMLImageElement | null) {
      window.clearTimeout(timeout);
      image.onload = image.onerror = null;
      if (!photo) image.removeAttribute("src");
      resolve(photo);
    }
    image.onload = () =>
      finish(image.naturalWidth && image.naturalHeight ? image : null);
    image.onerror = () => finish(null);
    image.src = url;
  });
}

function wrapText(context: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/u)) {
    let line = "";
    for (const word of paragraph.match(/\S+/gu) ?? []) {
      const next = line ? `${line} ${word}` : word;
      if (context.measureText(next).width <= width) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      if (context.measureText(word).width <= width) {
        line = word;
        continue;
      }
      for (const character of word) {
        if (line && context.measureText(line + character).width > width) {
          lines.push(line);
          line = "";
        }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

function drawLines(
  context: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
) {
  lines.forEach((line, index) =>
    context.fillText(line, x, y + index * lineHeight),
  );
}

function roundedPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function paintPhoto(
  context: CanvasRenderingContext2D,
  photo: HTMLImageElement | null,
  x: number,
  width: number,
  book: boolean,
  colors: ReturnType<typeof readColors>,
) {
  const top = 30;
  const height = 204;
  if (book) {
    context.fillStyle = colors.background;
    context.strokeStyle = colors.secondary;
    context.fillRect(x - 7, top - 7, width + 14, height + 24);
    context.strokeRect(x - 7, top - 7, width + 14, height + 24);
  }
  context.save();
  roundedPath(context, x, top, width, height, book ? 2 : 17);
  context.clip();
  if (photo) {
    const scale = Math.max(
      width / photo.naturalWidth,
      height / photo.naturalHeight,
    );
    const cropWidth = width / scale;
    const cropHeight = height / scale;
    context.drawImage(
      photo,
      (photo.naturalWidth - cropWidth) / 2,
      (photo.naturalHeight - cropHeight) / 2,
      cropWidth,
      cropHeight,
      x,
      top,
      width,
      height,
    );
  } else {
    context.fillStyle = colors.secondary;
    context.globalAlpha = 0.15;
    context.fillRect(x, top, width, height);
    context.globalAlpha = 1;
    context.fillStyle = colors.text;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "italic 25px Georgia, serif";
    context.fillText("À savourer", x + width / 2, top + height / 2);
  }
  context.restore();
}

function paintSurface(
  context: CanvasRenderingContext2D,
  height: number,
  book: boolean,
  colors: ReturnType<typeof readColors>,
) {
  context.fillStyle = colors.background;
  context.fillRect(0, 0, WIDTH, height);
  roundedPath(context, 11, 11, WIDTH - 22, height - 22, book ? 10 : 27);
  context.fillStyle = colors.panel || colors.background;
  context.fill();
  context.strokeStyle = colors.secondary;
  context.stroke();

  if (book) {
    context.save();
    context.clip();
    context.fillStyle = colors.text;
    context.globalAlpha = 0.035;
    for (let y = 12; y < height - 12; y += 5)
      context.fillRect(23, y, WIDTH - 35, 1);
    context.globalAlpha = 1;
    context.fillStyle = colors.binding;
    context.fillRect(11, 11, 17, height - 22);
    context.strokeStyle = colors.primary;
    context.setLineDash([3, 5]);
    context.beginPath();
    context.moveTo(21, 14);
    context.lineTo(21, height - 14);
    context.stroke();
    context.restore();
  } else {
    context.strokeStyle = colors.primary;
    roundedPath(context, 16, 16, WIDTH - 32, height - 32, 23);
    context.stroke();
  }
}

function badgeLabels({ recipe, servings, calories }: RecipeImageOptions) {
  const labels = [recipe.category === "sale" ? "Salé" : "Sucré"];
  if (isPanSize(recipe.panSize)) labels.push(`Moule ${recipe.panSize} cm`);
  if (servings && Number.isInteger(servings) && servings > 0)
    labels.push(`${servings} ${servings === 1 ? "personne" : "personnes"}`);
  if (calories && Number.isFinite(calories.value) && calories.value >= 0)
    labels.push(
      `${NUMBER_FORMAT.format(calories.value)} kcal/${calories.unit === "100g" ? "100 g" : "part"}`,
    );
  return labels;
}

export async function generateRecipeImage(
  options: RecipeImageOptions,
): Promise<File> {
  const {
    recipe,
    layout,
    themeElement,
    ingredients = recipe.ingredients,
  } = options;
  const book = layout === "book";
  const colors = readColors(themeElement, book);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("La création d’image est indisponible.");

  try {
    const photo = await loadPhoto(recipe.image_url);
    const left = book ? 46 : 30;
    const width = WIDTH - left - 30;
    const titleFont = book ? "italic 38px Georgia, serif" : "37px Georgia, serif";
    const bodyFont = book ? BOOK_BODY_FONT : BODY_FONT;
    const titleTop = book ? 270 : 253;
    context.font = titleFont;
    const title = wrapText(context, recipe.title, width);
    context.font = BADGE_FONT;

    let badgeX = left;
    let badgeY = titleTop + title.length * 41 + 11;
    const badges = badgeLabels(options).map((label) => {
      const badgeWidth = context.measureText(label).width + 22;
      if (badgeX > left && badgeX + badgeWidth > left + width) {
        badgeX = left;
        badgeY += 29;
      }
      const badge = { label, x: badgeX, y: badgeY, width: badgeWidth };
      badgeX += badgeWidth + 7;
      return badge;
    });

    const numberWidth = Math.max(
      27,
      context.measureText(String(recipe.steps.length)).width + 12,
    );
    context.font = bodyFont;
    const ingredientLines = ingredients.map((ingredient) =>
      wrapText(context, ingredient, width - 20),
    );
    const stepLines = recipe.steps.map((step) =>
      wrapText(context, step, width - numberWidth - 12),
    );
    const rowsHeight = (rows: string[][]) =>
      rows.reduce((height, lines) => height + lines.length * ROW_HEIGHT + ROW_GAP, 0);
    const ingredientTop = badgeY + 52;
    const stepTop = ingredientTop + 36 + rowsHeight(ingredientLines) + 18;
    const footer = stepTop + 37 + rowsHeight(stepLines) + 13;
    const height = footer + 59;
    const scale = Math.min(2, MAX_CANVAS_EDGE / height);
    canvas.width = Math.max(1, Math.floor(WIDTH * scale));
    canvas.height = Math.min(MAX_CANVAS_EDGE, Math.ceil(height * scale));
    context.scale(canvas.width / WIDTH, canvas.height / height);

    paintSurface(context, height, book, colors);
    paintPhoto(context, photo, left, width, book, colors);
    context.textBaseline = "top";
    context.font = titleFont;
    context.fillStyle = colors.text;
    drawLines(context, title, left, titleTop, 41);

    context.font = BADGE_FONT;
    badges.forEach((badge, index) => {
      roundedPath(context, badge.x, badge.y, badge.width, 23, book ? 4 : 11);
      context.fillStyle = index === 0 ? colors.primary : colors.secondary;
      context.globalAlpha = 0.15;
      context.fill();
      context.globalAlpha = 1;
      context.strokeStyle = index === 0 ? colors.primary : colors.secondary;
      context.stroke();
      context.fillStyle = colors.text;
      context.fillText(badge.label, badge.x + 11, badge.y + 5);
    });

    const drawHeading = (label: string, y: number) => {
      context.font = book ? "italic 28px Georgia, serif" : "25px Georgia, serif";
      context.fillStyle = colors.text;
      context.fillText(label, left, y);
      context.fillStyle = colors.primary;
      context.fillRect(left, y + 28, 31, 2);
      context.font = bodyFont;
      context.fillStyle = colors.text;
    };
    drawHeading("Ingrédients", ingredientTop);
    let y = ingredientTop + 36;
    for (const lines of ingredientLines) {
      context.fillStyle = colors.primary;
      context.beginPath();
      context.arc(left + 4, y + 9, 2.5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = colors.text;
      drawLines(context, lines, left + 16, y, ROW_HEIGHT);
      y += lines.length * ROW_HEIGHT + ROW_GAP;
    }

    drawHeading("Préparation", stepTop);
    y = stepTop + 37;
    stepLines.forEach((lines, index) => {
      roundedPath(context, left, y - 1, numberWidth, 23, book ? 5 : 10);
      context.strokeStyle = colors.primary;
      context.stroke();
      context.font = BADGE_FONT;
      context.textAlign = "center";
      context.fillText(String(index + 1), left + numberWidth / 2, y + 4);
      context.textAlign = "left";
      context.font = bodyFont;
      drawLines(context, lines, left + numberWidth + 9, y, ROW_HEIGHT);
      y += lines.length * ROW_HEIGHT + ROW_GAP;
    });

    const center = left + width / 2;
    context.textAlign = "center";
    context.fillStyle = colors.secondary;
    if (book) {
      context.fillRect(left, footer, width / 2 - 15, 1);
      context.fillRect(center + 15, footer, width / 2 - 15, 1);
      context.font = "16px Georgia, serif";
      context.fillStyle = colors.primary;
      context.fillText("✦", center, footer - 8);
    } else {
      context.fillRect(left, footer, width, 1);
    }
    context.fillStyle = colors.text;
    context.font = book ? "italic 16px Georgia, serif" : BADGE_FONT;
    context.fillText("DeckChef", center, footer + 17);

    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("L’image PNG n’a pas pu être créée."));
      }, "image/png");
    });
    const slug = recipe.title
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 90);
    return new File([png], `deckchef-${slug || "recette"}.png`, {
      type: "image/png",
    });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

export function canShareRecipeImage(file: File) {
  try {
    return (
      typeof navigator.share === "function" &&
      (typeof navigator.canShare !== "function" ||
        navigator.canShare({ files: [file] }))
    );
  } catch {
    return false;
  }
}

export async function shareRecipeImage(
  file: File,
  title: string,
): Promise<"shared" | "dismissed" | "unavailable"> {
  try {
    if (!canShareRecipeImage(file)) return "unavailable";
    await navigator.share({ files: [file], title });
    return "shared";
  } catch (error) {
    return (error as Error | null)?.name === "AbortError"
      ? "dismissed"
      : "unavailable";
  }
}

export function downloadRecipeImage(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}
