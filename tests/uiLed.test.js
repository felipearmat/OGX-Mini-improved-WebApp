import { test } from "node:test";
import assert from "node:assert/strict";

import { UILed, DEFAULT_COLORS, WHITE, hsToRgb, rgbToHs, COLOR_SLOTS, COLORS_VERSION } from "../modules/uiLed.js";

const table = (entries = {}) => {
    const bytes = new Uint8Array(1 + 3 * COLOR_SLOTS);
    bytes[0] = COLORS_VERSION;
    for (const [slot, rgb] of Object.entries(entries)) bytes.set(rgb, 1 + 3 * Number(slot));
    return bytes;
};

test("a mode shows its saved colour, else the default", () => {
    UILed.colors = table({ 8: [1, 2, 3] });
    assert.deepEqual(UILed.colorOf(8), [1, 2, 3]);
    assert.deepEqual(UILed.colorOf(15), DEFAULT_COLORS[15]);
    assert.deepEqual(UILed.colorOf(6), WHITE, "D-Input/Debug: white");
    UILed.colors = table({ 6: [9, 9, 9] });
    assert.deepEqual(UILed.colorOf(100), [9, 9, 9], "the old Web App mode uses D-Input/Debug's colour");
});

test("a table of another version or length is ignored", () => {
    UILed.colors = null;
    const bad = table();
    bad[0] = COLORS_VERSION + 1;
    UILed.setColors(bad);
    assert.equal(UILed.colors, null);
    UILed.setColors(table().slice(0, 10));
    assert.equal(UILed.colors, null);
});

test("the wheel: centre is white, the edge the full colour, and back", () => {
    assert.deepEqual(hsToRgb(0, 0), [255, 255, 255]);
    assert.deepEqual(hsToRgb(0, 1), [255, 0, 0]);
    assert.deepEqual(hsToRgb(120, 1), [0, 255, 0]);
    assert.deepEqual(hsToRgb(240, 1), [0, 0, 255]);
    for (const rgb of Object.values(DEFAULT_COLORS)) {
        const [h, s] = rgbToHs(rgb);
        const back = hsToRgb(h, s);
        rgb.forEach((v, i) => assert.ok(Math.abs(v - back[i]) <= 1, `${rgb} -> ${back}`));
    }
});
