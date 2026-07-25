import { Trophy } from "lucide-react";

import { BracketGrid } from "@/components/bracket/bracket-grid";
import { PosterImage } from "@/components/movie/poster-image";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RoomState } from "@/lib/rooms";

const LABELS = ["Primera noche", "Segunda noche", "Tercera noche", "Cuarta noche"];

export function FinishedPhase({ state }: { state: RoomState }) {
  const { matches, rounds, lineup } = state;
  const champion = lineup[0]?.movie;

  return (
    <>
      <Card>
        <CardHeader className="items-center text-center">
          <Trophy className="text-primary size-8" />
          <CardTitle className="text-2xl">{champion?.title ?? "Torneo terminado"}</CardTitle>
          <CardDescription>
            {champion
              ? "Campeona del Mundial de Pelis. Esa es la de esta noche."
              : "No quedó ninguna película en pie."}
          </CardDescription>
        </CardHeader>
      </Card>

      {lineup.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            La cartelera
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {lineup.map(({ position, movie }) => (
              <li key={movie.id}>
                <div className="bg-muted overflow-hidden rounded-lg">
                  <PosterImage
                    path={movie.posterPath}
                    alt={movie.title}
                    className="aspect-[2/3] w-full"
                  />
                </div>
                <p className="text-primary mt-1.5 text-xs font-semibold">
                  {LABELS[position - 1] ?? `Puesto ${position}`}
                </p>
                <p className="line-clamp-2 text-sm leading-tight font-medium">{movie.title}</p>
                {movie.originalTitle !== movie.title && (
                  <p className="text-muted-foreground truncate text-xs">{movie.originalTitle}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="border-t pt-4">
        <h2 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
          Cómo se llegó hasta acá
        </h2>
        <BracketGrid matches={matches} rounds={rounds} />
      </div>
    </>
  );
}
