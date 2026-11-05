// The web app against a real RP2040 + ESP32 hybrid on this computer's USB (D-Input/Debug), through
// e2e/realAdapter.js. Each test leaves the adapter's options as it found them; webapp-real-test.sh
// (ogxm-build) also keeps the whole settings record and puts it back afterwards.
import { readFile } from "node:fs/promises";
import { test, expect, connect, reconnectAfterRestart, showPanel } from "../fixtures.js";

const row = (page, key) =>
    page.locator(`#dongle-${key}`).locator("xpath=ancestor::div[contains(@class,'dongleOption')][1]");

test("connects over USB and reads the hybrid", async ({ page }) => {
    await connect(page);
    await expect(page.locator("#dropdown-deviceMode")).toHaveValue("6");
    await expect(page.locator("#firmwareWarning")).toBeHidden();
    await showPanel(page, "#button-toggleDongleOptions");
    // The hybrid has the ESP32's status LEDs and its transmit power.
    await expect(row(page, "statusLedEsp32")).not.toHaveClass(/unsupported/);
    await expect(row(page, "statusLedEsp32Ext")).not.toHaveClass(/unsupported/);
});

test("the diagnostics show the RP2040 and the ESP32 with the I2C link figures", async ({ page }) => {
    await connect(page);
    await showPanel(page, "#button-toggleDiagnostics");
    await page.locator("#button-diagRefresh").click();
    await expect(page.locator("#diagStatus")).toHaveText(/Updated/);
    await expect(page.locator("#diagInfo")).toContainText("ESP32_BLUEPAD32_I2C");
    const download = page.waitForEvent("download");
    await page.locator("#button-diagReport").click();
    const report = JSON.parse(await readFile(await (await download).path(), "utf8"));
    const text = JSON.stringify(report);
    expect(text).toContain("\"device_mode\":6");
    expect(text).toMatch(/"i2c_slave":\{"replies":\d+/);
    expect(text).toMatch(/"packets_checked":\d+/);  // the trailer's check is on
    // The kept log has both boards' lines (on an adapter up for a while the boot has left the ring).
    const log = (report.kept_log || []).join("\n");
    expect(log).toMatch(/\[rp\] [0-9.]+ /);
    expect(log).toContain("[esp] ");
});

test("an adapter option that needs a restart is stored across it, then put back", async ({ page, adapter }) => {
    await connect(page);
    await showPanel(page, "#button-toggleDongleOptions");
    const box = () => page.locator("#dongle-disconnectPadsOnModeChange");
    const before = await box().isChecked();
    for (const want of [!before, before]) {
        const restarts = adapter.restarts;
        await box().setChecked(want);
        await page.locator("#button-saveDongleOptions").click();
        await reconnectAfterRestart(page, adapter, restarts + 1);
        await showPanel(page, "#button-toggleDongleOptions");
        await expect(box()).toBeChecked({ checked: want });
    }
});

test("a mode's combo turned off is saved live, then turned on again", async ({ page, adapter }) => {
    await connect(page);
    await page.locator("#dropdown-deviceMode").selectOption("2");  // XInput (only shown, not saved)
    const box = page.locator("#checkbox-modeCombo");
    await expect(box).toBeEnabled();
    const before = await box.isChecked();
    await box.setChecked(!before);
    await expect(page.locator("#modeComboHint")).toHaveText(/saved/);
    expect(adapter.restarts).toBe(0);
    await page.reload();
    await connect(page);
    await page.locator("#dropdown-deviceMode").selectOption("2");
    await expect(page.locator("#checkbox-modeCombo")).toBeChecked({ checked: !before });
    await page.locator("#checkbox-modeCombo").setChecked(before);
    await expect(page.locator("#modeComboHint")).toHaveText(/saved/);
});

test("disconnect closes the port and the adapter keeps running", async ({ page, adapter }) => {
    await connect(page);
    await page.locator("#button-disconnect").click();
    await expect(page.locator("#connectPanel")).toBeVisible();
    await expect.poll(() => adapter.portOpen).toBe(false);
    expect(adapter.restarts).toBe(0);
    await connect(page);
});
