import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "trial.spec.ts",
  workers: 1,
  timeout: 60000,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8003/canyinfuwukaohexitong/",
    timezoneId: "Asia/Shanghai",
    viewport: { width: 1440, height: 1000 },
    actionTimeout: 10000,
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "VITE_TRIAL_MODE=1 VITE_BASE_PATH=/canyinfuwukaohexitong/ vite preview --host 127.0.0.1 --port 8003 --strictPort",
    url: "http://127.0.0.1:8003/canyinfuwukaohexitong/",
    reuseExistingServer: false,
  },
});
