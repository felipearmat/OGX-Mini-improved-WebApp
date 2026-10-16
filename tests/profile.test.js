/*  Profile and Mouse + Keyboard records against the firmware's contract: lengths, default bytes,
 *  and where every field the page edits lands in the bytes it sends (a field one byte off breaks
 *  Save / Load Profile). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { UserSettings } from "../modules/userSettings.js";
import { KbmSettings } from "../modules/kbmSettings.js";

const contract = JSON.parse(readFileSync(new URL("./contract/webapp_contract.json", import.meta.url)));
const P = contract.profile;

const snake = (key) => key.replace(/([A-Z0-9]+)/g, "_$1").toLowerCase();
const TOP = (key) => ({
    profileId: "id",
    "joystickSettings-left": "joystick_settings_l",
    "joystickSettings-right": "joystick_settings_r",
    "triggerSettings-left": "trigger_settings_l",
    "triggerSettings-right": "trigger_settings_r",
}[key] || snake(key));
const JOYSTICK = {
    dzInner: "dz_inner", dzOuter: "dz_outer", antiDzInnerC: "anti_dz_circle",
    antiDzInnerCYScale: "anti_dz_circle_y_scale", antiDzSquare: "anti_dz_square",
    antiDzSquareYScale: "anti_dz_square_y_scale", antiDzAngular: "anti_dz_angular", antiDzOuter: "anti_dz_outer",
    axialRestrict: "axis_restrict", angularRestrict: "angle_restrict", diagonalScaleMin: "diag_scale_min",
    diagonalScaleMax: "diag_scale_max", curve: "curve", uncapRadius: "uncap_radius", invertY: "invert_y",
    invertX: "invert_x",
};
const TRIGGER = { dzInner: "dz_inner", dzOuter: "dz_outer", antiDzInner: "anti_dz_inner", antiDzOuter: "anti_dz_outer", curve: "curve" };

test("profile length and default bytes match the firmware", () => {
    assert.equal(UserSettings.PROFILE_LENGTH, P.length);
    assert.deepEqual(Array.from(new UserSettings().getProfileBytes()), P.defaults);
});

test("a profile read from the firmware writes back unchanged", () => {
    const settings = new UserSettings();
    settings.setProfileFromBytes(new Uint8Array(P.defaults));
    assert.deepEqual(Array.from(settings.getProfileBytes()), P.defaults);
});

test("every top-level profile field lands at the firmware's offset", () => {
    for (const key of Object.keys(new UserSettings().profile)) {
        const field = TOP(key);
        assert.ok(field in P.offsets, `profile key ${key} -> ${field} not in the firmware`);
        if (typeof new UserSettings().profile[key] === "object") continue;  // stick / trigger blocks below
        const settings = new UserSettings();
        const value = typeof settings.profile[key] === "boolean" ? !settings.profile[key] : 0xA5;
        settings.profile[key] = value;
        const bytes = settings.getProfileBytes();
        const expected = typeof value === "boolean" ? (value ? 1 : 0) : 0xA5;
        assert.equal(bytes[P.offsets[field]], expected, `${key} at byte ${P.offsets[field]}`);
    }
});

test("every stick and trigger setting lands at the firmware's offset", () => {
    const blocks = [
        ["joystickSettings-left", JOYSTICK, P.joystick_offsets], ["joystickSettings-right", JOYSTICK, P.joystick_offsets],
        ["triggerSettings-left", TRIGGER, P.trigger_offsets], ["triggerSettings-right", TRIGGER, P.trigger_offsets],
    ];
    for (const [block, names, offsets] of blocks) {
        const base = P.offsets[TOP(block)];
        for (const [key, field] of Object.entries(names)) {
            const settings = new UserSettings();
            const target = settings.profile[block];
            const before = Array.from(settings.getProfileBytes());
            target[key] = typeof target[key] === "boolean" ? !target[key] : 0.25;
            const after = Array.from(settings.getProfileBytes());
            const changed = after.map((v, i) => (v !== before[i] ? i : -1)).filter((i) => i >= 0);
            assert.ok(changed.length > 0, `${block}.${key} changed no byte`);
            const at = base + offsets[field];
            const width = typeof target[key] === "boolean" ? 1 : 4;
            for (const i of changed) {
                assert.ok(i >= at && i < at + width, `${block}.${key} wrote byte ${i}, expected ${at}..${at + width - 1}`);
            }
        }
    }
});

test("Mouse + Keyboard record: length, version and defaults match the firmware", () => {
    const K = contract.kbm_settings;
    assert.equal(KbmSettings.LENGTH, K.length);
    assert.equal(KbmSettings.VERSION, K.version);
    assert.deepEqual(Array.from(KbmSettings.DEFAULT_BYTES), K.defaults);
    const kbm = new KbmSettings();
    kbm.restoreDefaults();
    assert.deepEqual(Array.from(kbm.getBytes()), K.defaults);
});
