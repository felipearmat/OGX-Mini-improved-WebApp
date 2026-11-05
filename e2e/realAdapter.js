// A real adapter on its USB serial port (D-Input/Debug), with the same calls the specs use on the
// virtual one (virtualAdapter.js) where they make sense on hardware. The port is a tty opened in raw
// mode; when the adapter restarts it goes away and comes back, which counts as a restart.
import { execFileSync } from "node:child_process";
import { closeSync, existsSync, openSync, read, writeSync } from "node:fs";

const POLL_MS = 100;

export class RealAdapter {
    constructor(path) {
        this.path = path;
        this.fd = null;
        this.portOpen = false;
        this.restarts = 0;
        this.bytesOut = 0;  // bytes the adapter sent
        this.onData = null;
        this.onLost = null;
        this._present = existsSync(path);
        this._stopping = false;
        this._watch = null;
    }

    start() {
        this._watch = setInterval(() => {
            const present = existsSync(this.path);
            if (present && !this._present) {
                this.restarts += 1;  // gone and back: the adapter restarted
            }
            this._present = present;
        }, POLL_MS);
    }

    async ready(timeoutMs = 20000) {
        const end = Date.now() + timeoutMs;
        while (!existsSync(this.path)) {
            if (Date.now() > end) throw new Error(`${this.path} not there`);
            await new Promise((r) => setTimeout(r, POLL_MS));
        }
    }

    async open() {
        try {
            await this.ready(10000);
            execFileSync("stty", ["-F", this.path, "raw", "-echo", "-echoe", "-echok", "-icanon", "-isig", "-iexten"]);
            this.fd = openSync(this.path, "r+");
        } catch {
            return false;
        }
        this.portOpen = true;
        this._readLoop(this.fd);
        return true;
    }

    _readLoop(fd) {
        const buf = Buffer.alloc(4096);
        const next = () => {
            read(fd, buf, 0, buf.length, null, (err, n) => {
                if (fd !== this.fd) return;  // closed meanwhile
                if (err || n === 0) {
                    this._lost();
                    return;
                }
                this.bytesOut += n;
                if (this.onData) this.onData(Buffer.from(buf.subarray(0, n)));
                next();
            });
        };
        next();
    }

    _lost() {
        const fd = this.fd;
        this.fd = null;
        this.portOpen = false;
        try { if (fd !== null) closeSync(fd); } catch {}
        if (!this._stopping && this.onLost) this.onLost();
    }

    close() {
        const fd = this.fd;
        this.fd = null;
        this.portOpen = false;
        try { if (fd !== null) closeSync(fd); } catch {}
    }

    write(bytes) {
        if (this.fd === null) return;
        try {
            writeSync(this.fd, Buffer.from(bytes));
        } catch {
            this._lost();
        }
    }

    async waitRestarts(n, timeoutMs = 30000) {
        const end = Date.now() + timeoutMs;
        while (this.restarts < n) {
            if (Date.now() > end) throw new Error(`${this.restarts} restarts, ${n} expected`);
            await new Promise((r) => setTimeout(r, POLL_MS));
        }
        await this.ready();
    }

    async stop() {
        this._stopping = true;
        clearInterval(this._watch);
        this.close();
    }
}
