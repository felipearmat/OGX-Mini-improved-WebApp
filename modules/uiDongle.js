import { DongleSettings } from "./dongleSettings.js";

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

    addCallbackSave(listenerFunc) {
        const button = document.getElementById("button-saveDongleOptions");
        if (button) {
            button.addEventListener("click", () => listenerFunc());
        }
    },
};
