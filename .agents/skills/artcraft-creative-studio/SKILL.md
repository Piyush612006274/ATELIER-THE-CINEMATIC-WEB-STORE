---
name: artcraft-creative-studio
description: The IDE for artists & creative crafting engine. Use for 2D/3D scene blocking, kitbashing, character posing with mannequin guidance, image-to-3D mesh staging, background removal, and multi-model generative art pipelines.
---

# ArtCraft Creative Studio Skill

**ArtCraft** is the open-source creative crafting engine and visual staging studio designed for artists, filmmakers, and digital creators. It bridges the gap between text prompting and deliberate visual direction.

## Core Capabilities

### 1. 2D & 3D Scene Compositing
- **Layered Depth Staging**: Compose scenes with distinct foreground, midground, and backdrop layers in 3D coordinate space before triggering generative render passes.
- **Camera Blocking & Placement**: Precisely frame focal lengths, pitch/yaw angles, and aspect ratios (16:9, 4:5, 1:1, 9:16) for editorial lookbooks and product displays.
- **Background Isolation & Cutouts**: Cleanly segment subjects to create modular transparent overlays, alpha cutouts, and interactive parallax layers.

### 2. Scene Blocking with Kitbashing
- Combine modular 3D geometric assets, architectural pedestals, lighting rigs, and environmental props into a single staging environment.
- Use kitbashed wireframes and bounding primitives to guide diffusion models, guaranteeing exact object positioning, proportions, and lighting shadows.

### 3. Character Posing & Mannequin Guidance
- Use skeletal posing and 3D mannequins to define posture, dynamic gesture, and garment draping.
- Guide AI apparel try-on and model lookbook generation with consistent physical geometry and zero anatomy distortion.

### 4. Image-to-3D Mesh Pipeline
- Convert 2D product designs, apparel silhouettes, and sculptural centerpieces into lightweight 3D meshes (`.glb`, `.obj`).
- Export textured geometries directly into WebGL runtime scenes (Three.js / React Three Fiber).

### 5. Multi-Model Generative Orchestration
- Supports structured pipeline handoffs across state-of-the-art models:
  - Text-to-Image / Inpainting: Nano Banana Pro, Flux, GPT Image.
  - Image-to-3D: Hunyuan3D, Meshy, Tripo3D.
  - Image-to-Video: Luma, Runway, Kling, CogVideoX.

## Integration with ATELIER V21
- **Cinematic Lookbook Production**: Stage the 3D figures and backdrop photography for ATELIER's editorial chapters (`frontend/components/storefront/cinematic.tsx`).
- **AI Provider Studio**: Standardize generation prompts and multi-layer composition in the backend AI provider registry (`backend/src/admin/aiProviders.ts`).
- **Catalog Asset Pipeline**: Generate 3D product representations and isolated cutouts for interactive e-commerce product detail cards.
