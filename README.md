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
  - Joy-Con pair rumble: per side (as SDL / Steam) or both Joy-Cons
  - Single controller (firmware from before the Bluetooth search times only)

  The panel appears only when the adapter's firmware supports it.
- **Bluetooth search** (its own section, before Diagnostics): how long the adapter keeps
  searching for new controllers once one is connected, while a slot is open (a lone Joy-Con,
  free slots) — full search (0-600 s, default 60), then reduced search at about 10% (0-600 s or
  no limit, the default); both 0 = no search with a controller connected. Saved by itself a
  moment after the last change and applied without a restart, like *Mode Enabled*.
- **Mouse + Keyboard Mode**: what each controller input sends in the firmware's mouse + keyboard
  output mode — any key (with Ctrl / Shift / Alt / Win held), a mouse button or a media key; each
  stick as pointer, scroll, arrow keys or WASD; pointer / scroll speed, deadzone, acceleration,
  touchpad as pointer. It is the profile of that mode: with *Mouse + Keyboard* selected as the
  device mode, it replaces the axis and button mappings, *Save Profile* stores it (and switches the
  adapter to that mode, as for any mode), *Reload Profile* reads it back and *Load Defaults* goes
  back to the firmware's layout.
- **Mode combos on / off**: *Mode Enabled* under the Device Mode dropdown turns the selected
  mode's button combo on or off (saved by itself a moment after the last change, no restart; the
  combo itself is shown below it), so a game's button chords cannot switch the adapter by
  accident. The Web App mode combo is always on. Stored in the Adapter Options
  record, bytes 12-15 (bit mask by mode).
- **Touchpad** (USB; PS4, STEAM, Mouse + Keyboard and Web App modes; first section of the
  page): the DS4 / DualSense touchpad as the adapter reads it, a green ball per finger, and the
  *Touchpad press* mapping row. The press is the Misc button (also listed as "Misc / Touchpad
  press" in Digital Mappings), so it can be mapped like the other buttons and lights up while
  pressed. USB packet `GP_TOUCH`
  (0x82), sent after each live input packet while the pad reports its touchpad: two touch points
  of 4 bytes as the pads send them, then the click byte.
- **Live input in the mappings**: each mapping row (D-pad, buttons, analog, Mouse + Keyboard)
  lights up green while its controller input is pressed — the controller's own button, whatever it
  is mapped to (OGX-Mini-improved firmware sends unmapped input in Web App mode).
- **Rumble Test** (USB): plays a rumble on the connected controller the way a game asks for it —
  left (strong) motor, right (weak) motor or both, at a chosen strength (5-100 %) for a chosen time
  (0.1-5 s), plus Stop. USB packet `SET_GP_OUT` (0x81): left, right, duration in ms (uint16 LE);
  the adapter answers with an empty `SET_GP_OUT`. Not over Bluetooth: the adapter stops BLE
  advertising while a Bluetooth Classic controller (Joy-Con, DS4...) is connected. Shown only for
  device modes that pass a game's rumble to the controller (Xbox OG, Steel Battalion, XInput, PS3,
  Switch, PS4, STEAM, and Web App itself).
- **Diagnostics** (USB, Web App mode): what the adapter measures for each controller — link
  (Bluetooth Classic / LE interval, Bluetooth version, wired or 2.4 GHz receiver), reports per
  second, late and lost reports, largest gap, signal and radio channels in use — and the summary
  of the session before the switch to Web App mode. **Generate log report** saves a JSON file
  (the adapter's report plus the browser and the web app's view of the settings) to send when
  asking for help. Shown only when the firmware answers (OGX-Mini-improved v1.1.0 or later).
- Output modes added to the list: Wii U, PS4, STEAM (DualSense), Mouse + Keyboard.

Everything else (profiles, stick and trigger settings, button mappings) works as in the
original web app, with original OGX-Mini firmware too.
With firmware that does not answer with its dongle settings (it predates these features), a
warning at the top of the settings lists what will not work as expected and advises updating the
adapter's firmware.

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

16 bytes: a version byte (3), then one byte per option (0 / 1) in bytes 1-6 and 8 (byte 7 is
unused); bytes 9-11 hold the two search times as 12-bit second counts (full = bits 0-11,
reduced = bits 12-23, 4095 = no limit); bytes 12-15 the mode combo mask. Older firmware answers
with version 2 (byte 7 = single controller, no search times) or 1 (the first 8 bytes); the page
then shows only those options and saves in that format.
USB: packets `GET_DONGLE_SETTINGS` (0x70) and `SET_DONGLE_SETTINGS` (0x71). Bluetooth:
characteristic `12345678-1234-1234-1234-123456789060` (read / write). Firmware side:
`Firmware/RP2040/src/Custom/DongleSettings.h`.

## Protocol notes (Diagnostics)

USB packet `GET_DIAGNOSTICS` (0x74, one byte of payload). The adapter answers with a JSON text
in up to 255 chunks of 55 bytes (`chunks_total` / `chunk_idx` in the header). Firmware side:
`Firmware/RP2040/src/Custom/Diagnostics.h`.

## Protocol notes (Mouse + Keyboard Mode)

48 bytes: a version byte (1), a 2-byte action per input (type in the high nibble and Ctrl /
Shift / Alt / Win in the low nibble of the first byte, then the key usage, mouse button or media
key index), the two stick modes, pointer speed, scroll speed, deadzone, flags and 5 reserved
bytes. USB: packets `GET_KBM_SETTINGS` (0x72) and `SET_KBM_SETTINGS` (0x73, answered
with the stored settings). Bluetooth: characteristic `12345678-1234-1234-1234-123456789070`
(read / write, long reads and writes). Firmware side: `Firmware/RP2040/src/Custom/KbmSettings.h`.
