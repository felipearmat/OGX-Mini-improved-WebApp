/*  Why a connection failed, shown at the top of the page. The page reloads after a failed
 *  connection, so the text is kept in sessionStorage until the reload shows it. */
const KEY = "ogxm-connect-error";

function describe(error, how) {
    const name = error && error.name;
    const message = (error && error.message) || String(error || "");
    if (name === "NotFoundError" && /no port selected|cancel/i.test(message)) {
        return null;  // the chooser was closed: nothing went wrong
    }
    if (name === "NotFoundError" && how === "Bluetooth") {
        return null;  // same for the Bluetooth chooser
    }
    if (how === "USB" && (name === "InvalidStateError" || name === "NetworkError" || /open/i.test(message))) {
        return "Could not open the adapter's USB port: another tab or program (this page in another tab, " +
            "ogxm_hybrid.py, a serial monitor) is using it. Close it and connect again.";
    }
    if (name === "NotSupportedError" || /not supported|not available/i.test(message)) {
        return `${how} is not available in this browser: use Chrome or Edge.`;
    }
    return `${how} connection failed: ${message || "no details"}.`;
}

export const ConnectError = {
    // Before the reload: keep the reason (nothing when the person closed the chooser).
    remember(error, how) {
        const text = describe(error, how);
        if (!text) {
            return;
        }
        try {
            sessionStorage.setItem(KEY, text);
        } catch (_) { /* storage blocked: the console has it */ }
    },

    // After the reload: show the kept reason once.
    showPending() {
        let text = null;
        try {
            text = sessionStorage.getItem(KEY);
            sessionStorage.removeItem(KEY);
        } catch (_) {
            return;
        }
        const box = document.getElementById("errorTxt");
        if (!text || !box) {
            return;
        }
        box.textContent = `⚠️ ${text}`;
        box.classList.remove("hidden");
    },
};
