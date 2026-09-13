import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Standalone config: the app's vite.config.ts loads the full TanStack Start
// plugin chain, which the pure unit tests here do not need.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
