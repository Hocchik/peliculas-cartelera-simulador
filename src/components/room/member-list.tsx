"use client";

import { useState, useTransition } from "react";
import { Crown, Loader2, Users, X } from "lucide-react";

import { kickParticipant } from "@/app/sala/[code]/actions";
import { Badge } from "@/components/ui/badge";
import type { MemberView } from "@/lib/room-types";

/**
 * Quién está en la sala. Para el host cada invitado lleva una ✕ para sacarlo:
 * es la defensa contra quien entra desde otro navegador con un apodo inventado
 * para tener dos votos. Todos ven la lista, así que una cuenta de más salta a la
 * vista del grupo.
 */
export function MemberList({
  code,
  members,
  meId,
  isHost,
}: {
  code: string;
  members: MemberView[];
  meId: string;
  isHost: boolean;
}) {
  const [pending, start] = useTransition();
  const [kicking, setKicking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function kick(member: MemberView) {
    if (
      !window.confirm(
        `¿Sacar a ${member.nickname} de la sala? Se anulan sus votos de la ronda abierta y ese navegador no podrá volver a entrar.`,
      )
    ) {
      return;
    }
    setError(null);
    setKicking(member.id);
    start(async () => {
      const result = await kickParticipant({ code, participantId: member.id });
      if (!result.ok) setError(result.error);
      setKicking(null);
    });
  }

  return (
    <div className="space-y-1">
      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
        <span className="flex items-center gap-1">
          <Users className="size-4" />
          <span className="tabular-nums">{members.length}</span>
        </span>
        {members.map((member) => {
          const canKick = isHost && !member.isHost;
          return (
            <Badge
              key={member.id}
              variant={member.id === meId ? "default" : "secondary"}
              className={canKick ? "pr-0.5" : undefined}
            >
              {member.isHost && <Crown className="size-3" />}
              {member.nickname}
              {canKick && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => kick(member)}
                  aria-label={`Sacar a ${member.nickname} de la sala`}
                  className="hover:bg-destructive hover:text-destructive-foreground ml-0.5 grid size-5 place-items-center rounded-full transition-colors disabled:opacity-50"
                >
                  {kicking === member.id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <X className="size-3" />
                  )}
                </button>
              )}
            </Badge>
          );
        })}
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
