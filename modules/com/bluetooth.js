import { BTInterface } from "./bluetoothInterface.js";
import { UserSettings } from "../userSettings.js";
import { UI } from "../uiSettings.js";
import { Gamepad } from "../gamepad.js";
import { Mutex } from "../mutex.js";
import { DongleSettings } from "../dongleSettings.js";
import { UISearch } from "../uiSearch.js";
import { ModeView } from "../modeView.js";
import { UIDongle } from "../uiDongle.js";
import { KbmSettings } from "../kbmSettings.js";
import { UIKbm } from "../uiKbm.js";

class BTManager {
    static #getUuid(uuidSuffix) {
        const UUIDPrefix = '12345678-1234-1234-1234-1234567890';
        return `${UUIDPrefix}${uuidSuffix}`;
    }

    static UUID = Object.freeze({
        PRIMARY : this.#getUuid('12'),

        FIRMWARE_VER  : this.#getUuid('20'),
        FIRMWARE_NAME : this.#getUuid('21'),
    
        SETUP_READ  : this.#getUuid('30'),
        SETUP_WRITE : this.#getUuid('31'),
        GET_SETUP   : this.#getUuid('32'),

        PROFILE : this.#getUuid('40'),
    
        GAMEPAD : this.#getUuid('50'),

        DONGLE_SETTINGS : this.#getUuid('60'),   // OGX-Mini-improved firmware
        KBM_SETTINGS    : this.#getUuid('70'),   // OGX-Mini-improved firmware
    });

    static #PACKET_MAX_LEN = Object.freeze(20);
    static #SETUP_PACKET_LEN = Object.freeze(4);
    static #SETUP_PACKET = Object.freeze([
        { key: "deviceMode",  size: 1 },
        { key: "maxGamepads", size: 1 },
        { key: "playerIdx",   size: 1 },
        { key: "profileId",   size: 1 },
        // { key: "dataLen",     size: 1 },   
    ]);

    #interface = null;
    #mutex = null;

    constructor() {
        this.#interface = new BTInterface();
        this.#mutex = new Mutex();
    }

    async init() {
        const options = {
            filters: [
                { name: "OGX-Wireless" },
                { name: "OGX-Wireless-Lite" },
                { name: "OGX-Mini" }
            ],
            acceptAllDevices: false,
            // acceptAllDevices: true,
            optionalServices: [BTManager.UUID.PRIMARY]
        };

        if (await this.#interface.connect(BTManager.UUID.PRIMARY, options)) {
            this.#interface.setDisconnectCb(() => {
                window.location.reload();
            });
            return true;
        }
        console.warn('Failed to connect to Bluetooth device');
        this.#interface.disconnect();
        return false;
    }

    async getSetup(userSettings) {
        await this.#mutex.lock();

        const buffer = await this.#tryRead(BTManager.UUID.GET_SETUP);
        if (!buffer || buffer.length === 0) {
            console.warn('Failed to read setup data');
            return false;
        }

        let offset = 0;
        let setup = {};
        for (let i = 0; i < BTManager.#SETUP_PACKET_LEN; i++) {
            const packet = BTManager.#SETUP_PACKET[i];
            setup[packet.key] = buffer[offset];
            offset += packet.size;
        }

        userSettings.deviceMode = setup.deviceMode;
        userSettings.maxGamepads = setup.maxGamepads;
        userSettings.playerIdx = setup.playerIdx;
        userSettings.profile.profileId = setup.profileId;

        this.#mutex.unlock();
    }

    async getProfileById(userSettings) {
        const setup = {
            deviceMode: userSettings.deviceMode,
            maxGamepads: userSettings.maxGamepads,
            playerIdx: 0xFF,
            profileId: userSettings.profile.profileId,
        }
        return await this.#readProfile(setup, userSettings);
    }

    async getProfileByIdx(userSettings) {
        const setup = {
            deviceMode: userSettings.deviceMode,
            maxGamepads: userSettings.maxGamepads,
            playerIdx: userSettings.playerIdx,
            profileId: 0xFF,
        }
        return await this.#readProfile(setup, userSettings);
    }

    async saveProfile(userSettings) {
        await this.stopGamepadTask();
        await this.#mutex.lock();
        await this.#sleep(500);

        const header = {
            deviceMode: userSettings.deviceMode,
            maxGamepads: userSettings.maxGamepads,
            playerIdx: userSettings.playerIdx,
            profileId: userSettings.profile.profileId,
        };

        async function save() {
            let success = false;
            success = await this.#tryWrite(
                BTManager.UUID.SETUP_WRITE,
                new Uint8Array(Object.values(header))
            );
            if (!success) {
                console.warn('Failed to write setup packet');
                return false;
            }
    
            let profileOffset = 0;
            const profileData = userSettings.getProfileBytes();
            success = false;
    
            while (profileOffset < UserSettings.PROFILE_LENGTH) {
                const chunkLen = Math.min(
                    UserSettings.PROFILE_LENGTH - profileOffset, 
                    BTManager.#PACKET_MAX_LEN
                );
    
                let buffer = new Uint8Array(chunkLen);
                buffer.set(profileData.subarray(profileOffset, profileOffset + chunkLen), 0);
    
                success = await this.#tryWrite(BTManager.UUID.PROFILE, buffer);
                if (!success) {
                    console.warn('Failed to write profile chunk');
                    return false;
                }
                profileOffset += chunkLen;
            }
        };

        let success = await save.bind(this)();

        await this.#sleep(1000);

        if (this.#interface.isConnected()) {
            this.runGamepadTask(userSettings);
        } else {
            this.disconnect();
        }

        this.#mutex.unlock();
        return success;
    }

    // Adapter options (OGX-Mini-improved firmware). False when the adapter lacks them.
    async getDongleSettings(dongleSettings) {
        await this.#mutex.lock();
        const buffer = await this.#tryRead(BTManager.UUID.DONGLE_SETTINGS);
        this.#mutex.unlock();
        return !!buffer && dongleSettings.setFromBytes(buffer);
    }

    // The adapter stores the options and restarts (the page reloads on disconnect).
    async saveDongleSettings(dongleSettings) {
        await this.stopGamepadTask();
        await this.#mutex.lock();
        const success = await this.#tryWrite(BTManager.UUID.DONGLE_SETTINGS, dongleSettings.getBytes());
        this.#mutex.unlock();
        return success;
    }

    // Given bytes (the mode combo list alone: applied without a restart).
    async saveDongleBytes(bytes) {
        await this.#mutex.lock();
        const success = await this.#tryWrite(BTManager.UUID.DONGLE_SETTINGS, bytes);
        this.#mutex.unlock();
        return success;
    }

    // Mouse + keyboard mapping (OGX-Mini-improved firmware). False when the adapter lacks it.
    async getKbmSettings(kbmSettings) {
        await this.#mutex.lock();
        const buffer = await this.#tryRead(BTManager.UUID.KBM_SETTINGS);
        this.#mutex.unlock();
        return !!buffer && kbmSettings.setFromBytes(buffer);
    }

    // Applied right away, no restart.
    async saveKbmSettings(kbmSettings) {
        await this.#mutex.lock();
        const success = await this.#tryWrite(BTManager.UUID.KBM_SETTINGS, kbmSettings.getBytes());
        this.#mutex.unlock();
        return success;
    }

    #gpTimer = null;
    static #GP_INTERVAL = Object.freeze(100);

    async runGamepadTask(userSettings) {
        this.#gpTimer = setInterval(async () => {
            if (!this.#interface.isConnected()) {
                return;
            }
            if (!(await this.#mutex.tryLock())) {
                return;
            }

            const gamepad = await this.#getGamepad();
            if (!gamepad) {
                this.#mutex.unlock();
                return;
            }

            UI.drawGamepadInput(gamepad, userSettings);

            this.#mutex.unlock();
        }, BTManager.#GP_INTERVAL);
    }

    async stopGamepadTask() {
        await this.#mutex.lock();
        clearInterval(this.#gpTimer);
        this.#mutex.unlock();
    }

    async disconnect() {
        await this.stopGamepadTask();
        await this.#mutex.lock();
        if (this.#interface.isConnected()) {
            await this.#interface.disconnect();
        }
        this.#mutex.unlock();
    }

    async #getGamepad() {
        const buffer = await this.#interface.read(BTManager.UUID.GAMEPAD);
        if (!buffer || buffer.length === 0) {
            console.warn('Failed to read gamepad data');
            return null;
        }

        const gamepad = new Gamepad();
        gamepad.setReportFromBytes(buffer);
        return gamepad;
    }

    async #readProfile(setup, userSettings) {
        async function read() {
            let success = await this.#tryWrite(
                BTManager.UUID.SETUP_READ,
                new Uint8Array(Object.values(setup))
            );
            if (!success) {
                console.warn('Failed to write setup packet');
                return false;
            }

            let bufferIn = new Uint8Array(UserSettings.PROFILE_LENGTH);
            let offset = 0;

            while (offset < UserSettings.PROFILE_LENGTH) {
                const chunk = await this.#tryRead(BTManager.UUID.PROFILE);
                if (!chunk || chunk.length === 0) {
                    console.warn('Failed to read profile chunk');
                    return false;
                }

                const copyLen = Math.min(chunk.length, UserSettings.PROFILE_LENGTH - offset);
                bufferIn.set(chunk.subarray(0, copyLen), offset);
                offset += copyLen;
            }
            return bufferIn;
        };

        await this.#mutex.lock();

        const bufferIn = await read.bind(this)();
        if (!bufferIn) {
            this.#mutex.unlock();
            return false;
        }

        userSettings.setProfileFromBytes(bufferIn);  
        console.log('Profile read, ID:', userSettings.profile.profileId);
        this.#mutex.unlock();
        return true;
    }

    async #tryWrite(uuid, data) {
        const maxRetries = 4;
        let retries = 0;
        let success = false;
        while (retries < maxRetries) {
            success = await this.#interface.write(uuid, data);
            if (success) {
                return true;
            }
            retries++;
        }
        return false;
    }

    async #tryRead(uuid) {
        const maxRetries = 4;
        let retries = 0;
        let buffer = null;
        while (retries < maxRetries) {
            buffer = await this.#interface.read(uuid);
            if (buffer) {
                return buffer;
            }
            retries++;
        }
        return null;
    }

    async #sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export const BT = {

    async connect() {
        const userSettings = new UserSettings();
        UI.init(userSettings);
        const dongleSettings = new DongleSettings();
        UIDongle.init(dongleSettings);
        UISearch.init(dongleSettings);
        const kbmSettings = new KbmSettings();
        UIKbm.init(kbmSettings);
        const btManager = new BTManager();

        try {
            UI.connectButtonsEnabled(false);

            if (!(await btManager.init())) {
                throw new Error('Failed to connect to Bluetooth device');
            }

            await btManager.getSetup(userSettings);
            await btManager.getProfileByIdx(userSettings);
            if (await btManager.getDongleSettings(dongleSettings)) {
                UIDongle.update(dongleSettings);
                UIDongle.setAvailable(true);
            } else {
                ModeView.setFirmwareWarning(true);  // older firmware: warn what will not work as expected
            }
            if (await btManager.getKbmSettings(kbmSettings)) {
                UIKbm.update(kbmSettings);
                UIKbm.setAvailable(true);
            }

            UI.updateAll(userSettings);
            UI.toggleConnected(true);
            UI.setSubheaderText("Settings");

            UI.addCallbackLoadProfile(async () => {
                await btManager.getProfileById(userSettings);
                UI.updateAll(userSettings);
            }, userSettings);

            UI.addCallbackSaveProfile(async () => {
                console.log('Saving profile...', userSettings.profile);
                await btManager.saveProfile(userSettings);
            }, userSettings);

            UIDongle.addCallbackSave(async () => {
                await btManager.saveDongleSettings(dongleSettings);
            });
            UIDongle.initModeCombo(dongleSettings, async (bytes) => {
                await btManager.saveDongleBytes(bytes);
            });
            UISearch.update(dongleSettings);

            UIKbm.addCallbackSave(async () => {
                UIKbm.setStatus("Saving...");
                const saved = await btManager.saveKbmSettings(kbmSettings);
                UIKbm.setStatus(saved ? `Saved (${new Date().toLocaleTimeString()}).` : "Saving failed.");
            });

            // Mouse + Keyboard mode: the mapping is the profile (Save / Reload / Load Defaults).
            UI.setKbmHandlers({
                save: async () => {
                    UIKbm.setStatus("Saving...");
                    const saved = await btManager.saveKbmSettings(kbmSettings);
                    UIKbm.setStatus(saved ? `Saved (${new Date().toLocaleTimeString()}).` : "Saving failed.");
                },
                reload: async () => {
                    if (await btManager.getKbmSettings(kbmSettings)) {
                        UIKbm.update(kbmSettings);
                        UIKbm.setStatus(`Mapping read from the adapter (${new Date().toLocaleTimeString()}).`);
                    }
                },
                defaults: () => {
                    kbmSettings.restoreDefaults();
                    UIKbm.update(kbmSettings);
                    UIKbm.setStatus("Default layout loaded; Save Profile stores it.");
                },
            });

            UI.addCallbackDisconnect(async () => {
                btManager.disconnect();
                UI.toggleConnected(false);
                window.location.reload();
            });

            btManager.runGamepadTask(userSettings);

        } catch (error) {
            console.warn('Connection error:', error);
            UI.toggleConnected(false);
            await btManager.disconnect();
            window.location.reload();
        }
    } 
};