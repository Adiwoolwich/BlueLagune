import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";
// Unit-Tests nur unter tests/; e2e/ läuft mit Playwright. Aliase (@/…) aus vite.config.
export default mergeConfig(viteConfig, defineConfig({ test: { include: ["tests/**/*.test.ts"] } }));
