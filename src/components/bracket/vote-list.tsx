"use client";

import { useState } from "react";
import { Crown } from "lucide-react";

import { VoteCard } from "@/components/bracket/vote-card";
import { Button } from "@/components/ui/button";
import type { MatchView } from "@/lib/room-types";

/**
 * Los versus de la ronda, empates primero. Pasa a dos columnas cuando el
 * contenedor (no la pantalla) tiene sitio: en escritorio comparte el ancho con
 * el cuadro, así que la pantalla sola no dice cuánto espacio hay.
 *
 * El poder del host de hacer pasar a cualquiera va detrás de "Decidir a mano":
 * se usa poco y, siempre a la vista, duplicaba la altura de cada versus.
 */
export function VoteList({
  code,
  ties,
  open,
  isHost,
}: {
  code: string;
  ties: MatchView[];
  open: MatchView[];
  isHost: boolean;
}) {
  const [hostMode, setHostMode] = useState(false);
  const unvoted = open.filter((match) => match.myChoice === null).length;

  return (
    <div className="@container space-y-2">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {open.length === 0
            ? "Empates"
            : unvoted > 0
              ? `Te ${unvoted === 1 ? "falta" : "faltan"} ${unvoted}`
              : "Votaste todo · puedes cambiar"}
        </h3>
        {isHost && open.length > 0 && (
          <Button
            size="xs"
            variant={hostMode ? "default" : "outline"}
            aria-pressed={hostMode}
            onClick={() => setHostMode((on) => !on)}
          >
            <Crown />
            Decidir a mano
          </Button>
        )}
      </div>

      {/* `grid-cols-1` es `minmax(0, 1fr)`: sin eso, un título largo con
          `truncate` estira la fila más allá de la pantalla. */}
      <ul className="grid grid-cols-1 gap-2 @xl:grid-cols-2">
        {[...ties, ...open].map((match) => (
          <VoteCard
            key={match.id}
            code={code}
            match={match}
            isHost={isHost}
            hostMode={hostMode}
          />
        ))}
      </ul>
    </div>
  );
}
