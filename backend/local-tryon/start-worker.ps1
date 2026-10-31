$ErrorActionPreference = "Stop"
$python = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
$weights = Join-Path $PSScriptRoot "weights"

if (-not (Test-Path -LiteralPath $python)) {
  throw "Local VTON Python environment is missing. Follow backend/local-tryon/README.md first."
}
if (-not (Test-Path -LiteralPath (Join-Path $weights "model.safetensors"))) {
  throw "FASHN model weights are missing. Follow backend/local-tryon/README.md first."
}

$env:HF_HOME = Join-Path $PSScriptRoot ".hf-cache"
$env:MPLCONFIGDIR = Join-Path $PSScriptRoot ".matplotlib-cache"
$env:OMP_NUM_THREADS = [string][Math]::Max(1, [Environment]::ProcessorCount - 1)
& $python (Join-Path $PSScriptRoot "worker.py") --weights-dir $weights
