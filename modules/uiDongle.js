import { DongleSettings } from "./dongleSettings.js";
import { ModeView } from "./modeView.js";

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

        for (const option of DongleSettings.OPTIONS) {
            const row = document.createElement("div");
            row.className = "dongleOption";

            const id = `dongle-${option.key}`;
            const label = document.createElement("label");
            label.htmlFor = id;
            label.textContent = option.label;
            if (option.help) {
                label.title = option.help;
            }

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

        const toggle = document.getElementById("button-toggleDongleOptions");
        const panel = document.getElementById("dongleOptionsPanel");
        if (toggle && panel && !this.built) {
            toggle.addEventListener("click", () => {
                const hidden = panel.classList.toggle("hidden");
                toggle.textContent = hidden ? "Show" : "Hide";
            });
        }
        this.built = true;
    },

    update(dongleSettings) {
        for (const option of DongleSettings.OPTIONS) {
            const input = document.getElementById(`dongle-${option.key}`);
            if (!input) {
                continue;
            }
            // Hide options the connected firmware does not have yet.
            const row = input.closest(".dongleOption");
            const known = (option.since || 1) <= dongleSettings.version;
            if (row) {
                row.classList.toggle("hidden", !known);
            }
            if (option.choices) {
                input.value = String(dongleSettings.values[option.key]);
            } else {
                input.checked = dongleSettings.values[option.key] !== 0;
            }
        }
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
     *  selected mode. Saved right away (saveFunc(bytes)); Web App mode always keeps its combo. */
    initModeCombo(dongleSettings, saveFunc) {
        const row = document.getElementById("modeComboRow");
        const box = document.getElementById("checkbox-modeCombo");
        const label = document.getElementById("label-modeCombo");
        const dropdown = document.getElementById("dropdown-deviceMode");
        if (!row || !box || !dropdown) {
            return;
        }
        const WEBAPP = 100;
        const hint = document.getElementById("modeComboHint");
        const show = () => {
            // Only once the adapter answered with a record that has the combo list.
            row.classList.toggle("hidden", !dongleSettings.storedBytes || dongleSettings.version < 2);
            const mode = Number(dropdown.value);
            box.checked = dongleSettings.comboEnabled(mode);
            box.disabled = mode === WEBAPP;
            label.textContent = "Mode Enabled";
            const combo = DongleSettings.MODE_COMBOS[mode];
            if (hint) {
                hint.textContent = combo
                    ? `${combo} (hold 3 s)${mode === WEBAPP ? ", always on: the way back to the web app" : ""}`
                    : "No combo for this mode";
            }
        };
        ModeView.addListener(show);  // dropdown changed by the user or by a profile read
        box.addEventListener("change", async () => {
            dongleSettings.setComboEnabled(Number(dropdown.value), box.checked);
            await saveFunc(dongleSettings.comboBytes());
            dongleSettings.storedBytes = dongleSettings.comboBytes();
            if (hint) {
                hint.textContent += ` - saved (${new Date().toLocaleTimeString()})`;
            }
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
