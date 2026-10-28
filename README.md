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
  - Joy-Con pair compatibility: rumble per side (as SDL / Steam) or on both Joy-Cons, in every mode but Switch (there the pair plays the game's HD Rumble as on a Switch)
  - Status LEDs on / off (the Pico's own, an external RGB LED on the Pico, the RP2040 + ESP32
    adapter's ESP32 LED and its external RGB LED) and the RGB LEDs' brightness
  - Single controller (firmware from before the Bluetooth search times only)

  Options the adapter's hardware can't use (the Joy-Con options on a wired-only adapter, the
  transmit power in Bluetooth config on a Pico W) are greyed out, with a note on hover.

  The panel appears only when the adapter's firmware supports it.
- **Bluetooth config** (its own section, before Diagnostics): how long the adapter keeps
  searching for new controllers once one is connected, while a slot is open (a lone Joy-Con,
  free slots) — full search (0-600 s, default 60), then reduced search at about 10% (0-600 s or
  no limit, the default); both 0 = no search with a controller connected; the idle turn-off time;
  and *Extended range (uses more power)* (RP2040 + ESP32 adapter: +9 dBm instead of +3 dBm).
  Saved by itself a moment after the last change and applied without a restart, like *Mode
  Enabled*.
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
  accident. D-Input/Debug, where the web app connects, is always on. Stored in the Adapter Options
  record, bytes 12-15 (bit mask by mode).
- **Touchpad and Motion** (USB; PS4, STEAM, Mouse + Keyboard and D-Input/Debug modes; first section of the
  page): the DS4 / DualSense touchpad as the adapter reads it, a green ball per finger, and the
  *Touchpad press* mapping row, lit while pressed. PS4, STEAM and Mouse + Keyboard modes send the
  press as the touchpad's own (in STEAM mode it was also Mute before the 2026-10-27 firmware); the
  other modes send it as the Misc button, so the row is the Misc mapping (also listed as "Misc
  (Capture; touchpad press without a touchpad)" in Digital Mappings). USB packet `GP_TOUCH`
  (0x82), sent after each live input packet while the pad reports its touchpad: two touch points
  of 4 bytes as the pads send them, then the click byte.
  Below it, **Motion**: a box that turns with the controller (gyro integrated, levelled by gravity;
  *Start*, *Recentre*), with the accelerometer (g) and gyro (deg/s) readouts. With firmware that
  has the capability `MOTION_STREAM` it takes the USB packet `GP_MOTION` (0x83), sent with each live
  input: motion source (u8), accel in mg and gyro in deg/s x10 (i16 x3 each, the common frame: X
  right, Y out of the face, Z toward the player), the adapter's time in ms (u32). Older firmware:
  the diagnostics report's `motion` block, asked for again as each answer arrives.
- **Live input in the mappings**: each mapping row (D-pad, buttons, analog, Mouse + Keyboard)
  lights up green while its controller input is pressed — the controller's own button, whatever it
  is mapped to (OGX-Mini-improved firmware sends unmapped input in D-Input/Debug mode while the web app is open).
- **Axis Settings, two dots**: with firmware that has the capability `RAW_LIVE_INPUT` (it sends
  the sticks and triggers without the profile's stick / trigger settings while the web app is
  open), each stick shows an orange dot where the controller is and a blue one with the settings
  being edited applied (what the game gets), and each trigger an orange and a blue mark, all the
  time; the old *Preview* boxes are gone. With older firmware, one dot as the input arrives.
- **Rumble Test** (USB): plays a rumble on the connected controller the way a game asks for it —
  left (strong) motor, right (weak) motor or both, at a chosen strength (5-100 %) for a chosen time
  (0.1-5 s), plus Stop. USB packet `SET_GP_OUT` (0x81): left, right, duration in ms (uint16 LE);
  the adapter answers with an empty `SET_GP_OUT`. Not over Bluetooth: the adapter stops BLE
  advertising while a Bluetooth Classic controller (Joy-Con, DS4...) is connected. Shown only for
  device modes that pass a game's rumble to the controller (Xbox OG, Steel Battalion, XInput, PS3,
  Switch, PS4, STEAM, and D-Input/Debug itself).
- **Diagnostics** (USB, D-Input/Debug mode): what the adapter measures for each controller — link
  (Bluetooth Classic / LE interval, Bluetooth version, wired or 2.4 GHz receiver), reports per
  second, late and lost reports, largest gap, signal and radio channels in use — and the summary
  of the session before the switch to D-Input/Debug mode. **Generate log report** saves a JSON file
  (the adapter's report plus the browser and the web app's view of the settings) to send when
  asking for help. Shown only when the firmware answers (OGX-Mini-improved v1.1.0 or later).
  Options there: *Keep the log in flash*, then *Detailed controller diagnostics*, indented below it
  and greyed out while the log in flash is off (the advanced report is kept there).
- **Mode colour**: below the colour wheel, a box with the colour code (`#RRGGBB`) — it follows the
  wheel, and a code typed in moves the wheel's marker (and shows on the adapter while you pick).
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
./serve.sh          # http://localhost:8000 (answers with Cache-Control: no-store, so a change shows on reload)
./serve.sh 8080     # another port
```

On Windows, `start.bat` does the same.

## Tests

```sh
npm test            # unit and contract tests: Node 20+, no dependencies (node:test)
npm ci && npx playwright install chromium
npm run e2e         # end-to-end tests (Playwright, Chromium)
```

`tests/contract.test.js` checks the page's constants (packet IDs, mode values, capability bits,
the Adapter Options record and how every older version reads, the default colours) against
`tests/contract/webapp_contract.json`, a copy of the file the firmware writes from its own code
(`Firmware/common/contract/webapp_contract.json` in OGX-Mini-improved). CI fails when the copy
differs from the firmware's: copy the new file and follow the change. The other tests cover the
Adapter Options record (live saves change only the live options, never on top of an unread
record) and the mode colours.

The end-to-end tests (`e2e/`) run the page in Chromium against the firmware's **virtual adapter**:
the firmware's own web app protocol and settings code built for the computer
(`Firmware/RP2040/tests/virtual_adapter` in OGX-Mini-improved, see its `docs/TESTING.md`), with
`navigator.serial` replaced by a port wired to that process (`e2e/fakeSerial.js`). A restart of the
adapter is a USB disconnect for the page, and the adapter comes back with its settings, as the
board does. They cover connecting, profiles saved across a restart, a mode change away from
D-Input/Debug and its combo back, live options without a restart, an option that needs one, the
status LEDs (saved with Adapter Options, across the restart) and mode colours, the colour code box
(checked on the adapter's LED), the motion view's live stream, the mouse + keyboard mapping and the
diagnostics panel and report.

The setup builds the virtual adapter from `../OGX-Mini-improved` (CMake and a C++20 compiler; the
`libfixmath` and `tinyusb` submodules); `OGXM_FIRMWARE_DIR` names another checkout and
`OGXM_VIRTUAL_ADAPTER` an already built binary. CI runs them against the firmware's master, and the
firmware's CI runs them against this repository's master.

## Connecting

- **USB**: plug the adapter in and hold **Start + Right Bumper + D-pad Left** for 3 seconds to
  enter D-Input/Debug mode, then click **Connect via USB**.
- **Bluetooth** (Pico W / Pico 2 W): click **Connect via Bluetooth** and pick the adapter.

## Protocol notes (Adapter Options)

24 bytes: a version byte (7), then one byte per option (0 / 1) in bytes 1-6 and 8 (byte 7 is
unused); bytes 9-11 hold the two search times as 12-bit second counts (full = bits 0-11,
reduced = bits 12-23, 4095 = no limit); bytes 12-15 the mode combo mask; byte 16 the idle
turn-off time (minutes, 0 = never; version 4); byte 17 the higher transmit power (version 5);
bytes 18-21 the status LEDs (Pico, Pico external, ESP32, ESP32 external) and byte 22 the RGB
LEDs' brightness (0 = the default, 48; version 6), shown in Adapter Options and saved with its
button (the adapter restarts, so the hybrid's ESP32 starts with them); byte 23 keeps the log in
flash too (version 7, Diagnostics panel).
Older firmware answers with version 6 (23 bytes), 5 (18 bytes), 4 (17 bytes), 3 (16 bytes), 2 (byte 7 = single
controller, no search times) or 1 (the first 8 bytes); the page then shows only those options and
saves in that format.
USB: packets `GET_DONGLE_SETTINGS` (0x70) and `SET_DONGLE_SETTINGS` (0x71). Bluetooth:
characteristic `12345678-1234-1234-1234-123456789060` (read / write). Firmware side:
`Firmware/RP2040/src/Custom/DongleSettings.h`.

## Connection messages

When a connection fails, the page says why after it reloads (the USB port in use by another tab or
program, a browser without Web Serial / Web Bluetooth, the error text otherwise); closing the port
chooser is not an error. Once connected over USB, the subheader shows the adapter's board
(`OGXM_BOARD`). When the adapter does not answer the newer requests, a note says its firmware may be
older or that it is not in D-Input/Debug mode.

## Update check

On connecting, the page compares the adapter's version with the latest release of
[felipearmat/OGX-Mini-improved](https://github.com/felipearmat/OGX-Mini-improved/releases) (GitHub
API, cached for an hour). The notice always shows the running firmware ("Your firmware is:", and
the ESP32's on an RP2040 + ESP32 adapter) and, when a newer release exists, the file for this board
(and the ESP32's zip). Offline, only the running firmware is shown. USB: packet `GET_VERSION` (0x77), NUL-separated version, board and ESP32 version.
Bluetooth: the firmware version characteristic (`...9020`).

## Protocol notes (Capabilities)

What the adapter's hardware supports, 32 bits little-endian (firmware
`Firmware/common/UserSettings/Capabilities.h`): Bluetooth, RP2040 + ESP32, higher transmit power,
Joy-Con options, MAC per controller, turn off before a mode change, search times, idle turn-off,
USB host port, web app over Bluetooth. USB: packet `GET_CAPABILITIES` (0x76). Bluetooth: the 4
bytes after the Adapter Options record. Older firmware sends neither; every option is then shown.

## Protocol notes (Diagnostics)

USB packet `GET_DIAGNOSTICS` (0x74, one byte of payload). The adapter answers with a JSON text
in up to 255 chunks of 55 bytes (`chunks_total` / `chunk_idx` in the header). On an RP2040 +
ESP32 adapter the report also has `companion` (the ESP32's firmware, uptime, transmit power,
I2C errors) and, per controller, `esp32_reports_per_s` / `esp32_lost_reports_pct` (measured on
the ESP32: losses there are the radio's, the rest between the boards). Firmware side:
`Firmware/RP2040/src/Custom/Diagnostics.h`.

## Protocol notes (Mouse + Keyboard Mode)

48 bytes: a version byte (1), a 2-byte action per input (type in the high nibble and Ctrl /
Shift / Alt / Win in the low nibble of the first byte, then the key usage, mouse button or media
key index), the two stick modes, pointer speed, scroll speed, deadzone, flags and 5 reserved
bytes. USB: packets `GET_KBM_SETTINGS` (0x72) and `SET_KBM_SETTINGS` (0x73, answered
with the stored settings). Bluetooth: characteristic `12345678-1234-1234-1234-123456789070`
(read / write, long reads and writes). Firmware side: `Firmware/RP2040/src/Custom/KbmSettings.h`.
