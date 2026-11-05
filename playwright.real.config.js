// End-to-end tests against a real adapter on this computer's USB (e2e/real): one test at a time,
// the port given by OGXM_REAL_ADAPTER (e.g. /dev/ttyACM0). The adapter must be in D-Input/Debug.
// Run with ogxm-build's webapp-real-test.sh, which keeps the adapter's settings and puts them back.
import { defineConfig, devices } from "@playwright/test";

const PORT = 8124;

export default defineConfig({
    testDir: "e2e/real",
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: "list",
    timeout: 90000,
    use: {
        baseURL: `http://127.0.0.1:${PORT}`,
        trace: "retain-on-failure",
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer: {
        command: `node e2e/server.js`,
        url: `http://127.0.0.1:${PORT}/index.html`,
        env: { PORT: String(PORT) },
        reuseExistingServer: false,
    },
});
