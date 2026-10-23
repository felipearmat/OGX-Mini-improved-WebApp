#!/usr/bin/env sh
# Serve the web app locally: http://localhost:8000
# The page is static (no build step). WebUSB / Web Serial / Web Bluetooth only work in a secure
# context, which includes localhost, and need a Chromium-based browser (Chrome, Edge, Brave).
# Every answer says "Cache-Control: no-store": Chrome kept old copies of the JavaScript modules
# (imported files) even after Ctrl + Shift + R, so a change did not show up.
# It listens on 127.0.0.1 and ::1: "localhost" may resolve to either (this machine only).
cd "$(dirname "$0")" || exit 1
PORT="${1:-8000}"
echo "OGX-Mini-improved web app: http://localhost:${PORT}"
exec python3 -c '
import http.server, socket, sys, threading
class NoStore(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
class V6(http.server.ThreadingHTTPServer):
    address_family = socket.AF_INET6
port = int(sys.argv[1])
try:
    v6 = V6(("::1", port), NoStore)
    threading.Thread(target=v6.serve_forever, daemon=True).start()
except OSError as error:
    print(f"IPv6 localhost not served ({error})")
http.server.ThreadingHTTPServer(("127.0.0.1", port), NoStore).serve_forever()
' "${PORT}"
