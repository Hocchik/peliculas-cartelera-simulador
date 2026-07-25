"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 3000;

/**
 * Mantiene la sala al día sin recargar. Pregunta cada 3 s por la huella del
 * estado y solo pide el render nuevo cuando cambió, para no interrumpir a quien
 * está escribiendo en el buscador.
 */
export function LiveUpdates({ code, version }: { code: string; version: string }) {
  const router = useRouter();
  const known = useRef(version);

  // El servidor manda la huella del render actual: esa pasa a ser la conocida.
  useEffect(() => {
    known.current = version;
  }, [version]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    async function check() {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/sala/${code}/pulse`, { cache: "no-store" });
        if (!res.ok) return;
        const { version: latest } = (await res.json()) as { version: string };
        if (!stopped && latest !== known.current) {
          known.current = latest;
          router.refresh();
        }
      } catch {
        // Sin conexión: el siguiente latido reintenta.
      }
    }

    // Encadenado y no `setInterval`: si una respuesta tarda, no se apilan.
    async function loop() {
      await check();
      if (!stopped) timer = setTimeout(loop, POLL_MS);
    }

    timer = setTimeout(loop, POLL_MS);

    // Al volver a la pestaña, mirar de inmediato en vez de esperar el turno.
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [code, router]);

  return null;
}
