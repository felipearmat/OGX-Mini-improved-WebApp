import { test } from "node:test";
import assert from "node:assert/strict";

import { DongleSettings } from "../modules/dongleSettings.js";

const record = () => {
    const s = new DongleSettings();
    const bytes = new Uint8Array(DongleSettings.LENGTH);
    bytes[0] = DongleSettings.VERSION;
    bytes[2] = 1;            // Joy-Con pair motion: right
    bytes[9] = 60;           // full search 60 s, reduced no limit
    bytes[10] = 0xF0;
    bytes[11] = 0xFF;
    bytes[16] = 15;          // idle 15 min
    bytes[18] = bytes[19] = bytes[20] = bytes[21] = 1;
    bytes[22] = 48;
    assert.ok(s.setFromBytes(bytes));
    return s;
};

test("no live save before the adapter's record is read", () => {
    assert.equal(new DongleSettings().liveBytes(), null);
});

test("a record newer than the page is not taken (and so never saved over)", () => {
    const s = new DongleSettings();
    const bytes = new Uint8Array(40);
    bytes[0] = DongleSettings.VERSION + 1;
    assert.equal(s.setFromBytes(bytes), false);
    assert.equal(s.liveBytes(), null);
});

test("a live save changes only the live options", () => {
    const s = record();
    const stored = Array.from(s.storedBytes);
    // Adapter Options edits not saved yet (they need a restart): left out
    s.values.disconnectPadsOnModeChange = 1;
    s.values.macPerController = 1;
    // live ones
    s.values.fullSearchSeconds = 45;
    s.values.statusLedPicoExt = 0;
    s.values.statusLedBrightness = 200;
    s.values.idleOffMinutes = 5;
    s.setComboEnabled(5, false);
    const live = Array.from(s.liveBytes());
    const changed = live.map((v, i) => (v !== stored[i] ? i : -1)).filter((i) => i >= 0);
    assert.deepEqual(changed, [9, 12, 16, 19, 22]);
    assert.equal(live[1], 0, "turn-off-before-mode-change stays as stored");
    assert.equal(live[5], 0, "MAC per controller stays as stored");
    assert.equal(live[9], 45);
    assert.equal(live[22], 200);
});

test("brightness stays 1-255", () => {
    const s = record();
    s.values.statusLedBrightness = 0;
    assert.equal(s.liveBytes()[22], 48, "0 is the default");
    s.values.statusLedBrightness = 999;
    assert.equal(s.liveBytes()[22], 255);
});

test("a version 5 record has no LED options and is saved as version 5", () => {
    const s = new DongleSettings();
    const v5 = new Uint8Array(18);
    v5[0] = 5;
    assert.ok(s.setFromBytes(v5));
    assert.equal(s.liveBytes().length, 18);
    assert.ok(!s.availableOptions().some((o) => o.panel === "led"));
});

test("D-Input/Debug can't be turned off", () => {
    const s = record();
    s.setComboEnabled(DongleSettings.DEBUG_MODE, false);
    assert.equal(s.comboEnabled(DongleSettings.DEBUG_MODE), true);
    s.comboDisabledModes = 1 << DongleSettings.DEBUG_MODE;  // a mask that says off
    assert.equal(s.comboEnabled(DongleSettings.DEBUG_MODE), true);
});
