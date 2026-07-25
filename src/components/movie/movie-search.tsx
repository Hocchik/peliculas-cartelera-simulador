"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Plus, Search } from "lucide-react";

import { addMovie } from "@/app/sala/[code]/actions";
import { PosterImage } from "@/components/movie/poster-image";
import { Input } from "@/components/ui/input";
import type { TmdbMovie } from "@/lib/tmdb-types";

const DEBOUNCE_MS = 300;
const MIN_QUERY = 2;

export function MovieSearch({
  code,
  disabled,
  nominatedTmdbIds,
}: {
  code: string;
  disabled: boolean;
  nominatedTmdbIds: number[];
}) {
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState<{ term: string; results: TmdbMovie[] }>({
    term: "",
    results: [],
  });
  const [failedTerm, setFailedTerm] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, startAdding] = useTransition();

  const term = query.trim();
  const active = term.length >= MIN_QUERY;

  // Todo lo visible se deriva del término actual. Así los resultados de una
  // búsqueda anterior nunca se quedan colgando bajo un texto que ya cambió.
  const results = loaded.term === term ? loaded.results : [];
  const searching = active && loaded.term !== term && failedTerm !== term;
  const error =
    addError ?? (failedTerm === term ? "No se pudo buscar en TMDB. Reintenta." : null);

  useEffect(() => {
    if (!active) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { results: TmdbMovie[] };
        setLoaded({ term, results: data.results });
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") setFailedTerm(term);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, active]);

  function nominate(movie: TmdbMovie) {
    setAddError(null);
    startAdding(async () => {
      const result = await addMovie({ code, tmdbId: movie.tmdbId });
      if (result.ok) {
        setQuery("");
      } else {
        setAddError(result.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setAddError(null);
          }}
          disabled={disabled || adding}
          placeholder="Busca una película: Interestelar, Parasite, El Padrino…"
          className="pl-9"
          aria-label="Buscar película"
        />
        {searching && (
          <Loader2 className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
        )}
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {results.length > 0 && (
        <ul className="divide-border border-border divide-y overflow-hidden rounded-lg border">
          {results.map((movie) => {
            const already = nominatedTmdbIds.includes(movie.tmdbId);
            return (
              <li key={movie.tmdbId}>
                <button
                  type="button"
                  onClick={() => nominate(movie)}
                  disabled={already || adding || disabled}
                  className="hover:bg-accent flex w-full items-center gap-3 p-2 text-left transition-colors disabled:opacity-50"
                >
                  <PosterImage
                    path={movie.posterPath}
                    alt={movie.title}
                    size="w92"
                    className="h-16 w-11 shrink-0 rounded"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {movie.title}
                      {movie.year ? (
                        <span className="text-muted-foreground font-normal"> ({movie.year})</span>
                      ) : null}
                    </span>
                    {movie.originalTitle !== movie.title && (
                      <span className="text-muted-foreground block truncate text-sm">
                        {movie.originalTitle}
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {already ? "Ya está" : <Plus className="size-4" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
