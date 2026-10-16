/*  The web app's constants against the firmware's contract file (written from the firmware's code
 *  by Firmware/RP2040/tests/test_webapp_contract.cpp; this repository keeps a copy, which CI
 *  compares with the firmware's). A failure here means the page and the firmware disagree on a
 *  packet ID, a mode value, a capability bit, the settings record or the default colours. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PACKET_ID } from "../modules/com/protocol.js";
import { Capabilities } from "../modules/capabilities.js";
import { DongleSettings } from "../modules/dongleSettings.js";
import { UserSettings } from "../modules/userSettings.js";
import { DEFAULT_COLORS, WHITE, COLOR_SLOTS, COLORS_VERSION } from "../modules/uiLed.js";

const contract = JSON.parse(readFileSync(new URL("./contract/webapp_contract.json", import.meta.url)));

// Web app option keys -> firmware Settings fields
const FIELD = {
    disconnectPadsOnModeChange: "disconnect_pads_on_mode_change",
    joyconPairImuRight: "joycon_pair_imu_right",
    joyconPairHorizontal: "joycon_pair_horizontal",
    joyconSoloHorizontal: "joycon_solo_horizontal",
    macPerController: "mac_per_controller",
    ps4LegacyMotionScale: "ps4_legacy_motion_scale",
    singleController: "unused_single_controller",
    joyconPairRumblePerSide: "joycon_pair_rumble_per_side",
    highTxPower: "high_tx_power",
    statusLedPico: "status_led_pico",
    statusLedPicoExt: "status_led_pico_ext",
    statusLedEsp32: "status_led_esp32",
    statusLedEsp32Ext: "status_led_esp32_ext",
};

test("packet IDs match the firmware", () => {
    for (const [name, value] of Object.entries(PACKET_ID)) {
        if (name === "NONE") continue;
        assert.equal(value, contract.packet.ids[name], `packet ${name}`);
    }
});

test("capability bits match the firmware", () => {
    for (const name of Object.keys(contract.capabilities)) {
        if (name.startsWith("k")) continue;  // firmware board presets
        assert.equal(Capabilities[name], contract.capabilities[name], `capability ${name}`);
    }
});

test("settings record: version, lengths and offsets match the firmware", () => {
    const ds = contract.dongle_settings;
    assert.equal(DongleSettings.VERSION, ds.version);
    for (const [version, length] of Object.entries(ds.lengths)) {
        assert.equal(DongleSettings.lengthOf(Number(version)), length, `length of version ${version}`);
    }
    for (const option of DongleSettings.OPTIONS) {
        const field = FIELD[option.key];
        assert.ok(field, `option ${option.key} has no firmware field in this test's map`);
        assert.equal(option.offset, ds.offsets[field], `offset of ${option.key}`);
    }
    assert.equal(DongleSettings.IDLE_OFFSET, ds.offsets.idle_off_minutes);
    assert.equal(DongleSettings.BRIGHTNESS_OFFSET, ds.offsets.status_led_brightness);
    assert.equal(DongleSettings.COMBO_MASK_OFFSET, ds.offsets.combo_disabled_modes);
    assert.equal(ds.offsets.search_times, 9);  // DongleSettings writes bytes 9-11
});

test("every record the firmware decodes reads and writes back unchanged", () => {
    for (const { input, output } of contract.dongle_settings.decode) {
        assert.ok(output, `firmware rejects ${input}`);
        const settings = new DongleSettings();
        assert.ok(settings.setFromBytes(new Uint8Array(output)), `page rejects ${output}`);
        assert.deepEqual(Array.from(settings.getBytes()), output, "getBytes() of a current record");
        assert.deepEqual(Array.from(settings.liveBytes()), output, "liveBytes() with nothing changed");
    }
});

test("an older record shows the same values as the current record it decodes to", () => {
    for (const { input, output } of contract.dongle_settings.decode) {
        const older = new DongleSettings();
        const current = new DongleSettings();
        assert.ok(older.setFromBytes(new Uint8Array(input)));
        assert.ok(current.setFromBytes(new Uint8Array(output)));
        for (const option of older.availableOptions()) {
            if (option.until) continue;  // only in old records (single controller)
            assert.equal(older.values[option.key], current.values[option.key], `${option.key} from ${input}`);
        }
        if (older.version >= 3) {
            assert.equal(older.values.fullSearchSeconds, current.values.fullSearchSeconds);
            assert.equal(older.values.reducedSearchSeconds, current.values.reducedSearchSeconds);
        }
        assert.equal(older.comboDisabledModes, current.comboDisabledModes);
    }
});

test("the mode lists use the firmware's mode values, without the old Web App mode", () => {
    const values = new Set(Object.values(contract.modes));
    for (const list of [UserSettings.DEVICE_MODE_OPTIONS, UserSettings.DEVICE_MODE_OPTIONS_MULTI_GP,
        UserSettings.DEVICE_MODE_OPTIONS_4CH]) {
        assert.ok(values.has(list.def), `default ${list.def}`);
        for (const field of list.fields) {
            assert.ok(values.has(field.value), `${field.label} = ${field.value}`);
            assert.notEqual(field.value, contract.modes.WEBAPP, "the Web App mode is D-Input/Debug now");
        }
        const debug = list.fields.find((f) => f.value === contract.modes.DINPUT_DEBUG);
        assert.ok(debug && debug.label === "D-Input/Debug", "D-Input/Debug is in every list");
    }
    for (const mode of Object.keys(DongleSettings.MODE_COMBOS)) {
        assert.ok(values.has(Number(mode)), `combo for mode ${mode}`);
    }
});

test("default colours match the firmware's palette", () => {
    const mc = contract.mode_colors;
    assert.equal(COLORS_VERSION, mc.version);
    assert.equal(COLOR_SLOTS, mc.slots);
    for (const [name, rgb] of Object.entries(mc.defaults)) {
        const value = contract.modes[name];
        const slot = name === "WEBAPP" ? contract.modes.DINPUT_DEBUG : value;
        assert.deepEqual(DEFAULT_COLORS[slot] || WHITE, rgb, `colour of ${name}`);
    }
});
