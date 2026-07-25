import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Identidad del participante. No hay contraseñas ni emails: cada dispositivo
 * guarda un token aleatorio en una cookie firmada, y ese token es quien vota.
 * La firma impide que alguien se invente el token de otro desde el navegador.
 */

const COOKIE_NAME = "mdp_device";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error("Falta SESSION_SECRET (ver .env.example)");
  }
  return value;
}

function sign(token: string): string {
  return createHmac("sha256", secret()).update(token).digest("base64url");
}

function verify(raw: string): string | null {
  const separator = raw.lastIndexOf(".");
  if (separator <= 0) return null;

  const token = raw.slice(0, separator);
  const received = Buffer.from(raw.slice(separator + 1));
  const expected = Buffer.from(sign(token));

  if (received.length !== expected.length) return null;
  return timingSafeEqual(received, expected) ? token : null;
}

/** Lee la identidad del dispositivo. Sirve en Server Components. */
export async function readDeviceToken(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE_NAME)?.value;
  return raw ? verify(raw) : null;
}

/**
 * Devuelve la identidad del dispositivo, creándola si no existía.
 * Escribe cookie, así que solo se puede llamar desde Server Actions o Route
 * Handlers — nunca durante el render de un Server Component.
 */
export async function ensureDeviceToken(): Promise<string> {
  const existing = await readDeviceToken();
  if (existing) return existing;

  const token = randomBytes(24).toString("base64url");
  (await cookies()).set(COOKIE_NAME, `${token}.${sign(token)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return token;
}
