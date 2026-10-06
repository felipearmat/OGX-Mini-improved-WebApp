/*  "Rumble Test" panel (OGX-Mini-improved firmware, USB only). Plays a rumble on the connected
 *  controller through the same path as a game's rumble: left (strong) motor, right (weak) motor
 *  or both, at the chosen strength for the chosen time. Hidden until the adapter answers with
 *  its dongle settings (older firmware has neither); shown only for modes with rumble (ModeView). */
export const UIRumble = {
    built: false,

    init(sendFunc) {
        const panel = document.getElementById("rumbleTestPanel");
        if (!panel || this.built) {
            return;
        }
        const strength = document.getElementById("rumble-strength");
        const duration = document.getElementById("rumble-duration");
        const strengthValue = document.getElementById("rumble-strength-value");
        const durationValue = document.getElementById("rumble-duration-value");
        const showValues = () => {
            strengthValue.textContent = `${strength.value} %`;
            durationValue.textContent = `${(Number(duration.value) / 1000).toFixed(1)} s`;
        };
        strength.addEventListener("input", showValues);
        duration.addEventListener("input", showValues);
        showValues();

        const play = async (left, right) => {
            const level = Math.round(Number(strength.value) * 255 / 100);
            const ms = Number(duration.value);
            this.setStatus("Sending...");
            await sendFunc(left ? level : 0, right ? level : 0, (left || right) ? ms : 0);
        };
        document.getElementById("button-rumbleLeft").addEventListener("click", () => play(true, false));
        document.getElementById("button-rumbleRight").addEventListener("click", () => play(false, true));
        document.getElementById("button-rumbleBoth").addEventListener("click", () => play(true, true));
        document.getElementById("button-rumbleStop").addEventListener("click", () => play(false, false));

        const toggle = document.getElementById("button-toggleRumbleTest");
        if (toggle) {
            toggle.addEventListener("click", () => {
                const hidden = panel.classList.toggle("hidden");
                toggle.textContent = hidden ? "Show" : "Hide";
            });
        }
        this.built = true;
    },

    // Show or hide the whole section (adapter support, USB connection).
    setAvailable(available) {
        for (const id of ["rumbleTestControl", "rumbleTestPanel"]) {
            const element = document.getElementById(id);
            if (element) {
                element.classList.toggle("hidden", !available);
            }
        }
    },

    setStatus(text) {
        const status = document.getElementById("rumbleTestStatus");
        if (status) {
            status.textContent = text;
        }
    },
};
