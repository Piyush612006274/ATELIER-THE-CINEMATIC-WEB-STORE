"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

export function CinematicAtmosphereCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Check if user prefers reduced motion
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 15);

    // 2. High-performance WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      powerPreference: "high-performance",
      antialias: false,
      alpha: true,
      depth: false,
      stencil: false,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1));
    renderer.domElement.style.position = "fixed";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.pointerEvents = "none";
    renderer.domElement.style.zIndex = "0";
    renderer.domElement.style.opacity = "0.75";
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.id = "cinematic-atmosphere-webgl";

    container.appendChild(renderer.domElement);

    // 3. Filmic Particle / Dust Motes Generation
    const particleCount = prefersReducedMotion ? 24 : 80;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const scales = new Float32Array(particleCount);
    const speeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 26; // X
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20; // Y
      positions[i * 3 + 2] = (Math.random() - 0.5) * 16; // Z
      scales[i] = Math.random() * 2.5 + 0.8;
      speeds[i] = Math.random() * 0.003 + 0.001;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    // Particle texture (soft radial circular glow)
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, "rgba(255, 248, 220, 1)");
      gradient.addColorStop(0.3, "rgba(215, 255, 85, 0.6)");
      gradient.addColorStop(0.8, "rgba(215, 255, 85, 0.1)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 32, 32);
    }
    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
      size: 0.18,
      map: texture,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // 4. Subtle Anamorphic Cinematic Glow Ring
    const ringGeo = new THREE.RingGeometry(8, 8.04, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xd7ff55,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(6, -2, -4);
    ring.rotation.x = 0.4;
    scene.add(ring);

    // 5. Mouse Parallax Tracking
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    const onPointerMove = (e: MouseEvent) => {
      targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
      targetMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });

    // 6. Resize Handler
    const onResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1));
    };

    window.addEventListener("resize", onResize, { passive: true });

    // 7. Animation Loop with Tab Inactivity Pause
    let animationFrameId = 0;
    let isTabVisible = !document.hidden;
    let lastRenderAt = 0;

    const onVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (!isTabVisible && animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      } else if (isTabVisible && !prefersReducedMotion && !animationFrameId) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const timer = new THREE.Timer();
    timer.connect(document);

    const animate = (timestamp = 0) => {
      animationFrameId = 0;
      if (!isTabVisible) return;
      if (!prefersReducedMotion && timestamp - lastRenderAt < 33) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }
      lastRenderAt = timestamp;

      timer.update(timestamp);
      const delta = timer.getDelta();

      // Smooth mouse lerp
      currentMouseX += (targetMouseX - currentMouseX) * 0.05;
      currentMouseY += (targetMouseY - currentMouseY) * 0.05;

      camera.position.x = currentMouseX * 0.8;
      camera.position.y = currentMouseY * 0.6;
      camera.lookAt(0, 0, 0);

      // Rotate and drift particles
      if (!prefersReducedMotion) {
        particles.rotation.y += delta * 0.03;
        particles.rotation.x += delta * 0.015;

        ring.rotation.z += delta * 0.02;
        ring.rotation.y += delta * 0.01;

        const posAttr = geometry.attributes.position as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;

        for (let i = 0; i < particleCount; i++) {
          arr[i * 3 + 1] += speeds[i]; // Float upward
          if (arr[i * 3 + 1] > 10) {
            arr[i * 3 + 1] = -10;
          }
        }
        posAttr.needsUpdate = true;
      }

      renderer.render(scene, camera);
      if (!prefersReducedMotion) animationFrameId = requestAnimationFrame(animate);
    };

    if (prefersReducedMotion) {
      timer.update();
      renderer.render(scene, camera);
    } else {
      animationFrameId = requestAnimationFrame(animate);
    }

    // 8. Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      timer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      texture.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="cinematic-atmosphere-mount" />;
}
