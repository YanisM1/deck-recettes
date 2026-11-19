import { memo, useState } from "react";
import { ChefHat } from "lucide-react";
export const RecipeImage = memo(function RecipeImage({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const safe =
    src.startsWith("/photos/") ||
    src.startsWith("data:image/jpeg;base64,") ||
    /^https:\/\//.test(src);
  return safe && !failed ? (
    <img
      src={src}
      alt={alt}
      className={className}
      draggable={false}
      decoding="async"
      onError={() => setFailed(true)}
    />
  ) : (
    <div
      className={`photo-placeholder ${className}`}
      role="img"
      aria-label={alt}
    >
      <ChefHat size={44} />
      <span>À savourer</span>
    </div>
  );
});
