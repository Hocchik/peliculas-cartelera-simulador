"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import type { ActionResult } from "@/app/sala/[code]/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, type ConfirmCopy } from "@/components/ui/confirm-dialog";

/**
 * Botón para las acciones del host. Con `confirm`, antes de actuar abre un
 * diálogo con el texto de esa acción: casi todas son irreversibles y se
 * disparan con el pulgar desde el celular. Si el servidor rechaza la acción,
 * el error aparece dentro del diálogo, donde el host está mirando.
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
  confirm?: ConfirmCopy;
  variant?: "default" | "secondary" | "destructive" | "outline";
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    start(async () => {
      const result = await action(code);
      if (result.ok) setOpen(false);
      else setError(result.error);
    });
  }

  return (
    <div className="space-y-1">
      <Button
        variant={variant}
        disabled={pending}
        onClick={() => {
          if (!confirm) return run();
          setError(null);
          setOpen(true);
        }}
      >
        {pending && !open && <Loader2 className="size-4 animate-spin" />}
        {label}
      </Button>
      {error && !open && <p className="text-destructive text-sm">{error}</p>}

      {confirm && (
        <ConfirmDialog
          {...confirm}
          open={open}
          pending={pending}
          error={error}
          onConfirm={run}
          onCancel={() => setOpen(false)}
        />
      )}
    </div>
  );
}
