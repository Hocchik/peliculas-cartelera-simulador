import { Scale } from "lucide-react";

import { forceCloseRound } from "@/app/sala/[code]/actions";
import { BracketGrid } from "@/components/bracket/bracket-grid";
import { VoteCard } from "@/components/bracket/vote-card";
import { HostButton } from "@/components/room/host-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { roundName } from "@/lib/bracket";
import type { RoomState } from "@/lib/rooms";

export function BracketPhase({ state }: { state: RoomState }) {
  const { room, me, matches, rounds, roundProgress } = state;
  if (!me) return null;

  const live = matches.filter(
    (match) => match.status === "open" || match.status === "tiebreak",
  );
  const open = live.filter((match) => match.status === "open");
  const ties = live.filter((match) => match.status === "tiebreak");
  const round = live[0]?.round ?? rounds;

  const unvoted = open.filter((match) => match.myChoice === null);
  const missing = roundProgress ? roundProgress.expected - roundProgress.cast : 0;

  return (
    // Hasta xl van uno debajo del otro, con el cuadro a lo ancho. Desde ahí el
    // cuadro cabe al costado sin achicarlo: cuatro rondas piden ~870 px y los
    // versus no necesitan más de 24 rem para que los pósters se vean grandes.
    <div className="xl:grid xl:grid-cols-[24rem_minmax(0,1fr)] xl:items-start xl:gap-8">
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>{roundName(round, 2 ** rounds)}</CardTitle>
            <CardDescription>
              {ties.length > 0 && open.length === 0
                ? me.isHost
                  ? `Hay ${ties.length} ${ties.length === 1 ? "empate" : "empates"} esperando tu decisión.`
                  : `Hay ${ties.length} ${ties.length === 1 ? "empate" : "empates"}: los desempata el host.`
                : unvoted.length > 0
                  ? `Te faltan ${unvoted.length} por votar.`
                  : "Ya votaste todo. La ronda avanza cuando voten los demás."}
            </CardDescription>
          </CardHeader>
          {roundProgress && (
            <CardContent className="text-muted-foreground text-sm">
              {roundProgress.cast} de {roundProgress.expected} votos emitidos
            </CardContent>
          )}
        </Card>

        {ties.length > 0 && (
          <p className="text-primary flex items-center gap-2 text-sm font-medium">
            <Scale className="size-4" />
            {me.isHost
              ? "Elige quién pasa en los empates para que siga la ronda."
              : "Esperando a que el host desempate."}
          </p>
        )}

        <ul className="space-y-5">
          {[...ties, ...open].map((match) => (
            <VoteCard key={match.id} code={room.code} match={match} isHost={me.isHost} />
          ))}
        </ul>

        {me.isHost && missing > 0 && open.length > 0 && (
          <HostButton
            code={room.code}
            action={forceCloseRound}
            label="Cerrar la ronda igual"
            variant="secondary"
            confirm={`Faltan ${missing} ${
              missing === 1 ? "voto" : "votos"
            }. Los ${open.length} versus abiertos se resolverán con lo que haya votado, y los que queden empatados los tendrás que decidir tú. ¿Cerramos?`}
          />
        )}
      </div>

      {/*
        `max-h` + `overflow-y-auto` solo entran en acción si el cuadro no cabe a
        lo alto; mientras quepa no aparece ninguna barra.
      */}
      <aside className="mt-8 xl:sticky xl:top-6 xl:mt-0 xl:max-h-[calc(100svh-3rem)] xl:overflow-y-auto">
        <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
          Cómo va el cuadro
        </h2>
        <BracketGrid matches={matches} rounds={rounds} />
      </aside>
    </div>
  );
}
