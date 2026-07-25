import { Download, ImageIcon, Trophy } from "lucide-react";

import { BracketGrid } from "@/components/bracket/bracket-grid";
import { PosterImage } from "@/components/movie/poster-image";
import { ExtraPicks } from "@/components/phases/extra-picks";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RoomState } from "@/lib/rooms";

const LABELS = [
  "Campeona",
  "Subcampeona",
  "Semifinalista",
  "Semifinalista",
  "Elegida por el host",
  "Elegida por el host",
];

const PODIUM_SIZE = 4;

export function FinishedPhase({ state }: { state: RoomState }) {
  const { room, me, movies, matches, rounds, lineup } = state;
  const champion = lineup[0]?.movie;

  const inLineup = new Set(lineup.map((row) => row.movie.id));
  const extras = lineup
    .filter((row) => row.position > PODIUM_SIZE)
    .map((row) => row.movie.id);
  const candidates = movies.filter(
    (movie) => !inLineup.has(movie.id) || extras.includes(movie.id),
  );

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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              La cartelera
            </h2>
            <div className="flex gap-2">
              <a
                href={`/api/sala/${room.code}/cartelera`}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs transition-colors"
              >
                <ImageIcon className="size-3.5" /> Ver imagen
              </a>
              <a
                href={`/api/sala/${room.code}/cartelera`}
                download={`cartelera-${room.code}.png`}
                className="bg-primary text-primary-foreground inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium"
              >
                <Download className="size-3.5" /> Descargar para el grupo
              </a>
            </div>
          </div>

          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {lineup.map(({ position, movie }) => (
              <li key={movie.id}>
                <div className="bg-muted overflow-hidden rounded-lg">
                  <PosterImage
                    path={movie.posterPath}
                    alt={movie.title}
                    className="aspect-[2/3] w-full"
                  />
                </div>
                <p
                  className={
                    position === 1
                      ? "text-primary mt-1.5 text-xs font-semibold"
                      : "text-muted-foreground mt-1.5 text-xs"
                  }
                >
                  {position}. {LABELS[position - 1] ?? "En cartelera"}
                </p>
                <p className="line-clamp-2 text-sm leading-tight font-medium">{movie.title}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {me?.isHost && (
        <ExtraPicks code={room.code} candidates={candidates} selected={extras} />
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
