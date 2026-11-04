"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Network, X } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * En escritorio el cuadro no ocupa la pantalla: se abre a pedido. Lo que se
 * consulta seguido (cómo terminó cada versus) queda a la vista en
 * `RoundResults`; el cuadro entero es para mirar el camino a la final.
 *
 * El contenido llega ya renderizado desde el servidor (`bracket`), así que el
 * modal no vuelve a pedir nada al abrirse.
 */
export function BracketDialog({ bracket }: { bracket: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <Network className="rotate-90" />
        Ver el cuadro completo
      </Button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bracket-title"
          className="bg-background/80 fixed inset-0 z-50 grid place-items-center p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-card max-h-[calc(100svh-2rem)] w-fit max-w-full overflow-y-auto rounded-xl border p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-6">
              <h2 id="bracket-title" className="text-lg font-semibold">
                El cuadro
              </h2>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Cerrar el cuadro"
                onClick={() => setOpen(false)}
              >
                <X />
              </Button>
            </div>
            {bracket}
          </div>
        </div>
      )}
    </>
  );
}
