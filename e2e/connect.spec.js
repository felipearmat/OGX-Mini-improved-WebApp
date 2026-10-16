import { test, expect, connect } from "./fixtures.js";

test("connects over USB and reads the adapter", async ({ page }) => {
    await connect(page);
    await expect(page.locator("#dropdown-deviceMode")).toHaveValue("6");  // D-Input/Debug, the mode the web app talks to
    await expect(page.locator("#firmwareWarning")).toBeHidden();
    await expect(page.locator("#ledControl")).toBeVisible();
    await expect(page.locator("#modeColorRow")).toBeVisible();
});

test("shows only the LED options this board has", async ({ page }) => {
    await connect(page);
    const row = (key) => page.locator(`#dongle-${key}`).locator("xpath=ancestor::div[contains(@class,'dongleOption')][1]");
    // A Pico 2 W with the external LED on GP6: no ESP32.
    await expect(row("statusLedPico")).not.toHaveClass(/unsupported/);
    await expect(row("statusLedPicoExt")).not.toHaveClass(/unsupported/);
    await expect(row("statusLedEsp32")).toHaveClass(/unsupported/);
    await expect(row("statusLedEsp32Ext")).toHaveClass(/unsupported/);
});

test("D-Input/Debug's mode combo can't be turned off", async ({ page }) => {
    await connect(page);
    await expect(page.locator("#checkbox-modeCombo")).toBeChecked();
    await expect(page.locator("#checkbox-modeCombo")).toBeDisabled();
});

test("disconnect closes the port and the adapter keeps running", async ({ page, adapter }) => {
    await connect(page);
    await page.locator("#button-disconnect").click();
    await expect(page.locator("#connectPanel")).toBeVisible();
    await expect.poll(() => adapter.portOpen).toBe(false);
    expect(adapter.restarts).toBe(0);
    await connect(page);
});
