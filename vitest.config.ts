import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "valibot-typed-regex",
    environment: "node",
    globals: true,
    typecheck: {
      enabled: true,
      include: ["src/**/*.test-d.ts"],
      tsconfig: "./tsconfig.test.json",
    },
  },
});
