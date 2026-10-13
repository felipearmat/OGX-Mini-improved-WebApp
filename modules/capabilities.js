/*  What the adapter's hardware supports (OGX-Mini-improved firmware, UserSettings/Capabilities.h):
 *  USB Web App mode GET_CAPABILITIES (0x76, 32 bits little-endian), and over Bluetooth 4 bytes
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
