"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { createRoom, type FormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateRoomForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createRoom, null);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="create-nickname">Tu apodo</Label>
        <Input
          id="create-nickname"
          name="nickname"
          required
          maxLength={24}
          autoComplete="nickname"
          placeholder="Josué"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="create-name">Nombre de la sala</Label>
        <Input id="create-name" name="name" maxLength={60} placeholder="Noche de pelis" />
      </div>

      {state?.error && <p className="text-destructive text-sm">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Loader2 className="size-4 animate-spin" />}
        Crear sala
      </Button>
    </form>
  );
}
