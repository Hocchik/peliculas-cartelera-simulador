"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db, participants, rooms } from "@/db";
import { generateRoomCode, generateSeed, normalizeRoomCode } from "@/lib/codes";
import { isUniqueViolation } from "@/lib/db-errors";
import { findRoomByCode } from "@/lib/rooms";
import { ensureDeviceToken } from "@/lib/session";

export type FormState = { error: string } | null;

const nickname = z
  .string()
  .trim()
  .min(2, "El apodo necesita al menos 2 letras")
  .max(24, "El apodo no puede pasar de 24 letras");

const createRoomSchema = z.object({
  name: z.string().trim().max(60, "El nombre de la sala es muy largo"),
  nickname,
});

const joinRoomSchema = z.object({
  code: z.string().trim().min(1, "Escribe el código de la sala"),
  nickname,
});

export async function createRoom(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = createRoomSchema.safeParse({
    name: formData.get("name") ?? "",
    nickname: formData.get("nickname") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const deviceToken = await ensureDeviceToken();
  let code: string | null = null;

  for (let attempt = 0; attempt < 5 && code === null; attempt++) {
    const candidate = generateRoomCode();
    let roomId: string | null = null;

    try {
      const [room] = await db()
        .insert(rooms)
        .values({
          code: candidate,
          name: parsed.data.name || "Mundial de Pelis",
          phase: "nominating",
          drawSeed: generateSeed(),
          tiebreakSeed: generateSeed(),
        })
        .returning();
      roomId = room.id;

      await db().insert(participants).values({
        roomId: room.id,
        nickname: parsed.data.nickname,
        avatarSeed: generateSeed(),
        isHost: true,
        deviceToken,
      });

      code = candidate;
    } catch (error) {
      // El driver HTTP de Neon no da transacciones interactivas, así que si el
      // host no se pudo crear hay que deshacer la sala a mano o queda huérfana.
      if (roomId) await db().delete(rooms).where(eq(rooms.id, roomId));
      if (isUniqueViolation(error, "rooms_code_unq")) continue;
      throw error;
    }
  }

  if (code === null) {
    return { error: "No se pudo generar un código libre. Intenta de nuevo." };
  }

  redirect(`/sala/${code}`);
}

export async function joinRoom(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = joinRoomSchema.safeParse({
    code: formData.get("code") ?? "",
    nickname: formData.get("nickname") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const room = await findRoomByCode(parsed.data.code);
  if (!room) {
    return { error: `No existe ninguna sala con el código ${normalizeRoomCode(parsed.data.code)}` };
  }

  const deviceToken = await ensureDeviceToken();
  const [existing] = await db()
    .select()
    .from(participants)
    .where(and(eq(participants.roomId, room.id), eq(participants.deviceToken, deviceToken)))
    .limit(1);

  if (!existing) {
    if (room.phase !== "nominating") {
      return { error: "Esa sala ya cerró las nominaciones y no admite gente nueva" };
    }
    try {
      await db().insert(participants).values({
        roomId: room.id,
        nickname: parsed.data.nickname,
        avatarSeed: generateSeed(),
        deviceToken,
      });
    } catch (error) {
      if (isUniqueViolation(error, "participants_room_nickname_unq")) {
        return { error: `Ya hay alguien con el apodo "${parsed.data.nickname}" en la sala` };
      }
      throw error;
    }
  }

  redirect(`/sala/${room.code}`);
}
