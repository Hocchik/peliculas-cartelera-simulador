"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { joinRoom, type FormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function JoinRoomForm({ code, autoFocus }: { code?: string; autoFocus?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(joinRoom, null);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="join-nickname">Tu apodo</Label>
        <Input
          id="join-nickname"
          name="nickname"
          required
          maxLength={24}
          autoComplete="nickname"
          autoFocus={autoFocus}
          placeholder="Josué"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="join-code">Código de la sala</Label>
        <Input
          id="join-code"
          name="code"
          required
          defaultValue={code}
          readOnly={code !== undefined}
          maxLength={9}
          placeholder="K7RM2X"
          className="font-mono tracking-[0.2em] uppercase"
        />
      </div>

      {state?.error && <p className="text-destructive text-sm">{state.error}</p>}

      <Button type="submit" disabled={pending} variant="secondary" className="w-full">
        {pending && <Loader2 className="size-4 animate-spin" />}
        Entrar
      </Button>
    </form>
  );
}
