import { DongleSettings } from "./dongleSettings.js";
import { UIDongle } from "./uiDongle.js";
import { ModeView } from "./modeView.js";
import { Capabilities, capabilities } from "./capabilities.js";

/*  Status LEDs (OGX-Mini-improved firmware).
 *
 *  "Status LED" panel: which LEDs are on (board, ESP32, external RGB) and the RGB LED's
 *  brightness, Adapter Options version 6, applied without a restart and saved by themselves like
 *  the Bluetooth config. Options the hardware lacks are off with a note (capabilities.js).
 *
 *  Mode colour (under the Device Mode dropdown, USB only): the colour of the selected mode on the
 *  controller's lightbar and the RGB LED. A colour wheel (angle = hue, centre = the light tone,
 *  edge = the full colour) previews on the adapter while picking (USB LED_PREVIEW, 0x7A); Save
 *  stores the whole table (SET_LED_COLORS, 0x79: a version byte, then r, g, b per mode 0-17;
 *  0, 0, 0 = the default colour). */

// The firmware's default colours (Firmware/common/Board/ModeIndicator.cpp lightbar_color).
export const DEFAULT_COLORS = Object.freeze({
    12: [0xFF, 0x00, 0xFF],  // GameCube: magenta
    14: [0xFF, 0x00, 0xFF],  // N64: magenta
    9: [0xFF, 0x80, 0x80],   // GameCube adapter (Wii U / Switch): light red
    8: [0xFF, 0x00, 0x00],   // Switch: red
    10: [0xFF, 0x80, 0x00],  // Wii: orange
    4: [0x00, 0xFF, 0x00],   // XInput: green
    1: [0xC0, 0xFF, 0x80],   // Original Xbox: light lime
    2: [0xC0, 0xFF, 0x80],
    3: [0xC0, 0xFF, 0x80],
    5: [0x00, 0xFF, 0xFF],   // PS3: cyan
    11: [0x40, 0xA0, 0xFF],  // PS1 / PS2: light azure
    7: [0x40, 0xA0, 0xFF],   // PS Classic: light azure
    15: [0x00, 0x00, 0xFF],  // PS4: blue
    16: [0xC0, 0x80, 0xFF],  // STEAM: lilac
    17: [0xFF, 0xFF, 0x00],  // Mouse + Keyboard: yellow
    13: [0x40, 0x40, 0xFF],  // Dreamcast: light blue-violet
});
export const WHITE = [0xFF, 0xFF, 0xFF];  // D-Input/Debug and anything else
export const COLOR_SLOTS = 18;
export const COLORS_VERSION = 1;
const WEBAPP = 100;
const DINPUT = 6;

const hex = (rgb) => "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");

// Hue 0-360, saturation 0-1, full value.
export function hsToRgb(h, s) {
    const f = (n) => {
        const k = (n + h / 60) % 6;
        return Math.round(255 * (1 - s * Math.max(0, Math.min(k, 4 - k, 1))));
    };
    return [f(5), f(3), f(1)];
}

export function rgbToHs([r, g, b]) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const s = max === 0 ? 0 : (max - min) / max;
    let h = 0;
    if (max !== min) {
        const d = max - min;
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h = (h * 60 + 360) % 360;
    }
    return [h, s];
}

