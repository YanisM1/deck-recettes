import { useState } from "react";
import { ChefHat } from "lucide-react";
export function RecipeImage({
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
}
