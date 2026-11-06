import { Shuffle, TriangleAlert } from "lucide-react";

import { startDraw } from "@/app/sala/[code]/actions";
import { HostButton } from "@/components/room/host-button";
import { ApprovalCard } from "@/components/seeding/approval-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RoomState } from "@/lib/rooms";

export function SeedingPhase({ state }: { state: RoomState }) {
  const { room, me, members, movies, myApprovals, membersWhoSeeded } = state;
  if (!me) return null;

  const approved = new Set(myApprovals);
  const missing = members.length - membersWhoSeeded;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>¿Cuáles verías?</CardTitle>
          <CardDescription>
            Marca todas las que estarías dispuesto a ver, sin límite. Esto ordena el cuadro: las
            más queridas no se cruzan entre ellas hasta el final.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Marcaste {approved.size} de {movies.length}
          {missing > 0
            ? ` · faltan ${missing} ${missing === 1 ? "persona" : "personas"} por marcar`
            : " · ya marcaron todos"}
        </CardContent>
      </Card>

      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {movies.map((movie) => (
          <ApprovalCard
            key={movie.id}
            code={room.code}
            movie={movie}
            approved={approved.has(movie.id)}
          />
        ))}
      </ul>

      {me.isHost && (
        <div className="border-t pt-4">
          <HostButton
            code={room.code}
            action={startDraw}
            label="Sortear el cuadro"
            confirm={
              missing > 0
                ? {
                    title: `Faltan ${missing} por marcar`,
                    description:
                      "Si sorteas ahora, sus preferencias no cuentan para ordenar el cuadro. El sorteo no se puede deshacer.",
                    confirmLabel: "Sortear igual",
                    icon: <TriangleAlert />,
                  }
                : {
                    title: "¿Sorteamos el cuadro?",
                    description:
                      "Se cierra la siembra y se arma el cuadro con lo que aprobó cada uno. No se puede deshacer.",
                    confirmLabel: "Sortear",
                    icon: <Shuffle />,
                  }
            }
          />
        </div>
      )}
    </>
  );
}
