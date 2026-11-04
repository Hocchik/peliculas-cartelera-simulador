import { BracketDialog } from "@/components/bracket/bracket-dialog";
import { BracketGrid } from "@/components/bracket/bracket-grid";
import { PhaseTabs } from "@/components/bracket/phase-tabs";
import { RoundResults } from "@/components/bracket/round-results";
import { RoundStatus } from "@/components/bracket/round-status";
import { VoteList } from "@/components/bracket/vote-list";
import { roundName } from "@/lib/bracket";
import type { RoomState } from "@/lib/rooms";

/**
 * Dos disposiciones, una por tamaño:
 *  - Celular y tablet: pestañas Versus | Cuadro, con los versus en filas
 *    compactas para votar rápido sin scroll.
 *  - Escritorio (`xl`): versus en tamaño cartelera con todo el ancho, y al
 *    costado cómo terminaron los versus ya jugados; el cuadro, en un modal.
 *
 * Se renderizan las dos y el CSS muestra una. Las imágenes son `lazy`, así que
 * la que está oculta no descarga pósters.
 */
export function BracketPhase({ state }: { state: RoomState }) {
  const { room, me, matches, rounds, voters } = state;
  if (!me) return null;

  const open = matches.filter((match) => match.status === "open");
  const ties = matches.filter((match) => match.status === "tiebreak");
  const round = (open[0] ?? ties[0])?.round ?? rounds;
  const unvoted = open.filter((match) => match.myChoice === null).length;

  const list = (variant: "rows" | "posters") => (
    <VoteList code={room.code} ties={ties} open={open} isHost={me.isHost} variant={variant} />
  );

  return (
    <div className="space-y-4 xl:space-y-6">
      <RoundStatus
        code={room.code}
        title={roundName(round, 2 ** rounds)}
        round={round}
        meId={me.id}
        isHost={me.isHost}
        voters={voters}
        openCount={open.length}
        tieCount={ties.length}
      />

      <div className="xl:hidden">
        <PhaseTabs
          pendingCount={unvoted}
          votes={list("rows")}
          bracket={<BracketGrid matches={matches} rounds={rounds} />}
        />
      </div>

      <div className="hidden xl:grid xl:grid-cols-[minmax(0,1fr)_19rem] xl:items-start xl:gap-8">
        {list("posters")}

        <aside className="sticky top-6 max-h-[calc(100svh-3rem)] space-y-4 overflow-y-auto">
          <BracketDialog bracket={<BracketGrid matches={matches} rounds={rounds} />} />
          <section className="space-y-2">
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Resultados
            </h2>
            <RoundResults matches={matches} rounds={rounds} />
          </section>
        </aside>
      </div>
    </div>
  );
}
