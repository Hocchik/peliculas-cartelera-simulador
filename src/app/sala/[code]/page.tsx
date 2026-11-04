import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CoinflipReveal } from "@/components/bracket/coinflip-reveal";
import { BracketPhase } from "@/components/phases/bracket-phase";
import { DrawPhase } from "@/components/phases/draw-phase";
import { FinishedPhase } from "@/components/phases/finished-phase";
import { NominatingPhase } from "@/components/phases/nominating-phase";
import { SeedingPhase } from "@/components/phases/seeding-phase";
import { HostControls } from "@/components/room/host-controls";
import { JoinRoomForm } from "@/components/room/join-room-form";
import { LiveUpdates } from "@/components/room/live-updates";
import { MemberList } from "@/components/room/member-list";
import { RoomCode } from "@/components/room/room-code";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeRoomCode } from "@/lib/codes";
import { findRoomByCode, getRoomState, type RoomState } from "@/lib/rooms";
import { readDeviceToken } from "@/lib/session";
import { cn } from "@/lib/utils";

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) return { title: "Sala no encontrada" };

  const title = `${room.name} · Mundial de Pelis`;

  // Con el torneo terminado, pegar el enlace en el grupo muestra la cartelera.
  if (room.phase !== "finished") return { title };

  return {
    title,
    openGraph: {
      title,
      description: "La cartelera quedó definida.",
      images: [{ url: `/api/sala/${room.code}/cartelera`, width: 1200, height: 630 }],
    },
  };
}

export default async function SalaPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const state = await getRoomState(code, await readDeviceToken());

  if (!state) notFound();

  const { room, me, members, version } = state;

  if (state.kicked) {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>{room.name}</CardTitle>
            <CardDescription>
              El host te sacó de esta sala. Si fue un error, pídele que cree otra o que te pase
              el código de una nueva.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

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

  // Las llaves necesitan sitio: en escritorio van los versus y el cuadro a la
  // par, y el cuadro pide unos 870 px para no tener que recorrerse de lado.
  const wide = room.phase === "bracket";

  return (
    <main
      className={cn(
        "mx-auto w-full space-y-6 px-4 py-8 sm:px-6",
        wide ? "max-w-[96rem]" : "max-w-4xl",
      )}
    >
      <LiveUpdates code={room.code} version={version} />

      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{room.name}</h1>
          {room.phase === "nominating" && <RoomCode code={room.code} />}
        </div>

        <MemberList
          code={room.code}
          // Mapeo explícito: `Participant` lleva el device_token y no sale al cliente.
          members={members.map(({ id, nickname, isHost }) => ({ id, nickname, isHost }))}
          meId={me.id}
          isHost={me.isHost}
        />
      </header>

      <PhaseView state={state} />

      {/* Fuera de PhaseView: si la final se define con moneda, la sala pasa a
          `finished` en el mismo refresh y la animación no debe desmontarse. */}
      {(room.phase === "bracket" || room.phase === "finished") && (
        <CoinflipReveal matches={state.matches} />
      )}

      {me.isHost && <HostControls code={room.code} phase={room.phase} />}

      <p className="text-muted-foreground pt-6 text-center text-xs">
        Este producto usa la API de TMDB pero no está avalado ni certificado por TMDB.
      </p>
    </main>
  );
}
