// Init script: a Web Serial port (navigator.serial) whose bytes go to the virtual adapter through
// the test's binding window.__ogxmSerial (fixtures.js). requestPort() picks it, as a user would.
(() => {
    let controller = null;

    class FakePort extends EventTarget {
        constructor() {
            super();
            this.readable = null;
            this.writable = null;
        }

        async open() {
            if (this.readable) {
                throw new DOMException("The port is already open.", "InvalidStateError");
            }
            if (!(await window.__ogxmSerial({ op: "open" }))) {
                throw new DOMException("Failed to open serial port.", "NetworkError");
            }
            this.readable = new ReadableStream({
                start: (c) => { controller = c; },
                cancel: () => { controller = null; },
            });
            this.writable = new WritableStream({
                write: (chunk) => window.__ogxmSerial({ op: "write", data: Array.from(chunk) }),
            });
        }

        async close() {
            controller = null;
            this.readable = null;
            this.writable = null;
            await window.__ogxmSerial({ op: "close" });
        }

        getInfo() {
            return { usbVendorId: 0xcafe, usbProductId: 0x4010 };
        }
    }

    const port = new FakePort();

    // From the test: bytes the adapter sent (base64), and the device going away.
    window.__ogxmSerialPush = (base64) => {
        if (controller) {
            controller.enqueue(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
        }
    };
    window.__ogxmSerialLost = () => {
        const c = controller;
        controller = null;
        if (c) {
            c.error(new DOMException("The device has been lost.", "NetworkError"));
        }
    };

    Object.defineProperty(navigator, "serial", {
        configurable: true,
        value: {
            requestPort: async () => port,
            getPorts: async () => [port],
            addEventListener() {},
            removeEventListener() {},
        },
    });
})();
