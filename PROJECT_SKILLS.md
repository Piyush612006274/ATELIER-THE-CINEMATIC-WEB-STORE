# Project Skills Registry & Cinematic Architecture

This file documents all skills installed from your Antigravity / CLI account and specifies the relevant skills activated to build the **why.zero.university** cinematic frontend for **ATELIER**.

All 40+ skills (including newly integrated creative, 3D generative, video compilation, analytics, and swarm simulation suites) are mirrored in `.agents/skills/` within this project root.

---

## 1. Skill Classification Matrix

| Skill Name | Status in Project | Role & Purpose |
|---|---|---|
| **threejs-fundamentals** | **ACTIVE (CORE)** | WebGL scene setup, camera projection, renderer configuration, pixel-ratio clamping, and responsive resize handling. |
| **threejs-shaders** | **ACTIVE (CORE)** | Custom GLSL vertex and fragment shaders for procedural noise, fluid wave distortion, radial background gradients, and chromatic aberration. |
| **threejs-animation** | **ACTIVE (CORE)** | Procedural `requestAnimationFrame` loop, spring physics, camera lerping, particle oscillation, and smooth chapter transitions. |
| **threejs-geometry** | **ACTIVE (CORE)** | GPU particle field using `BufferGeometry` with custom attribute buffers + faceted geometric monolithic 3D artifacts. |
| **threejs-interaction** | **ACTIVE (CORE)** | Pointer-driven raycasting, 3D tilt inertia, mouse tracking, and custom dual-ring interactive cursor. |
| **threejs-materials** | **ACTIVE (CORE)** | PBR physical materials, translucent wireframe glow, transmission, roughness, and additive blending. |
| **threejs-lighting** | **ACTIVE (CORE)** | Cinematic ambient and directional point lights with soft falloff and specular highlights. |
| **threejs-postprocessing** | **ACTIVE (CORE)** | Film grain, vignette, chromatic aberration, scanlines, and bloom simulation for filmic editorial look. |
| **threejs-textures** | **ACTIVE (CORE)** | Procedural noise textures, normal bump mapping, and gradient lookup maps. |
| **visual-style** | **ACTIVE (CORE)** | Portable visual design system (`visual-style.md`) defining the Emerald/Obsidian palette, technical typography, and motion curves. |
| **web-design-guidelines** | **ACTIVE (CORE)** | Mobile `svh` height resilience (from why.zero.university to eliminate URL-bar jumping), accessibility ARIA attributes, and `prefers-reduced-motion` fallbacks. |
| **vercel-react-best-practices** | **ACTIVE (CORE)** | Next.js 16 / React 19 client component dynamic imports (`ssr: false`), WebGL context cleanup, and zero hydration mismatch. |
| **vercel-composition-patterns** | **ACTIVE** | Compound component architecture for HUD overlays, telemetry displays, and chapter controls. |
| **framer-motion** | **ACTIVE** | Micro-interactions, spring entrances, staggered text reveals, and numeric counter animations. |
| **agency-senior-developer** | **ACTIVE** | Advanced WebGL integration, Web Audio API ambient soundscape synthesis, and 60fps performance profiling. |
| **agency-ui-designer** | **ACTIVE** | HUD editorial layer design, monospaced metadata coordinates, chapter indicators, and technical typography hierarchy. |
| **agency-frontend-developer** | **ACTIVE** | Clean component architecture, TypeScript typing, and modular state management. |
| **agency-ux-architect** | **ACTIVE** | Seamless transition between the 3D cinematic canvas and the e-commerce storefront. |
| **agency-performance-benchmarker**| **ACTIVE** | 60 FPS budget monitoring, GPU draw call optimization, and buffer recycling. |
| **agency-code-reviewer** | Tooling | Automated code quality and architecture verification. |
| **agency-backend-architect** | Platform | Server-side APIs, CMS endpoints, and database models. |
| **agency-database-optimizer** | Platform | Prisma query optimization, indexing, and SQLite/PostgreSQL caching. |
| **agency-devops-automator** | Platform | CI/CD pipelines, containerization, and build scripts. |
| **agency-git-workflow-master** | Platform | Git branch and commit management. |
| **agency-test-automation-engineer** | Testing | Automated Playwright / Cypress browser testing. |
| **playwright-cli** | Testing | Headless browser validation for responsive layouts and screenshot diffing. |
| **prompt-optimizer** | AI Tools | LLM prompt tuning for AI product descriptions and catalog generation. |
| **reverse-engineer-anything** | R&D | Reverse-engineering of `why.zero.university` DOM structure, shader gradients, and `svh` viewport handling. |
| **tailwind-design-system** | Styling | Utility token mapping reference. |
| **threejs-loaders** | 3D Assets | Asset loading pipelines for GLTF/GLB models when 3D apparel models are loaded. |
| **video-shotcraft** | **ACTIVE (CINEMATIC)** | Remotion programmatic video generation, 120+ shot recipe cards, 2.5D camera sweeps, and beat-synced lookbook reels. |
| **image-blaster** (suite) | **ACTIVE (3D ASSETS)** | 2D-to-3D asset pipeline: Hunyuan3D/FAL `.glb` mesh generation (`image-blast-3d`), spatial SFX (`image-blast-sfx`), and World Labs splats. |
| **artcraft-creative-studio** | **ACTIVE (VISUALS)** | Artist IDE for 2D/3D scene blocking, kitbashing, character posing with mannequin guidance, and multi-model visual crafting. |
| **vindex-video-compiler** | **ACTIVE (MEDIA)** | Deterministic video compilation, shot detection, keyframe extraction, Whisper ASR transcripts, and OCR indexing. |
| **bambooai-analytics** | **ACTIVE (ANALYTICS)** | Persistent Python analytics kernel, transactional computation, verifiable metrics replay, and e-commerce telemetry reporting. |
| **weknora-rag-search** | **ACTIVE (KNOWLEDGE)** | Enterprise hybrid RAG (BM25 + vector + graph), document citation chunking, and AI concierge search. |
| **mirofish-swarm-simulation** | **ACTIVE (SIMULATION)** | Multi-agent swarm intelligence, parallel digital sandbox simulation, and predictive capsule drop reception modeling. |

