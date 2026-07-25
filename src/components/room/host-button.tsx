"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import type { ActionResult } from "@/app/sala/[code]/actions";
import { Button } from "@/components/ui/button";

/**
 * Botón para las acciones del host. `confirm` está pensado para el cierre
 * forzado de ronda: es irreversible y se dispara con el pulgar desde el móvil.
 */
export function HostButton({
  code,
  action,
  label,
  confirm,
  variant = "default",
}: {
  code: string;
  action: (code: string) => Promise<ActionResult>;
  label: string;
  confirm?: string;
  variant?: "default" | "secondary" | "destructive" | "outline";
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <Button
        variant={variant}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setError(null);
          start(async () => {
            const result = await action(code);
            if (!result.ok) setError(result.error);
          });
        }}
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {label}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
