import { Trophy } from "lucide-react";

import { CreateRoomForm } from "@/components/room/create-room-form";
import { JoinRoomForm } from "@/components/room/join-room-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-4xl flex-col justify-center gap-8 px-4 py-10">
      <header className="space-y-3 text-center">
        <Trophy className="text-primary mx-auto size-10" />
        <h1 className="text-4xl font-bold tracking-tight text-balance">Mundial de Pelis</h1>
        <p className="text-muted-foreground mx-auto max-w-md text-balance">
          Nominen hasta 16 películas, sorteen el cuadro y decidan a puro versus qué se ve
          esta noche.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Armar una sala</CardTitle>
            <CardDescription>
              Creas la sala y compartes el código. Quedas como host.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateRoomForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Entrar a una sala</CardTitle>
            <CardDescription>Te pasaron un código de 6 letras y números.</CardDescription>
          </CardHeader>
          <CardContent>
            <JoinRoomForm />
          </CardContent>
        </Card>
      </div>

      <p className="text-muted-foreground text-center text-xs">
        Este producto usa la API de TMDB pero no está avalado ni certificado por TMDB.
      </p>
    </main>
  );
}
