"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check, Coins, Crown, Loader2 } from "lucide-react";

import { castVote, decideMatch, flipCoin } from "@/app/sala/[code]/actions";
import { PosterImage } from "@/components/movie/poster-image";
import { cn } from "@/lib/utils";
import type { MatchView, MovieView } from "@/lib/room-types";

export type VoteCardVariant = "rows" | "posters";

/**
 * Un versus. Dos formatos con la misma lógica de voto:
 *  - "rows": fila de ~68 px con miniaturas. Celular y tablet: los 8 de octavos
 *    entran en una pantalla.
 *  - "posters": tamaño cartelera, como la grilla de nominaciones. Escritorio,
 *    donde sobra ancho y la fila compacta se veía perdida.
 *
 * Mientras está abierto los conteos llegan en `null` y no se muestran; en un
 * empate sí, porque la votación ya cerró y es lo que el host necesita.
 */
export function VoteCard({
  code,
  match,
  isHost,
  hostMode,
  variant,
}: {
  code: string;
  match: MatchView;
  isHost: boolean;
  /** El host activó "decidir a mano": cada versus muestra a quién hacer pasar. */
  hostMode: boolean;
  variant: VoteCardVariant;
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

  const props: LayoutProps = {
    sides: [movieA, movieB].map((movie) => ({
      movie,
      chosen: myChoice === movie.id,
      dimmed: voted && myChoice !== movie.id,
    })),
    tied,
    tally: match.tally,
    pending,
    isHost,
    showDecide: tied ? isHost : hostMode,
    // Mientras el cruce esté abierto se puede cambiar de opinión: tocar la
    // otra reemplaza el voto. Tocar la que ya elegiste no hace nada.
    vote: (movieId) => {
      if (movieId === myChoice) return;
      run(() => castVote({ code, matchId: match.id, choiceMovieId: movieId }), movieId);
    },
    decide: (movieId) =>
      run(() => decideMatch({ code, matchId: match.id, winnerMovieId: movieId })),
    toss: () => run(() => flipCoin({ code, matchId: match.id })),
  };

  return (
    <li
      className={cn(
        "bg-card border",
        variant === "posters" ? "space-y-2 rounded-xl p-2" : "rounded-lg",
        tied && "border-primary/60",
      )}
    >
      {variant === "posters" ? <PosterLayout {...props} /> : <RowLayout {...props} />}
      {error && <p className="text-destructive px-3 pb-1.5 text-center text-xs">{error}</p>}
    </li>
  );
}

type Side = { movie: MovieView; chosen: boolean; dimmed: boolean };

type LayoutProps = {
  sides: Side[];
  tied: boolean;
  tally: MatchView["tally"];
  pending: boolean;
  isHost: boolean;
  showDecide: boolean;
  vote: (movieId: string) => void;
  decide: (movieId: string) => void;
  toss: () => void;
};

/** Lo que va entre las dos: "vs", el marcador del empate o el spinner. */
function Middle({ tied, tally, pending }: Pick<LayoutProps, "tied" | "tally" | "pending">) {
  if (pending) return <Loader2 className="size-3.5 animate-spin" />;
  if (tied) return <>{`${tally?.a ?? 0}–${tally?.b ?? 0}`}</>;
  return <>VS</>;
}

/** Título bilingüe: el original solo si es distinto; si no, el año. */
function subtitleOf(movie: MovieView) {
  return movie.originalTitle !== movie.title ? movie.originalTitle : movie.year;
}

// ---------------------------------------------------------------------------
// Filas compactas (celular y tablet)
// ---------------------------------------------------------------------------

function RowLayout({ sides, tied, tally, pending, isHost, showDecide, vote, decide, toss }: LayoutProps) {
  return (
    <>
      <div className="flex items-stretch gap-1 p-1">
        {sides.map(({ movie, chosen, dimmed }, index) => (
          <button
            key={movie.id}
            type="button"
            disabled={tied || pending}
            onClick={() => vote(movie.id)}
            aria-pressed={chosen}
            style={{ order: index * 2 }}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 rounded-md p-1.5 text-left transition-colors",
              "hover:bg-accent/60 disabled:cursor-default disabled:hover:bg-transparent",
              // La B va espejada para que el "vs" quede al centro.
              index === 1 && "flex-row-reverse text-right",
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
              {subtitleOf(movie) && (
                <span className="text-muted-foreground block truncate text-xs">
                  {subtitleOf(movie)}
                </span>
              )}
            </span>
          </button>
        ))}
        <div
          style={{ order: 1 }}
          className={cn(
            "grid w-7 shrink-0 place-items-center text-[10px] font-semibold uppercase",
            tied ? "text-primary text-xs tabular-nums" : "text-muted-foreground",
          )}
        >
          <Middle tied={tied} tally={tally} pending={pending} />
        </div>
      </div>

      {tied && !isHost && (
        <p className="text-primary border-t px-3 py-1.5 text-center text-xs font-medium">
          Empate: lo decide el host o la moneda
        </p>
      )}

      {showDecide && (
        <div className="flex items-center gap-1 border-t border-dashed p-1.5">
          <Crown className="text-primary size-3.5 shrink-0" />
          <span className="text-muted-foreground shrink-0 text-[11px]">Pasa:</span>
          {sides.map(({ movie }) => (
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
    </>
  );
}

// ---------------------------------------------------------------------------
// Cartelera (escritorio)
// ---------------------------------------------------------------------------

function PosterLayout({
  sides,
  tied,
  tally,
  pending,
  isHost,
  showDecide,
  vote,
  decide,
  toss,
}: LayoutProps) {
  return (
    <>
      <div className="relative grid grid-cols-2 gap-1.5">
        {sides.map(({ movie, chosen, dimmed }) => (
          <button
            key={movie.id}
            type="button"
            disabled={tied || pending}
            onClick={() => vote(movie.id)}
            aria-pressed={chosen}
            aria-label={`Votar por ${movie.title}`}
            className={cn(
              "group bg-muted relative block w-full overflow-hidden rounded-lg ring-2 ring-transparent transition",
              "disabled:cursor-default",
              chosen && "ring-primary",
              dimmed && "opacity-45 saturate-50",
            )}
          >
            <PosterImage
              path={movie.posterPath}
              alt=""
              className="aspect-[2/3] w-full transition-transform duration-300 group-enabled:group-hover:scale-[1.03]"
            />
            {chosen && (
              <span className="bg-primary text-primary-foreground absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full shadow">
                <Check className="size-4" />
              </span>
            )}
          </button>
        ))}
        {/* El "vs" va encima, centrado entre los dos pósters. */}
        <span
          className={cn(
            "bg-background absolute top-1/2 left-1/2 grid h-7 min-w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border px-1.5 text-[10px] font-bold shadow",
            tied ? "border-primary text-primary text-xs tabular-nums" : "text-muted-foreground",
          )}
        >
          <Middle tied={tied} tally={tally} pending={pending} />
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {sides.map(({ movie, dimmed }) => (
          <button
            key={movie.id}
            type="button"
            tabIndex={-1}
            aria-hidden
            disabled={tied || pending}
            onClick={() => vote(movie.id)}
            className={cn("min-w-0 px-0.5 text-left disabled:cursor-default", dimmed && "opacity-55")}
          >
            <span className="line-clamp-2 text-sm leading-tight font-medium">{movie.title}</span>
            {subtitleOf(movie) && (
              <span className="text-muted-foreground block truncate text-[11px]">
                {subtitleOf(movie)}
              </span>
            )}
          </button>
        ))}
      </div>

      {showDecide && (
        <div className="grid grid-cols-2 gap-1.5">
          {sides.map(({ movie }) => (
            <button
              key={movie.id}
              type="button"
              disabled={pending}
              onClick={() => decide(movie.id)}
              aria-label={`Hacer pasar a ${movie.title}`}
              className="bg-muted hover:bg-accent flex items-center justify-center gap-1 rounded-md py-1 text-[11px] font-medium transition-colors disabled:opacity-50"
            >
              <Crown className="text-primary size-3" />
              Pasa
            </button>
          ))}
        </div>
      )}

      {tied &&
        (isHost ? (
          <button
            type="button"
            disabled={pending}
            onClick={toss}
            className="bg-primary text-primary-foreground flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-opacity disabled:opacity-50"
          >
            <Coins className="size-4" />
            Tirar la moneda
          </button>
        ) : (
          <p className="text-primary text-center text-[11px] font-medium">
            Empate: lo decide el host o la moneda
          </p>
        ))}
    </>
  );
}
