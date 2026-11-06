"use client";

import { useId, type ReactNode } from "react";
import { CircleHelp, Loader2, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

/** El texto de una confirmación. Lo arma quien sabe qué se está por hacer. */
export type ConfirmCopy = {
  title: string;
  description: ReactNode;
  /** Dice exactamente lo que pasa: "Cerrar la ronda", no "Aceptar". */
  confirmLabel: string;
  cancelLabel?: string;
  /** `destructive` para lo que borra o no se puede deshacer. */
  tone?: "default" | "destructive";
  icon?: ReactNode;
  /** Algo más que mostrar debajo, por ejemplo quiénes faltan votar. */
  details?: ReactNode;
};

/**
 * Confirmación de una acción del host. Reemplaza a `window.confirm()`: mismo
 * propósito (frenar un toque por error en el celular), pero con el estilo de la
 * app, un botón que nombra la acción y la respuesta del servidor adentro.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  tone = "default",
  icon,
  details,
  pending,
  error,
  onConfirm,
  onCancel,
}: ConfirmCopy & {
  open: boolean;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const destructive = tone === "destructive";

  return (
    <Modal open={open} onClose={onCancel} busy={pending} labelledBy={titleId} role="alertdialog">
      <div className="flex gap-3">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full [&_svg]:size-5",
            destructive ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary",
          )}
        >
          {icon ?? (destructive ? <TriangleAlert /> : <CircleHelp />)}
        </span>
        <div className="min-w-0 space-y-1.5 pt-0.5">
          <h2 id={titleId} className="text-base leading-tight font-semibold">
            {title}
          </h2>
          <div className="text-muted-foreground text-sm">{description}</div>
        </div>
      </div>

      {details && <div className="mt-4">{details}</div>}
      {error && <p className="text-destructive mt-4 text-sm">{error}</p>}

      {/* Cancelar va primero en el DOM: es lo que enfoca `showModal()`, así un
          Enter apurado no confirma. En el celular, la acción queda arriba. */}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" size="lg" disabled={pending} onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? "destructive" : "default"}
          size="lg"
          disabled={pending}
          onClick={onConfirm}
        >
          {pending && <Loader2 className="animate-spin" />}
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
