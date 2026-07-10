#!/usr/bin/env python3
"""GerainaOS Printer Bridge -- run this on the same PC as your network thermal printer.

Why this exists: GerainaOS runs in your browser and its backend runs in the cloud. Neither
can open a direct network connection to a thermal printer sitting on your shop's local Wi-Fi
network (browsers don't allow raw TCP sockets, and the cloud server isn't on your local
network). This tiny bridge solves that: it runs on a PC on your shop's own network, listens
for print requests from your browser, and forwards the print data straight to the printer.

Requirements: Python 3.8+ (already installed on most Windows/Mac/Linux machines). No extra
packages needed -- this uses only Python's standard library.

How to run:
    python bridge.py
It will listen on http://127.0.0.1:9899 by default. Leave the window open while you're using
the till -- if you close it, network printing stops working (local/USB printing via the
browser's own print dialog is unaffected).

How to find your printer's IP and port: check your printer's network settings menu (most
thermal printers have a "self-test" or "network status" print you can trigger with its
buttons) or your router's connected-devices list. The port is almost always 9100 -- that's
the standard raw-socket printing port used by nearly all ESC/POS network thermal printers.
"""
import base64
import json
import os
import socket
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BRIDGE_PORT = int(os.environ.get("GERAINA_BRIDGE_PORT", "9899"))
PRINT_TIMEOUT_SECONDS = 5

# Only allow requests from GerainaOS's own origins -- this bridge accepts a target IP/port
# from the request body and blindly forwards bytes to it, so it should not be reachable by
# arbitrary web pages. Add your own dev origin here if testing locally on a different port.
ALLOWED_ORIGIN_SUFFIXES = (".dagangos.com", "dagangos.com")
ALLOWED_ORIGIN_EXACT = ("http://localhost:3000", "http://127.0.0.1:3000")


def _origin_allowed(origin: str) -> bool:
    if not origin:
        return False
    if origin in ALLOWED_ORIGIN_EXACT:
        return True
    try:
        host = origin.split("://", 1)[1].split(":")[0]
    except Exception:
        return False
    return any(host == s or host.endswith(s) for s in ALLOWED_ORIGIN_SUFFIXES)


class Handler(BaseHTTPRequestHandler):
    def _cors_headers(self):
        origin = self.headers.get("Origin", "")
        if _origin_allowed(origin):
            self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self._cors_headers()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "service": "geraina-printer-bridge"}).encode())
            return
        self.send_response(404)
        self._cors_headers()
        self.end_headers()

    def do_POST(self):
        if self.path != "/print":
            self.send_response(404)
            self._cors_headers()
            self.end_headers()
            return

        origin = self.headers.get("Origin", "")
        if not _origin_allowed(origin):
            self._respond(403, {"ok": False, "error": f"Origin not allowed: {origin or '(none)'}"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(length)
            payload = json.loads(body or b"{}")
            ip = str(payload.get("ip") or "").strip()
            port = int(payload.get("port") or 9100)
            data_b64 = payload.get("data_base64")
            if not ip or not data_b64:
                self._respond(400, {"ok": False, "error": "ip dan data_base64 wajib diisi"})
                return
            raw = base64.b64decode(data_b64)
        except Exception as e:
            self._respond(400, {"ok": False, "error": f"Payload tidak valid: {e}"})
            return

        try:
            with socket.create_connection((ip, port), timeout=PRINT_TIMEOUT_SECONDS) as sock:
                sock.sendall(raw)
            self._respond(200, {"ok": True, "bytes_sent": len(raw)})
        except Exception as e:
            self._respond(502, {"ok": False, "error": f"Gagal konek ke printer {ip}:{port} -- {e}"})

    def _respond(self, status: int, obj: dict):
        self.send_response(status)
        self._cors_headers()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(obj).encode())

    def log_message(self, fmt, *args):
        print(f"[printer-bridge] {self.address_string()} - {fmt % args}")


def main():
    server = ThreadingHTTPServer(("127.0.0.1", BRIDGE_PORT), Handler)
    print(f"GerainaOS Printer Bridge listening on http://127.0.0.1:{BRIDGE_PORT}")
    print("Keep this window open while using network printing. Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping printer bridge.")


if __name__ == "__main__":
    main()
