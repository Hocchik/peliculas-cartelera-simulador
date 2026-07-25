"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";

import { setExtraPicks } from "@/app/sala/[code]/actions";
import { PosterImage } from "@/components/movie/poster-image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MovieView } from "@/lib/room-types";

const MAX_EXTRAS = 2;

/**
 * El host suma un par de películas a la cartelera además del podio. Se guardan
 * como posiciones 5 y 6, así que entran directo en la imagen que se comparte.
 */
export function ExtraPicks({
  code,
  candidates,
  selected,
}: {
  code: string;
  candidates: MovieView[];
  selected: string[];
}) {
  const [picks, setPicks] = useState<string[]>(selected);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dirty =
    picks.length !== selected.length || picks.some((id) => !selected.includes(id));

  function toggle(movieId: string) {
    setError(null);
    setPicks((current) =>
      current.includes(movieId)
        ? current.filter((id) => id !== movieId)
        : current.length >= MAX_EXTRAS
          ? current // el tope se avisa abajo, no se sustituye a lo callado
          : [...current, movieId],
    );
  }

  function save() {
    setError(null);
    start(async () => {
      const result = await setExtraPicks({ code, movieIds: picks });
      if (!result.ok) setError(result.error);
    });
  }

  if (candidates.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Suma 2 más a la cartelera</h2>
        <p className="text-muted-foreground text-xs">
          Van después del podio en la imagen que compartes. Llevas {picks.length} de{" "}
          {MAX_EXTRAS}.
        </p>
      </div>

      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {candidates.map((movie) => {
          const chosen = picks.includes(movie.id);
          return (
            <li key={movie.id}>
              <button
                type="button"
                aria-pressed={chosen}
                onClick={() => toggle(movie.id)}
                disabled={pending}
                className="w-full text-left"
              >
                <div
                  className={cn(
                    "relative overflow-hidden rounded-md ring-2 transition-all",
                    chosen ? "ring-primary" : "ring-transparent opacity-55 hover:opacity-100",
                  )}
                >
                  <PosterImage
                    path={movie.posterPath}
                    alt={movie.title}
                    size="w185"
                    className="aspect-[2/3] w-full"
                  />
                  {chosen && (
                    <span className="bg-primary text-primary-foreground absolute top-1 right-1 grid size-5 place-items-center rounded-full">
                      <Check className="size-3" />
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-tight">{movie.title}</p>
              </button>
            </li>
          );
        })}
      </ul>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Button size="sm" variant="secondary" disabled={!dirty || pending} onClick={save}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Guardar en la cartelera
      </Button>
    </section>
  );
}
