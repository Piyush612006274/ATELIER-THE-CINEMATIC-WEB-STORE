"use client";

import { useEffect, useRef } from "react";

/** Silent loop cropped from the user's reference, preserving its rendered motion. */
export function ReferenceOrb() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      if (motion.matches || document.hidden) video.pause();
      else void video.play().catch(() => { /* The matching poster remains visible if autoplay is blocked. */ });
    };
    update();
    motion.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      video.pause();
      motion.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return <video ref={videoRef} className="virgo-reference-video" src="/virgo/reference-orb.mp4" poster="/virgo/reference-orb-poster.png" autoPlay loop muted playsInline preload="auto" disablePictureInPicture disableRemotePlayback tabIndex={-1} aria-hidden="true" />;
}
