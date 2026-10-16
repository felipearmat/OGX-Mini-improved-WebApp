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

test("the saved report has the adapter's and the web app's side", async ({ page }) => {
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
    await expect(page.locator("#diagStatus")).toHaveText(/Report saved/);
});
