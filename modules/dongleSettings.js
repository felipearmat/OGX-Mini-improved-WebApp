/*  Dongle-wide options (OGX-Mini-improved firmware).
 *
 *  Wire format, shared with the firmware (Custom/DongleSettings.h): 8 bytes, a version byte
 *  then one byte per option (0 / 1). USB: packets GET_DONGLE_SETTINGS (0x70) and
 *  SET_DONGLE_SETTINGS (0x71). Bluetooth: characteristic ...9060 (read / write).
 *  Saving stores the options and restarts the adapter.
 */
export class DongleSettings {
    static VERSION = Object.freeze(1);
    static LENGTH = Object.freeze(8);

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
    ]);

    constructor() {
        this.values = {};
        for (const option of DongleSettings.OPTIONS) {
            this.values[option.key] = 0;
        }
    }

    // False if the bytes are not a dongle settings record this page understands.
    setFromBytes(bytes) {
        if (!(bytes instanceof Uint8Array) || bytes.length < DongleSettings.LENGTH ||
            bytes[0] !== DongleSettings.VERSION) {
            return false;
        }
        for (const option of DongleSettings.OPTIONS) {
            this.values[option.key] = bytes[option.offset] ? 1 : 0;
        }
        return true;
    }

    getBytes() {
        const bytes = new Uint8Array(DongleSettings.LENGTH);
        bytes[0] = DongleSettings.VERSION;
        for (const option of DongleSettings.OPTIONS) {
            bytes[option.offset] = this.values[option.key] ? 1 : 0;
        }
        return bytes;
    }
}
