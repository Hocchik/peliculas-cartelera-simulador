import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import * as schema from "./schema";

let cached: NeonHttpDatabase<typeof schema> | undefined;

/**
 * Cliente de Drizzle sobre Neon.
 *
 * Es una función y no una constante a propósito: conectar en el import haría
 * fallar `next build` en cualquier máquina sin DATABASE_URL. Así el error solo
 * aparece cuando alguien realmente consulta la base.
 */
export function db(): NeonHttpDatabase<typeof schema> {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("Falta DATABASE_URL (ver .env.example)");
    }
    cached = drizzle(neon(url), { schema });
  }
  return cached;
}

export * from "./schema";
