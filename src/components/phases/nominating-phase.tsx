import { MovieSearch } from "@/components/movie/movie-search";
import { PosterImage } from "@/components/movie/poster-image";
import { RemoveMovieButton } from "@/components/movie/remove-movie-button";
import { HostButton } from "@/components/room/host-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { startSeeding } from "@/app/sala/[code]/actions";
import { MAX_MOVIES } from "@/lib/bracket";
import { remainingNominations } from "@/lib/nominations";
import type { RoomState } from "@/lib/rooms";

export function NominatingPhase({ state }: { state: RoomState }) {
  const { room, me, movies, myNominations, nominationLimit } = state;
  if (!me) return null;

  const full = movies.length >= MAX_MOVIES;
  const remaining = remainingNominations(nominationLimit, myNominations);
  const blocked = full || remaining === 0;
  const blockedReason = full
    ? `La sala ya llegó a las ${MAX_MOVIES} películas.`
    : remaining === 0
      ? `Llegaste a tus ${nominationLimit} nominaciones. Retira una si quieres cambiarla.`
      : undefined;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Nominaciones</CardTitle>
          <CardDescription>
            Van {movies.length} de {MAX_MOVIES} en la sala
            {nominationLimit !== null && ` · llevas ${myNominations} de ${nominationLimit}`}
            {me.isHost && " · como host no tienes tope"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MovieSearch
            code={room.code}
            disabled={blocked}
            disabledReason={blockedReason}
            nominatedTmdbIds={movies.map((movie) => movie.tmdbId)}
          />
        </CardContent>
      </Card>

      {movies.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          Todavía no hay nominaciones. Busca la primera arriba.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {movies.map((movie) => (
            <li key={movie.id} className="relative">
              <div className="bg-muted relative overflow-hidden rounded-lg">
                <PosterImage
                  path={movie.posterPath}
                  alt={movie.title}
                  className="aspect-[2/3] w-full"
                />
                {(movie.mine || me.isHost) && (
                  <RemoveMovieButton code={room.code} movieId={movie.id} title={movie.title} />
                )}
              </div>
              <p className="mt-1.5 line-clamp-2 text-sm leading-tight font-medium">
                {movie.title}
              </p>
              <p className="text-muted-foreground text-xs">
                {movie.year ?? "—"}
                {movie.addedByNickname ? ` · ${movie.addedByNickname}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}

      {me.isHost && movies.length >= 2 && (
        <div className="border-t pt-4">
          <HostButton
            code={room.code}
            action={startSeeding}
            label="Cerrar nominaciones y pasar a la siembra"
            confirm={`Se cierran las nominaciones con ${movies.length} películas. Después nadie podrá agregar ni entrar a la sala. ¿Seguimos?`}
          />
        </div>
      )}
    </>
  );
}
