import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Next lee .env.local; drizzle-kit corre fuera de Next, así que hay que cargarlo a mano.
config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
