import { DongleSettings } from "./dongleSettings.js";
import { UIDongle } from "./uiDongle.js";
import { Capabilities, capabilities } from "./capabilities.js";

/*  "Bluetooth config" panel (OGX-Mini-improved firmware, Adapter Options version 3): how long the
 *  adapter keeps searching for new controllers while a slot is open with a controller connected
 *  (a lone Joy-Con waiting for its other half, or free slots) — first at full speed, then at
 *  about 10%. The adapter applies these without a restart, so they are saved by themselves a
 *  moment after the last change (like Mode Enabled). Hidden until the adapter answers with a
 *  version 3 record. Version 4 adds the idle turn-off time of the controllers (minutes without
 *  input, 0 = never), saved the same way, and version 5 the live adapter options (transmit power). */
export const UISearch = {
    built: false,
    saved: false,  // a live save happened since the page connected

    init(dongleSettings) {
        if (this.built) {
            return;
        }
        const container = document.getElementById("searchInput");
        if (!container) {
            return;
        }
        const max = DongleSettings.SEARCH_MAX_S;

        const fullRow = this._numberRow("search-full", "Full search (seconds)",
            DongleSettings.SEARCH_MAX_S, "0-600 s. Full speed can add input lag to the connected controllers.");
        Capabilities.addTip(fullRow.querySelector("label"), "Search: with a controller connected and a slot still " +
            "open (a lone Joy-Con, free slots), the adapter keeps looking for new controllers, at full speed and " +
            "then at about 10% (LED: fast blink, slow blink, on = stopped).");
        const full = fullRow.querySelector("input");
        const reducedRow = this._numberRow("search-reduced", "Reduced search (seconds)",
            DongleSettings.SEARCH_MAX_S, "About 10% of the radio time, after the full search. Both 0 = no search " +
            "once a controller is connected. Start + L3 (3 s) stops the search; a controller going away restarts it. " +
            "With none connected the adapter always searches at full speed, and known controllers always reconnect.");
        const reduced = reducedRow.querySelector("input");
        // "No limit" right next to the label, before the number.
        const noLimitWrap = document.createElement("span");
        noLimitWrap.className = "searchNoLimit";
        const noLimit = document.createElement("input");
        noLimit.type = "checkbox";
        noLimit.id = "search-reduced-noLimit";
        const noLimitLabel = document.createElement("label");
        noLimitLabel.htmlFor = noLimit.id;
        noLimitLabel.textContent = "No limit";
        noLimitWrap.appendChild(noLimit);
        noLimitWrap.appendChild(noLimitLabel);
        const labelCell = document.createElement("span");  // first grid column: label + No limit
        labelCell.appendChild(reducedRow.querySelector("label"));
        labelCell.appendChild(noLimitWrap);
        reducedRow.insertBefore(labelCell, reduced);
        container.appendChild(fullRow);
        container.appendChild(reducedRow);
        const idleRow = this._numberRow("idle-off", "Turn controllers off after (minutes)",
            DongleSettings.IDLE_MAX_MIN, "Minutes without input (buttons, sticks, or being picked up or turned); " +
            "0 = never. A Joy-Con pair counts as one controller.");
        Capabilities.addTip(idleRow.querySelector("label"),
            "Idle: a Bluetooth controller left without input is turned off to save its battery.");
        idleRow.id = "idleOffRow";
        const idle = idleRow.querySelector("input");
        container.appendChild(idleRow);
        // Live adapter options (dongleSettings.js, panel "bluetooth"): a checkbox each.
        const liveOptions = DongleSettings.OPTIONS.filter((o) => o.panel === "bluetooth");
        for (const option of liveOptions) {
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
            if (option.help) {
                const help = document.createElement("div");
                help.className = "dongleOptionHelp";
                help.textContent = option.help;
                row.appendChild(help);
            }
            container.appendChild(row);
        }

        const clamp = (input, limit = max) => {
            const v = Math.min(limit, Math.max(0, Math.round(Number(input.value) || 0)));
            input.value = String(v);
            return v;
        };
        const changed = () => {
            dongleSettings.values.idleOffMinutes = clamp(idle, DongleSettings.IDLE_MAX_MIN);
            dongleSettings.values.fullSearchSeconds = clamp(full);
            reduced.disabled = noLimit.checked;
            dongleSettings.values.reducedSearchSeconds = noLimit.checked
                ? DongleSettings.SEARCH_NO_LIMIT : clamp(reduced);
            this.setStatus("Saving...");
            UIDongle.scheduleLiveSave(() => {
                const t = new Date();
                const hms = [t.getHours(), t.getMinutes(), t.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":");
                this.saved = true;
                this.setStatus(`Latest Save ${hms}`);
            });
        };
        full.addEventListener("input", changed);
        reduced.addEventListener("input", changed);
        idle.addEventListener("input", changed);
        noLimit.addEventListener("change", changed);

        capabilities.addListener(() => this.update(dongleSettings));  // the adapter answered

        const toggle = document.getElementById("button-toggleSearch");
        const panel = document.getElementById("searchPanel");
        if (toggle && panel) {
            toggle.addEventListener("click", () => {
                const hidden = panel.classList.toggle("hidden");
                toggle.textContent = hidden ? "Show" : "Hide";
            });
        }
        this.built = true;
    },

    // Values from the adapter; shown only for firmware with the search times (version 3).
    update(dongleSettings) {
        const available = !!dongleSettings.storedBytes && dongleSettings.version >= 3;
        for (const id of ["searchControl", "searchPanel"]) {
            const element = document.getElementById(id);
            if (element) {
                element.classList.toggle("hidden", !available);
            }
        }
        if (!available) {
            return;
        }
        if (!this.saved) {
            this.setStatus("Current Config");  // as read from the adapter
        }
        const full = document.getElementById("search-full");
        const reduced = document.getElementById("search-reduced");
        const noLimit = document.getElementById("search-reduced-noLimit");
        const unlimited = dongleSettings.values.reducedSearchSeconds === DongleSettings.SEARCH_NO_LIMIT;
        if (full) {
            full.value = String(dongleSettings.values.fullSearchSeconds);
        }
        if (noLimit) {
            noLimit.checked = unlimited;
        }
        // Off, with a note, where this hardware can't use them (capabilities.js).
        const search = capabilities.supports(Capabilities.SEARCH_TIMES);
        for (const input of [full, reduced]) {
            Capabilities.markRow(input && input.closest(".dongleOption"), search);
        }
        if (reduced) {
            reduced.disabled = unlimited || !search;
            reduced.value = String(unlimited ? DongleSettings.SEARCH_MAX_S : dongleSettings.values.reducedSearchSeconds);
        }
        const idleRow = document.getElementById("idleOffRow");
        const idle = document.getElementById("idle-off");
        if (idleRow && idle) {
            idleRow.classList.toggle("hidden", dongleSettings.version < 4);
            idle.value = String(dongleSettings.values.idleOffMinutes);
            Capabilities.markRow(idleRow, capabilities.supports(Capabilities.IDLE_OFF));
        }
        for (const option of DongleSettings.OPTIONS.filter((o) => o.panel === "bluetooth")) {
            const box = document.getElementById(`dongle-${option.key}`);
            const row = box && box.closest(".dongleOption");
            if (!row) {
                continue;
            }
            row.classList.toggle("hidden", (option.since || 1) > dongleSettings.version);
            box.checked = dongleSettings.values[option.key] !== 0;
            Capabilities.markRow(row, capabilities.supports(option.capability));
        }
    },

    setStatus(text) {
        const status = document.getElementById("searchStatus");
        if (status) {
            status.textContent = text;
        }
    },

    _numberRow(id, text, maxValue = DongleSettings.SEARCH_MAX_S, helpText = null) {
        const row = document.createElement("div");
        row.className = "dongleOption";
        const label = document.createElement("label");
        label.htmlFor = id;
        label.textContent = text;
        const input = document.createElement("input");
        input.type = "number";
        input.id = id;
        input.min = "0";
        input.max = String(maxValue);
        input.step = "1";
        input.className = "dongleNumber";
        row.appendChild(label);
        row.appendChild(input);
        if (helpText) {
            const help = document.createElement("div");
            help.className = "dongleOptionHelp";
            help.textContent = helpText;
            row.appendChild(help);
        }
        return row;
    },
};
