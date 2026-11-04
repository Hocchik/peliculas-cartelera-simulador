"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Coins } from "lucide-react";

import { PosterImage } from "@/components/movie/poster-image";
import { Button } from "@/components/ui/button";
import type { MatchView, MovieView } from "@/lib/room-types";

/** Vueltas completas antes de caer. Si gana la B se suma media vuelta. */
const SPINS = 6;
/** Cuánto queda a la vista el resultado antes de cerrarse solo. */
const LINGER_MS = 4000;

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
        className="bg-card w-full max-w-sm space-y-4 rounded-xl border p-6 text-center shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <p
          id="coinflip-title"
          className="text-primary flex items-center justify-center gap-2 text-sm font-semibold"
        >
          <Coins className="size-4" /> Empate: moneda al aire
        </p>

        <p className="text-muted-foreground text-xs">
          {movieA.title} <span className="font-semibold">vs</span> {movieB.title}
        </p>

        <div className="grid h-52 place-items-center [perspective:800px]">
          <div
            className="coin-toss relative size-32"
            style={coinStyle}
            onAnimationEnd={() => setLanded(true)}
          >
            <CoinFace movie={movieA} />
            <CoinFace movie={movieB} back />
          </div>
        </div>

        <p aria-live="polite" className="min-h-7 text-lg font-bold">
          {landed ? `¡Pasa ${winner.title}!` : "…"}
        </p>

        <Button variant="ghost" size="sm" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}

function CoinFace({ movie, back = false }: { movie: MovieView; back?: boolean }) {
  return (
    <div
      className={`coin-face ring-primary bg-muted absolute inset-0 overflow-hidden rounded-full ring-4 ${
        back ? "coin-back" : ""
      }`}
    >
      <PosterImage path={movie.posterPath} alt={movie.title} className="size-full" />
    </div>
  );
}
