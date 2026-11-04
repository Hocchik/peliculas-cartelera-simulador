"use client";

import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type Tab = "votes" | "bracket";

/**
 * Versus y cuadro en pestañas, para celular y tablet: votar es lo urgente y el
 * cuadro, apilado debajo, empujaba los versus o quedaba fuera de la vista. En
 * escritorio no se usa: ahí el cuadro va en un modal (`BracketDialog`).
 *
 * Los dos paneles siempre están montados (solo se ocultan), así que cambiar de
 * pestaña no pierde el estado de los versus ni el scroll lateral del cuadro.
 */
export function PhaseTabs({
  votes,
  bracket,
  pendingCount,
}: {
  votes: ReactNode;
  bracket: ReactNode;
  /** Versus que le faltan a quien mira: se muestra en la pestaña. */
  pendingCount: number;
}) {
  const [tab, setTab] = useState<Tab>("votes");

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "votes", label: "Versus", badge: pendingCount },
    { id: "bracket", label: "Cuadro" },
  ];

  return (
    <div className="space-y-4">
      <div role="tablist" className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1">
        {tabs.map(({ id, label, badge }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors",
              tab === id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            {badge ? (
              <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-[10px] font-semibold tabular-nums">
                {badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <section
        id="panel-votes"
        role="tabpanel"
        aria-labelledby="tab-votes"
        className={cn(tab !== "votes" && "hidden")}
      >
        {votes}
      </section>

      <section
        id="panel-bracket"
        role="tabpanel"
        aria-labelledby="tab-bracket"
        className={cn(tab !== "bracket" && "hidden")}
      >
        {bracket}
      </section>
    </div>
  );
}
