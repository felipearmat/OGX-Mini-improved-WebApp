/*  Which settings sections the selected device mode shows (OGX-Mini-improved).
 *
 *  Mouse + Keyboard mode: its mapping takes the place of the gamepad profile (axis, digital and
 *  analog mappings are hidden; Save / Reload Profile and Load Defaults act on the mapping).
 *  Rumble Test: only for modes that pass a host's rumble to the controller.
 *
 *  Uses its own "modeHidden" class, so the sections' Show / Hide buttons keep working. */
export const ModeView = {
    KBM_MODE: 17,
    WEBAPP_MODE: 100,
    // Output modes whose host rumble reaches the controller (firmware device drivers that fill
    // PadOut rumble): Xbox OG, Steel Battalion, XInput, PS3, Switch, PS4, STEAM; and Web App
    // mode itself, where the test runs.
    RUMBLE_MODES: new Set([1, 2, 4, 5, 8, 15, 16, 100]),

    GAMEPAD_SECTIONS: [
        "axisSettingsControl", "axisSettingsPanel",
        "digitalButtonsControl", "digitalButtonsPanel",
        "analogButtonsControl", "analogButtonsPanel",
    ],
    KBM_SECTIONS: ["kbmOptionsControl", "kbmOptionsPanel"],
    KBM_OWN_BUTTONS: ["button-saveKbmOptions", "button-restoreKbmOptions"],
    RUMBLE_SECTIONS: ["rumbleTestControl", "rumbleTestPanel"],

    mode: 100,
    kbmAvailable: false,

    setMode(mode) {
        this.mode = Number(mode);
        this.apply();
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

        const profile = document.getElementById("dropdown-profileId");
        if (profile) {
            profile.disabled = kbm;  // one mapping, stored on the adapter
            profile.title = kbm ? "Mouse + Keyboard mode has one mapping, stored on the adapter." : "";
        }
    },
};
