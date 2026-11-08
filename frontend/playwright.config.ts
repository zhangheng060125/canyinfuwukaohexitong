import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "workflow.spec.ts",
  workers: 1,
  timeout: 90000,
  reporter: "list",
  use: {
    actionTimeout: 10000,
    baseURL: "http://127.0.0.1:8001",
    timezoneId: "Asia/Shanghai",
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "../.venv/bin/python -m uvicorn backend.app:app --host 127.0.0.1 --port 8001 --app-dir ..",
    url: "http://127.0.0.1:8001/api/health",
    reuseExistingServer: false,
    env: {
      BAIHUALI_SETUP_KEY: "browser-test-initialization-only",
      BAIHUALI_REQUIRE_SETUP_KEY: "1",
      BAIHUALI_DATA_DIR: `/tmp/baihuali-e2e-${Date.now()}`,
    },
  },
});
