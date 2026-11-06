"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Ventana modal sobre `<dialog>` + `showModal()`: el navegador ya resuelve lo
 * difícil (capa superior, foco atrapado adentro, Escape, fondo inerte). Solo
 * se le pone el estilo de la app, en vez del `confirm()` gris del sistema.
 *
 * En el celular sale como hoja desde abajo, con los botones al alcance del
 * pulgar; desde `sm` va centrada.
 */
export function Modal({
  open,
  onClose,
  busy = false,
  labelledBy,
  role,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Mientras corre la acción no se cierra: ni con Escape ni tocando afuera. */
  busy?: boolean;
  labelledBy?: string;
  role?: "dialog" | "alertdialog";
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      role={role}
      aria-labelledby={labelledBy}
      // Escape dispara `cancel`: se intercepta para que el estado lo maneje React.
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      // Un clic en el fondo llega al propio <dialog>; uno en el contenido, no.
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      className={cn(
        "bg-card text-card-foreground border-foreground/10 m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border p-0 shadow-2xl",
        "backdrop:bg-black/60 backdrop:backdrop-blur-sm",
        "max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none",
        "open:animate-in open:fade-in open:slide-in-from-bottom-6 sm:open:slide-in-from-bottom-0 sm:open:zoom-in-95",
        className,
      )}
    >
      {open && <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>}
    </dialog>
  );
}
