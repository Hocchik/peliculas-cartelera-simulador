"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check, Coins, Crown, Loader2 } from "lucide-react";

import { castVote, decideMatch, flipCoin } from "@/app/sala/[code]/actions";
import { PosterImage } from "@/components/movie/poster-image";
import { cn } from "@/lib/utils";
import type { MatchView, MovieView } from "@/lib/room-types";

/**
 * Una mitad del versus: miniatura + título. Toda la mitad es el botón, así el
 * pulgar no tiene que apuntar. La B va espejada para que el "vs" quede al centro.
 */
function Pick({
  movie,
  chosen,
  dimmed,
  disabled,
  mirrored = false,
  onPick,
}: {
  movie: MovieView;
  chosen: boolean;
  dimmed: boolean;
  disabled: boolean;
  mirrored?: boolean;
  onPick: () => void;
}) {
  // Título bilingüe: el original debajo solo si es distinto; si no, el año.
  const subtitle = movie.originalTitle !== movie.title ? movie.originalTitle : movie.year;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      aria-pressed={chosen}
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 rounded-md p-1.5 text-left transition-colors",
        "hover:bg-accent/60 disabled:cursor-default disabled:hover:bg-transparent",
        mirrored && "flex-row-reverse text-right",
        chosen && "bg-primary/15 ring-primary hover:bg-primary/15 ring-2 ring-inset",
        dimmed && "opacity-55",
      )}
    >
      <span className="relative shrink-0">
        <PosterImage
          path={movie.posterPath}
          alt=""
          size="w92"
          className="h-14 w-[38px] rounded"
        />
        {chosen && (
          <span className="bg-primary text-primary-foreground absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full">
            <Check className="size-3" />
          </span>
        )}
      </span>
      <span className="min-w-0 space-y-0.5">
        <span className="line-clamp-2 text-sm leading-tight font-medium">{movie.title}</span>
        {subtitle && (
          <span className="text-muted-foreground block truncate text-xs">{subtitle}</span>
        )}
      </span>
    </button>
  );
}

/**
 * Un versus en una fila de ~68 px: los 8 de octavos entran en pantalla y media
 * en el celular, en vez de los ~2.500 px que ocupaban con pósters grandes.
 *
 * Mientras está abierto los conteos llegan en `null` y no se muestran; en un
 * empate sí, porque la votación ya cerró y es lo que el host necesita.
 */
export function VoteCard({
  code,
  match,
  isHost,
  hostMode,
}: {
  code: string;
  match: MatchView;
  isHost: boolean;
  /** El host activó "decidir a mano": cada fila muestra a quién hacer pasar. */
  hostMode: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // El voto se marca al instante; si el servidor lo rechaza, vuelve solo al
  // valor real cuando termina la transición.
  const [myChoice, setMyChoice] = useOptimistic(match.myChoice);

  const { movieA, movieB } = match;
  if (!movieA || !movieB) return null;

  const tied = match.status === "tiebreak";
  const voted = myChoice !== null;

  function run(action: () => Promise<{ ok: boolean; error?: string }>, optimistic?: string) {
    setError(null);
    start(async () => {
      if (optimistic) setMyChoice(optimistic);
      const result = await action();
      if (!result.ok) setError(result.error ?? "No se pudo");
    });
  }

  // Mientras el cruce esté abierto se puede cambiar de opinión: tocar la otra
  // reemplaza el voto. Tocar la que ya elegiste no hace nada.
  const vote = (movieId: string) => {
    if (movieId === myChoice) return;
    run(() => castVote({ code, matchId: match.id, choiceMovieId: movieId }), movieId);
  };

  const decide = (movieId: string) =>
    run(() => decideMatch({ code, matchId: match.id, winnerMovieId: movieId }));

  const toss = () => run(() => flipCoin({ code, matchId: match.id }));

  return (
    <li className={cn("bg-card rounded-lg border", tied && "border-primary/60")}>
      <div className="flex items-stretch gap-1 p-1">
        <Pick
          movie={movieA}
          chosen={myChoice === movieA.id}
          dimmed={voted && myChoice !== movieA.id}
          disabled={tied || pending}
          onPick={() => vote(movieA.id)}
        />
        <div className="text-muted-foreground grid w-7 shrink-0 place-items-center text-[10px] font-semibold uppercase">
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : tied ? (
            <span className="text-primary text-xs tabular-nums">
              {match.tally?.a ?? 0}–{match.tally?.b ?? 0}
            </span>
          ) : (
            "vs"
          )}
        </div>
        <Pick
          movie={movieB}
          chosen={myChoice === movieB.id}
          dimmed={voted && myChoice !== movieB.id}
          disabled={tied || pending}
          mirrored
          onPick={() => vote(movieB.id)}
        />
      </div>

      {tied && !isHost && (
        <p className="text-primary border-t px-3 py-1.5 text-center text-xs font-medium">
          Empate: lo decide el host o la moneda
        </p>
      )}

      {(tied ? isHost : hostMode) && (
        <div className="flex items-center gap-1 border-t border-dashed p-1.5">
          <Crown className="text-primary size-3.5 shrink-0" />
          <span className="text-muted-foreground shrink-0 text-[11px]">Pasa:</span>
          {[movieA, movieB].map((movie) => (
            <button
              key={movie.id}
              type="button"
              disabled={pending}
              onClick={() => decide(movie.id)}
              className="bg-muted hover:bg-accent min-w-0 flex-1 truncate rounded px-1.5 py-1 text-[11px] transition-colors disabled:opacity-50"
            >
              {movie.title}
            </button>
          ))}
          {tied && (
            <button
              type="button"
              disabled={pending}
              onClick={toss}
              className="bg-primary text-primary-foreground flex shrink-0 items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-opacity disabled:opacity-50"
            >
              <Coins className="size-3.5" />
              Moneda
            </button>
          )}
        </div>
      )}

      {error && <p className="text-destructive px-3 pb-1.5 text-center text-xs">{error}</p>}
    </li>
  );
}