---

## 2. Reverse-Engineered Blueprint from `why.zero.university`

Inspection of `why.zero.university` revealed key architectural decisions implemented directly into this project:

1. **Procedural Background Layer (`#bg-gradient`)**:
   - Fixed div behind the canvas (`z-index: 0`) with a multi-stop radial gradient (`rgb(28, 72, 57)` to `rgb(212, 246, 235)`).
   - Paints instantly on frame 0 before WebGL boots, preventing any white flashes.

2. **Pre-Canvas Numeric Loader (`#pre-canvas-99`)**:
   - A bold monospace percentage counter (e.g., `00` -> `99`) anchored at bottom-left.
   - Sized using **`svh` (small viewport height)** rather than `vh`, avoiding layout shift when mobile browser address bars expand/retract.

3. **WebGL Interactive Canvas (`#webgl`)**:
   - Fullscreen transparent/opaque canvas (`z-index: 1`).
   - Touch action disabled (`touch-action: none`) with pointer event delegation.
   - Interactive 3D particle constellation and glowing geometric artifact responding to cursor physics and scroll depth.

4. **UI Container HUD (`#ui-container`)**:
   - Overlay layer (`z-index: 2`) with `pointer-events: none` on container, and `pointer-events: auto` on interactive elements.
   - Minimalist monospaced typography (`Google Sans Code` / `Inter`), chapter controls, coordinate labels, and Web Audio toggle.

---

## 3. Directory Location of Mirrored Skills

All skill files are available in this repository under:
`.agents/skills/<skill-name>/SKILL.md`
