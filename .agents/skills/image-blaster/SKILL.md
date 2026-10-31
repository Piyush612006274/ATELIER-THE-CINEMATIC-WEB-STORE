---
name: image-blaster
description: Multi-modal AI generation suite for turning 2D images into 3D meshes (.glb/.obj via Hunyuan3D/FAL), Gaussian splats (.spz via World Labs), and spatial audio/SFX (.mp3 via ElevenLabs) in under 5 minutes.
---

# Image Blaster Orchestration Skill

Transforms single 2D input images into full 3D interactive assets, Gaussian splat environments, and spatial audio soundscapes.

## Sub-Skills in Suite
- **image-blast-3d**: Generate textured 3D objects (.glb, .obj) using FAL AI / Hunyuan3D / Meshy.
- **image-blast-world**: Generate Gaussian splat (.spz) environments with World Labs Marble.
- **image-blast-sfx**: Generate ambient loops and object-specific physics sound effects via ElevenLabs.
- **image-blast-plate**: Isolate foreground subjects and create clean backdrops.
- **image-blast-uncover**: Synthesize out-of-frame context and depth expanses.
- **image-blast-project**: Full end-to-end multi-asset project pipeline.
- **image-blast-image-edit**: Targeted prompt-based image transformation and cleanup.
- **image-blast-wildcard**: Creative stylistic variations and asset diversification.

## CLI Execution
Scripts are located at `.agents/skills/image-blaster/scripts/`:
- `node .agents/skills/image-blaster/scripts/asset-pipeline/generate-single-asset.mjs --world <slug> --object-id <id>`
- `node .agents/skills/image-blaster/scripts/world/generate-world.mjs`
- `node .agents/skills/image-blaster/scripts/sfx/fal-elevenlabs-sfx.mjs`
