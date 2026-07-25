import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { db, participants } from "@/db";
import { computeRoomVersion, findRoomByCode } from "@/lib/rooms";
import { readDeviceToken } from "@/lib/session";

/**
 * Latido barato para el polling: devuelve solo la huella del estado de la sala.
 * El cliente la compara con la que ya tiene y recién entonces pide el render
 * completo, así no se re-renderiza la pantalla cada 3 segundos porque sí.
 */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;

  const deviceToken = await readDeviceToken();
  if (!deviceToken) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const room = await findRoomByCode(code);
  if (!room) {
    return Response.json({ error: "La sala no existe" }, { status: 404 });
  }

  const [me] = await db()
    .select({ id: participants.id })
    .from(participants)
    .where(and(eq(participants.roomId, room.id), eq(participants.deviceToken, deviceToken)))
    .limit(1);

  if (!me) {
    return Response.json({ error: "No estás en esta sala" }, { status: 403 });
  }

  return Response.json({ version: await computeRoomVersion(room) });
}
