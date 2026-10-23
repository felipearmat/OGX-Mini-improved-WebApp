import { test, expect, connect } from "./fixtures.js";

// The motion view takes the live motion stream (GP_MOTION) from firmware that offers it, in the
// common frame every pad is converted to.
test("live motion reaches the motion view in the common frame", async ({ page, adapter }) => {
    await connect(page);
    await page.locator("#button-motionStart").click();
    await expect(page.locator("#motionStatus")).toContainText("Waiting for motion");

    // A DS4 (source 1) lying flat and turning: 1 g up (8192), 100 deg/s about Y (1024 per deg/s).
    adapter.motion(1, [0, 8192, 0], [0, 102400, 0]);
    await expect(page.locator("#motionAccel")).toContainText("0.00    1.00    0.00");
    await expect(page.locator("#motionGyro")).toContainText("100.0");
    await expect(page.locator("#motionStatus")).toContainText("the live stream");

    // A Switch Pro (source 3) lying flat: gravity on its own Z (4096 per g) is the common frame's Y.
    adapter.motion(3, [0, 0, 4096], [0, 0, 0]);
    await expect(page.locator("#motionAccel")).toContainText("0.00    1.00    0.00");
    await expect(page.locator("#motionGyro")).toContainText("0.0     0.0     0.0");
});
