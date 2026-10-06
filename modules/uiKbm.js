import { KbmSettings } from "./kbmSettings.js";
import { ModeView } from "./modeView.js";

/*  "Mouse + Keyboard Mode" panel (OGX-Mini-improved firmware). Hidden until the adapter answers
 *  with its mapping; older firmware never does. */
export const UIKbm = {
    built: false,

    init(kbmSettings) {
        const container = document.getElementById("kbmOptionsInput");
        if (!container) {
            return;
        }
        container.innerHTML = "";

        const table = document.createElement("div");
        table.className = "kbmMapping";
        KbmSettings.INPUTS.forEach((name, i) => table.appendChild(this._actionRow(kbmSettings, name, i)));
        container.appendChild(table);

        container.appendChild(this._selectRow("kbm-leftStick", "Left stick", KbmSettings.STICK_MODES,
            (v) => { kbmSettings.leftStick = v; }));
        container.appendChild(this._selectRow("kbm-rightStick", "Right stick", KbmSettings.STICK_MODES,
            (v) => { kbmSettings.rightStick = v; }));
        container.appendChild(this._rangeRow("kbm-pointerSpeed", "Pointer speed", 1, 20,
            (v) => { kbmSettings.pointerSpeed = v; }));
        container.appendChild(this._rangeRow("kbm-scrollSpeed", "Scroll speed", 1, 20,
            (v) => { kbmSettings.scrollSpeed = v; }));
        container.appendChild(this._rangeRow("kbm-deadzone", "Stick deadzone (%)", 0, 50,
            (v) => { kbmSettings.deadzone = v; }));
        container.appendChild(this._flagRow(kbmSettings, "kbm-flagAccel", "Pointer acceleration",
            KbmSettings.FLAG.POINTER_ACCEL, "Slow near the centre, fast at the edge of the stick."));
        container.appendChild(this._flagRow(kbmSettings, "kbm-flagTouchpad", "Touchpad moves the pointer",
            KbmSettings.FLAG.TOUCHPAD, "DS4 / DualSense: the touchpad works like a laptop touchpad; pressing it is a left click."));
        container.appendChild(this._flagRow(kbmSettings, "kbm-flagInvertScroll", "Invert scroll",
            KbmSettings.FLAG.INVERT_SCROLL));

        const toggle = document.getElementById("button-toggleKbmOptions");
        const panel = document.getElementById("kbmOptionsPanel");
        if (toggle && panel && !this.built) {
            toggle.addEventListener("click", () => {
                const hidden = panel.classList.toggle("hidden");
                toggle.textContent = hidden ? "Show" : "Hide";
            });
        }
        const restore = document.getElementById("button-restoreKbmOptions");
        if (restore && !this.built) {
            restore.addEventListener("click", () => {
                kbmSettings.restoreDefaults();
                this.update(kbmSettings);
            });
        }
        this.built = true;
    },

    update(kbmSettings) {
        kbmSettings.actions.forEach((a, i) => {
            const select = document.getElementById(`kbm-action-${i}`);
            if (select) {
                const value = `${a.type}:${a.code}`;
                select.value = [...select.options].some((o) => o.value === value) ? value : "0:0";
            }
            for (const [mod, bit] of Object.entries(KbmSettings.MOD)) {
                const box = document.getElementById(`kbm-mod-${i}-${mod}`);
                if (box) {
                    box.checked = (a.mods & bit) !== 0;
                    box.disabled = a.type !== KbmSettings.TYPE.KEY;
                }
            }
        });
        const set = (id, v) => {
            const el = document.getElementById(id);
            if (el) {
                el.value = String(v);
                el.dispatchEvent(new Event("input"));
            }
        };
        set("kbm-leftStick", kbmSettings.leftStick);
        set("kbm-rightStick", kbmSettings.rightStick);
        set("kbm-pointerSpeed", kbmSettings.pointerSpeed);
        set("kbm-scrollSpeed", kbmSettings.scrollSpeed);
        set("kbm-deadzone", kbmSettings.deadzone);
        const flags = {
            "kbm-flagAccel": KbmSettings.FLAG.POINTER_ACCEL,
            "kbm-flagTouchpad": KbmSettings.FLAG.TOUCHPAD,
            "kbm-flagInvertScroll": KbmSettings.FLAG.INVERT_SCROLL,
        };
        for (const [id, bit] of Object.entries(flags)) {
            const box = document.getElementById(id);
            if (box) {
                box.checked = (kbmSettings.flags & bit) !== 0;
            }
        }
    },

    // Show or hide the whole section (adapter support); shown only in Mouse + Keyboard mode
    // (ModeView).
    setAvailable(available) {
        for (const id of ["kbmOptionsControl", "kbmOptionsPanel"]) {
            const element = document.getElementById(id);
            if (element) {
                element.classList.toggle("hidden", !available);
            }
        }
        ModeView.setKbmAvailable(available);
    },

    setStatus(text) {
        const status = document.getElementById("kbmOptionsStatus");
        if (status) {
            status.textContent = text;
        }
    },

    addCallbackSave(listenerFunc) {
        const button = document.getElementById("button-saveKbmOptions");
        if (button) {
            button.addEventListener("click", () => listenerFunc());
        }
    },

    _actionRow(kbmSettings, name, i) {
        const row = document.createElement("div");
        row.className = "kbmAction";

        const label = document.createElement("label");
        label.htmlFor = `kbm-action-${i}`;
        label.textContent = name;

        const select = document.createElement("select");
        select.id = `kbm-action-${i}`;
        const add = (parent, text, type, code) => {
            const option = document.createElement("option");
            option.value = `${type}:${code}`;
            option.textContent = text;
            parent.appendChild(option);
        };
        add(select, "Nothing", KbmSettings.TYPE.NONE, 0);
        const groups = [
            ["Keyboard", KbmSettings.KEYS.map(([text, usage]) => [text, KbmSettings.TYPE.KEY, usage])],
            ["Mouse", KbmSettings.MOUSE_BUTTONS.map((text, idx) => [text, KbmSettings.TYPE.MOUSE, idx])],
            ["Media", KbmSettings.MEDIA_KEYS.map((text, idx) => [text, KbmSettings.TYPE.MEDIA, idx])],
        ];
        for (const [groupLabel, items] of groups) {
            const group = document.createElement("optgroup");
            group.label = groupLabel;
            for (const [text, type, code] of items) {
                add(group, text, type, code);
            }
            select.appendChild(group);
        }

        const mods = document.createElement("span");
        mods.className = "kbmMods";
        for (const [mod, bit] of Object.entries(KbmSettings.MOD)) {
            const box = document.createElement("input");
            box.type = "checkbox";
            box.id = `kbm-mod-${i}-${mod}`;
            box.title = `Hold ${mod} with this key`;
            box.addEventListener("change", () => {
                const action = kbmSettings.actions[i];
                action.mods = box.checked ? (action.mods | bit) : (action.mods & ~bit);
            });
            const boxLabel = document.createElement("label");
            boxLabel.htmlFor = box.id;
            boxLabel.textContent = mod === "GUI" ? "Win" : mod[0] + mod.slice(1).toLowerCase();
            mods.appendChild(box);
            mods.appendChild(boxLabel);
        }

        select.addEventListener("change", () => {
            const [type, code] = select.value.split(":").map(Number);
            const action = kbmSettings.actions[i];
            action.type = type;
            action.code = code;
            if (type !== KbmSettings.TYPE.KEY) {
                action.mods = 0;
            }
            this.update(kbmSettings);
        });

        row.appendChild(label);
        row.appendChild(select);
        row.appendChild(mods);
        return row;
    },

    _selectRow(id, text, choices, onChange) {
        const row = document.createElement("div");
        row.className = "dongleOption";
        const label = document.createElement("label");
        label.htmlFor = id;
        label.textContent = text;
        const select = document.createElement("select");
        select.id = id;
        for (const choice of choices) {
            const option = document.createElement("option");
            option.value = String(choice.value);
            option.textContent = choice.label;
            select.appendChild(option);
        }
        select.addEventListener("change", () => onChange(Number(select.value)));
        row.appendChild(label);
        row.appendChild(select);
        return row;
    },

    _rangeRow(id, text, min, max, onChange) {
        const row = document.createElement("div");
        row.className = "dongleOption";
        const label = document.createElement("label");
        label.htmlFor = id;
        label.textContent = text;
        const input = document.createElement("input");
        input.type = "range";
        input.id = id;
        input.min = String(min);
        input.max = String(max);
        const value = document.createElement("span");
        value.className = "kbmRangeValue";
        input.addEventListener("input", () => {
            value.textContent = input.value;
            onChange(Number(input.value));
        });
        row.appendChild(label);
        row.appendChild(input);
        row.appendChild(value);
        return row;
    },

    _flagRow(kbmSettings, id, text, bit, help) {
        const row = document.createElement("div");
        row.className = "dongleOption";
        const label = document.createElement("label");
        label.htmlFor = id;
        label.textContent = text;
        if (help) {
            label.title = help;
        }
        const box = document.createElement("input");
        box.type = "checkbox";
        box.id = id;
        box.className = "invertCheckbox";
        box.addEventListener("change", () => {
            kbmSettings.flags = box.checked ? (kbmSettings.flags | bit) : (kbmSettings.flags & ~bit);
        });
        row.appendChild(label);
        row.appendChild(box);
        if (help) {
            const helpText = document.createElement("div");
            helpText.className = "dongleOptionHelp";
            helpText.textContent = help;
            row.appendChild(helpText);
        }
        return row;
    },
};
