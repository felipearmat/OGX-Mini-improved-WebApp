import { test, expect, connect } from "./fixtures.js";

// A point on the colour wheel: angle in degrees (0 = red, 120 = green, 240 = blue), radius 0..1.
async function pickOnWheel(page, angle, radius) {
    const box = await page.locator("#canvas-modeColor").boundingBox();
    const a = angle * Math.PI / 180;
    await page.mouse.click(box.x + box.width / 2 * (1 + radius * Math.cos(a)),
                           box.y + box.height / 2 * (1 + radius * Math.sin(a)));
}

test("the picked colour shows on the adapter, cancel restores it", async ({ page, adapter }) => {
    await connect(page);
    await adapter.waitLed("303030");
    await page.locator("#button-modeColor").click();
    await expect(page.locator("#modeColorPicker")).toBeVisible();
    await pickOnWheel(page, 0, 0.98);  // red
    await expect(page.locator("#modeColorValue")).toHaveText(/^#FF/);
    await expect.poll(() => adapter.led).toMatch(/^30[01][0-9a-f][01][0-9a-f]$/);  // red at brightness 48
    await page.locator("#button-modeColorCancel").click();
    await adapter.waitLed("303030");
});

test("a saved mode colour is stored on the adapter; Default restores white", async ({ page, adapter }) => {
    await connect(page);
    await page.locator("#button-modeColor").click();
    await pickOnWheel(page, 240, 0.98);  // blue
    await page.locator("#button-modeColorSave").click();
    await expect(page.locator("#modeColorHint")).toHaveText(/Saved/);
    await expect.poll(() => adapter.led).toMatch(/^[01][0-9a-f][01][0-9a-f]30$/);  // blue at brightness 48

    await page.reload();
    await connect(page);
    await expect(page.locator("#button-modeColor")).toHaveAttribute("title", /Mode colour #0[0-9A-F]0[0-9A-F]FF/);

    await page.locator("#button-modeColor").click();
    await page.locator("#button-modeColorDefault").click();
    await expect(page.locator("#modeColorHint")).toHaveText(/Default restored/);
    await adapter.waitLed("303030");
    expect(adapter.restarts).toBe(0);
});
