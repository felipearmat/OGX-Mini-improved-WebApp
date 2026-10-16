/*  Dongle-wide options (OGX-Mini-improved firmware).
 *
 *  Wire format, shared with the firmware (UserSettings/DongleSettings.h): 17 bytes, a version
 *  byte (4) then one byte per option (0 / 1). Older firmware answers with version 3 or 2 (16
 *  bytes; version 2 has the single controller option in byte 7) or 1 (the first 8 bytes); the
 *  page then shows only the options that version has and saves in that format. USB: packets GET_DONGLE_SETTINGS
 *  (0x70) and SET_DONGLE_SETTINGS (0x71). Bluetooth: characteristic ...9060 (read / write).
 *  Saving stores the options and restarts the adapter, unless only the live ones changed.
 *
 *  Version 3, bytes 9-11: search for new controllers while a slot is open with a controller
 *  connected, two 12-bit second counts (full search = bits 0-11, reduced search = bits 12-23),
 *  0-600 s; 4095 for the reduced search = no limit. Applied without a restart.
 *  Bytes 12-15 (version 2): output modes whose button combo is off, a little-endian bit mask
 *  (bit n = device mode n); zero turns every combo on. D-Input/Debug's Start + LB + RB is always on. Saving a
 *  change of the mask alone applies it right away, without a restart.
 *  Version 4, byte 16: minutes without input before a Bluetooth controller is turned off
 *  (0 = never). Applied without a restart.
 *  Version 5, byte 17: higher Bluetooth transmit power, where the radio allows it (the RP2040 +
 *  ESP32 hybrid). Applied without a restart, so it sits in the Bluetooth config panel (panel:
 *  "bluetooth") and is saved live. Each option names the capability it needs (capabilities.js);
 *  the panel turns it off when the hardware lacks it.
 *  Version 6, bytes 18-22: the status LEDs (panel "led", Status LED panel, saved live): the
 *  Pico's LED, an external RGB LED on the Pico, the hybrid ESP32's LED and an external RGB LED on
 *  the ESP32 on (0 / 1), then the RGB LEDs' brightness (1-255).
 */
import { Capabilities } from "./capabilities.js";

export class DongleSettings {
    static VERSION = Object.freeze(6);
    static SEARCH_MAX_S = Object.freeze(600);
    static SEARCH_NO_LIMIT = Object.freeze(0xFFF);
    static LENGTH = Object.freeze(23);
    static V5_LENGTH = Object.freeze(18);
    static BRIGHTNESS_OFFSET = Object.freeze(22);
    static BRIGHTNESS_DEFAULT = Object.freeze(48);
    static V4_LENGTH = Object.freeze(17);
    static V3_LENGTH = Object.freeze(16);
    static IDLE_OFFSET = Object.freeze(16);
    static IDLE_MAX_MIN = Object.freeze(255);
    static V1_LENGTH = Object.freeze(8);

