CREATE TYPE "public"."decided_by" AS ENUM('votes', 'coinflip', 'host', 'bye');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('pending', 'open', 'decided');--> statement-breakpoint
CREATE TYPE "public"."room_phase" AS ENUM('lobby', 'nominating', 'seeding', 'draw', 'bracket', 'finished');--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"slot" integer NOT NULL,
	"movie_a_id" uuid,
	"movie_b_id" uuid,
	"winner_id" uuid,
	"decided_by" "decided_by",
	"status" "match_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"tmdb_id" integer NOT NULL,
	"title" text NOT NULL,
	"original_title" text NOT NULL,
	"year" integer,
	"poster_path" text,
	"runtime" integer,
	"overview" text,
	"vote_average" real,
	"added_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"nickname" text NOT NULL,
	"avatar_seed" integer NOT NULL,
	"is_host" boolean DEFAULT false NOT NULL,
	"device_token" text NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"phase" "room_phase" DEFAULT 'lobby' NOT NULL,
	"draw_seed" integer NOT NULL,
	"tiebreak_seed" integer NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "screenings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"movie_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"scheduled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "seed_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"movie_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"choice_movie_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_movie_a_id_movies_id_fk" FOREIGN KEY ("movie_a_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_movie_b_id_movies_id_fk" FOREIGN KEY ("movie_b_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_id_movies_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movies" ADD CONSTRAINT "movies_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movies" ADD CONSTRAINT "movies_added_by_participants_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenings" ADD CONSTRAINT "screenings_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenings" ADD CONSTRAINT "screenings_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seed_votes" ADD CONSTRAINT "seed_votes_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seed_votes" ADD CONSTRAINT "seed_votes_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seed_votes" ADD CONSTRAINT "seed_votes_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_choice_movie_id_movies_id_fk" FOREIGN KEY ("choice_movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "matches_room_round_slot_unq" ON "matches" USING btree ("room_id","round","slot");--> statement-breakpoint
CREATE INDEX "matches_room_idx" ON "matches" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "movies_room_tmdb_unq" ON "movies" USING btree ("room_id","tmdb_id");--> statement-breakpoint
CREATE INDEX "movies_room_idx" ON "movies" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_device_token_unq" ON "participants" USING btree ("device_token");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_room_nickname_unq" ON "participants" USING btree ("room_id","nickname");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_single_host_unq" ON "participants" USING btree ("room_id") WHERE is_host;--> statement-breakpoint
CREATE INDEX "participants_room_idx" ON "participants" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_code_unq" ON "rooms" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "screenings_room_position_unq" ON "screenings" USING btree ("room_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "screenings_room_movie_unq" ON "screenings" USING btree ("room_id","movie_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seed_votes_unq" ON "seed_votes" USING btree ("room_id","participant_id","movie_id");--> statement-breakpoint
CREATE INDEX "seed_votes_room_idx" ON "seed_votes" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "votes_match_participant_unq" ON "votes" USING btree ("match_id","participant_id");--> statement-breakpoint
CREATE INDEX "votes_match_idx" ON "votes" USING btree ("match_id");