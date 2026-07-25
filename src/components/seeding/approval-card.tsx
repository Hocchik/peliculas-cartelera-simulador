"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";

import { toggleApproval } from "@/app/sala/[code]/actions";
import { PosterImage } from "@/components/movie/poster-image";
import { cn } from "@/lib/utils";
import type { MovieView } from "@/lib/room-types";

export function ApprovalCard({
  code,
  movie,
  approved,
}: {
  code: string;
  movie: MovieView;
  approved: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <li>
      <button
        type="button"
        aria-pressed={approved}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await toggleApproval({ code, movieId: movie.id });
            setError(result.ok ? null : result.error);
          })
        }
        className="group w-full text-left"
      >
        <div
          className={cn(
            "relative overflow-hidden rounded-lg ring-2 transition-all",
            approved ? "ring-primary" : "ring-transparent opacity-60 hover:opacity-100",
          )}
        >
          <PosterImage path={movie.posterPath} alt={movie.title} className="aspect-[2/3] w-full" />
          <span
            className={cn(
              "absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full transition-colors",
              approved ? "bg-primary text-primary-foreground" : "bg-background/80 backdrop-blur",
            )}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className={cn("size-4", !approved && "opacity-30")} />
            )}
          </span>
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm leading-tight font-medium">{movie.title}</p>
        {error && <p className="text-destructive text-xs">{error}</p>}
      </button>
    </li>
  );
}
