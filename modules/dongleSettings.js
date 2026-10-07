/*  Dongle-wide options (OGX-Mini-improved firmware).
 *
 *  Wire format, shared with the firmware (Custom/DongleSettings.h): 16 bytes, a version byte
 *  (3) then one byte per option (0 / 1). Older firmware answers with version 2 (16 bytes, with
 *  the single controller option in byte 7) or 1 (the first 8 bytes); the page then shows only
 *  the options that version has and saves in that format. USB: packets GET_DONGLE_SETTINGS
 *  (0x70) and SET_DONGLE_SETTINGS (0x71). Bluetooth: characteristic ...9060 (read / write).
 *  Saving stores the options and restarts the adapter, unless only the live ones changed.
 *
 *  Version 3, bytes 9-11: search for new controllers while a slot is open with a controller
 *  connected, two 12-bit second counts (full search = bits 0-11, reduced search = bits 12-23),
 *  0-600 s; 4095 for the reduced search = no limit. Applied without a restart.
 *  Bytes 12-15 (version 2): output modes whose button combo is off, a little-endian bit mask
 *  (bit n = device mode n); zero turns every combo on. Web App mode (100) is always on. Saving a
 *  change of the mask alone applies it right away, without a restart.
 */
export class DongleSettings {
    static VERSION = Object.freeze(3);
    static SEARCH_MAX_S = Object.freeze(600);
    static SEARCH_NO_LIMIT = Object.freeze(0xFFF);
    static LENGTH = Object.freeze(16);
    static V1_LENGTH = Object.freeze(8);

    // Byte offsets follow the firmware struct. "choices" options are shown as a dropdown,
    // the others as a checkbox.
    static OPTIONS = Object.freeze([
        {
            key: "disconnectPadsOnModeChange", offset: 1,
            label: "Turn off controllers before mode change",
            help: "Controllers switch off (light off) BEFORE changing mode to avoid getting stuck.",
        },
        {
            key: "joyconPairImuRight", offset: 2,
            label: "Joy-Con pair: motion from",
            choices: [{ label: "Right Joy-Con", value: 1 }, { label: "Left Joy-Con", value: 0 }],
        },
        {
            key: "joyconPairHorizontal", offset: 3,
            label: "Joy-Con pair orientation",
            choices: [{ label: "Vertical", value: 0 }, { label: "Horizontal", value: 1 }],
        },
        {
            key: "joyconSoloHorizontal", offset: 4,
            label: "Single Joy-Con orientation",
            choices: [{ label: "Vertical", value: 0 }, { label: "Horizontal (sideways)", value: 1 }],
        },
        {
            key: "macPerController", offset: 5,
            label: "Use a MAC address per controller",
            help: "PS4 / STEAM modes: report the connected controller's Bluetooth address instead of the adapter's, so Steam keeps separate settings per controller. The adapter reconnects to the PC once when a controller connects.",
        },
        {
            key: "ps4LegacyMotionScale", offset: 6,
            label: "Legacy PS4 motion scale (Brook auth adapters)",
            help: "PS4 mode: the older motion scale, for authentication adapters that may expect it. Leave off on PC.",
        },
        {
            key: "singleController", offset: 7, until: 2,
            label: "Single controller",
            help: "Accept one Bluetooth controller only: a lone Joy-Con does not wait for its other half, so adapters next to each other do not take each other's controllers. Also set with Start + L3 (on) / Start + L3 + LB (off).",
        },
        {
            key: "joyconPairRumblePerSide", offset: 8, since: 2,
            label: "Joy-Con pair rumble",
            choices: [{ label: "Per side (as SDL / Steam)", value: 1 }, { label: "Both Joy-Cons", value: 0 }],
            help: "Per side: the game's left (strong) motor rumbles the left Joy-Con and the right (weak) motor the right one, as when the pair is connected straight to a PC. Both: each Joy-Con plays both motors.",
        },
    ]);

    static COMBO_MASK_OFFSET = Object.freeze(12);

    // Button combo of each device mode (firmware UserSettings.cpp ButtonCombo), Xbox names.
    static MODE_COMBOS = Object.freeze({
        1: "Start + D-pad Right",
        2: "Start + RB + D-pad Right",
        3: "Start + LB + D-pad Right",
        4: "Start + D-pad Up",
        5: "Start + D-pad Left",
        6: "Start + RB + D-pad Left",
        7: "Start + A",
        8: "Start + D-pad Down",
        9: "Start + LB + D-pad Down",
        15: "Start + LB + D-pad Left",
        16: "Start + LB + D-pad Up",
        17: "Start + RB + D-pad Up",
        100: "Start + LB + RB",
    });

