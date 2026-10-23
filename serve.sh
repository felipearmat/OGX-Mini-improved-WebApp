#!/usr/bin/env sh
# Serve the web app locally: http://localhost:8000
# The page is static (no build step). WebUSB / Web Serial / Web Bluetooth only work in a secure
# context, which includes localhost, and need a Chromium-based browser (Chrome, Edge, Brave).
# Every answer says "Cache-Control: no-store": Chrome kept old copies of the JavaScript modules
# (imported files) even after Ctrl + Shift + R, so a change did not show up.
cd "$(dirname "$0")" || exit 1
PORT="${1:-8000}"
echo "OGX-Mini-improved web app: http://localhost:${PORT}"
exec python3 -c '
import http.server, sys
class NoStore(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), NoStore).serve_forever()
' "${PORT}"
