import { UserSettings } from "./modules/userSettings.js";
import { USB } from './modules/com/usbSerial.js';
import { BT } from './modules/com/bluetooth.js';
import { ConnectError } from './modules/connectError.js';

document.addEventListener("DOMContentLoaded", () => {
    ConnectError.showPending();  // why the last connection failed, if it did

    document.getElementById('connectUsb').addEventListener('click', async () => {
        await USB.connect();
    });

    document.getElementById('connectBt').addEventListener('click', async () => {
        await BT.connect();
    });
});