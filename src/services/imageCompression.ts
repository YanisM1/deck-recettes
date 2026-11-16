export function imageDimensions(width: number, height: number, max = 1000) {
  const ratio = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}
export async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choisissez une image.");
  if (file.size > 25 * 1024 * 1024)
    throw new Error("Cette photo est trop volumineuse (25 Mo maximum).");
  const url = URL.createObjectURL(file),
    image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(
          new Error(
            "Cette photo ne peut pas être lue. Essayez une image JPEG ou PNG.",
          ),
        );
      image.src = url;
    });
    const { width, height } = imageDimensions(
      image.naturalWidth,
      image.naturalHeight,
    );
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("La compression photo est indisponible.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const result = canvas.toDataURL("image/jpeg", 0.75);
    if (!result.startsWith("data:image/jpeg;"))
      throw new Error("La photo n’a pas pu être enregistrée.");
    return result;
  } finally {
    URL.revokeObjectURL(url);
  }
}
