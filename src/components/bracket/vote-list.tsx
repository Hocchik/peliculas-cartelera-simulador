"use client";

import { useState } from "react";
import { Crown } from "lucide-react";

import { VoteCard, type VoteCardVariant } from "@/components/bracket/vote-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MatchView } from "@/lib/room-types";

/**
 * Los versus de la ronda, empates primero, en grilla de cartelera.
 *
 * El poder del host de hacer pasar a cualquiera va detrás de "Decidir a mano":
 * se usa poco y, siempre a la vista, agrandaba cada versus.
 */
export function VoteList({
  code,
  ties,
  open,
  isHost,
  variant,
}: {
  code: string;
  ties: MatchView[];
  open: MatchView[];
  isHost: boolean;
  variant: VoteCardVariant;
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

      {/* Columnas según el ancho del contenedor, no de la pantalla. Las de
          `grid-cols-*` son `minmax(0, 1fr)`: un título largo no las estira. */}
      <ul
        className={cn(
          "grid gap-2",
          variant === "rows"
            ? "grid-cols-1 @xl:grid-cols-2"
            : "grid-cols-2 gap-3 @3xl:grid-cols-3 @5xl:grid-cols-4",
        )}
      >
        {[...ties, ...open].map((match) => (
          <VoteCard
            key={match.id}
            code={code}
            match={match}
            isHost={isHost}
            hostMode={hostMode}
            variant={variant}
          />
        ))}
      </ul>
    </div>
  );
}
