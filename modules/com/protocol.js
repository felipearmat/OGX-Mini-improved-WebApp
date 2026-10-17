/*  The USB packet IDs (OGX-Mini-improved firmware, Firmware/common/UserSettings/WebAppProtocol.h).
 *  Checked against the firmware's contract file by tests/contract.test.js. */
export const PACKET_ID = Object.freeze({
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
    GET_CAPABILITIES: 0x76,
    GET_VERSION: 0x77,
    GET_LED_COLORS: 0x78,
    SET_LED_COLORS: 0x79,
    LED_PREVIEW: 0x7A,
    GET_LOG: 0x7B,
    GET_FLASH_LOG: 0x7C,
    SET_GP_IN: 0x80,
    GP_TOUCH: 0x82,
    SET_GP_OUT: 0x81,
    RESP_ERROR: 0xFF
});
