import { defineConfig, devices } from "@playwright/test";
const port = Number(process.env.BL_PORT ?? 9852);
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  workers: Number(process.env.BL_WORKERS ?? 4),
  reporter: [["list"]],
  use: { baseURL: `http://127.0.0.1:${port}`, ...devices["Desktop Chrome"] },
});
