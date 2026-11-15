# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = ["mflux==0.24.0"]
# ///
"""
Makes recipe pictures with FLUX 3 Image Klein on this Mac (MLX, through mflux).

It loads the model once, then reads one JSON request per line on stdin and answers with one JSON
line on stdout:

    {"id": "abc", "prompt": "...", "width": 1024, "height": 768, "seed": 7, "out": "/tmp/abc.png"}
    {"id": "abc", "path": "/tmp/abc.png", "seconds": 31.2}      # or {"id": "abc", "error": "..."}

The app's LocalFluxImageGenerator starts it with `uv run`, so nobody installs anything by hand.
Logs go to stderr, so stdout carries only answers. Set FLUX_LOCAL_MODEL to use another build
(default: the 8-bit community build, about 10 GB, downloaded on first use).
"""

import json
import os
import sys
import time

MODEL = os.environ.get("FLUX_LOCAL_MODEL", "mflux-community/flux-3-image-klein-mflux-q8")


def log(message: str) -> None:
    print(f"[flux-worker] {message}", file=sys.stderr, flush=True)


def answer(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload) + "\n")
    sys.stdout.flush()


def load_model():
    from mflux.models.common.config.model_config import ModelConfig
    from mflux.models.flux3.variants import Flux3Klein

    started = time.time()
    log(f"loading {MODEL}")
    model = Flux3Klein(
        model_config=ModelConfig.from_name(model_name=MODEL, base_model="flux3-image-klein"),
        model_path=MODEL,
    )
    log(f"ready in {time.time() - started:.1f}s")
    return model


def main() -> None:
    model = load_model()
    answer({"ready": True, "model": MODEL})
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        request = {}
        try:
            request = json.loads(line)
            width = int(request.get("width", 1024)) // 16 * 16
            height = int(request.get("height", 768)) // 16 * 16
            started = time.time()
            image = model.generate_image(
                seed=int(request.get("seed", 0)),
                prompt=request["prompt"],
                width=width,
                height=height,
            )
            image.save(path=request["out"], export_json_metadata=False)
            answer({"id": request["id"], "path": request["out"], "seconds": round(time.time() - started, 1)})
        except Exception as error:  # one bad request must not stop the batch
            log(f"failed: {error!r}")
            answer({"id": request.get("id"), "error": str(error)})


if __name__ == "__main__":
    main()
