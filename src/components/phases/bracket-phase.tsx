import { BracketGrid } from "@/components/bracket/bracket-grid";
import { PhaseTabs } from "@/components/bracket/phase-tabs";
import { RoundStatus } from "@/components/bracket/round-status";
import { VoteList } from "@/components/bracket/vote-list";
import { roundName } from "@/lib/bracket";
import type { RoomState } from "@/lib/rooms";

export function BracketPhase({ state }: { state: RoomState }) {
  const { room, me, matches, rounds, voters } = state;
  if (!me) return null;

  const open = matches.filter((match) => match.status === "open");
  const ties = matches.filter((match) => match.status === "tiebreak");
  const round = (open[0] ?? ties[0])?.round ?? rounds;
  const unvoted = open.filter((match) => match.myChoice === null).length;

  return (
    <div className="space-y-4">
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

      <PhaseTabs
        pendingCount={unvoted}
        votes={<VoteList code={room.code} ties={ties} open={open} isHost={me.isHost} />}
        bracket={<BracketGrid matches={matches} rounds={rounds} compact />}
      />
    </div>
  );
}
