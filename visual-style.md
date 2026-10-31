---
name: Atelier Zero Cinematic
version: "1.0"
style_prompt_short: "A high-end cinematic WebGL aesthetic blending deep emerald obsidian, electric acid lime, technical monospaced telemetry, and 3D geometric artifacts inspired by why.zero.university."
style_prompt_full: "Design an immersive, cinematic digital experience inspired by why.zero.university and luxury technical fashion. Use a deep forest emerald (#1c4839) to near-black obsidian (#080a09) background with multi-stop radial lighting, sharp electric acid lime (#d7ff55) and mint accents, pristine white typography, and fine 1px technical borders. Typography combines clean high-contrast serif headlines with dense, uppercase monospaced labels and coordinates. Include a persistent HUD layer with live telemetry, a numeric loader counter, custom dual-ring pointer physics, and a real-time interactive WebGL canvas with particle fields and glowing geometric forms."
tags:
  - cinematic
  - webgl
  - threejs
  - luxury
  - zero-university
  - interactive-hud
author: "Antigravity Creative Architect"
source_url: "https://why.zero.university"
created: "2026-10-20"

colors:
  primary:
    - name: "Obsidian Base"
      hex: "#080a09"
      role: "Base canvas background, darkest depth layer"
    - name: "Emerald Deep"
      hex: "#1c4839"
      role: "Atmospheric WebGL background gradient base from why.zero.university"
    - name: "Emerald Soft"
      hex: "#356f5e"
      role: "Radial mid-tone lighting and mesh ambient glow"
  accent:
    - name: "Acid Lime"
      hex: "#d7ff55"
      role: "High-contrast technical accents, active state indicators, telemetry dots"
    - name: "Mint Light"
      hex: "#d4f6eb"
      role: "Soft light reflections, loader highlights, gradient core"
    - name: "Paper Off-White"
      hex: "#f1eee7"
      role: "Editorial headings and primary typographic content"
  neutral:
    - name: "Muted Olive Grey"
      hex: "#a6a69d"
      role: "Secondary descriptions, chapter labels, coordinates"
    - name: "Technical Line"
      hex: "rgba(241, 238, 231, 0.18)"
      role: "Fine 1px grid lines, geometric framing, and HUD borders"

typography:
  display:
    family: "Newsreader, Georgia, serif"
    weights: [400]
    letter_spacing: "-0.075em"
    role: "Large hero cinematic headlines, chapter titles, editorial statements"
  body:
    family: "Inter, Helvetica Neue, sans-serif"
    weights: [400, 500]
    line_height: 1.8
    role: "Editorial copy, product descriptions, dialogs"
  caption:
    family: "Google Sans Code, Supply Sans, monospace"
    weights: [400, 700]
    letter_spacing: "0.18em"
    text_transform: "uppercase"
    role: "HUD telemetry, numeric counter (00-99), coordinates, status pills"

layout:
  grid: "12-column fluid grid with 5vw-7vw gutters"
  hud: "Fixed 4-corner telemetry anchors with pointer-events: none and interactive children"
  viewport_units: "svh units mandatory for mobile screens to eliminate address bar jitter"

motion:
  easing: "cubic-bezier(0.2, 0.72, 0.18, 1)"
  pointer_inertia: 0.18
  spring_damping: 0.85
  webgl_lerp: 0.05
---

# Atelier Zero Cinematic Design System

## 1. Palette Philosophy
The color system is derived directly from the WebGL architecture of **why.zero.university** combined with ATELIER's high-fashion luxury identity:
- **Base Environment**: `#1c4839` radial gradient blossoming outward into obsidian `#080a09`.
- **Accent Signature**: `#d7ff55` (Acid Lime) providing unmistakable technical energy.
- **Lighting Core**: `#d4f6eb` (Mint Ice) simulating luminous procedural WebGL passes.

## 2. Typography Rules
1. **Headlines**: Elegant serif (`Newsreader` / `Georgia`) with negative letter-spacing (`-0.07em`) and italic emphasis tokens (`<em>`).
2. **Metadata & Telemetry**: Monospace (`Google Sans Code` / `Courier`), strictly uppercase with generous letter-spacing (`0.18em` to `0.22em`), preceded by a 1px colored line or bullet point.
3. **Numeric Counters**: Sized dynamically via `svh` units (`16.67svh` on desktop, `10.18svh` on mobile).

## 3. WebGL & Shader Specs
- **Background Shader**: Custom fragment shader computing 7-stop radial gradient with time-based subtle chromatic pulse.
- **Particle System**: 1,200 GPU-instanced point vertices oscillating via a sinusoidal noise wave in 3D space.
- **Monolith Artifact**: Faceted icosahedron with double-sided transparent mesh, physical wireframe overlay, and mouse-directed quaternion rotation.
- **Post-Processing**: Procedural film grain noise overlay (`opacity: 0.075`), subtle edge vignette, and scanline pulse.
