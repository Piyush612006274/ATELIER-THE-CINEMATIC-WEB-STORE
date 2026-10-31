---
name: vindex-video-compiler
description: Deterministic video knowledge compiler. Use to extract scenes, keyframes, Whisper transcripts, on-screen OCR text, and multimodal metadata from brand videos, hero reels, or lookbook media into structured JSON and Markdown.
---

# vindex Video Knowledge Compiler Skill

**vindex** is a local-first, open-source video knowledge compiler. It transforms raw video files into typed, versioned, reproducible knowledge artifacts (`visual_memory.json` and `visual_memory.md`), eliminating the need to process raw video repeatedly.

## Output Artifacts

A compilation run (`vindex compile <video_file>`) produces six standardized artifacts:

| Artifact | Purpose & Contents |
|---|---|
| `visual_memory.json` | Master compiled index of all multimodal observations across the video timeline. |
| `visual_memory.md` | Human-readable Markdown narrative summarizing shots, transitions, and key moments. |
| `timeline.json` | Chronological sequence of cuts, camera moves, and scene boundaries. |
| `scene_index.json` | Semantically grouped scenes with contextual captions and duration tags. |
| `asr.json` | Full speech transcript with word-level timestamps and speaker confidence scores. |
| `ocr.json` | All detected on-screen typography, brand marks, and coordinates. |

## Extraction Pipeline Architecture

1. **Scene & Shot Detection**: Powered by `PySceneDetect` to detect hard cuts, dissolves, and camera pans.
2. **Keyframe Sampling**: Deterministic frame extraction via `PyAV` (`middle`, `first_last`, or `uniform_n`).
3. **Speech Recognition (ASR)**: Multilingual speech transcription using `faster-whisper`.
4. **On-Screen OCR**: High-precision text detection and recognition across 100+ languages via `PaddleOCR`.
5. **VLM Scene Captioning**: Dense visual understanding and composition description.
6. **Compiler & Narration**: Merges observation streams into typed Pydantic schemas.

## Usage in ATELIER V21

### 1. Brand Campaign & Lookbook Indexing
Compile hero brand videos into clean scene cuts and timestamped assets:
```bash
vindex compile public/videos/atelier-campaign-2026.mp4 --output-dir public/media-index/
```

### 2. Auto-Generating Product Video Thumbnails & Keyframes
Extract the optimal frame for every product feature showcased in a video lookbook:
- Extract middle frames from each detected scene to use as crisp WebP poster images.
- Generate synchronized caption overlays for accessibility compliance.

### 3. Video-to-Code Blueprint with `video-shotcraft`
Use `vindex` to compile an existing high-performing video reference, then feed the resulting `timeline.json` into `video-shotcraft` to programmatically reproduce the pacing, cuts, and camera motion in Remotion.
