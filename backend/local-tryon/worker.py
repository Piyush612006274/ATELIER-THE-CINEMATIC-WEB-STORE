"""Loopback-only FASHN VTON worker for personal local evaluation."""

from __future__ import annotations

import argparse
import base64
import io
import json
import os
import re
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any

from PIL import Image, ImageFile

MAX_IMAGE_BYTES = 12 * 1024 * 1024
MAX_REQUEST_BYTES = 36 * 1024 * 1024
DATA_URL_RE = re.compile(r"^data:(image/(?:jpeg|png|webp|avif));base64,([A-Za-z0-9+/=]+)$", re.I)
Image.MAX_IMAGE_PIXELS = 30_000_000
ImageFile.LOAD_TRUNCATED_IMAGES = False


def decode_image(value: Any) -> Image.Image:
    if not isinstance(value, str):
        raise ValueError("INVALID_IMAGE_DATA")
    match = DATA_URL_RE.fullmatch(value)
    if not match:
        raise ValueError("INVALID_IMAGE_DATA")
    raw = base64.b64decode(match.group(2), validate=True)
    if not raw or len(raw) > MAX_IMAGE_BYTES:
        raise ValueError("IMAGE_TOO_LARGE")
    with Image.open(io.BytesIO(raw)) as image:
        image.load()
        return image.convert("RGB")


def image_data_url(image: Image.Image) -> str:
    output = io.BytesIO()
    image.save(output, format="JPEG", quality=92, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(output.getvalue()).decode("ascii")


def create_handler(pipeline: Any) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        server_version = "AtelierLocalTryOn/1.0"

        def _send(self, status: int, payload: dict[str, Any]) -> None:
            body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self) -> None:  # noqa: N802
            if self.path == "/health":
                self._send(200, {"ok": True, "engine": "fashn-vton-1.5", "mode": "local-evaluation"})
            else:
                self._send(404, {"error": "NOT_FOUND"})

        def do_POST(self) -> None:  # noqa: N802
            if self.path != "/try-on":
                self._send(404, {"error": "NOT_FOUND"})
                return
            try:
                content_length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                self._send(400, {"error": "INVALID_CONTENT_LENGTH"})
                return
            if content_length <= 0 or content_length > MAX_REQUEST_BYTES:
                self._send(413, {"error": "REQUEST_TOO_LARGE"})
                return
            try:
                payload = json.loads(self.rfile.read(content_length))
                person = decode_image(payload.get("personImage"))
                garment = decode_image(payload.get("garmentImage"))
                category = payload.get("category")
                if category not in {"tops", "bottoms", "one-pieces"}:
                    raise ValueError("INVALID_GARMENT_CATEGORY")
                result = pipeline(
                    person_image=person,
                    garment_image=garment,
                    category=category,
                    garment_photo_type="model",
                    num_samples=1,
                    num_timesteps=20,
                    seed=int(payload.get("seed", 42)),
                    segmentation_free=True,
                )
                self._send(200, {"image": image_data_url(result.images[0]), "model": "fashn-vton-1.5"})
            except ValueError as error:
                self._send(400, {"error": str(error)})
            except Exception:
                self.log_error("Local try-on inference failed")
                self._send(500, {"error": "LOCAL_TRY_ON_FAILED"})

        def log_message(self, format: str, *args: Any) -> None:
            print("local-vton:", format % args)

    return Handler


def main() -> None:
    parser = argparse.ArgumentParser(description="Run local FASHN virtual try-on for personal evaluation.")
    parser.add_argument("--weights-dir", default=str(Path(__file__).resolve().parent / "weights"))
    parser.add_argument("--port", type=int, default=8789)
    args = parser.parse_args()
    weights_dir = Path(args.weights_dir).resolve()
    if not (weights_dir / "model.safetensors").is_file():
        raise SystemExit(f"FASHN weights not found at {weights_dir}. Run the upstream download_weights.py first.")

    os.environ.setdefault("OMP_NUM_THREADS", str(max(1, (os.cpu_count() or 4) - 1)))
    from fashn_vton import TryOnPipeline

    pipeline = TryOnPipeline(weights_dir=str(weights_dir), device="cpu")
    server = HTTPServer(("127.0.0.1", args.port), create_handler(pipeline))
    print(f"Local FASHN evaluation worker listening at http://127.0.0.1:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
