import { describe, expect, it } from "vitest";

import {
  DEFAULT_MAX_PER_GUEST,
  nominationLimit,
  remainingNominations,
  roomVersion,
} from "./nominations";

describe("nominationLimit", () => {
  it("no limita al host", () => {
    expect(nominationLimit({}, true)).toBeNull();
    expect(nominationLimit({ maxPerPerson: 2 }, true)).toBeNull();
  });

  it("aplica el tope por defecto al resto", () => {
    expect(nominationLimit({}, false)).toBe(DEFAULT_MAX_PER_GUEST);
  });

  it("deja que la sala fije su propio tope", () => {
    expect(nominationLimit({ maxPerPerson: 2 }, false)).toBe(2);
  });

  it("respeta un tope de cero", () => {
    // `?? ` y no `||`: con 0 un OR caería al default y dejaría nominar.
    expect(nominationLimit({ maxPerPerson: 0 }, false)).toBe(0);
  });
});

describe("remainingNominations", () => {
  it("descuenta las ya usadas", () => {
    expect(remainingNominations(4, 1)).toBe(3);
    expect(remainingNominations(4, 4)).toBe(0);
  });

  it("nunca devuelve negativos", () => {
    expect(remainingNominations(4, 9)).toBe(0);
  });

  it("sin tope no hay resta", () => {
    expect(remainingNominations(null, 9)).toBeNull();
  });
});

describe("roomVersion", () => {
  it("cambia al agregar una película", () => {
    const base = { phase: "nominating", memberCount: 3, lastMovieAt: "2026-01-01T00:00:00Z" };
    expect(roomVersion({ ...base, movieCount: 2 })).not.toBe(
      roomVersion({ ...base, movieCount: 3 }),
    );
  });

  it("cambia si alguien retira una y otro agrega otra entre dos consultas", () => {
    // El conteo vuelve a coincidir, pero la última nominación es más nueva.
    const antes = roomVersion({
      phase: "nominating",
      movieCount: 3,
      lastMovieAt: "2026-01-01T00:00:00Z",
      memberCount: 3,
    });
    const despues = roomVersion({
      phase: "nominating",
      movieCount: 3,
      lastMovieAt: "2026-01-01T00:05:00Z",
      memberCount: 3,
    });
    expect(antes).not.toBe(despues);
  });

  it("cambia cuando entra alguien nuevo", () => {
    const base = { phase: "nominating", movieCount: 0, lastMovieAt: null };
    expect(roomVersion({ ...base, memberCount: 2 })).not.toBe(
      roomVersion({ ...base, memberCount: 3 }),
    );
  });

  it("cambia al avanzar de fase", () => {
    const base = { movieCount: 16, lastMovieAt: null, memberCount: 4 };
    expect(roomVersion({ ...base, phase: "nominating" })).not.toBe(
      roomVersion({ ...base, phase: "seeding" }),
    );
  });

  it("es estable si nada cambió, dé igual el formato de la fecha", () => {
    const a = roomVersion({
      phase: "nominating",
      movieCount: 1,
      lastMovieAt: new Date("2026-01-01T00:00:00Z"),
      memberCount: 1,
    });
    const b = roomVersion({
      phase: "nominating",
      movieCount: 1,
      lastMovieAt: "2026-01-01T00:00:00.000Z",
      memberCount: 1,
    });
    expect(a).toBe(b);
  });
});
