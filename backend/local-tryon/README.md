# Local virtual try-on (personal evaluation)

This worker runs FASHN VTON v1.5 on this computer. Images stay on the local machine; it does not call Gemini, RapidAPI, or another inference API. It creates a **still image**, not a live change to the GLB model. Use a clear, front-facing, full-body person image and a clear garment image for best results.

## Machine notes

This computer has a GeForce GT 730 with 4 GB VRAM and 16 GB system RAM. The worker is deliberately set to CPU mode because the GPU is too old/small for dependable inference. The first result can take several minutes or fail if Windows runs out of memory. Close other memory-heavy apps and try one garment at a time.

The current environment was installed with Python 3.12 and CPU PyTorch. The upstream model weights are about 2 GB; the human-parser weights add about 244 MB on first start. Checkpoints and Python packages are ignored by Git and are never committed.

## Install once

The setup has already been started on this machine. If recreating it, use Python 3.12 and run these commands from the repository root:

```powershell
$python = "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
& $python -m venv backend/local-tryon/.venv
& backend/local-tryon/.venv/Scripts/python.exe -m pip install --upgrade pip
& backend/local-tryon/.venv/Scripts/python.exe -m pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision
& backend/local-tryon/.venv/Scripts/python.exe -m pip install -e backend/local-tryon/fashn-vton-1.5 --no-deps safetensors huggingface_hub pillow numpy opencv-python tqdm einops onnxruntime matplotlib fashn-human-parser transformers
& backend/local-tryon/.venv/Scripts/python.exe backend/local-tryon/fashn-vton-1.5/scripts/download_weights.py --weights-dir backend/local-tryon/weights
```

## Run locally

Set these entries in `backend/.env` and restart the backend:

```dotenv
LOCAL_TRYON_ENABLED=true
LOCAL_TRYON_URL=http://127.0.0.1:8789/try-on
```

In a separate PowerShell window, start the worker:

```powershell
& .\backend\local-tryon\start-worker.ps1
```

The worker binds only to `127.0.0.1`. Keep the window open while using Virtual Try-On. The backend sends one person image and one garment image to this local worker at a time.

## Model and license boundary

FASHN VTON v1.5 code and main weights are Apache-2.0. Its default `fashn-human-parser` component inherits NVIDIA's SegFormer license, which restricts that component to non-commercial research/evaluation. This setup is therefore for the owner's private evaluation only. Do not expose this worker to shoppers or deploy it for commercial customer previews without replacing/licensing the restricted parser and reviewing all model/data terms. The local worker is disabled in production mode.

The model accepts `tops`, `bottoms`, and `one-pieces`; product category is inferred from its name/type. Try-on output is a visual estimate and may alter garment details or the original 3D character's appearance.
