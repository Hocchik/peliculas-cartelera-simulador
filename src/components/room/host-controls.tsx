import { Settings2 } from "lucide-react";

import { deleteRoom, resetRoom } from "@/app/sala/[code]/actions";
import { HostButton } from "@/components/room/host-button";
import type { RoomPhase } from "@/db/schema";

/** Reiniciar y cerrar. Va al final y en gris: no es lo que uno viene a hacer. */
export function HostControls({ code, phase }: { code: string; phase: RoomPhase }) {
  return (
    <section className="border-border/60 mt-10 space-y-3 border-t border-dashed pt-5">
      <h2 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
        <Settings2 className="size-3.5" /> Opciones de host
      </h2>

      <div className="flex flex-wrap gap-2">
        {phase !== "nominating" && (
          <HostButton
            code={code}
            action={resetRoom}
            label="Reiniciar el torneo"
            variant="outline"
            confirm="Se borran la siembra, el cuadro, los votos y la cartelera, y la sala vuelve a nominaciones. Las películas y la gente se quedan. ¿Reiniciamos?"
          />
        )}

        <HostButton
          code={code}
          action={deleteRoom}
          label="Cerrar la sala"
          variant="destructive"
          confirm="Se borra la sala entera con todo lo que tiene dentro, y el enlace deja de funcionar para todos. Esto no se puede deshacer. ¿Cerramos?"
        />
      </div>

      <p className="text-muted-foreground text-xs">
        Reiniciar conserva las películas nominadas; cerrar borra la sala para todos.
      </p>
    </section>
  );
}
