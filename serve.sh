#!/usr/bin/env sh
# Serve the web app locally: http://localhost:8000
# The page is static (no build step). WebUSB / Web Serial / Web Bluetooth only work in a secure
# context, which includes localhost, and need a Chromium-based browser (Chrome, Edge, Brave).
cd "$(dirname "$0")" || exit 1
PORT="${1:-8000}"
echo "OGX-Mini-improved web app: http://localhost:${PORT}"
exec python3 -m http.server "${PORT}" --bind 127.0.0.1
