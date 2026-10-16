import { test, expect, connect, reconnectAfterRestart, showPanel } from "./fixtures.js";

test("status LED options and brightness apply live, without a restart", async ({ page, adapter }) => {
    await connect(page);
    await showPanel(page, "#button-toggleLed");
    await adapter.waitLed("303030");  // white (D-Input/Debug) at the default brightness 48

    await page.locator("#led-brightness").fill("100");
    await expect(page.locator("#ledStatus")).toHaveText(/Latest Save/);
    await adapter.waitLed("646464");

    await page.locator("#dongle-statusLedPicoExt").uncheck();
    await expect(page.locator("#ledStatus")).toHaveText(/Latest Save/);
    await adapter.waitLed("000000");
    expect(adapter.restarts).toBe(0);

    // Stored: read back after the page reloads.
    await page.reload();
    await connect(page);
    await expect(page.locator("#led-brightness")).toHaveValue("100");
    await expect(page.locator("#dongle-statusLedPicoExt")).not.toBeChecked();
});

test("an adapter option that needs a restart is stored across it", async ({ page, adapter }) => {
    await connect(page);
    await showPanel(page, "#button-toggleDongleOptions");
    const box = page.locator("#dongle-disconnectPadsOnModeChange");
    const before = await box.isChecked();
    await box.setChecked(!before);
    await page.locator("#button-saveDongleOptions").click();
    await reconnectAfterRestart(page, adapter, 1);
    await expect(page.locator("#dongle-disconnectPadsOnModeChange")).toBeChecked({ checked: !before });
});

test("a mode's combo turned off is saved live and stays off", async ({ page, adapter }) => {
    await connect(page);
    await page.locator("#dropdown-deviceMode").selectOption("2");  // XInput (not saved: the profile is not)
    const box = page.locator("#checkbox-modeCombo");
    await expect(box).toBeEnabled();
    await expect(box).toBeChecked();
    await box.uncheck();
    await expect(page.locator("#modeComboHint")).toHaveText(/saved/);
    expect(adapter.restarts).toBe(0);

    await page.reload();
    await connect(page);
    await page.locator("#dropdown-deviceMode").selectOption("2");
    await expect(page.locator("#checkbox-modeCombo")).not.toBeChecked();
});
