// End-to-end tests: the web app in Chromium against the firmware's virtual adapter (e2e/).
import { defineConfig, devices } from "@playwright/test";

const PORT = 8123;

export default defineConfig({
    testDir: "e2e",
    globalSetup: "./e2e/buildAdapter.js",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: 0,
    reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
    timeout: 30000,
    use: {
        baseURL: `http://127.0.0.1:${PORT}`,
        trace: "retain-on-failure",
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer: {
        command: `node e2e/server.js`,
        url: `http://127.0.0.1:${PORT}/index.html`,
        env: { PORT: String(PORT) },
        reuseExistingServer: !process.env.CI,
    },
});
