DROP INDEX "participants_device_token_unq";--> statement-breakpoint
CREATE UNIQUE INDEX "participants_room_device_unq" ON "participants" USING btree ("room_id","device_token");