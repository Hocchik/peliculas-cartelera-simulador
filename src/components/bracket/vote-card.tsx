"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check, Coins, Crown, Loader2, Scale } from "lucide-react";

import { castVote, decideMatch, flipCoin } from "@/app/sala/[code]/actions";
import { PosterImage } from "@/components/movie/poster-image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MatchView, MovieView } from "@/lib/room-types";

function Side({
  movie,
  chosen,
  dimmed,
  disabled,
  onPick,
}: {
  movie: MovieView;
  chosen: boolean;
  dimmed: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      className={cn(
        "relative flex-1 overflow-hidden rounded-lg ring-2 transition-all",
        chosen ? "ring-primary" : "ring-transparent",
        dimmed && "opacity-40",
      )}
    >
      <PosterImage path={movie.posterPath} alt={movie.title} className="aspect-[2/3] w-full" />
      {chosen && (
        <span className="bg-primary text-primary-foreground absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full">
          <Check className="size-4" />
        </span>
      )}
      <span className="bg-background/85 absolute inset-x-0 bottom-0 line-clamp-2 p-1.5 text-xs leading-tight font-medium backdrop-blur">
        {movie.title}
      </span>
    </button>
  );
}

/**
 * Un versus. Mientras está abierto los conteos llegan en `null` y no se pueden
 * mostrar; en un empate sí, porque la votación ya cerró y es lo que el host
 * necesita para decidir.
 */
export function VoteCard({
  code,
  match,
  isHost,
}: {
  code: string;
  match: MatchView;
  isHost: boolean;
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
    <li className="space-y-2">
      <div className="flex items-stretch gap-2">
        <Side
          movie={movieA}
          chosen={myChoice === movieA.id}
          dimmed={voted && myChoice !== movieA.id}
          disabled={tied || pending}
          onPick={() => vote(movieA.id)}
        />
        <div className="text-muted-foreground grid shrink-0 place-items-center text-xs font-semibold">
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : tied ? (
            <span className="tabular-nums">
              {match.tally?.a ?? 0}–{match.tally?.b ?? 0}
            </span>
          ) : (
            "VS"
          )}
        </div>
        <Side
          movie={movieB}
          chosen={myChoice === movieB.id}
          dimmed={voted && myChoice !== movieB.id}
          disabled={tied || pending}
          onPick={() => vote(movieB.id)}
        />
      </div>

      {tied && (
        <p className="text-primary flex items-center justify-center gap-1 text-xs font-medium">
          <Scale className="size-3.5" />
          {isHost
            ? "Empate: elige tú quién pasa o tira la moneda"
            : "Empate: lo decide el host o la moneda"}
        </p>
      )}

      {tied && isHost && (
        <Button variant="secondary" className="w-full" disabled={pending} onClick={toss}>
          <Coins className="size-4" />
          Tirar la moneda
        </Button>
      )}

      {!tied && voted && !error && (
        <p className="text-muted-foreground text-center text-xs">
          Votaste. Puedes cambiarlo hasta que cierre la ronda; los conteos se ven al final.
        </p>
      )}

      {isHost && (
        <div className="border-border/60 flex items-center gap-1.5 rounded-md border border-dashed p-1.5">
          <Crown className="text-primary size-3.5 shrink-0" />
          <span className="text-muted-foreground shrink-0 text-[11px]">Pasa:</span>
          {[movieA, movieB].map((movie) => (
            <button
              key={movie.id}
              type="button"
              disabled={pending}
              onClick={() => decide(movie.id)}
              className="hover:bg-accent min-w-0 flex-1 truncate rounded px-1.5 py-1 text-[11px] transition-colors disabled:opacity-50"
            >
              {movie.title}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-destructive text-center text-xs">{error}</p>}
    </li>
  );
}
