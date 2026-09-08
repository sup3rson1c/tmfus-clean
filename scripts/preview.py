#!/usr/bin/env python3
"""Look at the site on this machine, with the chat working.

    python scripts/preview.py

Then open http://127.0.0.1:8777 and click around. Ctrl+C stops it.

WHY THIS EXISTS. A plain `python -m http.server` serves the HTML fine, but
every page also talks to PHP, and there is no PHP on this machine. The chat
widget asks `api/chat.php?status=1` whether chat is switched on, gets a 404,
and hides itself. So the one thing you most want to look at is the one thing
you cannot see. This answers those calls with the same shapes the real
endpoints return, in leave-a-message mode.

WHAT IS FAKE. Only the server side. The HTML, CSS and JavaScript are the real
files straight off disk, so what you see is what deploys.

    api/chat.php     always on, always leave-a-message, every send marks the
                     visitor waiting. No Telegram alert and no email: nothing
                     you do here reaches a real phone or inbox.
    api/lead.php     always accepts. Nothing is written anywhere.

Applications, uploads and the Figure endpoint are not stubbed. Those pages
render, but submitting on them will fail, which is correct — they need real
encryption keys.

    --closed    pretend it is outside working hours, so you can see what the
                chat says at 2am without waiting until 2am.
    --port N    use a different port if 8777 is busy.
"""

import argparse
import io
import json
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

FAKE_REPLY = (
    "Thanks - that has reached us and a rep is being paged now. "
    "Leave the best number to reach you on and we will use that if the chat drops."
)


class Handler(SimpleHTTPRequestHandler):
    closed = False

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urlparse(self.path)

        # --closed rewrites the open days to none on the way out, so the
        # out-of-hours branch runs against the real shipped code rather than
        # a copy of it. The file on disk is never touched.
        if Handler.closed and u.path == "/assets/app.js":
            js = io.open(os.path.join(ROOT, "assets", "app.js"), encoding="utf-8").read()
            js = js.replace("days: [1, 2, 3, 4, 5],", "days: [],", 1)
            b = js.encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript; charset=utf-8")
            self.send_header("Content-Length", str(len(b)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(b)
            return

        if u.path == "/api/chat.php":
            q = parse_qs(u.query)
            if "status" in q:
                return self._json({"ok": True, "enabled": True, "mode": "message"})
            if "selftest" in q:
                return self._json({"ok": False, "config": "found (preview stub)",
                                   "chat": "switched on", "agent": "none"})

        # Clean URLs, so /heloc-calculator works here the way it does live.
        if u.path != "/" and "." not in os.path.basename(u.path):
            guess = os.path.join(ROOT, u.path.lstrip("/") + ".html")
            if os.path.isfile(guess):
                self.path = u.path + ".html"

        return super().do_GET()

    def do_POST(self):
        u = urlparse(self.path)
        n = int(self.headers.get("Content-Length") or 0)
        try:
            body = json.loads((self.rfile.read(n) if n else b"{}").decode() or "{}")
        except Exception:
            body = {}
        action = body.get("action")

        if u.path == "/api/chat.php":
            if action == "start":
                return self._json({"ok": True, "session": "preview", "mode": "message"})
            if action == "send":
                return self._json({"ok": True, "human": False, "messages": [
                    {"role": "assistant", "text": FAKE_REPLY, "at": ""}]})
            if action == "poll":
                return self._json({"ok": True, "human": False, "waiting": True,
                                   "messages": [], "total": 0})
            return self._json({"ok": True})

        if u.path == "/api/lead.php":
            print("  [preview] lead received:", json.dumps(body.get("data", {}))[:300])
            return self._json({"ok": True, "stored": True})

        return self._json({"ok": False, "error": "not stubbed in preview"}, 404)

    def log_message(self, *a):
        pass


def main():
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("--port", type=int, default=8777)
    ap.add_argument("--closed", action="store_true",
                    help="pretend it is outside working hours")
    args = ap.parse_args()
    Handler.closed = args.closed

    try:
        srv = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    except OSError as e:
        print("Could not start on port %d: %s" % (args.port, e))
        print("Something else is using it. Try:  python scripts/preview.py --port 8788")
        return 1

    print("")
    print("  Preview running.  Open this in your browser:")
    print("")
    print("      http://127.0.0.1:%d" % args.port)
    print("")
    print("  Chat is stubbed%s. Nothing here reaches a real phone or inbox." %
          (" (pretending to be out of hours)" if args.closed else ""))
    print("  Press Ctrl+C to stop.")
    print("")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
