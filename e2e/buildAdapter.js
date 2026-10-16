// Global setup: builds the firmware's virtual adapter, unless OGXM_VIRTUAL_ADAPTER names a built
// one. The firmware repository comes from OGXM_FIRMWARE_DIR (default: ../OGX-Mini-improved next
// to this repository); it needs the tinyusb and libfixmath submodules only.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));

export function adapterBinary() {
    if (process.env.OGXM_VIRTUAL_ADAPTER) {
        return resolve(process.env.OGXM_VIRTUAL_ADAPTER);
    }
    return resolve(HERE, ".build", "virtual_adapter");
}

export default function globalSetup() {
    if (process.env.OGXM_VIRTUAL_ADAPTER) {
        if (!existsSync(adapterBinary())) {
            throw new Error(`OGXM_VIRTUAL_ADAPTER: no file at ${adapterBinary()}`);
        }
        return;
    }
    const firmware = resolve(process.env.OGXM_FIRMWARE_DIR || resolve(HERE, "..", "..", "OGX-Mini-improved"));
    const source = resolve(firmware, "Firmware", "RP2040", "tests", "virtual_adapter");
    if (!existsSync(source)) {
        throw new Error(`No firmware checkout at ${firmware}: set OGXM_FIRMWARE_DIR or OGXM_VIRTUAL_ADAPTER`);
    }
    const build = resolve(HERE, ".build");
    execFileSync("cmake", ["-S", source, "-B", build, "-DCMAKE_BUILD_TYPE=Release"], { stdio: "inherit" });
    execFileSync("cmake", ["--build", build, "--parallel"], { stdio: "inherit" });
}
