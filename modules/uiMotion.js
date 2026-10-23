/*  "Motion" panel (OGX-Mini-improved firmware, USB, prototype): a box that turns with the
 *  controller, as Yuzu-based emulators show it. Fed by the diagnostics report's "motion" block
 *  (the newest sample, in the DS4 report frame: X right, Y out of the face, Z toward the player;
 *  accel in mg, gyro in deg/s x10), asked for again as soon as the last answer arrives, so it
 *  updates only a few times a second: the firmware's live motion stream (ROADMAP item 0) will
 *  replace the polling. The orientation integrates the gyro and leans toward gravity (Mahony
 *  filter); "Recentre" starts again from the tilt gravity gives, facing forward. */
export const UIMotion = {
    request: null,
    running: false,
    q: [1, 0, 0, 0],          // orientation (w, x, y, z), controller frame -> screen frame
    lastMs: 0,
    samples: 0,
    rateStartMs: 0,
    lastSampleCount: -1,
    KP: 1.0,                   // gravity correction gain (1/s)

    init(requestFunc) {
        this.request = requestFunc;
        document.getElementById("button-motionStart").addEventListener("click", () => this.toggle());
        document.getElementById("button-motionRecentre").addEventListener("click", () => {
            this.recentreNext = true;
        });
        // Shown with the touchpad ("Touchpad and Motion"): hiding the panel stops asking.
        document.getElementById("button-toggleTouchpad").addEventListener("click", () => {
            const panel = document.getElementById("touchpadPanel");
            if (panel.classList.contains("hidden") && this.running) {
                this.toggle();
            }
        });
        this.render();
    },

    setStatus(text) {
        document.getElementById("motionStatus").textContent = text;
    },

    async toggle() {
        const button = document.getElementById("button-motionStart");
        if (this.running) {
            this.running = false;
            button.textContent = "Start";
            return;
        }
        this.running = true;
        button.textContent = "Stop";
        this.recentreNext = true;
        this.lastMs = 0;
        this.samples = 0;
        this.rateStartMs = performance.now();
        while (this.running) {
            const report = await this.request();
            if (!this.running) {
                break;
            }
            if (!report) {
                this.setStatus("No answer from the adapter.");
                await new Promise((r) => setTimeout(r, 500));
                continue;
            }
            const m = report.motion;
            if (!m || !m.accel_mg || !m.gyro_dps_x10) {
                this.setStatus("No motion yet: connect a controller with motion (DS4, DualSense, Joy-Con, Switch Pro...).");
                await new Promise((r) => setTimeout(r, 300));
                continue;
            }
            this.update(m);
        }
        this.setStatus("Stopped.");
    },

    update(m) {
        const now = performance.now();
        const accel = m.accel_mg.map((v) => v / 1000);           // g
        const gyro = m.gyro_dps_x10.map((v) => v / 10);          // deg/s
        const fresh = m.samples !== this.lastSampleCount;
        this.lastSampleCount = m.samples;
        if (this.recentreNext) {
            this.q = this.tiltFromGravity(accel);
            this.recentreNext = false;
        } else if (this.lastMs && fresh) {
            const dt = Math.min((now - this.lastMs) / 1000, 0.5);
            this.integrate(gyro, accel, dt);
        }
        this.lastMs = now;
        this.samples++;
        const secs = (now - this.rateStartMs) / 1000;
        const rate = secs > 0 ? this.samples / secs : 0;
        const fmt = (a, d) => a.map((v) => v.toFixed(d).padStart(7)).join(" ");
        document.getElementById("motionAccel").textContent = `accel g   X Y Z ${fmt(accel, 2)}`;
        document.getElementById("motionGyro").textContent = `gyro deg/s X Y Z ${fmt(gyro, 1)}`;
        this.setStatus(`${rate.toFixed(1)} updates/s from the diagnostics report (prototype: the live stream will be ~100/s).`);
        this.render();
    },

    // Rotation that takes the controller's measured "up" (gravity reaction) to the screen's up
    // (Y), with no turn about the vertical.
    tiltFromGravity(a) {
        const n = Math.hypot(a[0], a[1], a[2]) || 1;
        const v = [a[0] / n, a[1] / n, a[2] / n];       // up, in the controller frame
        const up = [0, 1, 0];
        const c = [v[1] * up[2] - v[2] * up[1], v[2] * up[0] - v[0] * up[2], v[0] * up[1] - v[1] * up[0]];
        const d = v[0] * up[0] + v[1] * up[1] + v[2] * up[2];
        const q = [1 + d, c[0], c[1], c[2]];
        const qn = Math.hypot(...q);
        return qn < 1e-6 ? [0, 0, 0, 1] : q.map((x) => x / qn);
    },

    integrate(gyroDps, accelG, dt) {
        let [w, x, y, z] = this.q;
        let g = gyroDps.map((v) => (v * Math.PI) / 180);
        const an = Math.hypot(...accelG);
        if (an > 0.5 && an < 1.5) {
            // Mahony: where the orientation says "up" is, in the controller frame, against the
            // measured up; turn a little toward the measurement.
            const a = accelG.map((v) => v / an);
            const vx = 2 * (x * y + w * z), vy = w * w - x * x + y * y - z * z, vz = 2 * (y * z - w * x);
            const e = [a[1] * vz - a[2] * vy, a[2] * vx - a[0] * vz, a[0] * vy - a[1] * vx];
            g = g.map((v, i) => v + this.KP * e[i]);
        }
        const h = 0.5 * dt;
        const nw = w - h * (x * g[0] + y * g[1] + z * g[2]);
        const nx = x + h * (w * g[0] + y * g[2] - z * g[1]);
        const ny = y + h * (w * g[1] - x * g[2] + z * g[0]);
        const nz = z + h * (w * g[2] + x * g[1] - y * g[0]);
        const n = Math.hypot(nw, nx, ny, nz) || 1;
        this.q = [nw / n, nx / n, ny / n, nz / n];
    },

    // CSS: screen X right, Y down, Z toward the viewer; the controller frame has Y up.
    render() {
        const box = document.getElementById("motionBox");
        if (!box) {
            return;
        }
        const [w, x, y, z] = this.q;
        const r = [
            [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
            [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
            [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)],
        ];
        const f = [1, -1, 1];  // flip Y for the screen: S R S
        const m = (i, j) => f[i] * r[i][j] * f[j];
        // matrix3d is column-major.
        box.style.transform = `matrix3d(${m(0, 0)},${m(1, 0)},${m(2, 0)},0,${m(0, 1)},${m(1, 1)},${m(2, 1)},0,` +
            `${m(0, 2)},${m(1, 2)},${m(2, 2)},0,0,0,0,1)`;
    },
};
