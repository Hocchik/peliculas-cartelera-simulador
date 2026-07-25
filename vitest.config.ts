import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Tests unitarios: puros, sin red ni base. Corren con `npm test`. */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    exclude: ["**/node_modules/**", "**/*.integration.test.ts"],
  },
});
