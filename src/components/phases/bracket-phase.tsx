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

  const open = matches.filter((match) => match.status === "open");
  const round = open[0]?.round ?? rounds;
  const size = 2 ** rounds;

  const mine = open.filter((match) => match.myChoice === null);
  const missing = roundProgress ? roundProgress.expected - roundProgress.cast : 0;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{roundName(round, size)}</CardTitle>
          <CardDescription>
            {mine.length > 0
              ? `Te faltan ${mine.length} ${mine.length === 1 ? "versus" : "versus"} por votar.`
              : "Ya votaste todo. La ronda avanza cuando voten los demás."}
          </CardDescription>
        </CardHeader>
        {roundProgress && (
          <CardContent className="text-muted-foreground text-sm">
            {roundProgress.cast} de {roundProgress.expected} votos emitidos
          </CardContent>
        )}
      </Card>

      {open.length > 0 && (
        <ul className="space-y-5">
          {open.map((match) => (
            <VoteCard key={match.id} code={room.code} match={match} />
          ))}
        </ul>
      )}

      {me.isHost && missing > 0 && (
        <div className="border-t pt-4">
          <HostButton
            code={room.code}
            action={forceCloseRound}
            label="Cerrar la ronda igual"
            variant="secondary"
            confirm={`Faltan ${missing} ${
              missing === 1 ? "voto" : "votos"
            }. Los ${open.length} cruces abiertos se resolverán sin ellos, y los que queden empatados los decide la moneda al aire. Esto no se puede deshacer. ¿Cerramos?`}
          />
        </div>
      )}

      <div className="border-t pt-4">
        <h2 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
          El cuadro
        </h2>
        <BracketGrid matches={matches} rounds={rounds} />
      </div>
    </>
  );
}
