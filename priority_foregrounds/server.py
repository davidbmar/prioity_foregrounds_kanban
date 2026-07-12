"""Small localhost server for Priority Foregrounds Kanban."""
from __future__ import annotations

import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import logging
import mimetypes
import os
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from . import __version__
from .rescore import MAX_REQUEST_BYTES, RescoreError, rescore_queue


LOG = logging.getLogger(__name__)
WEB_ROOT = Path(__file__).resolve().parent.parent / "web"
STATIC_FILES = {
    "/": "index.html",
    "/index.html": "index.html",
    "/app.js": "app.js",
    "/styles.css": "styles.css",
}


def _loopback_authorized(headers: Any) -> bool:
    host_header = str(headers.get("Host") or "")
    try:
        hostname = urlsplit(f"//{host_header}").hostname
    except ValueError:
        return False
    if hostname not in {"127.0.0.1", "localhost", "::1"}:
        return False
    origin = str(headers.get("Origin") or "")
    if not origin:
        return True
    try:
        parsed = urlsplit(origin)
    except ValueError:
        return False
    return parsed.scheme in {"http", "https"} and parsed.netloc == host_header


class PriorityHandler(BaseHTTPRequestHandler):
    server_version = "PriorityForegrounds/0.1"

    def log_message(self, format: str, *args: object) -> None:
        LOG.info("%s - %s", self.address_string(), format % args)

    def _security_headers(self, *, content_type: str, length: int) -> None:
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(length))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self'; "
            "img-src 'self' data:; connect-src 'self'; base-uri 'none'; "
            "form-action 'self'; frame-ancestors 'none'",
        )

    def _json(self, payload: dict[str, Any], status: int = 200) -> None:
        body = json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode()
        self.send_response(status)
        self._security_headers(content_type="application/json; charset=utf-8", length=len(body))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _static(self, path: str) -> None:
        relative = STATIC_FILES.get(path)
        if relative is None:
            self.send_error(404, "not found")
            return
        target = WEB_ROOT / relative
        try:
            body = target.read_bytes()
        except FileNotFoundError:
            self.send_error(404, "not found")
            return
        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        if content_type.startswith("text/") or content_type in {
            "application/javascript", "application/json"
        }:
            content_type += "; charset=utf-8"
        self.send_response(200)
        self._security_headers(content_type=content_type, length=len(body))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def do_HEAD(self) -> None:
        self.do_GET()

    def do_GET(self) -> None:
        path = urlsplit(self.path).path
        if path == "/healthz":
            self._json({
                "ok": True,
                "service": "priority-foregrounds-kanban",
                "version": __version__,
                "rescore_enabled": os.environ.get("PRIORITY_RESCORE_ENABLED", "").lower()
                in {"1", "true", "yes", "on"},
            })
            return
        self._static(path)

    def do_POST(self) -> None:
        if urlsplit(self.path).path != "/api/rescore":
            self.send_error(404, "not found")
            return
        if not _loopback_authorized(self.headers):
            self._json({
                "ok": False,
                "error": {"code": "ACCESS_DENIED", "message": "localhost access denied"},
            }, 403)
            return
        if self.headers.get_content_type() != "application/json":
            self._json({
                "ok": False,
                "error": {"code": "INVALID_REQUEST", "message": "Content-Type must be application/json"},
            }, 415)
            return
        try:
            length = int(self.headers.get("Content-Length") or 0)
            if length <= 0:
                raise RescoreError("INVALID_REQUEST", "request body is required")
            if length > MAX_REQUEST_BYTES:
                raise RescoreError(
                    "INVALID_REQUEST",
                    f"request body exceeds {MAX_REQUEST_BYTES} bytes",
                    status=413,
                )
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            result = rescore_queue(body)
        except RescoreError as exc:
            self._json({
                "ok": False,
                "error": {"code": exc.code, "message": str(exc)},
            }, exc.status)
            return
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
            self._json({
                "ok": False,
                "error": {"code": "INVALID_REQUEST", "message": f"invalid JSON: {exc}"},
            }, 400)
            return
        self._json({"ok": True, **result})


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run Priority Foregrounds Kanban")
    parser.add_argument("--host", default=os.environ.get("PRIORITY_HOST", "127.0.0.1"))
    parser.add_argument(
        "--port", type=int, default=int(os.environ.get("PRIORITY_PORT", "8780"))
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    server = ThreadingHTTPServer((args.host, args.port), PriorityHandler)
    server.daemon_threads = True
    print(f"Priority Foregrounds Kanban: http://localhost:{server.server_port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
