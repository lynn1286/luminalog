import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "src/test/**/*.test.ts",
      "src/test/**/*.spec.ts",
      "test/**/*.test.ts",
      "test/**/*.spec.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "dist/", "**/*.d.ts", "**/*.test.ts", "**/*.spec.ts"],
    },
    alias: {
      vscode: path.resolve(__dirname, "./src/test/__mocks__/vscode.ts"),
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
