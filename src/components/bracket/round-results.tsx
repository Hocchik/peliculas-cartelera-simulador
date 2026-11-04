import { Coins, Crown } from "lucide-react";

import { PosterImage } from "@/components/movie/poster-image";
import { roundName } from "@/lib/bracket";
import { cn } from "@/lib/utils";
import type { MatchView, MovieView } from "@/lib/room-types";

function Side({ movie, won }: { movie: MovieView; won: boolean }) {
  return (
    <PosterImage
      path={movie.posterPath}
      alt={movie.title}
      size="w92"
      className={cn(
        "h-9 w-6 shrink-0 rounded-sm",
        won ? "ring-primary ring-2" : "opacity-45 grayscale",
      )}
    />
  );
}

/**
 * Cómo terminaron los versus ya jugados, de la ronda más reciente a la primera:
 * quién pasó y por cuánto, sin abrir el cuadro. Los byes no se listan: no hubo
 * nada que votar.
 */
export function RoundResults({ matches, rounds }: { matches: MatchView[]; rounds: number }) {
  const played = matches.filter(
    (match) => match.status === "decided" && match.decidedBy !== "bye" && match.movieA && match.movieB,
  );

  if (played.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        Todavía no se cerró ningún versus. Acá vas a ver quién pasó y por cuántos votos.
      </p>
    );
  }

  const byRound = [...new Set(played.map((match) => match.round))].sort((a, b) => b - a);

  return (
    <div className="space-y-4">
      {byRound.map((round) => (
        <section key={round} className="space-y-1.5">
          <h3 className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
            {roundName(round, 2 ** rounds)}
          </h3>
          <ul className="space-y-1">
            {played
              .filter((match) => match.round === round)
              .sort((a, b) => a.slot - b.slot)
              .map((match) => {
                const a = match.movieA!;
                const b = match.movieB!;
                const aWon = match.winnerId === a.id;
                const winner = aWon ? a : b;
                return (
                  <li
                    key={match.id}
                    className="bg-card flex items-center gap-2 rounded-md border px-2 py-1"
                  >
                    <Side movie={a} won={aWon} />
                    <span className="text-sm font-semibold tabular-nums">
                      <span className={aWon ? "text-primary" : "text-muted-foreground"}>
                        {match.tally?.a ?? 0}
                      </span>
                      <span className="text-muted-foreground px-0.5">–</span>
                      <span className={!aWon ? "text-primary" : "text-muted-foreground"}>
                        {match.tally?.b ?? 0}
                      </span>
                    </span>
                    <Side movie={b} won={!aWon} />
                    <span className="min-w-0 flex-1 text-[11px] leading-tight">
                      <span className="text-muted-foreground block">pasa</span>
                      <span className="block truncate font-medium" title={winner.title}>
                        {winner.title}
                      </span>
                    </span>
                    {match.decidedBy === "coinflip" && (
                      <Coins
                        className="text-muted-foreground size-3.5 shrink-0"
                        aria-label="Se decidió con la moneda"
                      />
                    )}
                    {match.decidedBy === "host" && (
                      <Crown
                        className="text-muted-foreground size-3.5 shrink-0"
                        aria-label="Lo decidió el host"
                      />
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}
