"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Coins } from "lucide-react";

import { PosterImage } from "@/components/movie/poster-image";
import { Button } from "@/components/ui/button";
import type { MatchView, MovieView } from "@/lib/room-types";

/** Vueltas completas en el aire. Si gana la B (sello) se suma media vuelta. */
const SPINS = 7;
/** Cuánto queda a la vista el resultado antes de cerrarse solo. */
const LINGER_MS = 4500;
/** Discos del canto, en px desde el centro. Las caras van en ±5. */
const EDGE_LAYERS = [-4, -3, -2, -1, 0, 1, 2, 3, 4];

/**
 * Muestra a todos la moneda de un desempate. No decide nada: el cruce llega con
 * `decided_by = 'coinflip'` y el ganador ya grabado en el servidor, y la moneda
 * solo cae del lado que corresponde (invariante 5).
 *
 * Las monedas que ya estaban tiradas al abrir la página no se repiten: solo se
 * anima la que aparece mientras uno mira, por el latido o por la propia acción
 * del host. Vive en `page.tsx` y no dentro de una fase para que la moneda de la
 * final se vea aunque la sala pase a `finished` en el mismo refresh.
 */
export function CoinflipReveal({ matches }: { matches: MatchView[] }) {
  const flips = matches.filter((match) => match.decidedBy === "coinflip");
  const [seen, setSeen] = useState(() => new Set(flips.map((match) => match.id)));
  const [queue, setQueue] = useState<MatchView[]>([]);

  const fresh = flips.filter((match) => !seen.has(match.id));
  if (fresh.length > 0) {
    // Ajuste de estado durante el render, el patrón que recomienda React para
    // reaccionar a props nuevas sin un efecto ni un render intermedio.
    setSeen(new Set([...seen, ...fresh.map((match) => match.id)]));
    setQueue([...queue, ...fresh]);
  }

  const dismiss = useCallback(() => setQueue((pending) => pending.slice(1)), []);

  const current = queue[0];
  if (!current?.movieA || !current.movieB) return null;

  return (
    <CoinToss
      key={current.id}
      movieA={current.movieA}
      movieB={current.movieB}
      winnerId={current.winnerId}
      onClose={dismiss}
    />
  );
}

function CoinToss({
  movieA,
  movieB,
  winnerId,
  onClose,
}: {
  movieA: MovieView;
  movieB: MovieView;
  winnerId: string | null;
  onClose: () => void;
}) {
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    if (!landed) return;
    const timer = setTimeout(onClose, LINGER_MS);
    return () => clearTimeout(timer);
  }, [landed, onClose]);

  const winnerIsA = winnerId === movieA.id;
  const winner = winnerIsA ? movieA : movieB;
  const coinStyle = {
    "--coin-end": `${SPINS * 360 + (winnerIsA ? 0 : 180)}deg`,
  } as CSSProperties;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="coinflip-title"
      className="bg-background/80 fixed inset-0 z-50 grid place-items-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card w-full max-w-sm space-y-3 rounded-xl border p-6 text-center shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <p
          id="coinflip-title"
          className="text-primary flex items-center justify-center gap-2 text-sm font-semibold"
        >
          <Coins className="size-4" /> Empate: ¿cara o sello?
        </p>

        {/* Antes de lanzarla queda claro qué lado es cuál. */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          {[
            { side: "Cara", movie: movieA },
            { side: "Sello", movie: movieB },
          ].map(({ side, movie }) => (
            <p key={side} className="min-w-0">
              <span className="text-muted-foreground block text-[10px] font-semibold tracking-wide uppercase">
                {side}
              </span>
              <span className="line-clamp-2 font-medium">{movie.title}</span>
            </p>
          ))}
        </div>

        <div className="coin-scene" data-landed={landed || undefined}>
          <div className="coin-table">
            <div className="coin-shadow" />
            <div
              className="coin-lift"
              onAnimationEnd={(event) => {
                // `animationend` sube desde el giro de adentro: solo cuenta el
                // de la caída, que es el que termina con la moneda en el piso.
                if (event.target === event.currentTarget) setLanded(true);
              }}
            >
              <div className="coin" style={coinStyle}>
                <CoinFace movie={movieA} />
                {EDGE_LAYERS.map((z) => (
                  <span key={z} className="coin-edge" style={{ transform: `translateZ(${z}px)` }} />
                ))}
                <CoinFace movie={movieB} back />
              </div>
            </div>
          </div>
        </div>

        <div aria-live="polite" className="min-h-14">
          {landed ? (
            <div className="animate-in fade-in zoom-in-75 duration-500">
              <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                Salió {winnerIsA ? "cara" : "sello"}
              </p>
              <p className="text-lg font-bold">¡Pasa {winner.title}!</p>
            </div>
          ) : (
            <p className="text-muted-foreground pt-3 text-sm">La moneda está en el aire…</p>
          )}
        </div>

        <Button variant="ghost" size="sm" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}

function CoinFace({ movie, back = false }: { movie: MovieView; back?: boolean }) {
  return (
    <div className="coin-face bg-muted" data-back={back || undefined}>
      <PosterImage path={movie.posterPath} alt="" className="size-full" />
    </div>
  );
}
