import { Shuffle } from "lucide-react";

import { startBracket } from "@/app/sala/[code]/actions";
import { BracketGrid } from "@/components/bracket/bracket-grid";
import { HostButton } from "@/components/room/host-button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RoomState } from "@/lib/rooms";

export function DrawPhase({ state }: { state: RoomState }) {
  const { room, me, matches, rounds } = state;
  if (!me) return null;

  const byes = matches.filter((match) => match.decidedBy === "bye").length;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shuffle className="text-primary size-5" /> El cuadro está sorteado
          </CardTitle>
          <CardDescription>
            Cada película quedó sembrada según cuántos la aprobaron: las favoritas arrancan contra
            las menos votadas y no pueden cruzarse entre ellas hasta el final del cuadro. Los
            empates de aprobaciones se sortearon.
            {byes > 0 &&
              ` Como no llegaron a llenar el cuadro, ${byes} ${
                byes === 1 ? "cruce pasa" : "cruces pasan"
              } sin rival.`}
          </CardDescription>
        </CardHeader>
      </Card>

      <BracketGrid matches={matches} rounds={rounds} reveal />

      {me.isHost ? (
        <div className="border-t pt-4">
          <HostButton code={room.code} action={startBracket} label="Empezar los versus" />
        </div>
      ) : (
        <p className="text-muted-foreground text-center text-sm">
          Esperando a que el host arranque los versus…
        </p>
      )}
    </>
  );
}
