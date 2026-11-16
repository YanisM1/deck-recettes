import sharp from "sharp";
await Promise.all(
  [192, 512, 180].map((size) =>
    sharp("public/icon.svg")
      .resize(size, size)
      .png()
      .toFile(
        `public/${size === 180 ? "apple-touch-icon" : `icon-${size}`}.png`,
      ),
  ),
);
