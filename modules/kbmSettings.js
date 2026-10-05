/*  Mouse + keyboard mode mapping (OGX-Mini-improved firmware).
 *
 *  Wire format, shared with the firmware (Custom/KbmSettings.h): 48 bytes, a version byte, then
 *  a 2-byte action per pad input, the stick modes, the pointer / scroll settings and 5 reserved
 *  bytes. USB: packets
 *  GET_KBM_SETTINGS (0x72) and SET_KBM_SETTINGS (0x73, answered with the stored settings).
 *  Bluetooth: characteristic ...9070 (read / write). Saving applies the mapping right away.
 *
 *  Action bytes: [0] = type (bits 7..4) | modifiers held with it (bits 3..0: Ctrl, Shift, Alt,
 *  GUI); [1] = key usage, mouse button index or media key index.
 */
export class KbmSettings {
    static VERSION = Object.freeze(1);
    static LENGTH = Object.freeze(48);

    static TYPE = Object.freeze({ NONE: 0, KEY: 1, MOUSE: 2, MEDIA: 3 });
    static MOD = Object.freeze({ CTRL: 0x01, SHIFT: 0x02, ALT: 0x04, GUI: 0x08 });
    static FLAG = Object.freeze({ POINTER_ACCEL: 0x01, TOUCHPAD: 0x04, INVERT_SCROLL: 0x08 });

    // Pad inputs, in firmware order (kbm_settings::Input).
    static INPUTS = Object.freeze([
        "A", "B", "X", "Y", "LB", "RB", "LT", "RT", "L3", "R3", "Start", "Select / Back",
        "Home / Guide", "Misc (Capture / Touchpad click)",
        "D-pad Up", "D-pad Down", "D-pad Left", "D-pad Right",
    ]);

    static STICK_MODES = Object.freeze([
        { label: "Nothing", value: 0 },
        { label: "Mouse pointer", value: 1 },
        { label: "Scroll wheel", value: 2 },
        { label: "Arrow keys", value: 3 },
        { label: "W A S D", value: 4 },
    ]);

    static MOUSE_BUTTONS = Object.freeze(["Left click", "Right click", "Middle click", "Back", "Forward"]);

    // Same order as kbm_settings::kConsumerUsages.
    static MEDIA_KEYS = Object.freeze([
        "Home", "Back", "Volume up", "Volume down", "Mute", "Play / pause",
        "Next track", "Previous track", "Stop", "Search",
    ]);

    // Keyboard keys offered in the web app: [label, HID usage].
    static KEYS = Object.freeze((() => {
        const keys = [];
        for (let i = 0; i < 26; i++) {
            keys.push([String.fromCharCode(65 + i), 0x04 + i]);
        }
        for (let i = 1; i <= 9; i++) {
            keys.push([String(i), 0x1D + i]);
        }
        keys.push(["0", 0x27]);
        keys.push(
            ["Enter", 0x28], ["Esc", 0x29], ["Backspace", 0x2A], ["Tab", 0x2B], ["Space", 0x2C],
            ["- _", 0x2D], ["= +", 0x2E], ["[ {", 0x2F], ["] }", 0x30], ["\\ |", 0x31],
            ["; :", 0x33], ["' \"", 0x34], ["` ~", 0x35], [", <", 0x36], [". >", 0x37], ["/ ?", 0x38],
            ["Caps Lock", 0x39],
        );
        for (let i = 1; i <= 12; i++) {
            keys.push([`F${i}`, 0x39 + i]);
        }
        keys.push(
            ["Print Screen", 0x46], ["Pause", 0x48], ["Insert", 0x49], ["Home", 0x4A],
            ["Page Up", 0x4B], ["Delete", 0x4C], ["End", 0x4D], ["Page Down", 0x4E],
            ["Right arrow", 0x4F], ["Left arrow", 0x50], ["Down arrow", 0x51], ["Up arrow", 0x52],
            ["Menu (context)", 0x65],
            ["Ctrl (left)", 0xE0], ["Shift (left)", 0xE1], ["Alt (left)", 0xE2], ["Win / Super (left)", 0xE3],
            ["Ctrl (right)", 0xE4], ["Shift (right)", 0xE5], ["AltGr (right)", 0xE6], ["Win / Super (right)", 0xE7],
        );
        return keys;
    })());

    // Firmware defaults (kbm_settings::defaults), for "Restore defaults".
    static DEFAULT_BYTES = Object.freeze([
        1,
        0x10, 0x28,  // A: Enter
        0x10, 0x29,  // B: Esc
        0x10, 0x2A,  // X: Backspace
        0x10, 0x2C,  // Y: Space
        0x12, 0x2B,  // LB: Shift + Tab
        0x10, 0x2B,  // RB: Tab
        0x20, 0x01,  // LT: right click
        0x20, 0x00,  // RT: left click
        0x10, 0xE0,  // L3: Ctrl
        0x10, 0xE1,  // R3: Shift
        0x10, 0x65,  // Start: Menu
        0x10, 0xE3,  // Select: Win / Super
        0x30, 0x00,  // Home: media Home
        0x00, 0x00,  // Misc: nothing
        0x10, 0x52,  // D-pad: arrows
        0x10, 0x51,
        0x10, 0x50,
        0x10, 0x4F,
        2,           // left stick: scroll
        1,           // right stick: pointer
        8,           // pointer speed
        8,           // scroll speed
        12,          // deadzone %
        0x01 | 0x04, // pointer acceleration, touchpad
        0, 0, 0, 0, 0,
    ]);

    constructor() {
        this.setFromBytes(new Uint8Array(KbmSettings.DEFAULT_BYTES));
    }

    // False if the bytes are not a mapping record this page understands.
    setFromBytes(bytes) {
        if (!(bytes instanceof Uint8Array) || bytes.length < KbmSettings.LENGTH ||
            bytes[0] !== KbmSettings.VERSION) {
            return false;
        }
        this.actions = [];
        for (let i = 0; i < KbmSettings.INPUTS.length; i++) {
            const typeMods = bytes[1 + 2 * i];
            this.actions.push({ type: typeMods >> 4, mods: typeMods & 0x0F, code: bytes[2 + 2 * i] });
        }
        const o = 1 + 2 * KbmSettings.INPUTS.length;
        this.leftStick = bytes[o];
        this.rightStick = bytes[o + 1];
        this.pointerSpeed = bytes[o + 2];
        this.scrollSpeed = bytes[o + 3];
        this.deadzone = bytes[o + 4];
        this.flags = bytes[o + 5];
        return true;
    }

    getBytes() {
        const bytes = new Uint8Array(KbmSettings.LENGTH);
        bytes[0] = KbmSettings.VERSION;
        this.actions.forEach((a, i) => {
            bytes[1 + 2 * i] = ((a.type & 0x0F) << 4) | (a.mods & 0x0F);
            bytes[2 + 2 * i] = a.code;
        });
        const o = 1 + 2 * KbmSettings.INPUTS.length;
        bytes[o] = this.leftStick;
        bytes[o + 1] = this.rightStick;
        bytes[o + 2] = this.pointerSpeed;
        bytes[o + 3] = this.scrollSpeed;
        bytes[o + 4] = this.deadzone;
        bytes[o + 5] = this.flags;
        return bytes;
    }

    restoreDefaults() {
        this.setFromBytes(new Uint8Array(KbmSettings.DEFAULT_BYTES));
    }
}
