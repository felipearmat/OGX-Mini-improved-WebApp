import { test, expect, connect, reconnectAfterRestart } from "./fixtures.js";

test("a saved profile survives the adapter's restart", async ({ page, adapter }) => {
    await connect(page);
    const buttonA = page.locator("#dropdown-buttonA");
    await expect(buttonA).toHaveValue("1");
    await buttonA.selectOption("2");  // A sends B
    await page.locator("#button-saveProfile").click();
    await reconnectAfterRestart(page, adapter, 1);
    await expect(page.locator("#dropdown-buttonA")).toHaveValue("2");
});

test("Load Defaults resets the page, not the adapter, until saved", async ({ page, adapter }) => {
    await connect(page);
    await page.locator("#dropdown-buttonA").selectOption("2");
    await page.locator("#button-loadDefaults").click();
    await expect(page.locator("#dropdown-buttonA")).toHaveValue("1");
    expect(adapter.restarts).toBe(0);
});

test("saving another mode leaves D-Input/Debug; its combo brings the web app back", async ({ page, adapter }) => {
    await connect(page);
    await page.locator("#dropdown-deviceMode").selectOption("2");  // XInput
    await page.locator("#button-saveProfile").click();
    await adapter.waitRestarts(1);
    expect(adapter.mode).toBe(2);
    await expect(page.locator("#connectPanel")).toBeVisible();

    // No serial port in XInput: connecting fails and the page says why.
    await page.waitForLoadState("load");
    await page.locator("#connectUsb").click();
    await expect(page.locator("#errorTxt")).not.toBeEmpty();
    await expect(page.locator("#settingsPanel")).toBeHidden();

    adapter.holdCombo(6);  // Start + RB + D-pad Left
    await reconnectAfterRestart(page, adapter, 2);
    await expect(page.locator("#dropdown-deviceMode")).toHaveValue("6");
});
