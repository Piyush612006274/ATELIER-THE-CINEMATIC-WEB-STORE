"use client";

import { useEffect, useRef, useState } from "react";

type Props = { src: string; title: string; preview?: boolean };

/** Loads one optimized GLB only while the visitor has opened the 3D viewer. */
export function ModelViewer({ src, title, preview = false }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let frame = 0;
    let autoRotateTimer = 0;
    let renderer: import("three").WebGLRenderer | null = null;
    let controls: import("three/addons/controls/OrbitControls.js").OrbitControls | null = null;
    let observer: ResizeObserver | null = null;
    let root: import("three").Object3D | null = null;
    let scene: import("three").Scene | null = null;
    let manager: import("three").LoadingManager | null = null;
    let mixer: import("three").AnimationMixer | null = null;
    let clock: import("three").Clock | null = null;
    let modelRoot: import("three").Group | null = null;
    let visible = !preview;
    let started = false;
    let lastFrameAt = 0;
    let drawFrame: ((time: number) => void) | null = null;
    let visibilityObserver: IntersectionObserver | null = null;
    let pausedByModal = false;

    const stopRendering = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    };
    const startRendering = () => {
      if (disposed || !visible || document.hidden || pausedByModal || !drawFrame || frame) return;
      frame = window.requestAnimationFrame(drawFrame);
    };
    const onDocumentVisibility = () => document.hidden ? stopRendering() : startRendering();
    const onModalState = (event: Event) => {
      pausedByModal = Boolean((event as CustomEvent<boolean>).detail);
      if (pausedByModal) stopRendering();
      else startRendering();
    };
    document.addEventListener("visibilitychange", onDocumentVisibility);
    if (preview) window.addEventListener("atelier:model-viewer-modal", onModalState);

    const start = async () => {
      try {
        const [THREE, { GLTFLoader }, { OrbitControls }, { MeshoptDecoder }] = await Promise.all([
          import("three"),
          import("three/addons/loaders/GLTFLoader.js"),
          import("three/addons/controls/OrbitControls.js"),
          import("three/addons/libs/meshopt_decoder.module.js"),
        ]);
        if (disposed || !host.isConnected) return;

        scene = new THREE.Scene();
        scene.background = preview ? null : new THREE.Color("#171714");
        const camera = new THREE.PerspectiveCamera(preview ? 31 : 32, 1, 0.01, 100);
        camera.position.set(0, 0.12, 3.2);
        renderer = new THREE.WebGLRenderer({ alpha: preview, antialias: !preview, preserveDrawingBuffer: !preview, powerPreference: "low-power" });
        renderer.setPixelRatio(preview ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        renderer.setClearColor("#171714", preview ? 0 : 1);
        renderer.domElement.className = "cin-3d-canvas";
        renderer.domElement.setAttribute("aria-label", `${title}, interactive 3D model`);
        host.appendChild(renderer.domElement);

        scene.add(new THREE.HemisphereLight(0xe9eadf, 0x302b24, 2.1));
        const key = new THREE.DirectionalLight(0xfff4df, 3.1);
        key.position.set(3.2, 4.5, 4);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xc6d2b1, 1.35);
        rim.position.set(-3, 1.3, -3);
        scene.add(rim);

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.07;
        controls.enablePan = false;
        const shouldAutoRotate = preview || !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        controls.autoRotate = false;
        controls.autoRotateSpeed = 2.2;

        const resize = () => {
          if (!renderer || !host) return;
          const width = Math.max(1, host.clientWidth);
          const height = Math.max(1, host.clientHeight);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        resize();
        observer = new ResizeObserver(resize);
        observer.observe(host);

        manager = new THREE.LoadingManager();
        const loader = new GLTFLoader(manager);
        loader.setMeshoptDecoder(MeshoptDecoder);
        loader.load(
          src,
          (gltf) => {
            if (disposed || !scene) {
              releaseModel(gltf.scene);
              return;
            }
            root = gltf.scene;
            // These two source assets were authored in side-profile orientation;
            // turn them toward the viewer so all three looks open front-facing.
            if (/\/(?:makima|tifa)-look\.glb(?:$|[?#])/i.test(src)) root.rotation.y = -Math.PI / 2;
            const bounds = new THREE.Box3().setFromObject(root);
            const size = bounds.getSize(new THREE.Vector3());
            const center = bounds.getCenter(new THREE.Vector3());
            root.position.sub(center);
            scene.add(root);
            modelRoot = new THREE.Group();
            modelRoot.add(root);
            // The source figures read slightly low inside the tall editorial frames.
            if (preview) modelRoot.position.y = size.y * 0.14;
            scene.add(modelRoot);
            if (gltf.animations.length) {
              mixer = new THREE.AnimationMixer(root);
              gltf.animations.forEach((clip) => mixer?.clipAction(clip).play());
            }
            clock = new THREE.Clock();

            const largest = Math.max(size.x, size.y, size.z, 0.01);
            const distance = largest / (2 * Math.tan((camera.fov * Math.PI) / 360)) * 1.2;
            camera.position.set(0, size.y * 0.025, distance);
            camera.near = Math.max(0.001, distance / 1000);
            camera.far = distance * 100;
            camera.updateProjectionMatrix();
            controls?.target.set(0, 0, 0);
            if (controls) {
              controls.minDistance = distance * 0.65;
              controls.maxDistance = distance * 2.2;
            }
            controls?.update();
            setProgress(100);
            setStatus("ready");
            if (shouldAutoRotate) {
              autoRotateTimer = window.setTimeout(() => {
                if (!disposed && controls) {
                  controls.autoRotate = true;
                  controls.update();
                }
              }, 1800);
            }
          },
          (event) => {
            if (!disposed && event.total > 0) setProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
          },
          () => { if (!disposed) setStatus("error"); },
        );

        const render = (time: number) => {
          frame = 0;
          if (disposed || !renderer || !scene || !visible || document.hidden || pausedByModal) return;
          if (preview && time - lastFrameAt < 33) {
            frame = window.requestAnimationFrame(render);
            return;
          }
          lastFrameAt = time;
          const delta = clock?.getDelta() || 0;
          const elapsed = clock?.elapsedTime || 0;
          mixer?.update(delta);
          if (preview && modelRoot) {
            modelRoot.rotation.y = Math.sin(elapsed * 0.38) * 0.08;
            modelRoot.rotation.x = Math.sin(elapsed * 0.55) * 0.025;
            modelRoot.position.y = Math.sin(elapsed * 1.15) * 0.025;
          }
          controls?.update();
          renderer.render(scene, camera);
          frame = window.requestAnimationFrame(render);
        };
        drawFrame = render;
        startRendering();
      } catch {
        if (!disposed) setStatus("error");
      }
    };

    if (preview && typeof IntersectionObserver !== "undefined") {
      visibilityObserver = new IntersectionObserver(([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        if (visible && !started) { started = true; void start(); }
        else if (visible) startRendering();
        else stopRendering();
      }, { rootMargin: "120px" });
      visibilityObserver.observe(host);
    } else {
      visible = true;
      started = true;
      void start();
    }
    return () => {
      disposed = true;
      if (autoRotateTimer) window.clearTimeout(autoRotateTimer);
      manager?.abort();
      stopRendering();
      document.removeEventListener("visibilitychange", onDocumentVisibility);
      if (preview) window.removeEventListener("atelier:model-viewer-modal", onModalState);
      visibilityObserver?.disconnect();
      observer?.disconnect();
      controls?.dispose();
      mixer?.stopAllAction();
      if (root) releaseModel(root);
      renderer?.forceContextLoss?.();
      renderer?.dispose();
      renderer?.domElement?.remove();
      scene?.clear();
    };
  }, [src, title]);

  return (
    <div className={`cin-3d-viewer${preview ? " cin-3d-preview" : ""}`} ref={hostRef} aria-busy={status === "loading"}>
      {status === "loading" && <div className="cin-3d-loading" role="status"><span>Preparing the look</span><span>{progress ? `${progress}%` : "3D"}</span><i><b style={{ width: `${progress}%` }} /></i></div>}
      {status === "error" && <div className="cin-3d-error" role="alert">This 3D look could not be loaded. Please try again.</div>}
      {status === "ready" && <div className="cin-3d-hint" aria-hidden="true">DRAG TO ROTATE · SCROLL TO ZOOM</div>}
    </div>
  );
}

function releaseModel(root: import("three").Object3D) {
  root.traverse((object) => {
    const mesh = object as import("three").Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      if (!material) return;
      Object.values(material).forEach((value) => {
        if (value && typeof value === "object" && "isTexture" in value) {
          try { (value as import("three").Texture).dispose(); } catch {}
        }
      });
      try { material.dispose(); } catch {}
    });
  });
}
