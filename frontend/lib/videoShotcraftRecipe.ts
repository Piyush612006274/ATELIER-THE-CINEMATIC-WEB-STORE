/**
 * ATELIER x Video-Shotcraft Cinematic Recipe Specification
 *
 * Implements Remotion-based shot recipes from `.agents/skills/video-shotcraft/`
 * tuned specifically for ATELIER's Obsidian/Emerald/Acid-Green aesthetic.
 *
 * Each shot is a deterministic React/TypeScript Remotion composition
 * with beat-synced keyframes, camera lerping, and sound design layers.
 */

export interface ShotcraftKeyframe {
  frame: number;
  timeMs: number;
  camera: {
    x: number;
    y: number;
    z: number;
    fov: number;
  };
  telemetry: {
    label: string;
    coord: string;
    opacity: number;
  };
  audioCue?: string;
}

export interface ShotcraftRecipeCard {
  id: string;
  name: string;
  styleCategory: "orbit" | "reveal" | "exploded-view" | "hud-lockup" | "card-assemble";
  durationFrames: number;
  fps: number;
  palette: {
    background: string;
    monolithEmissive: string;
    hudAccent: string;
    ambientGlow: string;
  };
  motion: {
    springDamping: number;
    springStiffness: number;
    easing: string;
  };
  soundTrack: {
    sfx: string;
    volume: number;
    beatSyncBpm: number;
  };
  keyframes: ShotcraftKeyframe[];
}

export const ATELIER_SHOTCRAFT_RECIPES: Record<string, ShotcraftRecipeCard> = {
  "monolith-ambient-orbit": {
    id: "shot-01-monolith",
    name: "Obsidian Monolith Orbit & Telemetry Wakeup",
    styleCategory: "orbit",
    durationFrames: 120, // 4.0s @ 30fps
    fps: 30,
    palette: {
      background: "radial-gradient(circle at 50% 50%, #1c4839 0%, #080a09 100%)",
      monolithEmissive: "#0c1e18",
      hudAccent: "#d7ff55",
      ambientGlow: "#d4f6eb",
    },
    motion: {
      springDamping: 24,
      springStiffness: 120,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    },
    soundTrack: {
      sfx: "sub-bass-drone-40hz-ambient-rise.mp3",
      volume: 0.85,
      beatSyncBpm: 128,
    },
    keyframes: [
      {
        frame: 0,
        timeMs: 0,
        camera: { x: 0, y: 0, z: 22, fov: 45 },
        telemetry: { label: "INIT_ZERO_TELEMETRY", coord: "LAT 28.6139° N / LONG 77.2090° E", opacity: 0 },
        audioCue: "ambient-swell",
      },
      {
        frame: 36,
        timeMs: 1200,
        camera: { x: 4.6, y: 0.2, z: 18, fov: 42 },
        telemetry: { label: "CORE_MONOLITH_ACTIVE", coord: "POLY_COUNT: 48,200 TRIS", opacity: 0.8 },
        audioCue: "hud-click-accent",
      },
      {
        frame: 120,
        timeMs: 4000,
        camera: { x: 2.2, y: -0.4, z: 16, fov: 38 },
        telemetry: { label: "CHAPTER_01_READY", coord: "FPS: 60.0 [STABLE]", opacity: 1.0 },
      },
    ],
  },

  "lookbook-cutout-assemble": {
    id: "shot-02-cutout",
    name: "Editorial Lookbook Depth-Parallax Assemble",
    styleCategory: "card-assemble",
    durationFrames: 90, // 3.0s @ 30fps
    fps: 30,
    palette: {
      background: "#0d0f0e",
      monolithEmissive: "#142820",
      hudAccent: "#d7ff55",
      ambientGlow: "#ffffff",
    },
    motion: {
      springDamping: 20,
      springStiffness: 150,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    },
    soundTrack: {
      sfx: "shutter-snap-kinetic-woosh.mp3",
      volume: 0.9,
      beatSyncBpm: 128,
    },
    keyframes: [
      {
        frame: 0,
        timeMs: 0,
        camera: { x: -8, y: 0, z: 20, fov: 50 },
        telemetry: { label: "LOOK_01_PARALLAX_IN", coord: "APERTURE f/1.4", opacity: 0 },
      },
      {
        frame: 45,
        timeMs: 1500,
        camera: { x: 0, y: 0, z: 17, fov: 44 },
        telemetry: { label: "FIGURE_DEPTH_LOCK", coord: "Z-INDEX: 20px DEPTH", opacity: 0.95 },
        audioCue: "snare-transient",
      },
      {
        frame: 90,
        timeMs: 3000,
        camera: { x: 1.2, y: 0.1, z: 16.5, fov: 44 },
        telemetry: { label: "STOREFRONT_HANDOFF", coord: "COLLECTION_V21", opacity: 1.0 },
      },
    ],
  },

  "wireframe-dissolution-reveal": {
    id: "shot-03-wireframe",
    name: "Acid Wireframe Exploded Geometry Cut",
    styleCategory: "exploded-view",
    durationFrames: 75, // 2.5s @ 30fps
    fps: 30,
    palette: {
      background: "#080a09",
      monolithEmissive: "#d7ff55",
      hudAccent: "#d7ff55",
      ambientGlow: "#1c4839",
    },
    motion: {
      springDamping: 18,
      springStiffness: 180,
      easing: "cubic-bezier(0.19, 1, 0.22, 1)",
    },
    soundTrack: {
      sfx: "glitch-riser-reverse-cymbal.mp3",
      volume: 0.8,
      beatSyncBpm: 128,
    },
    keyframes: [
      {
        frame: 0,
        timeMs: 0,
        camera: { x: 0, y: 0, z: 15, fov: 40 },
        telemetry: { label: "WIREFRAME_BURST", coord: "GL_LINES_TRANSMISSION", opacity: 1 },
        audioCue: "sub-glitch",
      },
      {
        frame: 75,
        timeMs: 2500,
        camera: { x: 0, y: 0, z: 24, fov: 55 },
        telemetry: { label: "CATALOG_ENTRY", coord: "STATUS: LIVE", opacity: 1 },
      },
    ],
  },
};
