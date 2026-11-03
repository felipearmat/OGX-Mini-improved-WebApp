import { readFile } from "node:fs/promises";
import { test, expect, connect, showPanel } from "./fixtures.js";

test("the diagnostics panel shows the adapter's report", async ({ page }) => {
    await connect(page);
    await showPanel(page, "#button-toggleDiagnostics");
    await page.locator("#button-diagRefresh").click();
    await expect(page.locator("#diagStatus")).toHaveText(/Updated/);
    await expect(page.locator("#diagInfo")).toContainText("PI_PICO2W_VIRTUAL (RP2350), firmware virtual (Release)");
    await expect(page.locator("#diagControllers")).toContainText("No controller connected.");
});

test("the saved report has the adapter's and the web app's side", async ({ page, adapter }) => {
    adapter.log("I (812) bluepad32: started");
    await connect(page);
    await showPanel(page, "#button-toggleDiagnostics");
    const download = page.waitForEvent("download");
    await page.locator("#button-diagReport").click();
    const file = await (await download).path();
    const report = JSON.parse(await readFile(file, "utf8"));
    const text = JSON.stringify(report);
    expect(text).toContain("PI_PICO2W_VIRTUAL");
    expect(text).toContain("\"connection\":\"USB\"");
    expect(text).toContain("\"device_mode\":6");
    // The kept log: the boot event and the ESP32's line, in order.
    const log = report.kept_log.join("\n");
    expect(log).toMatch(/\[rp\] [0-9.]+ boot DINPUT_DEBUG/);
    expect(log).toContain("[esp] I (812) bluepad32: started");
    await expect(page.locator("#diagStatus")).toHaveText(/Report saved/);
});

test("the log kept in flash outlives unplugging the adapter", async ({ page, adapter }) => {
    test.setTimeout(60000);
    await connect(page);
    await showPanel(page, "#button-toggleDiagnostics");
    const box = page.locator("#dongle-keepLogInFlash");
    await expect(box).toBeVisible();
    await expect(box).not.toBeChecked();  // off by default
    await expect(page.locator("#dongle-activityLog")).toBeChecked();  // the virtual adapter's build default
    await box.check();
    await expect(page.locator("#diagStatus")).toHaveText(/Saved/);
    expect(adapter.restarts).toBe(0);  // applied live

    adapter.log("I (4321) BP32: Switch: Joy-Con pair L@0 + R@1");
    await page.waitForTimeout(7000);  // quiet: written once the log stops growing for 5 s

    await adapter.powerCycle();  // unplugged: the RAM log is gone
    await page.waitForLoadState("load");
    await connect(page);
    await showPanel(page, "#button-toggleDiagnostics");
    await expect(page.locator("#dongle-keepLogInFlash")).toBeChecked();
    await page.locator("#button-diagRefresh").click();
    await expect(page.locator("#diagFlashLog")).toHaveText(/Log in flash: on, [1-9]\d* of \d+ pages kept/);

    const download = page.waitForEvent("download");
    await page.locator("#button-diagReport").click();
    const report = JSON.parse(await readFile(await (await download).path(), "utf8"));
    expect(report.flash_log.join("\n")).toContain("[esp] I (4321) BP32: Switch: Joy-Con pair L@0 + R@1");
    expect(report.kept_log.join("\n")).not.toContain("Joy-Con pair");  // the RAM started over
});


test("detailed controller diagnostics are saved live and shown in the report", async ({ page, adapter }) => {
    await connect(page);
    await showPanel(page, "#button-toggleDiagnostics");
    const box = page.locator("#dongle-linkDiagnostics");
    const flash = page.locator("#dongle-keepLogInFlash");
    await expect(box).toBeVisible();
    await expect(box).not.toBeChecked();  // off by default
    // Both warn of lag beside their names.
    await expect(page.locator("label[for=dongle-keepLogInFlash] .optionWarning")).toHaveText("adds a little lag");
    await expect(page.locator("label[for=dongle-linkDiagnostics] .optionWarning")).toHaveText("adds more lag");
    // It needs the activity log, not the log in flash: enabled with the log in flash off.
    if (await flash.isChecked()) {
        await flash.uncheck();
        await expect(page.locator("#diagStatus")).toHaveText(/Saved/);
    }
    await expect(box).toBeEnabled();
    await box.check();
    await expect(page.locator("#diagStatus")).toHaveText(/Saved/);
    expect(adapter.restarts).toBe(0);  // applied live

    const download = page.waitForEvent("download");
    await page.locator("#button-diagReport").click();
    const report = JSON.parse(await readFile(await (await download).path(), "utf8"));
    expect(report.adapter.bluetooth.link_details).toBe(true);
});


test("turning the activity log off turns off the log levels below it", async ({ page }) => {
    await connect(page);
    await showPanel(page, "#button-toggleDiagnostics");
    const activity = page.locator("#dongle-activityLog");
    const flash = page.locator("#dongle-keepLogInFlash");
    const details = page.locator("#dongle-linkDiagnostics");
    await expect(activity).toBeChecked();
    await flash.check();
    await details.check();
    await expect(page.locator("#diagStatus")).toHaveText(/Saved/);
    await activity.uncheck();
    await expect(page.locator("#diagStatus")).toHaveText(/Saved/);
    await expect(flash).not.toBeChecked();
    await expect(flash).toBeDisabled();
    await expect(details).not.toBeChecked();
    await expect(details).toBeDisabled();
    await page.locator("#button-diagRefresh").click();
    await expect(page.locator("#diagInfo")).toContainText("Activity log off");
    await activity.check();  // back as it was
    await expect(page.locator("#diagStatus")).toHaveText(/Saved/);
});
