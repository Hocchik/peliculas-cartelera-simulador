import type { NextRequest } from "next/server";

import { readDeviceToken } from "@/lib/session";
import { searchMovies } from "@/lib/tmdb";

/**
 * Proxy de búsqueda de TMDB. Existe para que el token no salga del servidor.
 * Pide cookie de dispositivo válida: es un proxy público si no, y cualquiera
 * podría gastarnos la cuota de la API.
 */
export async function GET(request: NextRequest) {
  const deviceToken = await readDeviceToken();
  if (!deviceToken) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q") ?? "";

  try {
    return Response.json({ results: await searchMovies(query) });
  } catch {
    return Response.json({ error: "TMDB no respondió" }, { status: 502 });
  }
}
