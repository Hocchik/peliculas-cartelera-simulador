"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";

import { castVote } from "@/app/sala/[code]/actions";
import { PosterImage } from "@/components/movie/poster-image";
import { cn } from "@/lib/utils";
import type { MatchView, MovieView } from "@/lib/room-types";

function Side({
  movie,
  chosen,
  voted,
  pending,
  onPick,
}: {
  movie: MovieView;
  chosen: boolean;
  voted: boolean;
  pending: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={voted || pending}
      onClick={onPick}
      className={cn(
        "relative flex-1 overflow-hidden rounded-lg ring-2 transition-all",
        chosen ? "ring-primary" : "ring-transparent",
        voted && !chosen && "opacity-40",
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

/** Un versus abierto. Los conteos no se muestran: llegan en `null` hasta cerrar. */
export function VoteCard({ code, match }: { code: string; match: MatchView }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!match.movieA || !match.movieB) return null;

  const voted = match.myChoice !== null;

  function pick(movieId: string) {
    setError(null);
    start(async () => {
      const result = await castVote({ code, matchId: match.id, choiceMovieId: movieId });
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <li className="space-y-2">
      <div className="flex items-stretch gap-2">
        <Side
          movie={match.movieA}
          chosen={match.myChoice === match.movieA.id}
          voted={voted}
          pending={pending}
          onPick={() => pick(match.movieA!.id)}
        />
        <div className="text-muted-foreground grid shrink-0 place-items-center text-xs font-semibold">
          {pending ? <Loader2 className="size-4 animate-spin" /> : "VS"}
        </div>
        <Side
          movie={match.movieB}
          chosen={match.myChoice === match.movieB.id}
          voted={voted}
          pending={pending}
          onPick={() => pick(match.movieB!.id)}
        />
      </div>
      {voted && !error && (
        <p className="text-muted-foreground text-center text-xs">
          Votaste. Los conteos se ven cuando cierre la ronda.
        </p>
      )}
      {error && <p className="text-destructive text-center text-xs">{error}</p>}
    </li>
  );
}
