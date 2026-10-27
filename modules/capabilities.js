/*  What the adapter's hardware supports (OGX-Mini-improved firmware, UserSettings/Capabilities.h):
 *  USB (D-Input/Debug mode) GET_CAPABILITIES (0x76, 32 bits little-endian), and over Bluetooth 4 bytes
 *  after the dongle settings record. Until the adapter answers (older firmware never does) every
 *  option stays available, as before. Options the hardware can't use are turned off with a note. */
export class Capabilities {
    static BLUETOOTH = 1 << 0;
    static HYBRID = 1 << 1;
    static HIGH_TX_POWER = 1 << 2;
    static JOYCON = 1 << 3;
    static MAC_PER_CONTROLLER = 1 << 4;
    static DISCONNECT_ON_MODE_CHANGE = 1 << 5;
    static SEARCH_TIMES = 1 << 6;
    static IDLE_OFF = 1 << 7;
    static WIRED_INPUT = 1 << 8;
    static BLE_WEBAPP = 1 << 9;
    static STATUS_LED_PICO = 1 << 10;       // the Pico board's own status LED (or its RGB LED)
    static STATUS_LED_ESP32 = 1 << 11;      // the hybrid ESP32's status LED
    static STATUS_LED_PICO_EXT = 1 << 12;   // an external RGB LED on the Pico (GP6)
    static MODE_COLORS = 1 << 13;           // colour per output mode (USB only)
    static STATUS_LED_ESP32_EXT = 1 << 14;  // an external RGB LED on the hybrid ESP32 (GPIO 4)
    static FLASH_LOG = 1 << 15;             // the log also kept in flash (Diagnostics panel)
    static MOTION_STREAM = 1 << 16;         // live motion with the live input (GP_MOTION, USB)
    static RAW_LIVE_INPUT = 1 << 17;        // live input without stick / trigger settings (USB)
    static RAW_CAPTURE = 1 << 18;           // raw Bluetooth input reports (RAW_CAPTURE / RAW_REPORT, USB; bench tools)

    static NOTE = "Not supported on this adapter's hardware.";

    constructor() {
        this.known = false;
        this.mask = 0;
        this.listeners = [];
    }

    set(mask) {
        this.known = true;
        this.mask = mask >>> 0;
        for (const fn of this.listeners) {
            fn(this);
        }
    }

    // From 4 bytes, little-endian.
    setFromBytes(bytes, offset = 0) {
        if (!bytes || bytes.length < offset + 4) {
            return false;
        }
        this.set((bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0);
        return true;
    }

    // An unknown capability (no bit, or no answer yet) counts as supported.
    supports(bit) {
        return !bit || !this.known || (this.mask & bit) !== 0;
    }

    get hybrid() {
        return this.known && (this.mask & Capabilities.HYBRID) !== 0;
    }

    addListener(fn) {
        this.listeners.push(fn);
    }

    // An ⓘ popover on a settings label (style.css .hasTip), also shown on keyboard focus.
    static addTip(label, text) {
        if (!label || !text) {
            return;
        }
        label.dataset.tip = text;
        label.classList.add("hasTip");
        label.tabIndex = 0;
    }

    // Turn a settings row on or off: label and field disabled, a note on hover / focus.
    static markRow(row, supported) {
        if (!row) {
            return;
        }
        row.classList.toggle("unsupported", !supported);
        if (supported) {
            row.removeAttribute("data-note");
            row.removeAttribute("tabindex");
        } else {
            row.setAttribute("data-note", Capabilities.NOTE);
            row.setAttribute("tabindex", "0");  // the note also shows on keyboard focus
        }
        for (const input of row.querySelectorAll("input, select, button")) {
            if (!supported) {
                input.dataset.unsupported = "1";
                input.disabled = true;
            } else if (input.dataset.unsupported) {
                delete input.dataset.unsupported;
                input.disabled = false;
            }
        }
    }
}

export const capabilities = new Capabilities();
