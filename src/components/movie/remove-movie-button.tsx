"use client";

import { useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";

import { removeMovie } from "@/app/sala/[code]/actions";

export function RemoveMovieButton({
  code,
  movieId,
  title,
}: {
  code: string;
  movieId: string;
  title: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <button
      type="button"
      title={error ?? `Retirar ${title}`}
      aria-label={`Retirar ${title}`}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await removeMovie({ code, movieId });
          if (!result.ok) setError(result.error);
        })
      }
      className="bg-background/80 text-foreground hover:bg-destructive hover:text-white absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full backdrop-blur transition-colors"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
    </button>
  );
}
