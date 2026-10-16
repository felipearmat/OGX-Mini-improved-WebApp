import { test, expect, connect, reconnectAfterRestart } from "./fixtures.js";

const KBM = "17";

test("the mouse + keyboard mapping is saved with the profile, then the adapter switches mode", async ({ page, adapter }) => {
    await connect(page);
    await page.locator("#dropdown-deviceMode").selectOption(KBM);
    await expect(page.locator("#kbmOptionsPanel")).toBeVisible();
    await expect(page.locator("#digitalButtonsControl")).toBeHidden();  // the mapping is the profile

    const action = page.locator("#kbm-action-0");
    const options = await action.locator("option").evaluateAll((list) => list.map((o) => o.value));
    const before = await action.inputValue();
    const changed = options.find((value) => value !== before);
    await action.selectOption(changed);

    await page.locator("#button-saveProfile").click();
    await adapter.waitRestarts(1);
    expect(adapter.mode).toBe(17);

    adapter.holdCombo(6);  // back to the web app
    await reconnectAfterRestart(page, adapter, 2);
    await page.locator("#dropdown-deviceMode").selectOption(KBM);
    await expect(page.locator("#kbm-action-0")).toHaveValue(changed);
});

test("Load Defaults in mouse + keyboard mode restores the default layout", async ({ page }) => {
    await connect(page);
    await page.locator("#dropdown-deviceMode").selectOption(KBM);
    const action = page.locator("#kbm-action-0");
    const before = await action.inputValue();
    const other = (await action.locator("option").evaluateAll((list) => list.map((o) => o.value))).find((v) => v !== before);
    await action.selectOption(other);
    await page.locator("#button-loadDefaults").click();
    await expect(action).toHaveValue(before);
    await expect(page.locator("#kbmOptionsStatus")).toHaveText(/Default layout loaded/);
});
