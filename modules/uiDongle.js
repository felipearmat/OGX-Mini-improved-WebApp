import { DongleSettings } from "./dongleSettings.js";
import { ModeView } from "./modeView.js";
import { Capabilities, capabilities } from "./capabilities.js";

/*  "Adapter Options" panel (OGX-Mini-improved firmware). Hidden until the adapter answers with
 *  its dongle settings; older firmware never does. */
export const UIDongle = {
    built: false,

    init(dongleSettings) {
        const container = document.getElementById("dongleOptionsInput");
        if (!container) {
            return;
        }
        container.innerHTML = "";

        for (const option of DongleSettings.OPTIONS.filter((o) => !o.panel)) {  // the others: Bluetooth config
            const row = document.createElement("div");
            row.className = "dongleOption";

            const id = `dongle-${option.key}`;
            const label = document.createElement("label");
            label.htmlFor = id;
            label.textContent = option.label;
            Capabilities.addTip(label, option.tip);

            let input;
            if (option.choices) {
                input = document.createElement("select");
                for (const choice of option.choices) {
                    const element = document.createElement("option");
                    element.value = String(choice.value);
                    element.textContent = choice.label;
                    input.appendChild(element);
                }
                input.addEventListener("change", () => {
                    dongleSettings.values[option.key] = Number(input.value);
                });
            } else {
                input = document.createElement("input");
                input.type = "checkbox";
                input.className = "invertCheckbox";
                input.addEventListener("change", () => {
                    dongleSettings.values[option.key] = input.checked ? 1 : 0;
                });
            }
            input.id = id;

            row.appendChild(label);
            row.appendChild(input);
            if (option.help) {
                const help = document.createElement("div");
                help.className = "dongleOptionHelp";
                help.textContent = option.help;
                row.appendChild(help);
            }
            container.appendChild(row);
        }
        container.appendChild(this.brightnessRow(dongleSettings));

        const toggle = document.getElementById("button-toggleDongleOptions");
        const panel = document.getElementById("dongleOptionsPanel");
        if (!this.built) {
            capabilities.addListener(() => this.update(dongleSettings));  // the adapter answered
        }
        if (toggle && panel && !this.built) {
            toggle.addEventListener("click", () => {
                const hidden = panel.classList.toggle("hidden");
                toggle.textContent = hidden ? "Show" : "Hide";
            });
        }
        this.built = true;
    },

    update(dongleSettings) {
        for (const option of DongleSettings.OPTIONS.filter((o) => !o.panel)) {
            const input = document.getElementById(`dongle-${option.key}`);
            if (!input) {
                continue;
            }
            // Hide options the connected firmware does not have yet.
            const row = input.closest(".dongleOption");
            const known = (option.since || 1) <= dongleSettings.version && dongleSettings.version <= (option.until || 99);
            if (row) {
                row.classList.toggle("hidden", !known);
            }
            if (option.choices) {
                input.value = String(dongleSettings.values[option.key]);
            } else {
                input.checked = dongleSettings.values[option.key] !== 0;
            }
            // Off, with a note, where this hardware can't use it (capabilities.js).
            Capabilities.markRow(row, capabilities.supports(option.capability));
        }
        const range = document.getElementById("led-brightness");
        const value = document.getElementById("led-brightness-value");
        if (range && value) {
            range.value = String(dongleSettings.values.statusLedBrightness);
            value.textContent = range.value;
            const row = range.closest(".dongleOption");
            row.classList.toggle("hidden", dongleSettings.version < 6);
            Capabilities.markRow(row, capabilities.supports(Capabilities.STATUS_LED_PICO_EXT) ||
                capabilities.supports(Capabilities.STATUS_LED_ESP32_EXT));
        }
    },

    // The RGB LEDs' brightness (Adapter Options version 6, byte 22): saved with the others.
    brightnessRow(dongleSettings) {
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
        });
        row.appendChild(label);
        row.appendChild(range);
        row.appendChild(value);
        return row;
    },

    // Show or hide the whole section (adapter support).
    setAvailable(available) {
        for (const id of ["dongleOptionsControl", "dongleOptionsPanel"]) {
            const element = document.getElementById(id);
            if (element) {
                element.classList.toggle("hidden", !available);
            }
        }
    },

    /*  The checkbox under the Device Mode dropdown: whether the button combo may switch to the
     *  selected mode. Saved right away (saveFunc(bytes)); D-Input/Debug, the way back to the web
     *  app, can't be turned off (the box stays checked and locked). */
    /*  Live settings (mode combos, Bluetooth search times): the adapter applies them without a
     *  restart, so they are saved by themselves, once the changes stop for a moment. */
    liveSave: null,
    liveTimer: null,
    liveDone: [],

    setLiveSave(dongleSettings, saveFunc) {
        this.liveSave = async () => {
            const bytes = dongleSettings.liveBytes();  // null before the adapter's record is read
            if (!bytes) {
                return;
            }
            await saveFunc(bytes);
            dongleSettings.storedBytes = bytes;
        };
    },

    scheduleLiveSave(onSaved) {
        if (!this.liveSave) {
            return;
        }
        if (onSaved) {
            this.liveDone.push(onSaved);
        }
        clearTimeout(this.liveTimer);
        this.liveTimer = setTimeout(async () => {
            const done = this.liveDone;
            this.liveDone = [];
            await this.liveSave();
            for (const fn of done) {
                fn();
            }
        }, 700);
    },

    initModeCombo(dongleSettings, saveFunc) {
        this.setLiveSave(dongleSettings, saveFunc);
        const row = document.getElementById("modeComboRow");
        const box = document.getElementById("checkbox-modeCombo");
        const label = document.getElementById("label-modeCombo");
        const dropdown = document.getElementById("dropdown-deviceMode");
        if (!row || !box || !dropdown) {
            return;
        }
        const DEBUG = 6;
        const hint = document.getElementById("modeComboHint");
        const show = () => {
            // Only once the adapter answered with a record that has the combo list.
            row.classList.toggle("hidden", !dongleSettings.storedBytes || dongleSettings.version < 2);
            const mode = Number(dropdown.value);
            box.checked = dongleSettings.comboEnabled(mode);
            box.disabled = mode === DEBUG;

            label.textContent = "Mode Enabled";
            const combo = DongleSettings.MODE_COMBOS[mode];
            if (hint) {
                hint.textContent = combo
                    ? `${combo} (hold 3 s)${mode === DEBUG ? ", always on: the way back to the web app" : ""}`
                    : "No combo for this mode";
            }
        };
        ModeView.addListener(show);  // dropdown changed by the user or by a profile read
        box.addEventListener("change", () => {
            dongleSettings.setComboEnabled(Number(dropdown.value), box.checked);
            const base = hint ? hint.textContent.replace(/ - (saving\.\.\.|saved .*)$/, "") : "";
            if (hint) {
                hint.textContent = `${base} - saving...`;
            }
            this.scheduleLiveSave(() => {
                if (hint) {
                    hint.textContent = `${base} - saved (${new Date().toLocaleTimeString()})`;
                }
            });
        });
        this.refreshModeCombo = show;
        show();
    },

    refreshModeCombo: null,

    addCallbackSave(listenerFunc) {
        const button = document.getElementById("button-saveDongleOptions");
        if (button) {
            button.addEventListener("click", () => listenerFunc());
        }
    },
};
