/*  Firmware update check (OGX-Mini-improved): compares the adapter's version with the latest
 *  release on GitHub and says when there is a newer one, with the file for this board. The adapter
 *  answers with its version (USB GET_VERSION 0x77: version, board, the hybrid's ESP32 version;
 *  Bluetooth: the firmware version characteristic). Versions look like improved-v1.2.0, or
 *  improved-v1.2.0-14-gabc1234 for a build 14 commits after it. Offline, or when GitHub does not
 *  answer, nothing is shown. */
const REPO = "felipearmat/OGX-Mini-improved";
const LATEST_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const RELEASES_PAGE = `https://github.com/${REPO}/releases`;
const CACHE_KEY = "ogxm-latest-release";
const CACHE_MS = 60 * 60 * 1000;  // GitHub allows 60 unauthenticated requests an hour

export function parseVersion(text) {
    const m = /^improved-v(\d+)\.(\d+)\.(\d+)(?:-(\d+)-g([0-9a-f]+))?/.exec(text || "");
    if (!m) {
        return null;
    }
    return {
        text,
        parts: [Number(m[1]), Number(m[2]), Number(m[3])],
        ahead: m[4] ? Number(m[4]) : 0,  // commits after the release: a development build
        label: `v${m[1]}.${m[2]}.${m[3]}`,
    };
}

// < 0: a older than b; 0: same release; > 0: newer. A development build counts after its release.
export function compareVersions(a, b) {
    for (let i = 0; i < 3; i++) {
        if (a.parts[i] !== b.parts[i]) {
            return a.parts[i] - b.parts[i];
        }
    }
    return a.ahead - b.ahead;
}

async function latestRelease() {
    try {
        const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
        if (cached && Date.now() - cached.at < CACHE_MS) {
            return cached.release;
        }
    } catch (_) { /* storage blocked: ask GitHub */ }
    try {
        const response = await fetch(LATEST_URL, { headers: { Accept: "application/vnd.github+json" } });
        if (!response.ok) {
            return null;
        }
        const data = await response.json();
        const release = {
            tag: data.tag_name,
            url: data.html_url,
            assets: (data.assets || []).map((a) => ({ name: a.name, url: a.browser_download_url })),
        };
        try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), release }));
        } catch (_) { /* fine without the cache */ }
        return release;
    } catch (_) {
        return null;  // offline
    }
}

function link(text, url) {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = text;
    return a;
}

// The running firmware next to the page title, whether or not GitHub answers.
function showVersion(version, companion) {
    const label = document.getElementById("fwVersion");
    if (!label) {
        return;
    }
    const parts = [];
    if (version) {
        parts.push(`firmware ${version}`);
    }
    if (companion) {
        parts.push(`ESP32 ${companion}`);
    }
    label.textContent = parts.join(" · ");
}

export const UpdateCheck = {
    /*  version: the adapter's (or, over Bluetooth on the hybrid, the ESP32's) version text;
     *  board: OGXM_BOARD when known (USB), to point at its file; companion: the hybrid ESP32's
     *  version when known. */
    async check({ version, board = null, companion = null }) {
        showVersion(version, companion);
        const banner = document.getElementById("updateNotice");
        if (!banner) {
            return;
        }
        const release = await latestRelease();
        const latest = release && parseVersion(release.tag);
        if (!latest) {
            return;
        }
        banner.innerHTML = "";
        const lines = [];
        const current = parseVersion(version);
        if (!current) {
            // Not an OGX-Mini-improved build (the original firmware), or a build without a tag.
            lines.push(["This adapter's firmware is not an OGX-Mini-improved release. Latest: ",
                link(latest.label, release.url), "."]);
        } else if (compareVersions(current, latest) < 0) {
            const asset = board && release.assets.find((a) => a.name.endsWith(`-${board}.uf2`));
            lines.push([`Firmware update available: ${latest.label} (this adapter: ${current.label}). `,
                asset ? link(`Download ${asset.name}`, asset.url) : link("Release page", release.url),
                asset ? " — or " : "", asset ? link("release page", release.url) : "", "."]);
        } else if (current.ahead > 0) {
            lines.push([`Development build: ${current.label} + ${current.ahead} commits (latest release ${latest.label}).`]);
        }
        const esp = parseVersion(companion);
        if (companion && esp && compareVersions(esp, latest) < 0) {
            const zip = release.assets.find((a) => a.name.endsWith("-ESP32_COMPANION.zip"));
            lines.push([`ESP32 update available: ${latest.label} (ESP32: ${esp.label}). `,
                zip ? link(`Download ${zip.name}`, zip.url) : link("Release page", release.url),
                " — flash it through the adapter with Tools/hybrid/ogxm_hybrid.py flash-esp32."]);
        }
        for (const parts of lines) {
            const p = document.createElement("div");
            for (const part of parts) {
                p.append(part);
            }
            banner.appendChild(p);
        }
        banner.classList.toggle("hidden", lines.length === 0);
    },

    releasesPage: RELEASES_PAGE,
};
