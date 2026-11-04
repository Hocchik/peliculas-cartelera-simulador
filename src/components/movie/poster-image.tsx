import { Film } from "lucide-react";

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
    // El texto solo si entra: en las miniaturas del cuadro (16 px) y de los
    // versus (38 px) se desbordaba, así que ahí va un icono. Lo decide el ancho
    // del propio recuadro (container query), no el de la pantalla.
    return (
      <div
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        className={cn(
          "bg-muted text-muted-foreground @container flex items-center justify-center overflow-hidden text-center text-xs",
          className,
        )}
      >
        <Film className="h-auto w-1/2 max-w-5 @[4rem]:hidden" aria-hidden />
        <span className="hidden p-2 @[4rem]:inline">Sin póster</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" className={cn("object-cover", className)} />
  );
}
