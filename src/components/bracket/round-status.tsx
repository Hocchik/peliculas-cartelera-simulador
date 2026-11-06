import { Check, Flag, Scale } from "lucide-react";

import { forceCloseRound } from "@/app/sala/[code]/actions";
import { HostButton } from "@/components/room/host-button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { VoterProgress } from "@/lib/room-types";

/**
 * Cabecera de la ronda: cuánto votaste tú, cuánto va el grupo y QUIÉN falta.
 * Lo ven todos a propósito: es solo un recuento por persona (nunca qué votó),
 * y saber a quién se espera es lo que mantiene el ritmo. Al host además le
 * sirve para decidir si cierra la ronda igual o si saca a una cuenta fantasma.
 *
 * En móvil va todo apilado; desde `md` el avance queda a la izquierda y la
 * gente a la derecha, para no estirar una barra de 1000 px.
 */
export function RoundStatus({
  code,
  title,
  round,
  meId,
  isHost,
  voters,
  openCount,
  tieCount,
}: {
  code: string;
  title: string;
  round: number;
  meId: string;
  isHost: boolean;
  voters: VoterProgress[];
  openCount: number;
  tieCount: number;
}) {
  const cast = voters.reduce((sum, voter) => sum + voter.cast, 0);
  const expected = voters.length * openCount;
  const pending = expected - cast;
  const percent = expected > 0 ? Math.round((cast / expected) * 100) : 100;
  const mine = voters.find((voter) => voter.id === meId)?.cast ?? 0;

  // Primero a quien más le falta: es a quien hay que apurar.
  const missing = voters
    .filter((voter) => voter.cast < openCount)
    .sort((a, b) => a.cast - b.cast || a.nickname.localeCompare(b.nickname));
  const done = voters.filter((voter) => voter.cast >= openCount);

  return (
    <Card size="sm">
      <CardContent className="space-y-3 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:gap-6 md:space-y-0">
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            {openCount > 0 && (
              <p className="text-sm">
                Tú:{" "}
                <span className="font-semibold tabular-nums">
                  {mine} de {openCount}
                </span>
              </p>
            )}
          </div>

          {openCount > 0 ? (
            <>
              <div
                role="progressbar"
                aria-label="Votos de la ronda"
                aria-valuemin={0}
                aria-valuemax={expected}
                aria-valuenow={cast}
                className="bg-muted h-2 overflow-hidden rounded-full"
              >
                <div
                  className="bg-primary h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="text-muted-foreground text-xs tabular-nums">
                {cast} de {expected} votos ·{" "}
                {pending > 0
                  ? `${missing.length} ${missing.length === 1 ? "persona" : "personas"} por terminar`
                  : "cerrando la ronda…"}
              </p>
            </>
          ) : (
            tieCount > 0 && (
              <p className="text-primary flex items-center gap-1.5 text-sm font-medium">
                <Scale className="size-4 shrink-0" />
                {isHost
                  ? `${tieCount === 1 ? "Queda un empate" : `Quedan ${tieCount} empates`}: elige quién pasa o tira la moneda.`
                  : `${tieCount === 1 ? "Queda un empate" : `Quedan ${tieCount} empates`}: los resuelve el host.`}
              </p>
            )
          )}

          {isHost && openCount > 0 && pending > 0 && (
            <HostButton
              code={code}
              action={forceCloseRound.bind(null, round)}
              label="Cerrar la ronda igual"
              variant="secondary"
              confirm={{
                title: "¿Cerramos la ronda igual?",
                description: `Faltan ${pending} ${pending === 1 ? "voto" : "votos"}. Los ${openCount} versus abiertos se resuelven con lo que haya, y los empates los decides tú.`,
                confirmLabel: "Cerrar la ronda",
                icon: <Flag />,
                // Quiénes faltan, con cuántos versus cada uno: el host decide
                // mirando a quién deja afuera, no un número.
                details: (
                  <PeopleRow label="Faltan">
                    {missing.map((voter) => (
                      <Person key={voter.id} voter={voter} isMe={voter.id === meId}>
                        <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-[10px] font-semibold tabular-nums">
                          {openCount - voter.cast}
                        </span>
                      </Person>
                    ))}
                  </PeopleRow>
                ),
              }}
            />
          )}
        </div>

        {openCount > 0 && voters.length > 0 && (
          <div className="space-y-2">
            {missing.length > 0 && (
              <PeopleRow label="Faltan">
                {missing.map((voter) => (
                  <Person key={voter.id} voter={voter} isMe={voter.id === meId}>
                    <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-[10px] font-semibold tabular-nums">
                      {openCount - voter.cast}
                    </span>
                  </Person>
                ))}
              </PeopleRow>
            )}
            {done.length > 0 && (
              <PeopleRow label="Listos">
                {done.map((voter) => (
                  <Person key={voter.id} voter={voter} isMe={voter.id === meId} done>
                    <Check className="text-primary size-3" />
                  </Person>
                ))}
              </PeopleRow>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PeopleRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground w-11 shrink-0 pt-1 text-[11px] font-semibold tracking-wide uppercase">
        {label}
      </span>
      <ul className="flex min-w-0 flex-wrap gap-1.5">{children}</ul>
    </div>
  );
}

function Person({
  voter,
  isMe,
  done = false,
  children,
}: {
  voter: VoterProgress;
  isMe: boolean;
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li
      aria-label={
        done ? `${voter.nickname} ya votó todo` : `A ${voter.nickname} le faltan versus por votar`
      }
      className={cn(
        "flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-2 text-xs",
        done ? "text-muted-foreground border-transparent bg-muted" : "border-primary/40 bg-primary/10",
        isMe && "ring-primary ring-1",
      )}
    >
      <span className="max-w-[9rem] truncate">{isMe ? `${voter.nickname} (tú)` : voter.nickname}</span>
      {children}
    </li>
  );
}
