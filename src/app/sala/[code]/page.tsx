import { notFound } from "next/navigation";
import { Crown, Users } from "lucide-react";

import { BracketPhase } from "@/components/phases/bracket-phase";
import { DrawPhase } from "@/components/phases/draw-phase";
import { FinishedPhase } from "@/components/phases/finished-phase";
import { NominatingPhase } from "@/components/phases/nominating-phase";
import { SeedingPhase } from "@/components/phases/seeding-phase";
import { JoinRoomForm } from "@/components/room/join-room-form";
import { LiveUpdates } from "@/components/room/live-updates";
import { RoomCode } from "@/components/room/room-code";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeRoomCode } from "@/lib/codes";
import { getRoomState, type RoomState } from "@/lib/rooms";
import { readDeviceToken } from "@/lib/session";

function PhaseView({ state }: { state: RoomState }) {
  switch (state.room.phase) {
    case "seeding":
      return <SeedingPhase state={state} />;
    case "draw":
      return <DrawPhase state={state} />;
    case "bracket":
      return <BracketPhase state={state} />;
    case "finished":
      return <FinishedPhase state={state} />;
    default:
      return <NominatingPhase state={state} />;
  }
}

export default async function SalaPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const state = await getRoomState(code, await readDeviceToken());

  if (!state) notFound();

  const { room, me, members, version } = state;

  if (!me) {
    const open = room.phase === "nominating";
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>{room.name}</CardTitle>
            <CardDescription>
              {open
                ? "Te invitaron a esta sala. Elige un apodo para entrar."
                : "Esta sala ya cerró las nominaciones y no admite gente nueva."}
            </CardDescription>
          </CardHeader>
          {open && (
            <CardContent>
              <JoinRoomForm code={normalizeRoomCode(code)} autoFocus />
            </CardContent>
          )}
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <LiveUpdates code={room.code} version={version} />

      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{room.name}</h1>
          {room.phase === "nominating" && <RoomCode code={room.code} />}
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

      <PhaseView state={state} />

      <p className="text-muted-foreground pt-6 text-center text-xs">
        Este producto usa la API de TMDB pero no está avalado ni certificado por TMDB.
      </p>
    </main>
  );
}
