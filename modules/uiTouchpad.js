/*  "Touchpad" panel (OGX-Mini-improved firmware, USB): where the fingers are on a DS4 /
 *  DualSense touchpad (a green ball per touch) and whether the touchpad is pressed. Fed by the
 *  GP_TOUCH packet (0x82): two touch points as the pads send them, 4 bytes each (bit 7 of the
 *  first byte set = not touching; X 12 bits, Y 12 bits), then the click byte. The touchpad press
 *  is the Misc button: its mapping row ("Touchpad press") is part of the panel. */
export const UITouchpad = {
    // Touchpad coordinates: X 0-1919 on both pads, Y 0-942 (DS4) / 0-1079 (DualSense).
    MAX_X: 1920,
    MAX_Y: 1080,

    draw(bytes) {
        const canvas = document.getElementById("canvasTouchpad");
        if (!canvas || bytes.length < 9) {
            return;
        }
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#888";
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

        let touches = 0;
        for (let i = 0; i < 2; i++) {
            const p = bytes.subarray(i * 4, i * 4 + 4);
            if (p[0] & 0x80) {
                continue;  // not touching
            }
            const x = p[1] | ((p[2] & 0x0F) << 8);
            const y = (p[2] >> 4) | (p[3] << 4);
            ctx.beginPath();
            ctx.arc(x * canvas.width / this.MAX_X, y * canvas.height / this.MAX_Y, 10, 0, 2 * Math.PI);
            ctx.fillStyle = "#2eaa2e";
            ctx.fill();
            touches++;
        }

        // The press is the Misc button: its mapping row lights up with the live input.
        const status = document.getElementById("touchpadStatus");
        if (status) {
            status.textContent = touches ? `${touches} finger${touches > 1 ? "s" : ""}` : "No finger on the touchpad";
        }
    },

    initToggle() {
        const toggle = document.getElementById("button-toggleTouchpad");
        const panel = document.getElementById("touchpadPanel");
        if (toggle && panel && !this.built) {
            toggle.addEventListener("click", () => {
                const hidden = panel.classList.toggle("hidden");
                toggle.textContent = hidden ? "Show" : "Hide";
            });
            this.built = true;
        }
    },

    built: false,
};
