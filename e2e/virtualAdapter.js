// The firmware's virtual adapter (OGX-Mini-improved: Firmware/RP2040/tests/virtual_adapter): the
// web app protocol and the settings storage of the real firmware, running as a process. Its USB
// serial port is stdin / stdout, its flash a file; fd 3 opens / closes the port (DTR), holds a mode
// combo, and tells the output mode at boot (the serial port exists in D-Input/Debug only).
//
// A restart of the firmware (exit 3) is a USB disconnect for the page; the process comes back on
// the same flash file, like the board re-enumerating. Exit 4 is the USB bootloader: it stays gone.
import { spawn } from "node:child_process";

const RESTART_DELAY_MS = 300;
export const DINPUT_DEBUG = 6;

export class VirtualAdapter {
    constructor(binary, flashFile) {
        this.binary = binary;
        this.flashFile = flashFile;
        this.child = null;
        this.mode = null;     // output mode of the running process
        this.led = null;      // the external status LED's colour, "rrggbb"
        this.portOpen = false;
        this.restarts = 0;
        this.bootloader = false;
        this.stderr = "";
        this.onData = null;   // (Buffer) => void: bytes the adapter sent
        this.onLost = null;   // () => void: the USB device went away (restart or bootloader)
        this._stopping = false;
    }

    start() {
        this._stopping = false;
        this._spawn();
        return this.ready();
    }

    _spawn() {
        const child = spawn(this.binary, [this.flashFile], { stdio: ["pipe", "pipe", "pipe", "pipe"] });
        this.child = child;
        child.stdout.on("data", (data) => {
            if (this.child === child && this.portOpen && this.onData) {
                this.onData(data);
            }
        });
        child.stderr.on("data", (data) => { this.stderr += data.toString(); });
        let control = "";
        child.stdio[3].on("data", (data) => {
            control += data.toString();
            let end;
            while ((end = control.indexOf("\n")) >= 0) {
                const line = control.slice(0, end);
                control = control.slice(end + 1);
                const match = /^MODE (\d+)$/.exec(line);
                if (match && this.child === child) {
                    this.mode = Number(match[1]);
                }
                const led = /^LED ([0-9a-f]{6})$/.exec(line);
                if (led && this.child === child) {
                    this.led = led[1];
                }
            }
        });
        for (const stream of [child.stdin, child.stdio[3]]) {
            stream.on("error", () => {});  // the process may exit while the page writes
        }
        child.once("error", (error) => { this.stderr += `${error}\n`; });
        child.once("exit", (code) => {
            if (this.child !== child) {
                return;
            }
            this.child = null;
            this.mode = null;
            if (this._stopping) {
                return;
            }
            const wasOpen = this.portOpen;
            this.portOpen = false;
            if (code === 3) {
                this.restarts++;
                setTimeout(() => { if (!this._stopping) this._spawn(); }, RESTART_DELAY_MS);
            } else if (code === 4) {
                this.bootloader = true;
            } else {
                this.stderr += `virtual adapter exited with ${code}\n`;
            }
            if (wasOpen && this.onLost) {
                this.onLost();
            }
        });
    }

    // Resolves once a process is running and has booted (after a restart, once it is back).
    async ready(timeoutMs = 5000) {
        const deadline = Date.now() + timeoutMs;
        while (!this.child || this.mode === null) {
            if (this.bootloader || this._stopping || Date.now() > deadline) {
                return false;
            }
            await new Promise((resolve) => setTimeout(resolve, 20));
        }
        return true;
    }

    // The page opened the port: true when there is an adapter to talk to (in D-Input/Debug).
    async open() {
        if (!(await this.ready()) || this.mode !== DINPUT_DEBUG) {
            return false;
        }
        this.portOpen = true;
        this.child.stdio[3].write("D1\n");
        return true;
    }

    close() {
        if (this.child && this.portOpen) {
            this.child.stdio[3].write("D0\n");
        }
        this.portOpen = false;
    }

    write(bytes) {
        if (this.child && this.portOpen) {
            this.child.stdin.write(Buffer.from(bytes));
        }
    }

    // The user holds the mode combo of the given output mode (the adapter restarts into it).
    holdCombo(mode) {
        if (this.child) {
            this.child.stdio[3].write(`M${mode}\n`);
        }
    }

    // Waits until the external status LED shows the colour ("rrggbb").
    async waitLed(rgb, timeoutMs = 5000) {
        const deadline = Date.now() + timeoutMs;
        while (this.led !== rgb) {
            if (Date.now() > deadline) {
                throw new Error(`the status LED shows ${this.led}, expected ${rgb}`);
            }
            await new Promise((resolve) => setTimeout(resolve, 20));
        }
    }

    // Waits for the n-th restart (counted from the start).
    async waitRestarts(n, timeoutMs = 10000) {
        const deadline = Date.now() + timeoutMs;
        while (this.restarts < n) {
            if (Date.now() > deadline) {
                throw new Error(`the adapter restarted ${this.restarts} times, expected ${n}`);
            }
            await new Promise((resolve) => setTimeout(resolve, 20));
        }
        await this.ready();
    }

    async stop() {
        this._stopping = true;
        const child = this.child;
        this.child = null;
        if (!child) {
            return;
        }
        const exited = new Promise((resolve) => child.once("exit", resolve));
        child.stdin.end();
        child.stdio[3].end();
        const timer = setTimeout(() => child.kill("SIGKILL"), 2000);
        await exited;
        clearTimeout(timer);
    }
}
