// Playwright fixtures: a virtual adapter per test (its own flash file), wired to the page's Web
// Serial port (fakeSerial.js).
import { test as base, expect } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { VirtualAdapter } from "./virtualAdapter.js";
import { adapterBinary } from "./buildAdapter.js";

const FAKE_SERIAL = fileURLToPath(new URL("./fakeSerial.js", import.meta.url));

export const test = base.extend({
    adapter: async ({}, use, testInfo) => {
        const dir = mkdtempSync(join(tmpdir(), "ogxm-e2e-"));
        const adapter = new VirtualAdapter(adapterBinary(), join(dir, "flash.bin"));
        await adapter.start();
        await use(adapter);
        await adapter.stop();
        if (adapter.stderr) {
            await testInfo.attach("virtual adapter stderr", { body: adapter.stderr, contentType: "text/plain" });
        }
        rmSync(dir, { recursive: true, force: true });
    },

    page: async ({ page, adapter }, use) => {
        // Bytes from the adapter go to the page in order, one evaluate at a time: what arrives
        // meanwhile is joined into the next one (a call per chunk queues up on a slow machine).
        // Dropped while the page reloads, like bytes on a USB disconnect.
        let pending = [];
        let sending = null;
        const flush = () => {
            if (sending || pending.length === 0) {
                return sending;
            }
            const data = Buffer.concat(pending).toString("base64");
            pending = [];
            sending = page.evaluate((b64) => window.__ogxmSerialPush(b64), data)
                .catch(() => {})
                .then(() => { sending = null; return flush(); });
            return sending;
        };
        adapter.onData = (data) => {
            pending.push(data);
            flush();
        };
        adapter.onLost = async () => {
            await flush();  // what was sent before the device went away arrives first
            await page.evaluate(() => window.__ogxmSerialLost()).catch(() => {});
        };
        await page.exposeBinding("__ogxmSerial", async (_source, message) => {
            switch (message.op) {
                case "open":
                    return adapter.open();
                case "write":
                    adapter.write(message.data);
                    return true;
                case "close":
                    adapter.close();
                    return true;
            }
            return false;
        });
        await page.addInitScript({ path: FAKE_SERIAL });
        await use(page);
    },
});

// Opens the web app and connects over USB; resolves once the settings are shown.
export async function connect(page) {
    if (!page.url().startsWith("http")) {
        await page.goto("/");
    }
    await page.locator("#connectUsb").click();
    await expect(page.locator("#settingsPanel")).toBeVisible();
    await expect(page.locator("#dongleOptionsControl")).toBeVisible();  // the adapter's record arrived
}

// After a change that restarts the adapter: the page reloads on the disconnect; connect again.
export async function reconnectAfterRestart(page, adapter, restarts) {
    await adapter.waitRestarts(restarts);
    await expect(page.locator("#connectPanel")).toBeVisible();
    await page.waitForLoadState("load");
    await connect(page);
}

// Opens a collapsible panel unless it is open already (its toggle reads "Show" while closed).
export async function showPanel(page, toggle) {
    const button = page.locator(toggle);
    if ((await button.textContent()).trim() === "Show") {
        await button.click();
    }
}

export { expect };
