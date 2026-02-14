import { defineConfig } from "vitest/config";
import { sveltekit } from "@sveltejs/kit/vite";

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ["tests/**/*.{test,spec}.{js,ts}"],
    globals: true,
    environment: "node",
    // Longer timeout for DB tests with testcontainers
    testTimeout: 60000,
    hookTimeout: 60000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "tests/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/build/**",
        "**/.svelte-kit/**",
        "**/drizzle/**",
      ],
    },
  },
});
