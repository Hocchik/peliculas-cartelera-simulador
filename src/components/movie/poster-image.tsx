import { cn } from "@/lib/utils";
import { posterUrl, type PosterSize } from "@/lib/poster";

/**
 * Se usa `<img>` y no `next/image` a propósito: TMDB ya sirve el póster en el
 * tamaño pedido, así que optimizarlo otra vez solo gastaría la cuota de
 * transformaciones de Vercel sin ganar nada.
 */
export function PosterImage({
  path,
  alt,
  size = "w342",
  className,
}: {
  path: string | null;
  alt: string;
  size?: PosterSize;
  className?: string;
}) {
  const src = posterUrl(path, size);

  if (!src) {
    return (
      <div
        className={cn(
          "bg-muted text-muted-foreground flex items-center justify-center p-2 text-center text-xs",
          className,
        )}
      >
        Sin póster
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" className={cn("object-cover", className)} />
  );
}
