import { USBInterface } from "./usbInterface.js";
import { Gamepad } from "../gamepad.js";
import { UI } from "../uiSettings.js";
import { UserSettings } from "../userSettings.js";
import { DongleSettings } from "../dongleSettings.js";
import { ModeView } from "../modeView.js";
import { UIDongle } from "../uiDongle.js";
import { KbmSettings } from "../kbmSettings.js";
import { UIKbm } from "../uiKbm.js";
import { UIRumble } from "../uiRumble.js";
import { UITouchpad } from "../uiTouchpad.js";
import { UISearch } from "../uiSearch.js";
import { UIDiagnostics } from "../uiDiagnostics.js";

class USBManager {
    static #PACKET_LENGTH = Object.freeze(64);
    static #HEADER_LENGTH = Object.freeze(9);
    static #BAUDRATE = Object.freeze(9600); 
    static #BUFFER_LEN = Object.freeze(16384);  // diagnostics reports are a few KB

    static #PACKET_ID = Object.freeze({
        NONE: 0,
        GET_PROFILE_BY_ID: 0x50,
        GET_PROFILE_BY_IDX: 0x55,
        SET_PROFILE_START: 0x60,
        SET_PROFILE: 0x61,
        GET_DONGLE_SETTINGS: 0x70,
        SET_DONGLE_SETTINGS: 0x71,
        GET_KBM_SETTINGS: 0x72,
        SET_KBM_SETTINGS: 0x73,
        GET_DIAGNOSTICS: 0x74,
        SET_GP_IN: 0x80,
        GP_TOUCH: 0x82,
        SET_GP_OUT: 0x81,
        RESP_ERROR: 0xFF
    });

    static #PACKET_HEADER = Object.freeze([
        { key: "packetLen",   size: 1 },
        { key: "packetId",    size: 1 },
        { key: "deviceMode",  size: 1 },
        { key: "maxGamepads", size: 1 },
        { key: "playerIdx",   size: 1 },
        { key: "profileId",   size: 1 },
        { key: "chunksTotal", size: 1 },
        { key: "chunkIdx",    size: 1 },
        { key: "chunkLen",    size: 1 },
    ]);

    #interface = null;
    #currentBufferInOffset = 0;
    #bufferIn = null;
    #userSettings = null;
    #dongleSettings = null;
    #kbmSettings = null;
    #diagnosticsResolve = null;

    constructor() {
        this.#interface = new USBInterface();
        this.#bufferIn = new Uint8Array(USBManager.#BUFFER_LEN);
    }

    async init(userSettings, dongleSettings, kbmSettings) {
        try {
            this.#userSettings = userSettings;
            this.#dongleSettings = dongleSettings;
            this.#kbmSettings = kbmSettings;

            if (await this.#interface.connect(USBManager.#BAUDRATE)) {
                this.#interface.registerDisconnectCb(() => {
                    window.location.reload();
                });

                this.#interface.readTask(USBManager.#PACKET_LENGTH, this.#processPacketIn.bind(this));
                await this.#sleep(1000);
                return true;
            }
        } catch (error) {
            console.warn('Connection error:', error);
            await this.#interface.disconnect();
            return false;
        }
    }

    async saveProfile() {
        let header = this.#headerFromUi(USBManager.#PACKET_ID.SET_PROFILE_START);
        await this.#writeToDevice(
            header, 
            new Uint8Array([0xFF])
        );
        await this.#sleep(100);

        const data = this.#userSettings.getProfileBytes();
        header.packetId = USBManager.#PACKET_ID.SET_PROFILE;
        await this.#writeToDevice(
            header, 
            data
        );
    }

    async getProfileById() {
        let header = this.#headerFromUi(USBManager.#PACKET_ID.GET_PROFILE_BY_ID);
        await this.#writeToDevice(
            header, 
            new Uint8Array([0xFF])
        );
    }

    async getProfileByIdx() {
        let header = this.#headerFromUi(USBManager.#PACKET_ID.GET_PROFILE_BY_IDX);
        await this.#writeToDevice(
            header, 
            new Uint8Array([0xFF])
        );
    }

    async disconnect() {
        await this.#interface.disconnect();
    }

    // Adapter options (OGX-Mini-improved firmware); older firmware ignores the request.
    async getDongleSettings() {
        let header = this.#headerFromUi(USBManager.#PACKET_ID.GET_DONGLE_SETTINGS);
        await this.#writeToDevice(header, new Uint8Array([0xFF]));
    }

    async saveDongleSettings() {
        let header = this.#headerFromUi(USBManager.#PACKET_ID.SET_DONGLE_SETTINGS);
        await this.#writeToDevice(header, this.#dongleSettings.getBytes());
    }

    // Given bytes (the mode combo list alone: applied without a restart).
    async saveDongleBytes(bytes) {
        let header = this.#headerFromUi(USBManager.#PACKET_ID.SET_DONGLE_SETTINGS);
        await this.#writeToDevice(header, bytes);
    }

    // Mouse + keyboard mapping (OGX-Mini-improved firmware); older firmware ignores the request.
    async getKbmSettings() {
        let header = this.#headerFromUi(USBManager.#PACKET_ID.GET_KBM_SETTINGS);
        await this.#writeToDevice(header, new Uint8Array([0xFF]));
    }

    // Applied right away; the adapter answers with the stored mapping.
    async saveKbmSettings() {
        let header = this.#headerFromUi(USBManager.#PACKET_ID.SET_KBM_SETTINGS);
        await this.#writeToDevice(header, this.#kbmSettings.getBytes());
    }

    // Diagnostics report (OGX-Mini-improved firmware): the parsed JSON, or null after 3 s
    // without an answer (older firmware ignores the request).
    async getDiagnostics() {
        const answer = new Promise((resolve) => {
            this.#diagnosticsResolve = resolve;
            setTimeout(() => {
                if (this.#diagnosticsResolve === resolve) {
                    this.#diagnosticsResolve = null;
                    resolve(null);
                }
            }, 3000);
        });
        let header = this.#headerFromUi(USBManager.#PACKET_ID.GET_DIAGNOSTICS);
        await this.#writeToDevice(header, new Uint8Array([0xFF]));
        return answer;
    }

    // Rumble test (OGX-Mini-improved firmware): left / right motor 0-255, duration in ms.
    async sendRumbleTest(left, right, durationMs) {
        let header = this.#headerFromUi(USBManager.#PACKET_ID.SET_GP_OUT);
        await this.#writeToDevice(header, new Uint8Array([left, right, durationMs & 0xFF, (durationMs >> 8) & 0xFF]));
    }

    #headerFromUi(packetId) {
        return {
            packetLen: USBManager.#PACKET_LENGTH,
            packetId: packetId,
            deviceMode: UI.getSelectedDeviceMode(),
            maxGamepads: this.#userSettings.maxGamepads,
            playerIdx: UI.getSelectedPlayerIdx(),
            profileId: UI.getSelectedProfileId(),
            chunksTotal: 1,
            chunkIdx: 0,
            chunkLen: 0
        }
    }

    #deserializeHeader(packetData) {
        if (packetData.length < USBManager.#HEADER_LENGTH) {
            console.error("Invalid packet data length.");
            return;
        }
        const header = {};
        let offset = 0;
        USBManager.#PACKET_HEADER.forEach(field => {
            header[field.key] = packetData[offset];
            offset += field.size;
        });
        return header;
    }

    #serializeHeader(header) {
        const buffer = new Uint8Array(USBManager.#HEADER_LENGTH);
        let offset = 0;
        USBManager.#PACKET_HEADER.forEach(field => {
            buffer[offset] = header[field.key];
            offset += field.size;
        });
        return buffer;
    }

    #processPacketInData(header, bufferIn, dataLen) {
        switch (header.packetId) {
            case USBManager.#PACKET_ID.GET_PROFILE_BY_IDX:   
                console.log("Received profile data.");
                this.#userSettings.setProfileFromBytes(bufferIn.subarray(0, dataLen));
                this.#userSettings.maxGamepads = header.maxGamepads;
                this.#userSettings.playerIdx = header.playerIdx;
                this.#userSettings.deviceMode = header.deviceMode;
                UI.updateAll(this.#userSettings);
                break;

            case USBManager.#PACKET_ID.GET_PROFILE_BY_ID:
                console.log("Received profile data.");
                this.#userSettings.setProfileFromBytes(bufferIn.subarray(0, dataLen));
                this.#userSettings.maxGamepads = header.maxGamepads;
                this.#userSettings.deviceMode = header.deviceMode;
                UI.updateAll(this.#userSettings);
                break; 

            case USBManager.#PACKET_ID.GET_DONGLE_SETTINGS:
                if (this.#dongleSettings && this.#dongleSettings.setFromBytes(bufferIn.slice(0, dataLen))) {
                    UIDongle.update(this.#dongleSettings);
                    UIDongle.setAvailable(true);
                    if (UIDongle.refreshModeCombo) {
                        UIDongle.refreshModeCombo();
                    }
                    UISearch.update(this.#dongleSettings);
                    UIRumble.setAvailable(true);  // same firmware generation
                }
                break;

            case USBManager.#PACKET_ID.GET_KBM_SETTINGS:
                if (this.#kbmSettings && this.#kbmSettings.setFromBytes(bufferIn.slice(0, dataLen))) {
                    UIKbm.update(this.#kbmSettings);
                    UIKbm.setAvailable(true);
                    UIKbm.setStatus(`Mapping read from the adapter (${new Date().toLocaleTimeString()}).`);
                }
                break;

            case USBManager.#PACKET_ID.GET_DIAGNOSTICS: {
                let report = null;
                try {
                    report = JSON.parse(new TextDecoder().decode(bufferIn.slice(0, dataLen)));
                } catch (error) {
                    console.warn("Diagnostics: bad JSON", error);
                }
                if (this.#diagnosticsResolve) {
                    this.#diagnosticsResolve(report);
                    this.#diagnosticsResolve = null;
                }
                break;
            }

            case USBManager.#PACKET_ID.SET_GP_OUT:
                UIRumble.setStatus(`Sent (${new Date().toLocaleTimeString()}).`);
                break;

            case USBManager.#PACKET_ID.GP_TOUCH:
                UITouchpad.draw(bufferIn.subarray(0, dataLen));
                break;

            case USBManager.#PACKET_ID.SET_GP_IN:
                const gamepad = new Gamepad();
                gamepad.setReportFromBytes(bufferIn.subarray(0, dataLen));
                UI.drawGamepadInput(gamepad, this.#userSettings);
                break;

            default:
                console.warn(`Unknown packet ID: ${header.packetId}`);
                break;
        }
    }

    #processPacketIn(data) {
        if (data[0] !== USBManager.#PACKET_LENGTH) {
            console.warn(`Invalid packet length: ${data[0]}`);
            return;
        }
        const header = this.#deserializeHeader(data);

        this.#bufferIn.set(
            data.subarray(
                USBManager.#HEADER_LENGTH, 
                USBManager.#HEADER_LENGTH + header.chunkLen
            ), this.#currentBufferInOffset
        );

        this.#currentBufferInOffset += header.chunkLen;

        console.log("Received packet: " + (header.chunkIdx + 1) + " of " + header.chunksTotal);    

        if (header.chunkIdx + 1 === header.chunksTotal) {
            this.#processPacketInData(header, this.#bufferIn, this.#currentBufferInOffset);
            this.#currentBufferInOffset = 0;
        }
    }

    async #writeToDevice(header, data) {
        const dataLen = data.length;
        const lenLimit = USBManager.#PACKET_LENGTH - USBManager.#HEADER_LENGTH;
        const chunksTotal = Math.ceil(dataLen / lenLimit);;
        let currentOffset = 0;

        header.chunksTotal = chunksTotal;

        for (let i = 0; i < chunksTotal; i++) {
            const isLastChunk = (i === chunksTotal - 1);
            const chunkLen = isLastChunk ? dataLen - currentOffset : lenLimit;
            header.chunkIdx = i;
            header.chunkLen = chunkLen;

            const buffer = new Uint8Array(USBManager.#PACKET_LENGTH);

            buffer.set(this.#serializeHeader(header), 0);
            buffer.set(
                data.subarray(currentOffset, currentOffset + chunkLen), 
                USBManager.#HEADER_LENGTH
            );

            console.log("Writing packet: " + (i + 1) + " of " + chunksTotal);

            await this.#interface.write(buffer);
            currentOffset += chunkLen;
        }
    }

    async #sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export const USB = {

    async connect() {
        if (!("serial" in navigator)) {
            console.error("Web Serial API not supported.");
            return;
        }

        const userSettings = new UserSettings();
        UI.init(userSettings);
        const dongleSettings = new DongleSettings();
        UIDongle.init(dongleSettings);
        UISearch.init(dongleSettings);
        const kbmSettings = new KbmSettings();
        UIKbm.init(kbmSettings);
        const usbManager = new USBManager();

        try {
            UI.connectButtonsEnabled(false);

            if (!(await usbManager.init(userSettings, dongleSettings, kbmSettings))) {
                throw new Error("Connection failed.");
            }

            await usbManager.getProfileByIdx();
            await usbManager.getDongleSettings();
            // No answer (older firmware) within 1.5 s: warn what will not work as expected.
            setTimeout(() => ModeView.setFirmwareWarning(!dongleSettings.storedBytes), 1500);
            await usbManager.getKbmSettings();

            UI.updateAll(userSettings);
            UI.toggleConnected(true);
            UI.setSubheaderText("Settings");

            UI.addCallbackLoadProfile(async () => {
                await usbManager.getProfileById();
                UI.updateAll(userSettings);
            }, userSettings);

            UI.addCallbackSaveProfile(async () => {
                await usbManager.saveProfile();
            }, userSettings);

            UIDongle.addCallbackSave(async () => {
                await usbManager.saveDongleSettings();
            });
            UIDongle.initModeCombo(dongleSettings, async (bytes) => {
                await usbManager.saveDongleBytes(bytes);
            });

            UIDiagnostics.init(() => usbManager.getDiagnostics(), () => ({
                connection: "USB",
                device_mode: userSettings.deviceMode,
                max_gamepads: userSettings.maxGamepads,
                adapter_options: dongleSettings.version ? { version: dongleSettings.version, ...dongleSettings.values } : null,
                mouse_keyboard_mapping: Array.from(kbmSettings.getBytes()),
            }));
            UIDiagnostics.setAvailable(true);
            UITouchpad.initToggle();

            UIRumble.init(async (left, right, ms) => {
                await usbManager.sendRumbleTest(left, right, ms);
            });

            UIKbm.addCallbackSave(async () => {
                UIKbm.setStatus("Saving...");
                await usbManager.saveKbmSettings();
            });

            // Mouse + Keyboard mode: the mapping is the profile (Save / Reload / Load Defaults).
            UI.setKbmHandlers({
                save: async () => {
                    UIKbm.setStatus("Saving...");
                    await usbManager.saveKbmSettings();
                    await new Promise((resolve) => setTimeout(resolve, 300));  // stored before the mode change
                },
                reload: async () => {
                    await usbManager.getKbmSettings();
                },
                defaults: () => {
                    kbmSettings.restoreDefaults();
                    UIKbm.update(kbmSettings);
                    UIKbm.setStatus("Default layout loaded; Save Profile stores it.");
                },
            });

            UI.addCallbackDisconnect(async () => {
                await usbManager.disconnect();
                UI.toggleConnected(false);
                window.location.reload();
            });

        } catch (error) {
            console.warn('Connection error:', error);
            usbManager.disconnect();
            window.location.reload();
        }
    }
};