export const UILed = {
    built: false,
    saved: false,
    colors: null,       // Uint8Array, the adapter's table once read
    previewFunc: null,  // async (active, r, g, b)
    saveColorsFunc: null,
    picking: null,      // [r, g, b] being picked

    /* ---------- Status LED panel ---------- */

    init(dongleSettings) {
        if (this.built) {
            return;
        }
        const container = document.getElementById("ledInput");
        if (!container) {
            return;
        }
        const changed = () => {
            this.setStatus("Saving...");
            UIDongle.scheduleLiveSave(() => {
                const t = new Date();
                const hms = [t.getHours(), t.getMinutes(), t.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":");
                this.saved = true;
                this.setStatus(`Latest Save ${hms}`);
            });
        };
        for (const option of DongleSettings.OPTIONS.filter((o) => o.panel === "led")) {
            const row = document.createElement("div");
            row.className = "dongleOption";
            const id = `dongle-${option.key}`;
            const label = document.createElement("label");
            label.htmlFor = id;
            label.textContent = option.label;
            const box = document.createElement("input");
            box.type = "checkbox";
            box.className = "invertCheckbox";
            box.id = id;
            box.addEventListener("change", () => {
                dongleSettings.values[option.key] = box.checked ? 1 : 0;
                changed();
            });
            row.appendChild(label);
            row.appendChild(box);
            Capabilities.addTip(label, option.tip);
            container.appendChild(row);
        }
        const row = document.createElement("div");
        row.className = "dongleOption";
        row.id = "ledBrightnessRow";
        const label = document.createElement("label");
        label.htmlFor = "led-brightness";
        label.textContent = "External LED brightness";
        Capabilities.addTip(label, "Brightness of the RGB LEDs (1-255). The controller's lightbar always uses the full colour.");
        const range = document.createElement("input");
        range.type = "range";
        range.id = "led-brightness";
        range.min = "1";
        range.max = "255";
        range.step = "1";
        const value = document.createElement("span");
        value.className = "kbmRangeValue";
        value.id = "led-brightness-value";
        range.addEventListener("input", () => {
            dongleSettings.values.statusLedBrightness = Number(range.value);
            value.textContent = range.value;
            changed();
        });
        row.appendChild(label);
        row.appendChild(range);
        row.appendChild(value);
        container.appendChild(row);

        capabilities.addListener(() => this.update(dongleSettings));
        const toggle = document.getElementById("button-toggleLed");
        const panel = document.getElementById("ledPanel");
        if (toggle && panel) {
            toggle.addEventListener("click", () => {
                const hidden = panel.classList.toggle("hidden");
                toggle.textContent = hidden ? "Show" : "Hide";
            });
        }
        this.built = true;
    },

    // Values from the adapter; shown only for firmware with the LED options (version 6).
    update(dongleSettings) {
        const available = !!dongleSettings.storedBytes && dongleSettings.version >= 6;
        for (const id of ["ledControl", "ledPanel"]) {
            const element = document.getElementById(id);
            if (element) {
                element.classList.toggle("hidden", !available);
            }
        }
        if (!available) {
            return;
        }
        if (!this.saved) {
            this.setStatus("Current Config");
        }
        for (const option of DongleSettings.OPTIONS.filter((o) => o.panel === "led")) {
            const box = document.getElementById(`dongle-${option.key}`);
            const row = box && box.closest(".dongleOption");
            if (!row) {
                continue;
            }
            box.checked = dongleSettings.values[option.key] !== 0;
            Capabilities.markRow(row, capabilities.supports(option.capability));
        }
        const range = document.getElementById("led-brightness");
        const value = document.getElementById("led-brightness-value");
        if (range && value) {
            range.value = String(dongleSettings.values.statusLedBrightness);
            value.textContent = range.value;
            const rgb = capabilities.supports(Capabilities.STATUS_LED_PICO_EXT) ||
                capabilities.supports(Capabilities.STATUS_LED_ESP32_EXT);
            Capabilities.markRow(range.closest(".dongleOption"), rgb);
        }
    },

    setStatus(text) {
        const status = document.getElementById("ledStatus");
        if (status) {
            status.textContent = text;
        }
    },

    /* ---------- Mode colour ---------- */

    // USB only: previewFunc(active, r, g, b) and saveColorsFunc(bytes) talk to the adapter.
    initModeColor(previewFunc, saveColorsFunc) {
        this.previewFunc = previewFunc;
        this.saveColorsFunc = saveColorsFunc;
        const swatch = document.getElementById("button-modeColor");
        const picker = document.getElementById("modeColorPicker");
        const wheel = document.getElementById("canvas-modeColor");
        if (!swatch || !picker || !wheel) {
            return;
        }
        this._drawWheel(wheel);
        swatch.addEventListener("click", () => {
            const open = picker.classList.toggle("hidden") === false;
            if (open) {
                this.picking = this.colorOf(this._mode());
                this._showPicking();
                this._preview();
            } else {
                this._endPreview();
            }
        });
        let dragging = false;
        const pick = (event) => {
            const rect = wheel.getBoundingClientRect();
            const x = (event.clientX - rect.left) / rect.width * 2 - 1;
            const y = (event.clientY - rect.top) / rect.height * 2 - 1;
            const s = Math.min(1, Math.hypot(x, y));
            const h = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
            this.picking = hsToRgb(h, s);
            this._showPicking();
            this._preview();
        };
        wheel.addEventListener("pointerdown", (event) => {
            dragging = true;
            wheel.setPointerCapture(event.pointerId);
            pick(event);
        });
        wheel.addEventListener("pointermove", (event) => dragging && pick(event));
        wheel.addEventListener("pointerup", () => { dragging = false; });
        // A colour code typed in (#rrggbb or rrggbb): the wheel's marker moves to it.
        const code = document.getElementById("modeColorHex");
        code?.addEventListener("input", () => {
            const m = /^#?([0-9a-f]{6})$/i.exec(code.value.trim());
            code.classList.toggle("invalid", !m);
            if (m) {
                const n = parseInt(m[1], 16);
                this.picking = [(n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF];
                this._showPicking();
                this._preview();
            }
        });
        code?.addEventListener("blur", () => {
            code.classList.remove("invalid");
            this._showPicking();
        });
        document.getElementById("button-modeColorSave")?.addEventListener("click", () => this._save(this.picking));
        document.getElementById("button-modeColorDefault")?.addEventListener("click", () => this._save([0, 0, 0]));
        document.getElementById("button-modeColorCancel")?.addEventListener("click", () => {
            picker.classList.add("hidden");
            this._endPreview();
        });
        ModeView.addListener(() => {
            picker.classList.add("hidden");
            this._endPreview();
            this.refreshModeColor();
        });
        capabilities.addListener(() => this.refreshModeColor());
        this.refreshModeColor();
    },

    // The table read from the adapter (GET_LED_COLORS).
    setColors(bytes) {
        if (!(bytes instanceof Uint8Array) || bytes.length < 1 + 3 * COLOR_SLOTS || bytes[0] !== COLORS_VERSION) {
            return;
        }
        this.colors = bytes.slice(0, 1 + 3 * COLOR_SLOTS);
        this.refreshModeColor();
    },

    // The colour a mode shows: its saved one, else the default.
    colorOf(mode) {
        const slot = mode === WEBAPP ? DINPUT : mode;
        if (this.colors && slot >= 0 && slot < COLOR_SLOTS) {
            const rgb = Array.from(this.colors.slice(1 + 3 * slot, 4 + 3 * slot));
            if (rgb[0] | rgb[1] | rgb[2]) {
                return rgb;
            }
        }
        return (DEFAULT_COLORS[slot] || WHITE).slice();
    },

    refreshModeColor() {
        const row = document.getElementById("modeColorRow");
        const swatch = document.getElementById("button-modeColor");
        if (!row || !swatch) {
            return;
        }
        const available = !!this.colors && capabilities.known && capabilities.supports(Capabilities.MODE_COLORS);
        row.classList.toggle("hidden", !available);
        if (available) {
            const rgb = this.colorOf(this._mode());
            swatch.style.setProperty("--swatch", hex(rgb));
            swatch.title = `Mode colour ${hex(rgb).toUpperCase()}: change it`;
        }
    },

    _mode() {
        const dropdown = document.getElementById("dropdown-deviceMode");
        return dropdown ? Number(dropdown.value) : 0;
    },

    _showPicking() {
        const status = document.getElementById("modeColorValue");
        if (status && this.picking) {
            status.style.setProperty("--swatch", hex(this.picking));
        }
        // The code box follows the wheel, except while it is being typed in.
        const code = document.getElementById("modeColorHex");
        if (code && this.picking && document.activeElement !== code) {
            code.value = hex(this.picking).toUpperCase();
        }
        const marker = document.getElementById("modeColorMarker");
        if (marker && this.picking) {
            const [h, s] = rgbToHs(this.picking);
            const a = h * Math.PI / 180;
            marker.style.left = `${50 + 50 * s * Math.cos(a)}%`;
            marker.style.top = `${50 + 50 * s * Math.sin(a)}%`;
        }
    },

    _previewTimer: null,
    _previewKeepAlive: null,

    // At most every 60 ms while dragging; repeated every 10 s while the picker stays open.
    _preview() {
        if (!this.previewFunc || this._previewTimer) {
            return;
        }
        this._previewTimer = setTimeout(async () => {
            this._previewTimer = null;
            const [r, g, b] = this.picking || WHITE;
            await this.previewFunc(true, r, g, b);
        }, 60);
        clearInterval(this._previewKeepAlive);
        this._previewKeepAlive = setInterval(() => this._preview(), 10000);
    },

    async _endPreview() {
        clearInterval(this._previewKeepAlive);
        this._previewKeepAlive = null;
        clearTimeout(this._previewTimer);
        this._previewTimer = null;
        if (this.previewFunc) {
            await this.previewFunc(false, 0, 0, 0);
        }
    },

    async _save(rgb) {
        if (!this.saveColorsFunc || !this.colors) {
            return;
        }
        const mode = this._mode();
        const slot = mode === WEBAPP ? DINPUT : mode;
        if (slot < 0 || slot >= COLOR_SLOTS) {
            return;
        }
        const table = new Uint8Array(this.colors);
        table.set(rgb.slice(0, 3), 1 + 3 * slot);
        document.getElementById("modeColorPicker")?.classList.add("hidden");
        await this._endPreview();
        await this.saveColorsFunc(table);  // the adapter answers with the stored table
        const status = document.getElementById("modeColorHint");
        if (status) {
            status.textContent = `${rgb[0] | rgb[1] | rgb[2] ? "Saved" : "Default restored"} (${new Date().toLocaleTimeString()})`;
        }
    },

    _drawWheel(canvas) {
        const ctx = canvas.getContext("2d");
        const size = canvas.width;
        const image = ctx.createImageData(size, size);
        const r = size / 2;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const dx = (x + 0.5 - r) / r;
                const dy = (y + 0.5 - r) / r;
                const d = Math.hypot(dx, dy);
                const i = (y * size + x) * 4;
                if (d > 1) {
                    image.data[i + 3] = 0;
                    continue;
                }
                const [cr, cg, cb] = hsToRgb((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, d);
                image.data[i] = cr;
                image.data[i + 1] = cg;
                image.data[i + 2] = cb;
                image.data[i + 3] = 255;
            }
        }
        ctx.putImageData(image, 0, 0);
    },
};
