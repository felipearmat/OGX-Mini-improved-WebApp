import { test, expect, connect, reconnectAfterRestart, showPanel } from "./fixtures.js";

test("status LED options and brightness are Adapter Options: saved with the button, the adapter restarts", async ({ page, adapter }) => {
    await connect(page);
    await showPanel(page, "#button-toggleDongleOptions");
    await adapter.waitLed("303030");  // white (D-Input/Debug) at the default brightness 48

    await page.locator("#led-brightness").fill("100");
    await page.locator("#dongle-statusLedPicoExt").uncheck();
    await page.waitForTimeout(500);
    await adapter.waitLed("303030");  // nothing changes before Save
    expect(adapter.restarts).toBe(0);

    await page.locator("#button-saveDongleOptions").click();
    await reconnectAfterRestart(page, adapter, 1);
    await adapter.waitLed("000000");  // the external LED off after the restart

    // Stored: read back after the restart.
    await showPanel(page, "#button-toggleDongleOptions");
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
