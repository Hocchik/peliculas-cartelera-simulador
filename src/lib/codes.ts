import { randomInt } from "node:crypto";

/** Sin I, O, 0 ni 1: el código se dicta en voz alta y se teclea a mano. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

/** Acepta lo que la gente escribe de verdad: minúsculas, espacios, guiones. */
export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidRoomCode(input: string): boolean {
  const code = normalizeRoomCode(input);
  return code.length === CODE_LENGTH && [...code].every((c) => ALPHABET.includes(c));
}

/** Semilla para el sorteo y para las monedas al aire. */
export function generateSeed(): number {
  return randomInt(1, 2 ** 31 - 1);
}
