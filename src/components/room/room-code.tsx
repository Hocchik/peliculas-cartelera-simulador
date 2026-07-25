"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

export function RoomCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}/sala/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles el código sigue visible para dictarlo.
    }
  }

  return (
    <div className="flex items-center gap-2">
      <code className="bg-muted rounded-md px-2.5 py-1 font-mono text-lg tracking-[0.25em]">
        {code}
      </code>
      <Button variant="ghost" size="sm" onClick={copy}>
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Copiado" : "Copiar link"}
      </Button>
    </div>
  );
}