    // Byte offsets follow the firmware struct. "choices" options are shown as a dropdown,
    // the others as a checkbox.
    static OPTIONS = Object.freeze([
        {
            key: "disconnectPadsOnModeChange", offset: 1, capability: Capabilities.DISCONNECT_ON_MODE_CHANGE,
            label: "Turn off controllers before mode change",
            help: "Controllers switch off (light off) before the mode changes, so none gets stuck in the old mode.",
        },
        {
            key: "joyconPairImuRight", offset: 2, capability: Capabilities.JOYCON,
            label: "Joy-Con pair: motion from",
            choices: [{ label: "Right Joy-Con", value: 1 }, { label: "Left Joy-Con", value: 0 }],
        },
        {
            key: "joyconPairHorizontal", offset: 3, capability: Capabilities.JOYCON,
            label: "Joy-Con pair orientation",
            choices: [{ label: "Vertical", value: 0 }, { label: "Horizontal", value: 1 }],
        },
        {
            key: "joyconSoloHorizontal", offset: 4, capability: Capabilities.JOYCON,
            label: "Single Joy-Con orientation",
            choices: [{ label: "Vertical", value: 0 }, { label: "Horizontal (sideways)", value: 1 }],
        },
        {
            key: "macPerController", offset: 5, capability: Capabilities.MAC_PER_CONTROLLER,
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
            key: "joyconPairRumblePerSide", offset: 8, since: 2, capability: Capabilities.JOYCON,
            label: "Joy-Con pair rumble",
            choices: [{ label: "Per side (as SDL / Steam)", value: 1 }, { label: "Both Joy-Cons", value: 0 }],
            help: "Per side: the game's left (strong) motor rumbles the left Joy-Con and the right (weak) motor the right one, as when the pair is connected straight to a PC. Both: each Joy-Con plays both motors.",
        },
        {
            key: "highTxPower", offset: 17, since: 5, capability: Capabilities.HIGH_TX_POWER, panel: "bluetooth",
            label: "Extended range (uses more power)",
            tip: "Range: a stronger radio reaches controllers further away, for a little more power.",
            help: "+9 dBm instead of +3 dBm (RP2040 + ESP32 adapter).",
        },
        {
            key: "statusLedPico", offset: 18, since: 6, capability: Capabilities.STATUS_LED_PICO, panel: "led",
            label: "Pico LED", defaultValue: 1,
            tip: "The Pico board's own LED (or its RGB LED, on boards that have one): the mode's blink code at boot, then blinking while searching for controllers. On a Pico W / Pico 2 W in the RP2040 + ESP32 adapter it stays dark: it is wired to the radio chip, which that adapter leaves off.",
        },
        {
            key: "statusLedPicoExt", offset: 19, since: 6, capability: Capabilities.STATUS_LED_PICO_EXT, panel: "led",
            label: "External LED on the Pico (GP6)", defaultValue: 1,
            tip: "An RGB LED (WS2812B) on GP6 of a Pico 2 / Pico 2 W, in the mode colour.",
        },
        {
            key: "statusLedEsp32", offset: 20, since: 6, capability: Capabilities.STATUS_LED_ESP32, panel: "led",
            label: "ESP32 LED", defaultValue: 1,
            tip: "The ESP32 board's LED on the RP2040 + ESP32 adapter.",
        },
        {
            key: "statusLedEsp32Ext", offset: 21, since: 6, capability: Capabilities.STATUS_LED_ESP32_EXT, panel: "led",
            label: "External LED on the ESP32 (GPIO 4)", defaultValue: 1,
            tip: "An RGB LED (WS2812B) on GPIO 4 of the ESP32 (RP2040 + ESP32 adapter), in the mode colour.",
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
        6: "Start + LB + RB (always on) or Start + RB + D-pad Left",
        7: "Start + A",
        8: "Start + D-pad Down",
        9: "Start + LB + D-pad Down",
        15: "Start + LB + D-pad Left",
        16: "Start + LB + D-pad Up",
        17: "Start + RB + D-pad Up",
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
        // Version 4: idle turn-off, saved live too.
        this.values.idleOffMinutes = 15;
        // Version 6: the RGB status LED's brightness, saved live (Status LED panel).
        this.values.statusLedBrightness = DongleSettings.BRIGHTNESS_DEFAULT;
        for (const option of DongleSettings.OPTIONS) {
            if (option.defaultValue !== undefined) {
                this.values[option.key] = option.defaultValue;
            }
        }
    }

    // Record length of a version.
    static lengthOf(version) {
        return version >= 6 ? DongleSettings.LENGTH : version >= 5 ? DongleSettings.V5_LENGTH
            : version >= 4 ? DongleSettings.V4_LENGTH
            : version >= 2 ? DongleSettings.V3_LENGTH : DongleSettings.V1_LENGTH;
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
        const version = bytes[0];
        if (version < 1 || version > DongleSettings.VERSION || bytes.length < DongleSettings.lengthOf(version)) {
            return false;
        }
        this.version = version;
        for (const option of this.availableOptions()) {
            this.values[option.key] = bytes[option.offset] ? 1 : 0;
        }
        if (version >= 3) {
            this.values.fullSearchSeconds = bytes[9] | ((bytes[10] & 0x0F) << 8);
            this.values.reducedSearchSeconds = (bytes[10] >> 4) | (bytes[11] << 4);
        }
        if (version >= 4) {
            this.values.idleOffMinutes = bytes[DongleSettings.IDLE_OFFSET];
        }
        if (version >= 6) {
            this.values.statusLedBrightness = bytes[DongleSettings.BRIGHTNESS_OFFSET] || DongleSettings.BRIGHTNESS_DEFAULT;
        }
        const o = DongleSettings.COMBO_MASK_OFFSET;
        this.comboDisabledModes = version >= 2 ? (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0 : 0;
        this.storedBytes = bytes.slice(0, DongleSettings.lengthOf(version));
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
    // Null until the adapter's record was read and understood: a record built from defaults would
    // change options that need a restart, and the adapter would restart.
    liveBytes() {
        if (!this.storedBytes) {
            return null;
        }
        const bytes = new Uint8Array(this.storedBytes);
        this.#writeMask(bytes);
        if (this.version >= 3) {
            this.#writeSearchTimes(bytes);
        }
        this.#writeIdle(bytes);
        this.#writeLiveOptions(bytes);
        return bytes;
    }

    // Options shown in the Bluetooth config and Status LED panels: the adapter applies them
    // without a restart.
    #writeLiveOptions(bytes) {
        for (const option of this.availableOptions()) {
            if (option.panel && bytes.length > option.offset) {
                bytes[option.offset] = this.values[option.key] ? 1 : 0;
            }
        }
        this.#writeBrightness(bytes);
    }

    #writeBrightness(bytes) {
        if (this.version >= 6 && bytes.length > DongleSettings.BRIGHTNESS_OFFSET) {
            const v = Math.round(Number(this.values.statusLedBrightness) || DongleSettings.BRIGHTNESS_DEFAULT);
            bytes[DongleSettings.BRIGHTNESS_OFFSET] = Math.min(255, Math.max(1, v));
        }
    }

    #writeIdle(bytes) {
        if (this.version >= 4 && bytes.length > DongleSettings.IDLE_OFFSET) {
            const v = Math.round(Number(this.values.idleOffMinutes) || 0);
            bytes[DongleSettings.IDLE_OFFSET] = Math.min(DongleSettings.IDLE_MAX_MIN, Math.max(0, v));
        }
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
        const bytes = new Uint8Array(DongleSettings.lengthOf(this.version));
        bytes[0] = this.version;
        for (const option of this.availableOptions()) {
            bytes[option.offset] = this.values[option.key] ? 1 : 0;
        }
        if (this.version >= 3) {
            this.#writeSearchTimes(bytes);
        }
        this.#writeMask(bytes);
        this.#writeIdle(bytes);
        this.#writeBrightness(bytes);
        return bytes;
    }
}
