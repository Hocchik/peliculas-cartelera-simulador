"use client";

import { useState, useTransition } from "react";
import { Ban, Crown, Loader2, UserMinus, Users, X } from "lucide-react";

import { kickParticipant } from "@/app/sala/[code]/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { MemberView } from "@/lib/room-types";

/**
 * Quién está en la sala. Para el host cada invitado lleva una ✕ que abre dos
 * opciones: sacarlo (puede volver con el código) o bloquearlo (ese navegador ya
 * no entra). Todos ven la lista, así que una cuenta de más salta a la vista.
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
  const [target, setTarget] = useState<MemberView | null>(null);

  return (
    <>
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
                  onClick={() => setTarget(member)}
                  aria-label={`Sacar a ${member.nickname} de la sala`}
                  className="hover:bg-destructive hover:text-destructive-foreground ml-0.5 grid size-5 place-items-center rounded-full transition-colors"
                >
                  <X className="size-3" />
                </button>
              )}
            </Badge>
          );
        })}
      </div>

      {target && <KickDialog code={code} member={target} onClose={() => setTarget(null)} />}
    </>
  );
}

function KickDialog({
  code,
  member,
  onClose,
}: {
  code: string;
  member: MemberView;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function kick(ban: boolean) {
    setError(null);
    start(async () => {
      const result = await kickParticipant({ code, participantId: member.id, ban });
      if (result.ok) onClose();
      else setError(result.error);
    });
  }

  return (
    <Modal open onClose={onClose} busy={pending} labelledBy="kick-title">
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 id="kick-title" className="text-lg font-semibold">
            ¿Qué hacemos con {member.nickname}?
          </h2>
          <p className="text-muted-foreground text-sm">
            En los dos casos se anulan sus votos de la ronda abierta y deja de contar para cerrarla.
          </p>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => kick(false)}
            className="hover:bg-accent flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors disabled:opacity-50"
          >
            <UserMinus className="mt-0.5 size-5 shrink-0" />
            <span>
              <span className="block font-medium">Sacar de la sala</span>
              <span className="text-muted-foreground block text-sm">
                Es del grupo: puede volver a entrar con el código cuando quiera.
              </span>
            </span>
          </button>

          <button
            type="button"
            disabled={pending}
            onClick={() => kick(true)}
            className="border-destructive/40 hover:bg-destructive/10 flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors disabled:opacity-50"
          >
            <Ban className="text-destructive mt-0.5 size-5 shrink-0" />
            <span>
              <span className="text-destructive block font-medium">Sacar y bloquear</span>
              <span className="text-muted-foreground block text-sm">
                No es del grupo o es una cuenta repetida: desde ese navegador ya no podrá entrar.
              </span>
            </span>
          </button>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <Button variant="ghost" className="w-full" disabled={pending} onClick={onClose}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Cancelar
        </Button>
      </div>
    </Modal>
  );
}
