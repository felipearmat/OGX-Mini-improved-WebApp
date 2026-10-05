# OGX-Mini-improved WebApp

Web app for changing the settings of an OGX-Mini adapter running the
[OGX-Mini-improved](https://github.com/felipearmat/OGX-Mini-improved) firmware.
Fork of [MegaCadeDev/OGX-Mini-2026-WebApp](https://github.com/MegaCadeDev/OGX-Mini-2026-WebApp).

**Online:** https://felipearmat.github.io/OGX-Mini-improved-WebApp/

## What this fork adds

- **Adapter Options**: dongle-wide settings stored on the adapter. The firmware build sets
  the defaults; this panel changes them. Saving restarts the adapter.
  - Turn off controllers before mode change
  - Joy-Con pair: motion from the right or the left Joy-Con
  - Joy-Con pair orientation (vertical / horizontal)
  - Single Joy-Con orientation (vertical / horizontal)
  - Use a MAC address per controller (PS4 / STEAM modes)
  - Legacy PS4 motion scale (Brook auth adapters)
  - Single controller (a lone Joy-Con does not wait for its other half)

  The panel appears only when the adapter's firmware supports it.
- **Mouse + Keyboard Mode**: what each controller input sends in the firmware's mouse + keyboard
  output mode — any key (with Ctrl / Shift / Alt / Win held), a mouse button or a media key; each
  stick as pointer, scroll, arrow keys or WASD; pointer / scroll speed, deadzone, acceleration,
  touchpad as pointer. Saving applies it right away (no restart);
  *Restore defaults* goes back to the firmware's layout.
- Output modes added to the list: Wii U, PS4, STEAM (DualSense), Mouse + Keyboard.

Everything else (profiles, stick and trigger settings, button mappings) works as in the
original web app, with original OGX-Mini firmware too.

## Run it locally

The page is static; there is nothing to build. Serve the folder and open it in a
Chromium-based browser (Chrome, Edge, Brave): WebUSB, Web Serial and Web Bluetooth need one,
and a secure context, which `localhost` is.

```sh
./serve.sh          # http://localhost:8000
./serve.sh 8080     # another port
```

On Windows, `start.bat` does the same.

## Connecting

- **USB**: plug the adapter in and hold **Start + Left Bumper + Right Bumper** for 3 seconds to
  enter web app mode, then click **Connect via USB**.
- **Bluetooth** (Pico W / Pico 2 W): click **Connect via Bluetooth** and pick the adapter.

## Protocol notes (Adapter Options)

8 bytes: a version byte (1), then one byte per option (0 / 1), in the order listed above.
USB: packets `GET_DONGLE_SETTINGS` (0x70) and `SET_DONGLE_SETTINGS` (0x71). Bluetooth:
characteristic `12345678-1234-1234-1234-123456789060` (read / write). Firmware side:
`Firmware/RP2040/src/Custom/DongleSettings.h`.

## Protocol notes (Mouse + Keyboard Mode)

48 bytes: a version byte (1), a 2-byte action per input (type in the high nibble and Ctrl /
Shift / Alt / Win in the low nibble of the first byte, then the key usage, mouse button or media
key index), the two stick modes, pointer speed, scroll speed, deadzone, flags and 5 reserved
bytes. USB: packets `GET_KBM_SETTINGS` (0x72) and `SET_KBM_SETTINGS` (0x73, answered
with the stored settings). Bluetooth: characteristic `12345678-1234-1234-1234-123456789070`
(read / write, long reads and writes). Firmware side: `Firmware/RP2040/src/Custom/KbmSettings.h`.
