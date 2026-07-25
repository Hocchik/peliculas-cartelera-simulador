import { notFound } from "next/navigation";
import { Crown, Users } from "lucide-react";

import { MovieSearch } from "@/components/movie/movie-search";
import { PosterImage } from "@/components/movie/poster-image";
import { RemoveMovieButton } from "@/components/movie/remove-movie-button";
import { JoinRoomForm } from "@/components/room/join-room-form";
import { RoomCode } from "@/components/room/room-code";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MAX_MOVIES } from "@/lib/bracket";
import { normalizeRoomCode } from "@/lib/codes";
import { getRoomState } from "@/lib/rooms";
import { readDeviceToken } from "@/lib/session";

export default async function SalaPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const state = await getRoomState(code, await readDeviceToken());

  if (!state) notFound();

  const { room, me, members, movies } = state;

  if (!me) {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>{room.name}</CardTitle>
            <CardDescription>
              Te invitaron a esta sala. Elige un apodo para entrar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <JoinRoomForm code={normalizeRoomCode(code)} autoFocus />
          </CardContent>
        </Card>
      </main>
    );
  }

  const full = movies.length >= MAX_MOVIES;

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{room.name}</h1>
          <RoomCode code={room.code} />
        </div>

        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
          <Users className="size-4" />
          {members.map((member) => (
            <Badge key={member.id} variant={member.id === me.id ? "default" : "secondary"}>
              {member.isHost && <Crown className="size-3" />}
              {member.nickname}
            </Badge>
          ))}
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Nominaciones</CardTitle>
          <CardDescription>
            {full
              ? `Ya están las ${MAX_MOVIES} películas. El host puede retirar alguna si hace falta.`
              : `Van ${movies.length} de ${MAX_MOVIES}. Agrega las que quieras ver.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MovieSearch
            code={room.code}
            disabled={full}
            nominatedTmdbIds={movies.map((m) => m.tmdbId)}
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
            <li key={movie.id} className="group relative">
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
    </main>
  );
}
