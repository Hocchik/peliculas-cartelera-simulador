import { Coins, Crown, Scale, Trophy } from "lucide-react";

import { PosterImage } from "@/components/movie/poster-image";
import { roundName } from "@/lib/bracket";
import { cn } from "@/lib/utils";
import type { MatchView, MovieView } from "@/lib/room-types";

/*
 * Medidas compartidas. El hueco entre rondas se reparte en dos mitades: la
 * llave "]" que sale del par ocupa la primera y el tramo que entra al cruce
 * siguiente, la segunda. Por eso `GAP` es el doble de `HALF`.
 */
const GAP = "gap-x-6 sm:gap-x-10";
const HALF = "w-3 sm:w-5";

function Contender({
  movie,
  score,
  won,
  lost,
  bye,
}: {
  movie: MovieView | null;
  score: number | null;
  won: boolean;
  lost: boolean;
  /** El rival no existe (cuadro incompleto), no es que falte definirlo. */
  bye: boolean;
}) {
  return (
    <div
      title={movie?.title ?? (bye ? "Bye" : "Por definir")}
      className={cn(
        "flex items-center justify-between gap-1 border-l-2 border-transparent py-0.5 pr-1.5 pl-0.5",
        won && "border-primary",
        lost && "opacity-45 grayscale",
      )}
    >
      {movie ? (
        <PosterImage
          path={movie.posterPath}
          alt={movie.title}
          size="w92"
          className="h-[30px] w-5 shrink-0 rounded-sm sm:h-9 sm:w-6"
        />
      ) : (
        <span className="border-border h-[30px] w-5 shrink-0 rounded-sm border border-dashed sm:h-9 sm:w-6" />
      )}
      <span
        className={cn(
          "text-xs font-semibold tabular-nums",
          won ? "text-primary" : "text-muted-foreground",
        )}
      >
        {bye ? "bye" : (score ?? "–")}
      </span>
    </div>
  );
}

/** Insignia en la esquina: cómo se resolvió, o si espera desempate. */
function Mark({ match, isFinal }: { match: MatchView; isFinal: boolean }) {
  const mark =
    match.status === "tiebreak"
      ? { Icon: Scale, label: "Empate: lo decide el host o la moneda", accent: true }
      : isFinal && match.winnerId
        ? { Icon: Trophy, label: "Campeona", accent: true }
        : match.decidedBy === "coinflip"
          ? { Icon: Coins, label: "Se decidió con la moneda", accent: false }
          : match.decidedBy === "host"
            ? { Icon: Crown, label: "Lo decidió el host", accent: false }
            : null;
  if (!mark) return null;

  return (
    <span
      title={mark.label}
      aria-label={mark.label}
      className={cn(
        "bg-background absolute -top-1.5 -right-1.5 grid size-4 place-items-center rounded-full border",
        mark.accent ? "border-primary text-primary" : "text-muted-foreground",
      )}
    >
      <mark.Icon className="size-2.5" />
    </span>
  );
}

function MatchBox({
  match,
  isFinal,
  reveal,
  delay,
}: {
  match: MatchView | null;
  isFinal: boolean;
  reveal: boolean;
  delay: number;
}) {
  // Los cruces de rondas futuras todavía no existen en la base: se dibujan
  // vacíos para que el cuadro tenga su forma completa desde el principio.
  const decided = match?.winnerId != null;
  const isBye = match?.decidedBy === "bye";

  return (
    <div
      style={reveal ? { animationDelay: `${delay}ms` } : undefined}
      className={cn(
        "relative w-14 sm:w-[4.5rem]",
        reveal && "animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards",
      )}
    >
      <article
        className={cn(
          "bg-card divide-foreground/10 border-foreground/15 divide-y overflow-hidden rounded-md border",
          match?.status === "open" && "border-foreground/35",
          match?.status === "tiebreak" && "border-primary",
        )}
      >
        {(["A", "B"] as const).map((side) => {
          const movie = side === "A" ? (match?.movieA ?? null) : (match?.movieB ?? null);
          return (
            <Contender
              key={side}
              movie={movie}
              score={side === "A" ? (match?.tally?.a ?? null) : (match?.tally?.b ?? null)}
              won={decided && movie !== null && match?.winnerId === movie.id}
              lost={decided && movie !== null && match?.winnerId !== movie.id}
              bye={isBye && movie === null}
            />
          );
        })}
      </article>
      {match && <Mark match={match} isFinal={isFinal} />}
    </div>
  );
}

