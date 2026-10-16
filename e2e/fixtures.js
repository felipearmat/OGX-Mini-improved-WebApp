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
        const push = (script, arg) => page.evaluate(script, arg).catch(() => {});  // dropped while the page reloads
        adapter.onData = (data) => push((b64) => window.__ogxmSerialPush(b64), data.toString("base64"));
        adapter.onLost = () => push(() => window.__ogxmSerialLost());
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
