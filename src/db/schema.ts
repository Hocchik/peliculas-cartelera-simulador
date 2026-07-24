import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const roomPhase = pgEnum("room_phase", [
  "lobby",
  "nominating",
  "seeding",
  "draw",
  "bracket",
  "finished",
]);

export const matchStatus = pgEnum("match_status", ["pending", "open", "decided"]);

/** Cómo se resolvió un versus. `bye` = pasó sin rival por cuadro incompleto. */
export const decidedBy = pgEnum("decided_by", ["votes", "coinflip", "host", "bye"]);

export type RoomSettings = {
  /** Tope de nominaciones por persona. Sin definir = libre (el default). */
  maxPerPerson?: number;
};

// ---------------------------------------------------------------------------
// Tablas
// ---------------------------------------------------------------------------

/**
 * Una sala es un evento único: se crea, se juega y se archiva. No se reutiliza,
 * por eso el sorteo vive aquí y no en una tabla `tournaments` aparte.
 */
export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    phase: roomPhase("phase").notNull().default("lobby"),
    /** Semilla del sorteo. Fija al crear la sala: el cuadro es reproducible. */
    drawSeed: integer("draw_seed").notNull(),
    /** Semilla de las monedas al aire. Ídem: un refresh no cambia un desempate. */
    tiebreakSeed: integer("tiebreak_seed").notNull(),
    settings: jsonb("settings").$type<RoomSettings>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("rooms_code_unq").on(t.code)],
);

export const participants = pgTable(
  "participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    nickname: text("nickname").notNull(),
    /** Semilla del avatar generado. Evita pedir foto de perfil. */
    avatarSeed: integer("avatar_seed").notNull(),
    isHost: boolean("is_host").notNull().default(false),
    /** Token aleatorio guardado en cookie firmada: es la identidad del participante. */
    deviceToken: text("device_token").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("participants_device_token_unq").on(t.deviceToken),
    uniqueIndex("participants_room_nickname_unq").on(t.roomId, t.nickname),
    // Un solo host por sala, garantizado por la base y no por el código.
    uniqueIndex("participants_single_host_unq")
      .on(t.roomId)
      .where(sql`is_host`),
    index("participants_room_idx").on(t.roomId),
  ],
);

/**
 * Nominaciones. Los datos de TMDB se denormalizan al insertar: la sala debe
 * seguir funcionando aunque TMDB esté caído.
 */
export const movies = pgTable(
  "movies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    tmdbId: integer("tmdb_id").notNull(),
    /** Título en español (TMDB `language=es-MX`). */
    title: text("title").notNull(),
    /** Título original, normalmente en inglés. Se muestra como subtítulo. */
    originalTitle: text("original_title").notNull(),
    year: integer("year"),
    posterPath: text("poster_path"),
    runtime: integer("runtime"),
    overview: text("overview"),
    voteAverage: real("vote_average"),
    /** Autoría: SOLO se expone al host (ver invariante 4 en CLAUDE.md). */
    addedBy: uuid("added_by").references(() => participants.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("movies_room_tmdb_unq").on(t.roomId, t.tmdbId),
    index("movies_room_idx").on(t.roomId),
  ],
);

/** Votos de aprobación de la fase de siembra: "¿cuáles verías?". */
export const seedVotes = pgTable(
  "seed_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    movieId: uuid("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("seed_votes_unq").on(t.roomId, t.participantId, t.movieId),
    index("seed_votes_room_idx").on(t.roomId),
  ],
);

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    /** 1 = primera ronda del cuadro. La final es la ronda `log2(tamaño)`. */
    round: integer("round").notNull(),
    /** Posición dentro de la ronda, de arriba a abajo, empezando en 0. */
    slot: integer("slot").notNull(),
    movieAId: uuid("movie_a_id").references(() => movies.id, { onDelete: "cascade" }),
    movieBId: uuid("movie_b_id").references(() => movies.id, { onDelete: "cascade" }),
    winnerId: uuid("winner_id").references(() => movies.id, { onDelete: "cascade" }),
    decidedBy: decidedBy("decided_by"),
    status: matchStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("matches_room_round_slot_unq").on(t.roomId, t.round, t.slot),
    index("matches_room_idx").on(t.roomId),
  ],
);

export const votes = pgTable(
  "votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    choiceMovieId: uuid("choice_movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Un voto por persona por versus. Es la garantía central del juego.
    uniqueIndex("votes_match_participant_unq").on(t.matchId, t.participantId),
    index("votes_match_idx").on(t.matchId),
  ],
);

/** La cartelera: el podio ordenado como las próximas noches de película. */
export const screenings = pgTable(
  "screenings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    movieId: uuid("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    /** 1 = campeona, 2 = subcampeona, 3 y 4 = semifinalistas. */
    position: integer("position").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("screenings_room_position_unq").on(t.roomId, t.position),
    uniqueIndex("screenings_room_movie_unq").on(t.roomId, t.movieId),
  ],
);

// ---------------------------------------------------------------------------
// Tipos inferidos
// ---------------------------------------------------------------------------

export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
export type Participant = typeof participants.$inferSelect;
export type NewParticipant = typeof participants.$inferInsert;
export type Movie = typeof movies.$inferSelect;
export type NewMovie = typeof movies.$inferInsert;
export type SeedVote = typeof seedVotes.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
export type Vote = typeof votes.$inferSelect;
export type Screening = typeof screenings.$inferSelect;

export type RoomPhase = (typeof roomPhase.enumValues)[number];
export type MatchStatus = (typeof matchStatus.enumValues)[number];
export type DecidedBy = (typeof decidedBy.enumValues)[number];
