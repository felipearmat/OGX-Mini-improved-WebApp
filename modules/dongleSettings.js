/*  Dongle-wide options (OGX-Mini-improved firmware).
 *
 *  Wire format, shared with the firmware (Custom/DongleSettings.h): 16 bytes, a version byte
 *  (2) then one byte per option (0 / 1). Firmware before the format grew sends version 1, the
 *  first 8 bytes; the page then shows only those options and saves in that format. USB: packets GET_DONGLE_SETTINGS (0x70) and
 *  SET_DONGLE_SETTINGS (0x71). Bluetooth: characteristic ...9060 (read / write).
 *  Saving stores the options and restarts the adapter.
 */
export class DongleSettings {
    static VERSION = Object.freeze(2);
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
            key: "singleController", offset: 7,
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

    constructor() {
        this.values = {};
        this.version = DongleSettings.VERSION;
        for (const option of DongleSettings.OPTIONS) {
            this.values[option.key] = 0;
        }
    }

    // Options the connected firmware knows (it answered in this.version).
    availableOptions() {
        return DongleSettings.OPTIONS.filter((option) => (option.since || 1) <= this.version);
    }

    // False if the bytes are not a dongle settings record this page understands.
    setFromBytes(bytes) {
        if (!(bytes instanceof Uint8Array)) {
            return false;
        }
        const v2 = bytes[0] === DongleSettings.VERSION && bytes.length >= DongleSettings.LENGTH;
        const v1 = bytes[0] === 1 && bytes.length >= DongleSettings.V1_LENGTH;
        if (!v2 && !v1) {
            return false;
        }
        this.version = v2 ? DongleSettings.VERSION : 1;
        for (const option of this.availableOptions()) {
            this.values[option.key] = bytes[option.offset] ? 1 : 0;
        }
        return true;
    }

    getBytes() {
        // Same format the firmware answered with, so older firmware still accepts it.
        const bytes = new Uint8Array(this.version === 1 ? DongleSettings.V1_LENGTH : DongleSettings.LENGTH);
        bytes[0] = this.version;
        for (const option of this.availableOptions()) {
            bytes[option.offset] = this.values[option.key] ? 1 : 0;
        }
        return bytes;
    }
}
