import { Coins, Crown, Scale, Trophy } from "lucide-react";

import { PosterImage } from "@/components/movie/poster-image";
import { roundName } from "@/lib/bracket";
import { cn } from "@/lib/utils";
import type { MatchView, MovieView } from "@/lib/room-types";

function Contender({
  movie,
  won,
  lost,
  score,
  compact,
}: {
  movie: MovieView | null;
  won: boolean;
  lost: boolean;
  score: number | null;
  compact: boolean;
}) {
  const row = compact ? "px-1.5 py-1 text-[11px]" : "px-2 py-1.5 text-xs";

  if (!movie) {
    return <p className={cn("text-muted-foreground italic", row)}>Bye</p>;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        row,
        won && "text-primary font-semibold",
        lost && "text-muted-foreground line-through opacity-60",
      )}
    >
      <PosterImage
        path={movie.posterPath}
        alt={movie.title}
        size="w92"
        className={cn("shrink-0 rounded-sm", compact ? "h-6 w-4" : "h-8 w-6")}
      />
      <span className="min-w-0 flex-1 truncate">{movie.title}</span>
      {score !== null && <span className="tabular-nums">{score}</span>}
    </div>
  );
}

function MatchCard({
  match,
  isFinal,
  compact,
  className,
  style,
}: {
  match: MatchView;
  isFinal: boolean;
  compact: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <article
      style={style}
      className={cn("divide-border bg-card divide-y overflow-hidden rounded-lg border", className)}
    >
      <Contender
        movie={match.movieA}
        won={match.winnerId !== null && match.winnerId === match.movieA?.id}
        lost={match.winnerId !== null && match.winnerId !== match.movieA?.id}
        score={match.tally?.a ?? null}
        compact={compact}
      />
      <Contender
        movie={match.movieB}
        won={match.winnerId !== null && match.winnerId === match.movieB?.id}
        lost={match.winnerId !== null && match.winnerId !== match.movieB?.id}
        score={match.tally?.b ?? null}
        compact={compact}
      />
      {match.status === "tiebreak" && (
        <p className="text-primary flex items-center gap-1 px-2 py-1 text-[11px] font-medium">
          <Scale className="size-3" /> Empate: host o moneda
        </p>
      )}
      {match.decidedBy === "host" && (
        <p className="text-muted-foreground flex items-center gap-1 px-2 py-1 text-[11px]">
          <Crown className="size-3" /> Lo decidió el host
        </p>
      )}
      {match.decidedBy === "coinflip" && (
        <p className="text-muted-foreground flex items-center gap-1 px-2 py-1 text-[11px]">
          <Coins className="size-3" /> Moneda al aire
        </p>
      )}
      {isFinal && match.winnerId && (
        <p className="text-primary flex items-center gap-1 px-2 py-1 text-[11px] font-semibold">
          <Trophy className="size-3" /> Campeona
        </p>
      )}
    </article>
  );
}

/**
 * El cuadro completo, ronda por ronda en horizontal: es la forma en que se lee
 * un cuadro de Mundial y la única en la que se ve de un vistazo quién se cruza
 * con quién. Cuando no entra, se recorre de lado; los márgenes negativos dejan
 * que ese scroll llegue al borde de la pantalla en móvil, sin cortar el
 * contenido a media tarjeta.
 */
export function BracketGrid({
  matches,
  rounds,
  reveal = false,
  compact = false,
}: {
  matches: MatchView[];
  rounds: number;
  reveal?: boolean;
  /**
   * Durante las llaves el cuadro es contexto, no la acción: va más angosto
   * (cuatro rondas en ~650 px en vez de ~800) para dejarle el ancho a los versus.
   */
  compact?: boolean;
}) {
  const size = 2 ** rounds;

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 xl:mx-0 xl:px-0">
      <div className={cn("flex min-w-max", compact ? "gap-2" : "gap-3")}>
        {Array.from({ length: rounds }, (_, index) => index + 1).map((round) => {
          const ofRound = matches
            .filter((match) => match.round === round)
            .sort((a, b) => a.slot - b.slot);

          return (
            <section
              key={round}
              className={cn("shrink-0", compact ? "w-40 space-y-1.5" : "w-48 space-y-2")}
            >
              <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {roundName(round, size)}
              </h3>

              {ofRound.length === 0 ? (
                <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-xs">
                  Por definir
                </p>
              ) : (
                ofRound.map((match, position) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    isFinal={round === rounds}
                    compact={compact}
                    style={
                      reveal
                        ? { animationDelay: `${(round - 1) * 240 + position * 80}ms` }
                        : undefined
                    }
                    className={cn(
                      reveal && "animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards",
                    )}
                  />
                ))
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
