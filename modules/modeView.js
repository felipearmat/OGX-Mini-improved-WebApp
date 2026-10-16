/*  Which settings sections the selected device mode shows (OGX-Mini-improved).
 *
 *  Mouse + Keyboard mode: its mapping takes the place of the gamepad profile (axis, digital and
 *  analog mappings are hidden; Save / Reload Profile and Load Defaults act on the mapping).
 *  Rumble Test: only for modes that pass a host's rumble to the controller.
 *
 *  Uses its own "modeHidden" class, so the sections' Show / Hide buttons keep working. */
export const ModeView = {
    KBM_MODE: 17,
    DEBUG_MODE: 6,  // D-Input/Debug: the mode the web app connects in
    // Output modes whose host rumble reaches the controller (firmware device drivers that fill
    // PadOut rumble): Xbox OG, Steel Battalion, XInput, PS3, Switch, PS4, STEAM; and D-Input/Debug
    // itself, where the test runs.
    RUMBLE_MODES: new Set([1, 2, 4, 5, 6, 8, 15, 16]),

    GAMEPAD_SECTIONS: [
        "axisSettingsControl", "axisSettingsPanel",
        "digitalButtonsControl", "digitalButtonsPanel",
        "analogButtonsControl", "analogButtonsPanel",
    ],
    KBM_SECTIONS: ["kbmOptionsControl", "kbmOptionsPanel"],
    KBM_OWN_BUTTONS: ["button-saveKbmOptions", "button-restoreKbmOptions"],
    RUMBLE_SECTIONS: ["rumbleTestControl", "rumbleTestPanel"],
    // Modes that use a DS4 / DualSense touchpad: PS4, STEAM, Mouse + Keyboard (pointer), and
    // D-Input/Debug (generic: shows what the adapter reads).
    TOUCHPAD_MODES: new Set([6, 15, 16, 17]),
    TOUCHPAD_SECTIONS: ["touchpadControl", "touchpadPanel"],

    mode: 6,
    kbmAvailable: false,
    listeners: [],

    // Called after every mode change (and every apply()).
    addListener(fn) {
        this.listeners.push(fn);
    },

    setMode(mode) {
        this.mode = Number(mode);
        this.apply();
    },

    // Older firmware (no dongle settings answer): warn at the top of the settings.
    setFirmwareWarning(show) {
        const warning = document.getElementById("firmwareWarning");
        if (warning) {
            warning.classList.toggle("hidden", !show);
        }
    },

    setKbmAvailable(available) {
        this.kbmAvailable = available;
        this.apply();
    },

    // The mapping replaces the profile only when the adapter has Mouse + Keyboard mode.
    isKbm() {
        return this.kbmAvailable && this.mode === this.KBM_MODE;
    },

    hasRumble() {
        return this.RUMBLE_MODES.has(this.mode);
    },

    apply() {
        const kbm = this.isKbm();
        const set = (ids, hidden) => {
            for (const id of ids) {
                const element = document.getElementById(id);
                if (element) {
                    element.classList.toggle("modeHidden", hidden);
                }
            }
        };
        set(this.GAMEPAD_SECTIONS, kbm);
        set(this.KBM_SECTIONS, !kbm);
        set(this.KBM_OWN_BUTTONS, kbm);  // the profile buttons save / restore the mapping
        set(this.RUMBLE_SECTIONS, !this.hasRumble());
        set(this.TOUCHPAD_SECTIONS, !this.TOUCHPAD_MODES.has(this.mode));

        const profile = document.getElementById("dropdown-profileId");
        if (profile) {
            profile.disabled = kbm;  // one mapping, stored on the adapter
            profile.title = kbm ? "Mouse + Keyboard mode has one mapping, stored on the adapter." : "";
        }
        for (const fn of this.listeners) {
            fn(this.mode);
        }
    },
};
