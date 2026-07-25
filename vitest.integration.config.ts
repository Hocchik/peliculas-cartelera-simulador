import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: ".env.local" });

/** Tests contra la base real de Neon. Corren aparte con `npm run test:db`. */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["**/*.integration.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Comparten la misma sala de prueba: en paralelo se pisarían.
    fileParallelism: false,
  },
});
