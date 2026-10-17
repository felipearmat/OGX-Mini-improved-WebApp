import { DongleSettings } from "./dongleSettings.js";
import { Capabilities, capabilities } from "./capabilities.js";
/*  "Diagnostics" panel (OGX-Mini-improved firmware, USB). Shows what the adapter measures for
 *  each controller (identity, link, reports per second, late and lost reports, largest gap
 *  between reports, signal and channels in use), the summary of the previous session (the mode
 *  used for playing, before the reboot into D-Input/Debug mode) and saves a log report (a JSON file) to send when asking for help:
 *  the adapter's report (board, firmware, mode, controllers, recent events) plus the web app's
 *  view of the settings and the browser. */
export const UIDiagnostics = {
    built: false,

    // requestFunc() resolves with the adapter's report object, or null if it did not answer.
    // extraFunc() returns the web app side of the report (settings, profile...).
    // logFunc(), optional (USB), resolves with the adapter's kept log text, or null.
    // flashLogFunc(report), optional (USB), resolves with the newest part of the log kept in
    // flash (text), or null.
    init(requestFunc, extraFunc, logFunc = null, flashLogFunc = null) {
        if (this.built) {
            return;
        }
        const refresh = async () => {
            this.setStatus("Asking the adapter...");
            const report = await requestFunc();
            if (!report) {
                this.setStatus("No answer: the adapter's firmware is older than this panel (OGX-Mini-improved v1.1.0 or later).");
                return null;
            }
            this.show(report);
            this.setStatus(`Updated ${new Date().toLocaleTimeString()}.`);
            return report;
        };
        document.getElementById("button-diagRefresh").addEventListener("click", refresh);
        document.getElementById("button-diagReport").addEventListener("click", async () => {
            const report = await refresh();
            const keptLog = logFunc ? await logFunc() : null;
            const flashLog = flashLogFunc && report && report.flash_log && report.flash_log.pages
                ? await flashLogFunc(report) : null;
            const file = {
                generated_at: new Date().toISOString(),
                web_app: window.location.href,
                browser: navigator.userAgent,
                adapter: report,  // null when the firmware did not answer
                web_app_view: extraFunc(),
                // The adapter's kept log, one line per entry: [rp] events, [esp] the hybrid's ESP32.
                kept_log: keptLog === null ? null : keptLog.split("\n").filter((line) => line),
                // The newest part of the log kept in flash (it outlives unplugging the adapter).
                flash_log: flashLog === null ? null : flashLog.split("\n").filter((line) => line),
            };
            const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
            const link = document.createElement("a");
            const stamp = file.generated_at.replace(/[:.]/g, "-");
            link.href = URL.createObjectURL(blob);
            link.download = `ogx-mini-report-${stamp}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(link.href);
            this.setStatus(`Report saved (${link.download}). Send this file when asking for help.`);
        });
        const toggle = document.getElementById("button-toggleDiagnostics");
        const panel = document.getElementById("diagnosticsPanel");
        if (toggle && panel) {
            toggle.addEventListener("click", () => {
                const hidden = panel.classList.toggle("hidden");
                toggle.textContent = hidden ? "Show" : "Hide";
            });
        }
        this.built = true;
    },

    /* "Keep the log in flash" (Adapter Options version 7, applied live like the Status LED
     * options): built once the adapter's record is known. */
    optionsBuilt: false,

    initOptions(dongleSettings, saveLive) {
        const container = document.getElementById("diagOptionsInput");
        if (!container || this.optionsBuilt) {
            return;
        }
        for (const option of DongleSettings.OPTIONS.filter((o) => o.panel === "diagnostics")) {
            const row = document.createElement("div");
            row.className = "dongleOption hidden";
            const id = `dongle-${option.key}`;
            const label = document.createElement("label");
            label.htmlFor = id;
            label.textContent = option.label;
            Capabilities.addTip(label, option.tip);
            const box = document.createElement("input");
            box.type = "checkbox";
            box.className = "invertCheckbox";
            box.id = id;
            box.addEventListener("change", () => {
                dongleSettings.values[option.key] = box.checked ? 1 : 0;
                this.setStatus("Saving...");
                saveLive(() => this.setStatus(`Saved (${new Date().toLocaleTimeString()}).`));
            });
            row.appendChild(label);
            row.appendChild(box);
            container.appendChild(row);
        }
        capabilities.addListener(() => this.updateOptions(dongleSettings));  // the adapter answered
        this.optionsBuilt = true;
    },

    updateOptions(dongleSettings) {
        for (const option of DongleSettings.OPTIONS.filter((o) => o.panel === "diagnostics")) {
            const box = document.getElementById(`dongle-${option.key}`);
            const row = box && box.closest(".dongleOption");
            if (!row) {
                continue;
            }
            const known = (option.since || 1) <= dongleSettings.version;
            row.classList.toggle("hidden", !known || !capabilities.supports(option.capability));
            box.checked = dongleSettings.values[option.key] !== 0;
        }
    },

    show(report) {
        const flash = document.getElementById("diagFlashLog");
        if (flash) {
            const f = report.flash_log;
            flash.textContent = f && f.available
                ? `Log in flash: ${f.enabled ? "on" : "off"}, ${f.pages} of ${f.capacity} pages kept` +
                  (f.dropped_bytes ? `, ${f.dropped_bytes} bytes missed` : "") + "."
                : "";
        }
        const info = document.getElementById("diagInfo");
        info.textContent = `${report.board} (${report.chip}), firmware ${report.firmware} (${report.build}), ` +
            `mode ${report.output_mode}, up ${Math.round(report.uptime_ms / 1000)} s, last reset: ${report.last_reset}`;
        if (report.last_crash) {
            const k = report.last_crash;
            info.textContent += `. Last crash (${k.when}): ${k.kind}` +
                (k.message ? ` "${k.message}"` : "") + (k.pc ? ` at ${k.pc}` : "") +
                " - include the log report when asking for help";
        }
        if (report.companion) {
            // RP2040 + ESP32 adapter: what the ESP32 (the Bluetooth side) reports about itself.
            const e = report.companion;
            info.textContent += `. Bluetooth on the ESP32: firmware ${e.firmware || "?"}, up ${e.uptime_s} s, ` +
                `transmit power ${e.high_tx_power ? "high" : "default"}, link to the ESP32: ` +
                `${e.i2c_write_errors} write / ${e.i2c_read_errors} read errors, ${e.i2c_queue_drops} queue drops` +
                (e.last_heard_s > 10 ? ` (last heard ${e.last_heard_s} s ago)` : "");
        }
        if (report.bluetooth && report.bluetooth.bredr_inquiry_running) {
            info.textContent += ". Searching for new Bluetooth controllers (slows down the connected ones)";
        }
        const body = document.getElementById("diagControllers");
        body.innerHTML = "";
        const addRow = (cells) => {
            const row = body.insertRow();
            for (const text of cells) {
                row.insertCell().textContent = text;
            }
        };
        const pct = (value) => value === undefined ? "-" : value === null ? "n/a" : `${value}%`;
        const controllers = report.controllers || [];
        const wired = report.wired_controllers || [];
        if (controllers.length === 0 && wired.length === 0) {
            const cell = body.insertRow().insertCell();
            cell.colSpan = 8;
            cell.textContent = "No controller connected.";
        }
        for (const c of controllers) {
            const details = [c.manufacturer, c.bt_chip_vendor && `${c.bt_chip_vendor} chip`,
                c.firmware && `fw ${c.firmware}`, c.switch_firmware && `fw ${c.switch_firmware}`]
                .filter(Boolean).join(", ");
            let link = c.link === "LE" && c.le_interval_ms !== undefined
                ? `LE, ${c.le_interval_ms} ms (latency ${c.le_latency})` : c.link;
            if (c.bt_version) {
                link += `, BT ${c.bt_version}`;
            }
            if (c.link_mode === "sniff") {
                link += `, power saving (sniff, ${c.sniff_interval_ms} ms)`;
            }
            // Classic links report the distance from the receiver's ideal range, not dBm.
            let signal = c.rssi_dbm !== undefined ? `${c.rssi_dbm} dBm`
                : c.rssi_golden_range_db === undefined ? "-"
                : c.rssi_golden_range_db === 0 ? "good"
                : c.rssi_golden_range_db < 0 ? `weak (${c.rssi_golden_range_db} dB)` : `strong (+${c.rssi_golden_range_db} dB)`;
            if (c.channels_total) {
                signal += `, ${c.channels_in_use}/${c.channels_total} channels`;
            }
            if (c.tx_power_dbm !== undefined) {
                // The adapter's own transmit power on this link (and the most it may use).
                signal += `, adapter TX ${c.tx_power_dbm}` +
                    (c.tx_power_max_dbm !== undefined ? `/${c.tx_power_max_dbm}` : "") + " dBm";
            }
            // RP2040 + ESP32: what reached the ESP32 next to what reached the RP2040, so radio
            // losses (before the ESP32) and link losses (between the boards) can be told apart.
            const esp32 = c.esp32_reports_per_s !== undefined;
            addRow([
                `${c.name} (${c.vid}:${c.pid})${details ? ` - ${details}` : ""}`,
                link,
                esp32 ? `${c.reports_per_s} (ESP32 ${c.esp32_reports_per_s})` : `${c.reports_per_s}`,
                pct(c.late_reports_pct),
                esp32 && c.esp32_lost_reports_pct !== undefined
                    ? `${pct(c.lost_reports_pct)} (radio ${pct(c.esp32_lost_reports_pct)})` : pct(c.lost_reports_pct),
                `${c.max_gap_ms_recent} ms`,
                signal,
                `${c.connected_s} s`,
            ]);
        }
        for (const u of wired) {
            addRow([
                `USB ${u.vid}:${u.pid} (bcd ${u.bcd_device}, ${u.driver})`,
                `${u.connection}, ${u.speed} speed`,
                `${u.reports_per_s}`,
                pct(u.late_reports_pct),
                "-",
                `${u.max_gap_ms_recent} ms`,
                "-",
                `${u.connected_s} s`,
            ]);
        }
        const previous = document.getElementById("diagPrevious");
        const p = report.previous_session;
        if (!previous) {
            return;
        }
        if (!p) {
            previous.textContent = "";
            return;
        }
        const parts = [`Previous session (${p.mode}, ${p.uptime_s} s): ${p.usb_reports_sent_per_s ?? "-"} USB reports/s`];
        if (p.input_to_output_latency && p.input_to_output_latency.samples) {
            const l = p.input_to_output_latency;
            parts.push(`adapter latency avg ${(l.avg_us / 1000).toFixed(1)} ms, max ${(l.max_us / 1000).toFixed(1)} ms`);
        }
        for (const c of p.controllers || []) {
            parts.push(`${c.vid}:${c.pid} ${c.link} ${c.reports_per_s}/s, late ${pct(c.late_reports_pct)}, ` +
                `lost ${pct(c.lost_reports_pct)}, largest gap ${c.max_gap_ms} ms`);
        }
        if (p.wired) {
            parts.push(`USB ${p.wired.vid}:${p.wired.pid} ${p.wired.reports_per_s}/s, largest gap ${p.wired.max_gap_ms} ms`);
        }
        previous.textContent = parts.join("; ") + ".";
    },

    setAvailable(available) {
        for (const id of ["diagnosticsControl", "diagnosticsPanel"]) {
            const element = document.getElementById(id);
            if (element) {
                element.classList.toggle("hidden", !available);
            }
        }
    },

    setStatus(text) {
        const status = document.getElementById("diagStatus");
        if (status) {
            status.textContent = text;
        }
    },
};