/**
 * El cuadro, a lo Riot: rondas en columnas, cada cruce centrado entre los dos
 * que lo alimentan y unido a ellos con líneas. Solo pósters y votos; los
 * nombres ya están en los versus, y sin ellos las cuatro rondas de un cuadro
 * de 16 entran a lo ancho de un celular (~300 px) sin recorrerlo de lado.
 *
 * La alineación sale sola: todas las columnas miden lo mismo (la grilla las
 * estira a la altura de la primera ronda) y cada una se reparte en partes
 * iguales, así que el centro de un cruce de la ronda r+1 cae justo entre los
 * centros de su par en la ronda r.
 */
export function BracketGrid({
  matches,
  rounds,
  reveal = false,
}: {
  matches: MatchView[];
  rounds: number;
  /** Animación de entrada del sorteo, ronda por ronda. */
  reveal?: boolean;
}) {
  const size = 2 ** rounds;
  const roundList = Array.from({ length: rounds }, (_, index) => index + 1);

  return (
    // El relleno de arriba y a los lados deja sitio a las insignias de las
    // esquinas: `overflow-x-auto` también recorta en vertical.
    <div className="-mx-4 overflow-x-auto px-4 pt-1.5 pb-2 sm:mx-0 sm:px-2">
      <div
        className={cn("mx-auto grid w-max", GAP)}
        style={{ gridTemplateColumns: `repeat(${rounds}, auto)` }}
      >
        {roundList.map((round) => (
          <h3
            key={`h${round}`}
            className="bg-muted text-muted-foreground mb-2 truncate rounded px-1.5 py-1 text-center text-[10px] font-semibold tracking-wide uppercase"
          >
            {/* Corto: la columna mide 56 px en el celular. */}
            {roundName(round, size).replace(" de final", "").replace("Semifinales", "Semis")}
          </h3>
        ))}

        {roundList.map((round) => {
          const count = size / 2 ** round;
          const isFinal = round === rounds;
          const bySlot = new Map(
            matches.filter((match) => match.round === round).map((match) => [match.slot, match]),
          );
          const slots = Array.from({ length: count }, (_, slot) => bySlot.get(slot) ?? null);

          // De a pares, porque cada par desemboca en un cruce de la ronda
          // siguiente. La final queda sola.
          const groups = isFinal
            ? [slots]
            : slots.flatMap((_, i) => (i % 2 ? [] : [slots.slice(i, i + 2)]));

          return (
            <div key={round} className="flex flex-col">
              {groups.map((group, groupIndex) => (
                <div key={groupIndex} className="relative flex flex-1 flex-col">
                  {group.map((match, inGroup) => {
                    const slot = groupIndex * 2 + inGroup;
                    return (
                      <div key={slot} className="relative flex flex-1 items-center py-1">
                        {/* Tramo que entra desde la llave de la ronda anterior. */}
                        {round > 1 && (
                          <span
                            aria-hidden
                            className={cn("border-border absolute top-1/2 right-full border-t", HALF)}
                          />
                        )}
                        <MatchBox
                          match={match}
                          isFinal={isFinal}
                          reveal={reveal}
                          delay={(round - 1) * 240 + slot * 70}
                        />
                      </div>
                    );
                  })}
                  {/* La llave "]": une los centros del par (al 25 % y al 75 %). */}
                  {!isFinal && (
                    <span
                      aria-hidden
                      className={cn(
                        "border-border absolute top-1/4 bottom-1/4 left-full rounded-r-sm border-y border-r",
                        HALF,
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