    constructor() {
        this.values = {};
        this.version = DongleSettings.VERSION;
        this.comboDisabledModes = 0;
        this.storedBytes = null;  // as last read from the adapter
        for (const option of DongleSettings.OPTIONS) {
            this.values[option.key] = 0;
        }
        // Bluetooth search panel (version 3), saved live like the mode combos.
        this.values.fullSearchSeconds = 60;
        this.values.reducedSearchSeconds = DongleSettings.SEARCH_NO_LIMIT;
    }

    // Options the connected firmware knows (it answered in this.version).
    availableOptions() {
        return DongleSettings.OPTIONS.filter((option) =>
            (option.since || 1) <= this.version && this.version <= (option.until || 99));
    }

    // False if the bytes are not a dongle settings record this page understands.
    setFromBytes(bytes) {
        if (!(bytes instanceof Uint8Array)) {
            return false;
        }
        const full = bytes.length >= DongleSettings.LENGTH;
        const version = bytes[0];
        if (!((version === 3 || version === 2) && full) && !(version === 1 && bytes.length >= DongleSettings.V1_LENGTH)) {
            return false;
        }
        this.version = version;
        for (const option of this.availableOptions()) {
            this.values[option.key] = bytes[option.offset] ? 1 : 0;
        }
        if (version === 3) {
            this.values.fullSearchSeconds = bytes[9] | ((bytes[10] & 0x0F) << 8);
            this.values.reducedSearchSeconds = (bytes[10] >> 4) | (bytes[11] << 4);
        }
        const o = DongleSettings.COMBO_MASK_OFFSET;
        this.comboDisabledModes = version >= 2 ? (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0 : 0;
        this.storedBytes = bytes.slice(0, version >= 2 ? DongleSettings.LENGTH : DongleSettings.V1_LENGTH);
        return true;
    }

    // Whether the button combo may switch the adapter to this device mode.
    comboEnabled(mode) {
        return mode >= 32 || ((this.comboDisabledModes >>> mode) & 1) === 0;
    }

    setComboEnabled(mode, enabled) {
        if (mode >= 32) {
            return;
        }
        const bit = (1 << mode) >>> 0;
        this.comboDisabledModes = (enabled ? (this.comboDisabledModes & ~bit) : (this.comboDisabledModes | bit)) >>> 0;
    }

    // The settings as stored on the adapter with only the live ones changed — mode combos and
    // search times, which the adapter applies without a restart. Unsaved edits in the Adapter
    // Options panel are left out.
    liveBytes() {
        const bytes = new Uint8Array(this.storedBytes || this.getBytes());
        this.#writeMask(bytes);
        if (this.version === 3) {
            this.#writeSearchTimes(bytes);
        }
        return bytes;
    }

    #writeSearchTimes(bytes) {
        const clamp = (v) => Math.min(DongleSettings.SEARCH_MAX_S, Math.max(0, Math.round(Number(v) || 0)));
        const full = clamp(this.values.fullSearchSeconds);
        const reduced = this.values.reducedSearchSeconds === DongleSettings.SEARCH_NO_LIMIT
            ? DongleSettings.SEARCH_NO_LIMIT : clamp(this.values.reducedSearchSeconds);
        bytes[9] = full & 0xFF;
        bytes[10] = ((full >> 8) & 0x0F) | ((reduced & 0x0F) << 4);
        bytes[11] = (reduced >> 4) & 0xFF;
    }

    #writeMask(bytes) {
        const o = DongleSettings.COMBO_MASK_OFFSET;
        if (bytes.length >= o + 4) {
            for (let i = 0; i < 4; i++) {
                bytes[o + i] = (this.comboDisabledModes >>> (8 * i)) & 0xFF;
            }
        }
    }

    getBytes() {
        // Same format the firmware answered with, so older firmware still accepts it.
        const bytes = new Uint8Array(this.version === 1 ? DongleSettings.V1_LENGTH : DongleSettings.LENGTH);
        bytes[0] = this.version;
        for (const option of this.availableOptions()) {
            bytes[option.offset] = this.values[option.key] ? 1 : 0;
        }
        if (this.version === 3) {
            this.#writeSearchTimes(bytes);
        }
        this.#writeMask(bytes);
        return bytes;
    }
}
