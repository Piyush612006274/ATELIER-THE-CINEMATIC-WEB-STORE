"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { CampaignCards } from "./campaign-cards";
import { campaignLayout } from "@/lib/campaign-layouts";
import dynamic from "next/dynamic";
const ModelViewer = dynamic(() => import("../3d/model-viewer").then(m => m.ModelViewer), { ssr: false });

/* Cinematic home sections. All copy and images come from the CMS section content (editable in Admin). */
const FALLBACK = "/images/fallback-fashion.svg";
const lines = (t: any) =>
  String(t ?? "")
    .split("\n")
    .map((x, i, a) => (
      <React.Fragment key={i}>
        {x}
        {i < a.length - 1 && <br />}
      </React.Fragment>
    ));
const arr = (v: any): any[] => (Array.isArray(v) ? v : []);
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

function CImg({
  src,
  alt = "",
  className,
  style,
  eager,
}: {
  src?: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  eager?: boolean;
}) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [src]);
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={bad ? FALLBACK : src}
      alt={alt}
      className={`cin-img ${className || ""}`}
      style={style}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      decoding="async"
      onError={() => setBad(true)}
    />
  );
}

function go(link: string, onNavigate: (x: string) => void) {
  const t = String(link || "").trim();
  if (!t) return;
  if (t.startsWith("#")) {
    document
      .getElementById(t.slice(1))
      ?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    return;
  }
  onNavigate(t);
}

/** Reveal-on-scroll for every .reveal element inside the ref. */
function useReveal(deps: any[] = []) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = Array.from(
      root.querySelectorAll<HTMLElement>(".reveal:not(.in)"),
    );
    if (root.classList.contains("reveal") && !root.classList.contains("in"))
      els.push(root);
    if (!("IntersectionObserver" in window)) {
      els.forEach((e) => e.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12 },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref as React.RefObject<any>;
}

export function CinHero({
  c,
  onNavigate,
}: {
  c: any;
  onNavigate: (x: string) => void;
}) {
  const looks = arr(c.looks).filter((l) => l && (l.figure || l.bg));
  const [i, setI] = useState(0);
  const [changing, setChanging] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const fig = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLImageElement>(null);
  const halo = useRef<HTMLDivElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const idx = looks.length ? i % looks.length : 0;
  const look = looks[idx] || {};
  const pick = useCallback((n: number) => {
    setChanging(true);
    window.setTimeout(() => {
      setI(n);
      setChanging(false);
    }, 130);
  }, []);
  useEffect(() => {
    if (
      c.autoplay === false ||
      paused ||
      looks.length < 2 ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const id = window.setInterval(
      () => pick((idx + 1) % looks.length),
      Math.max(3000, Number(c.intervalMs) || 6500),
    );
    return () => window.clearInterval(id);
  }, [c.autoplay, c.intervalMs, looks.length, paused, idx, pick]);
  useEffect(() => {
    const el = stage.current;
    if (
      !el ||
      !matchMedia("(pointer:fine) and (prefers-reduced-motion: no-preference)")
        .matches
    )
      return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect(),
        x = (e.clientX - r.left) / r.width - 0.5,
        y = (e.clientY - r.top) / r.height - 0.5;
      if (back.current)
        back.current.style.transform = `translate3d(${(-x * 20).toFixed(1)}px,${(-y * 16).toFixed(1)}px,0) scale(1.13)`;
      if (halo.current)
        halo.current.style.transform = `translate3d(${(x * 22).toFixed(1)}px,${(y * 17).toFixed(1)}px,0)`;
      if (fig.current)
        fig.current.style.transform = `translate3d(${(x * -30).toFixed(1)}px,${(y * -18).toFixed(1)}px,20px) rotateY(${(x * 3).toFixed(2)}deg) rotateX(${(y * -2).toFixed(2)}deg)`;
      if (shadow.current)
        shadow.current.style.transform = `translate3d(${(23 + x * -20).toFixed(1)}px,${(8 + y * -11).toFixed(1)}px,0) scale(.98)`;
    };
    const leave = () => {
      if (back.current) back.current.style.transform = "";
      if (halo.current) halo.current.style.transform = "";
      if (fig.current) fig.current.style.transform = "";
      if (shadow.current) shadow.current.style.transform = "";
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, []);
  const cutout = look.mode !== "photo";
  return (
    <section className="cin-hero" id="top" aria-label="Opening">
      <div className="cin-hero-copy">
        <div className="cin-eyebrow" data-cms-element-id="eyebrow">
          {c.eyebrow}
        </div>
        <h1>
          <span>{c.line1}</span>
          <span className="outline">{c.line2}</span>
        </h1>
        <p className="cin-hero-desc">{c.description}</p>
        <div className="cin-actions">
          {c.button1Text && (
            <button
              className="cin-btn light"
              onClick={() => go(c.button1Link, onNavigate)}
            >
              {c.button1Text} <span className="arrow">↘</span>
            </button>
          )}
          {c.button2Text && (
            <button
              className="cin-btn"
              onClick={() => go(c.button2Link, onNavigate)}
            >
              {c.button2Text} <span className="arrow">↗</span>
            </button>
          )}
        </div>
        <div className="cin-footnote">
          <strong>{c.footnoteNum}</strong>
          <i />
          <span>{c.footnote}</span>
        </div>
      </div>
      <div
        className={`cin-stage ${changing ? "changing" : ""}`}
        ref={stage}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
      >
        <div className="cin-backdrop">
          <img
            ref={back}
            alt=""
            aria-hidden="true"
            src={look.bg || FALLBACK}
            className="cin-img cin-backdrop-img"
            onError={(e) => {
              (e.target as HTMLImageElement).src = FALLBACK;
            }}
          />
        </div>
        <div className="cin-halo" ref={halo} />
        <div className="cin-stage-number" aria-hidden="true">
          {look.number || String(idx + 1).padStart(2, "0")}
        </div>
        {cutout && (
          <div className="cin-depth-shadow" ref={shadow} aria-hidden="true">
            <CImg src={look.shadow || look.figure} />
          </div>
        )}
        <div className="cin-depth-figure" ref={fig}>
          {cutout ? (
            <CImg
              src={look.figure}
              eager
              alt={look.caption?.replace(/\n/g, " ") || "Look"}
              className="cin-model"
            />
          ) : (
            <CImg
              src={look.figure}
              eager
              alt={look.caption?.replace(/\n/g, " ") || "Look"}
              className="cin-photo"
            />
          )}
        </div>
        <div className="cin-stage-rail">{look.rail}</div>
        <div className="cin-stage-coord">{look.coord}</div>
        <div className="cin-stage-caption">
          {lines(look.caption)}
          <small>{look.sub}</small>
        </div>
        {looks.length > 1 && (
          <div
            className="cin-look-switcher"
            role="group"
            aria-label="Change look"
          >
            {looks.map((l, n) => (
              <button
                key={n}
                className="cin-look-choice"
                aria-pressed={n === idx}
                onClick={() => pick(n)}
              >
                <b>{String(n + 1).padStart(2, "0")}</b> {l.tab}
              </button>
            ))}
          </div>
        )}
      </div>
      {c.scrollCue && (
        <div className="cin-scroll-cue">
          {c.scrollCue} <span />
        </div>
      )}
    </section>
  );
}

export function CinTicker({ c }: { c: any }) {
  const items = arr(c.items)
    .map((x) => (typeof x === "string" ? x : x?.text))
    .filter(Boolean);
  const list = items.length ? [...items, ...items] : [];
  return (
    <div className="cin-ticker-wrap">
      <div className="cin-ticker" aria-label="Brand statement">
        <div className="cin-ticker-track">
          {list.concat(list).map((t, i) => (
            <span key={i} aria-hidden={i >= items.length ? true : undefined}>
              {t} <b>✳</b>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CinFilm(props: { c: any; products?: any[]; user?: any; onNavigate: (path: string) => void }) {
  if (campaignLayout(props.c.presentation) === 'film') return <CinScrollFilm {...props} />;
  return <><CampaignCards c={props.c} onNavigate={props.onNavigate} />{props.c.show3D !== false && <Cin3DLooks products={props.products || []} user={props.user} onNavigate={props.onNavigate} />}</>;
}

function CinScrollFilm({ c, products = [], user, onNavigate }: { c: any; products?: any[]; user?: any; onNavigate: (path: string) => void }) {
  const frames = arr(c.frames);
  const sec = useRef<HTMLElement>(null),
    stage = useRef<HTMLDivElement>(null),
    fill = useRef<HTMLDivElement>(null);
  const shots = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const n = frames.length;
  useEffect(() => {
    if (!n) return;
    let pending = false;
    const apply = () => {
      pending = false;
      const s = sec.current,
        st = stage.current;
      if (!s || !st) return;
      const rect = s.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > innerHeight) return;
      const travel = Math.max(1, s.offsetHeight - st.offsetHeight);
      const p = clamp(-rect.top / travel, 0, 1);
      const pos = p * (n - 1);
      shots.current.forEach((el, i) => {
        if (!el) return;
        const d = Math.abs(pos - i),
          local = clamp(1 - d, 0, 1);
        el.style.opacity = String(local);
        // Keep the full garment inside the film aperture; the previous 1.07–1.125
        // zoom clipped heads and hems on portrait campaign frames.
        el.style.transform = `scale(${(1 + local * 0.015).toFixed(3)}) translate3d(0,${(d * 2).toFixed(1)}px,0)`;
      });
      if (fill.current) fill.current.style.height = p * 100 + "%";
      const idx = Math.min(n - 1, Math.round(pos));
      if (idx !== activeRef.current) {
        activeRef.current = idx;
        setActive(idx);
      }
    };
    const req = () => {
      if (!pending) {
        pending = true;
        requestAnimationFrame(apply);
      }
    };
    apply();
    window.addEventListener("scroll", req, { passive: true });
    window.addEventListener("resize", req);
    return () => {
      window.removeEventListener("scroll", req);
      window.removeEventListener("resize", req);
    };
  }, [n]);
  const jump = (i: number) => {
    const s = sec.current,
      st = stage.current;
    if (!s || !st) return;
    const start = window.scrollY + s.getBoundingClientRect().top;
    const travel = Math.max(1, s.offsetHeight - st.offsetHeight);
    window.scrollTo({
      top: start + travel * (i / Math.max(1, n - 1)),
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };
  if (!n) return null;
  const f = frames[active] || frames[0];
  return (
    <>
    <section
      className="cin-film"
      id="film"
      ref={sec}
      aria-label="Scroll controlled image film"
      style={{ height: `${Math.max(2, n) * 105}vh` }}
    >
      <div className="cin-film-stage" ref={stage}>
        <div className="cin-film-ambient" />
        <div className="cin-film-copy">
          <div className="cin-film-kicker">
            Image film / frame {String(active + 1).padStart(2, "0")}
          </div>
          <h2>
            {f.title}
            <br />
            <em>{f.emphasis}</em>
          </h2>
          <p>{f.desc}</p>
          <div
            className="cin-film-controls"
            role="group"
            aria-label="Jump to chapter"
          >
            {frames.map((x, i) => (
              <button
                key={i}
                className="cin-chapter"
                aria-pressed={i === active}
                onClick={() => jump(i)}
              >
                <span>{String(i + 1).padStart(2, "0")}</span> {x.chapter}
              </button>
            ))}
          </div>
          <div className="cin-film-footer">
            <span>
              {String(active + 1).padStart(2, "0")} /{" "}
              {String(n).padStart(2, "0")}
            </span>
            <span className="line" />
            <span>{c.hint}</span>
          </div>
        </div>
        <div className="cin-film-window">
          {frames.map((x, i) => (
            <div
              key={i}
              className="cin-film-photo"
              ref={(el) => {
                shots.current[i] = el;
              }}
              style={{ opacity: i === 0 ? 1 : 0 }}
            >
              <CImg src={x.image} alt={x.tag} eager={i === 0} />
              <div className="cin-film-tag">
                <strong>{x.tag}</strong>
                <span>
                  Frame {String(i + 1).padStart(2, "0")} /{" "}
                  {String(n).padStart(2, "0")}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="cin-film-meter" aria-hidden="true">
          <div className="cin-film-meter-fill" ref={fill} />
        </div>
        <div className="cin-film-meter-label">Film progress</div>
        <div className="cin-film-hint">{c.hint}</div>
      </div>
    </section>
    {c.show3D !== false && <Cin3DLooks products={products} user={user} onNavigate={onNavigate} />}
    </>
  );
}

export function CinEdit({
  c,
  onNavigate,
}: {
  c: any;
  onNavigate: (x: string) => void;
}) {
  const ref = useReveal([c]);
  return (
    <section className="cin-edit" id="edit" ref={ref}>
      <div className="cin-section-top reveal">
        <div>
          <div className="cin-micro">{c.micro}</div>
          <h2>{lines(c.title)}</h2>
        </div>
        <p>{c.body}</p>
      </div>
      <div className="cin-edit-grid">
        {arr(c.tiles).map((t, i) => (
          <a
            key={i}
            className={`cin-tile reveal ${i % 2 ? "delay" : ""}`}
            href={t.link || "#"}
            onClick={(e) => {
              e.preventDefault();
              go(t.link, onNavigate);
            }}
          >
            <CImg
              src={t.image}
              alt={String(t.title || "").replace(/\n/g, " ")}
            />
            <span className="cin-tile-index">{t.index}</span>
            <div className="cin-tile-meta">
              <div>
                <h3>{lines(t.title)}</h3>
                <p>{t.meta}</p>
              </div>
              <span className="cin-circle">↗</span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

export function CinManifesto({
  c,
  onNavigate,
}: {
  c: any;
  onNavigate?: (x: string) => void;
}) {
  const ref = useReveal([c]);
  const [activeLook, setActiveLook] = useState(0);
  const [activePin, setActivePin] = useState<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const figRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);

  const characterLooks = [
    {
      id: "01",
      name: "ARCHITECTURAL WINTER OVERCOAT",
      tag: "01 · COAT",
      figure: "/images/cinematic/winterCutout.webp",
      coords: "28.6139° N / 77.2090° E",
      productLink: "/shop?gender=Men",
      spec: "480GSM WOOL BLEND // STRUCTURED DRAPE",
      pins: [
        {
          id: 1,
          x: 42,
          y: 22,
          label: "SHAPED SHOULDER",
          spec: "Engineered zero-bulk architectural drop with clean seam lines",
        },
        {
          id: 2,
          x: 54,
          y: 48,
          label: "480GSM THERMAL WEAVE",
          spec: "Tactile high-density melton wool tailored to endure daily wear",
        },
        {
          id: 3,
          x: 38,
          y: 76,
          label: "KINETIC POSTURE VENT",
          spec: "Elongated rear drop allowing natural motion without disruption",
        },
      ],
    },
    {
      id: "02",
      name: "STRUCTURED INDIGO DENIM & LAYERS",
      tag: "02 · DENIM",
      figure: "/images/cinematic/denimCutout.webp",
      coords: "35.6762° N / 139.6503° E",
      productLink: "/shop?gender=Men",
      spec: "14OZ SELVEDGE RAW DENIM // SCULPTED SEAMS",
      pins: [
        {
          id: 1,
          x: 46,
          y: 26,
          label: "SCULPTED COLLAR",
          spec: "Structured collar stance tailored for effortless layering",
        },
        {
          id: 2,
          x: 52,
          y: 46,
          label: "DEEP INDIGO SURFACE",
          spec: "Authentic yarn-dyed weave treated for rich tactile depth",
        },
        {
          id: 3,
          x: 40,
          y: 78,
          label: "PROPORTION BALANCE",
          spec: "Clean boxy cut calibrated to pair over heavyweight knits",
        },
      ],
    },
    {
      id: "03",
      name: "FLUID SCULPTED DRAPE & TAILORING",
      tag: "03 · DRAPE",
      figure: "/images/cinematic/womenCoat.webp",
      coords: "48.8566° N / 2.3522° E",
      productLink: "/shop?gender=Women",
      spec: "FLUID DOUBLE-FACED CREPE // EDITORIAL SILHOUETTE",
      pins: [
        {
          id: 1,
          x: 48,
          y: 20,
          label: "ARCHITECTURAL NOTCH",
          spec: "Clean sharp lapel cutting through modern evening silhouettes",
        },
        {
          id: 2,
          x: 44,
          y: 48,
          label: "FLUID WAIST FALL",
          spec: "Unstructured drape designed to complement anatomical contours",
        },
        {
          id: 3,
          x: 52,
          y: 78,
          label: "COLUMN EXTENSION",
          spec: "Elongated hemline creating continuous vertical motion lines",
        },
      ],
    },
  ];

  const currentLook = characterLooks[activeLook] || characterLooks[0];

  useEffect(() => {
    const el = stageRef.current;
    if (
      !el ||
      !matchMedia("(pointer:fine) and (prefers-reduced-motion: no-preference)")
        .matches
    )
      return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      if (figRef.current) {
        figRef.current.style.transform = `translate3d(${(x * -22).toFixed(1)}px,${(y * -14).toFixed(1)}px,20px) rotateY(${(x * 4).toFixed(2)}deg) rotateX(${(y * -2.5).toFixed(2)}deg)`;
      }
      if (shadowRef.current) {
        shadowRef.current.style.transform = `translate3d(${(18 + x * -14).toFixed(1)}px,${(10 + y * -8).toFixed(1)}px,0) scale(0.97)`;
      }
      if (haloRef.current) {
        haloRef.current.style.transform = `translate3d(${(x * 16).toFixed(1)}px,${(y * 12).toFixed(1)}px,0)`;
      }
    };
    const leave = () => {
      if (figRef.current) figRef.current.style.transform = "";
      if (shadowRef.current) shadowRef.current.style.transform = "";
      if (haloRef.current) haloRef.current.style.transform = "";
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <section
      className="cin-manifesto"
      id="story"
      ref={ref}
      aria-label="Brand manifesto and character visualization"
    >
      <div className="cin-manifesto-inner">
        {/* Left Editorial Text Column */}
        <div className="cin-manifesto-left">
          <div className="cin-micro reveal">
            {c.micro || "02 / A QUIETER KIND OF LUXURY"}
          </div>
          <h2 className="reveal">
            {lines(c.title || "Not made for\na moment.")}
            <br />
            <em>{c.emphasis || "Made for life."}</em>
          </h2>

          <div className="cin-manifesto-desc reveal">
            <p>
              {c.body ||
                "Great design is felt before it is noticed. Thoughtful materials, useful details and silhouettes that leave room for you to be yourself."}
            </p>
          </div>

          {/* Interactive Silhouette Look Switcher */}
          <div
            className="cin-character-tabs reveal"
            role="tablist"
            aria-label="Select character look"
          >
            <span className="cin-tabs-eyebrow">
              CHARACTER VISUALIZATION // ANATOMICAL MAPPING
            </span>
            <div className="cin-tabs-row">
              {characterLooks.map((look, idx) => (
                <button
                  key={look.id}
                  role="tab"
                  aria-selected={activeLook === idx}
                  className={`cin-tab-btn ${activeLook === idx ? "active" : ""}`}
                  onClick={() => {
                    setActiveLook(idx);
                    setActivePin(null);
                  }}
                >
                  <span className="cin-tab-num">{look.id}</span>
                  <span className="cin-tab-tag">{look.tag}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="cin-manifesto-actions reveal">
            <button
              className="cin-btn light"
              onClick={() =>
                onNavigate
                  ? onNavigate(currentLook.productLink)
                  : go(currentLook.productLink, () => {})
              }
            >
              EXPLORE THIS SILHOUETTE <span className="arrow">↗</span>
            </button>
            <button
              className="cin-btn"
              onClick={() =>
                onNavigate
                  ? onNavigate("/collections")
                  : go("/collections", () => {})
              }
            >
              COLLECTIONS ARCHIVE ↘
            </button>
          </div>

          <div className="cin-manifesto-bottom reveal">
            <span className="cin-manifesto-mark">
              {c.mark || "FORM · FUNCTION · FEELING"}
            </span>
            <span className="cin-manifesto-geo">{currentLook.coords}</span>
          </div>
        </div>

        {/* Right Character Visualization 3D Stage */}
        <div className="cin-character-stage reveal" ref={stageRef}>
          <div
            className="cin-character-halo"
            ref={haloRef}
            aria-hidden="true"
          />
          <div className="cin-stage-lines" aria-hidden="true" />

          {/* Telemetry Header */}
          <div className="cin-character-telemetry">
            <span className="cin-telemetry-dot" />
            <span>
              FIGURE {currentLook.id} ╱ 03 · {currentLook.spec}
            </span>
          </div>

          <div className="cin-stage-coord-rail" aria-hidden="true">
            <span>GEO // {currentLook.coords}</span>
            <i />
            <span>ATELIER LAB // V21</span>
          </div>

          {/* Character Cutout & Depth Layer */}
          <div className="cin-character-viewport">
            <div
              className="cin-character-shadow"
              ref={shadowRef}
              aria-hidden="true"
            >
              <CImg src={currentLook.figure} alt="" />
            </div>
            <div className="cin-character-fig" ref={figRef}>
              <CImg
                src={currentLook.figure}
                alt={currentLook.name}
                className="cin-character-cutout"
              />
            </div>

            {/* Interactive Anatomical Pins */}
            {currentLook.pins.map((pin) => (
              <div
                key={pin.id}
                className={`cin-hotspot ${pin.y > 55 ? "is-low" : ""} ${activePin === pin.id ? "active" : ""}`}
                style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
              >
                <button
                  type="button"
                  className="cin-hotspot-beacon"
                  aria-label={pin.label}
                  onClick={() =>
                    setActivePin(activePin === pin.id ? null : pin.id)
                  }
                  onMouseEnter={() => setActivePin(pin.id)}
                >
                  <span className="cin-hotspot-pulse" />
                  <span className="cin-hotspot-core">+</span>
                </button>
                <div className="cin-hotspot-popover">
                  <div className="cin-popover-tag">
                    [PIN 0{pin.id}] {pin.label}
                  </div>
                  <div className="cin-popover-desc">{pin.spec}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Spec Footer */}
          <div className="cin-character-footer">
            <div className="cin-character-meta">
              <strong>{currentLook.name}</strong>
              <small>TOUCHSCREEN / MOUSE ENABLED // INTERACTIVE DEPTH</small>
            </div>
            <button
              className="cin-character-cta"
              onClick={() =>
                onNavigate
                  ? onNavigate(currentLook.productLink)
                  : go(currentLook.productLink, () => {})
              }
            >
              INSPECT PIECE ↗
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CinShop({
  c,
  products,
  onNavigate,
  onAddCart,
  productImage,
  money,
}: {
  c: any;
  products: any[];
  onNavigate: (x: string) => void;
  onAddCart: (
    p: any,
    size?: string,
    color?: string,
    qty?: number,
  ) => Promise<boolean>;
  productImage: (p: any) => string;
  money: (n: number) => string;
}) {
  const [filter, setFilter] = useState("all");
  const ref = useReveal([c]);
  let list = (products || []).filter((p: any) => p.status === "ACTIVE");
  if (c.filter === "new") list = list.filter((p: any) => p.newArrival);
  if (c.filter === "best") {
    const b = list.filter((p: any) => p.bestSeller);
    if (b.length) list = b;
  }
  if (c.filter === "men") list = list.filter((p: any) => p.gender === "Men");
  if (c.filter === "women")
    list = list.filter((p: any) => p.gender === "Women");
  const lim = Math.max(1, Number(c.limit) || 6);
  if (!c.filter || c.filter === "all") {
    const m = list.filter((p: any) => p.gender === "Men"),
      w = list.filter((p: any) => p.gender !== "Men");
    const half = Math.ceil(lim / 2);
    list = [
      ...m.slice(0, half),
      ...w.slice(0, lim - Math.min(half, m.length)),
    ].slice(0, lim);
  } else list = list.slice(0, lim);
  const shown = list.filter(
    (p: any) =>
      filter === "all" ||
      (filter === "men" ? p.gender === "Men" : p.gender === "Women"),
  );
  const quick = (p: any) => {
    const sz = (p.sizes || []).includes("M") ? "M" : (p.sizes || [])[0] || "M";
    void onAddCart(p, sz, (p.colors || [])[0] || "Black", 1);
  };
  return (
    <section className="cin-shop" id="collection" ref={ref}>
      <div className="cin-section-top reveal">
        <div>
          <div className="cin-micro">{c.micro}</div>
          <h2>{lines(c.title)}</h2>
        </div>
        <p>{c.body}</p>
      </div>
      {c.showFilters !== false && (
        <div className="cin-shop-toolbar">
          <div
            className="cin-filter-row"
            role="group"
            aria-label="Filter products"
          >
            {[
              ["all", c.allLabel || "All pieces"],
              ["men", c.menLabel || "Menswear"],
              ["women", c.womenLabel || "Womenswear"],
            ].map(([k, l]) => (
              <button
                key={k}
                className="cin-filter"
                aria-pressed={filter === k}
                onClick={() => setFilter(k)}
              >
                {l}
              </button>
            ))}
          </div>
          <span className="cin-shop-count">
            {String(shown.length).padStart(2, "0")} pieces
          </span>
        </div>
      )}
      <div className="cin-product-grid">
        {shown.map((p: any, i: number) => (
          <article className="cin-product" key={p.id}>
            <div className="cin-product-visual">
              <button
                className="cin-product-hit"
                aria-label={`View ${p.name}`}
                onClick={() => onNavigate(`/product/${p.id}`)}
              >
                <CImg src={productImage(p)} alt={p.name} />
              </button>
              <span className="cin-product-index">
                {String(i + 1).padStart(2, "0")} /{" "}
                {p.gender === "Men" ? "Menswear" : "Womenswear"}
              </span>
              <button
                className="cin-quick-add"
                disabled={p.stock < 1}
                onClick={() => quick(p)}
              >
                <span>{p.stock < 1 ? "Sold out" : "Add to bag"}</span>
                <span>＋</span>
              </button>
            </div>
            <div className="cin-product-info">
              <div>
                <h3>{p.name}</h3>
                <p>{p.category?.name || p.type}</p>
              </div>
              <span className="cin-price">{money(p.price)}</span>
            </div>
            <div className="cin-product-material">
              {p.newArrival
                ? "New season"
                : p.bestSeller
                  ? "Best seller"
                  : "Everyday icon"}
              {(p.colors || [])[0]
                ? ` / ${String(p.colors[0]).toLowerCase()}`
                : ""}
            </div>
          </article>
        ))}
      </div>
      <div className="cin-shop-note">
        <span>{c.noteLeft}</span>
        {c.viewAllText ? (
          <button onClick={() => go(c.viewAllLink || "/shop", onNavigate)}>
            {c.viewAllText} ↗
          </button>
        ) : (
          <span>{c.noteRight}</span>
        )}
      </div>
    </section>
  );
}

export function CinLookbook({
  c,
  onNavigate,
}: {
  c: any;
  onNavigate: (x: string) => void;
}) {
  const ref = useReveal([c]);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const looks = arr(c.looks);
  const [playing, setPlaying] = useState(true);
  const [activeLookIndex, setActiveLookIndex] = useState(0);

  const isHoveredRef = useRef(false);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollStartRef = useRef(0);
  const hasMovedRef = useRef(false);
  const singleSetWidthRef = useRef(0);
  const posRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const directionRef = useRef<1 | -1>(1);

  // Repeat the looks 8 times to provide ample buffer for seamless continuous round rolling
  const repeatList = useMemo(() => {
    if (looks.length < 2) return looks.map((look, i) => ({ look, origIndex: i, key: `look-0-${i}` }));
    const repeatCount = Math.max(6, Math.ceil(32 / looks.length));
    const result: { look: any; origIndex: number; key: string }[] = [];
    for (let setIdx = 0; setIdx < repeatCount; setIdx++) {
      looks.forEach((look, origIdx) => {
        result.push({
          look,
          origIndex: origIdx,
          key: `look-set-${setIdx}-${origIdx}`,
        });
      });
    }
    return result;
  }, [looks]);

  // Measure single set width and initialize to middle buffer set
  const measureAndInit = useCallback(() => {
    const row = rowRef.current;
    if (!row || looks.length < 2) return;
    const cards = row.querySelectorAll<HTMLElement>(".cin-look");
    let width = 0;
    if (cards.length >= looks.length * 2) {
      const first = cards[0];
      const target = cards[looks.length];
      if (first && target) {
        width = target.offsetLeft - first.offsetLeft;
      }
    }
    if (width <= 0) {
      const card = row.querySelector<HTMLElement>(".cin-look");
      const cardW = card?.offsetWidth || 340;
      width = (cardW + 24) * looks.length;
    }
    if (width > 0) {
      singleSetWidthRef.current = width;
      if (posRef.current === 0 || row.scrollLeft === 0) {
        const startPos = width * 2;
        posRef.current = startPos;
        row.scrollLeft = startPos;
      }
    }
  }, [looks.length]);

  // Update dynamic 3D cylinder round curvature transforms
  const updateTransforms = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    const rowRect = row.getBoundingClientRect();
    const centerX = rowRect.left + rowRect.width / 2;
    const cards = row.querySelectorAll<HTMLElement>(".cin-look");

    let minDistance = Infinity;
    let closestIndex = 0;

    cards.forEach((card) => {
      const cardRect = card.getBoundingClientRect();
      // Skip far offscreen cards
      if (cardRect.right < rowRect.left - 150 || cardRect.left > rowRect.right + 150) return;

      const cardCenter = cardRect.left + cardRect.width / 2;
      const dist = cardCenter - centerX;
      const norm = Math.max(-1.3, Math.min(1.3, dist / (rowRect.width * 0.45)));

      // 3D Cylinder Curvature ("Like a round")
      const rotateY = -norm * 14;
      const translateZ = (1 - Math.min(1, Math.abs(norm))) * 28;
      const scale = 1 - Math.min(1, Math.abs(norm)) * 0.055;
      const brightness = 1 - Math.min(1, Math.abs(norm)) * 0.16;

      card.style.transform = `perspective(1200px) rotateY(${rotateY.toFixed(2)}deg) translateZ(${translateZ.toFixed(1)}px) scale(${scale.toFixed(3)})`;
      card.style.filter = `brightness(${brightness.toFixed(2)})`;

      if (Math.abs(dist) < minDistance) {
        minDistance = Math.abs(dist);
        const idxAttr = card.getAttribute("data-orig-index");
        if (idxAttr) closestIndex = parseInt(idxAttr, 10);
      }
    });

    setActiveLookIndex((prev) => (prev === closestIndex ? prev : closestIndex));
  }, []);

  // Continuous animation frame step - rolls continuously without interruption
  useEffect(() => {
    const row = rowRef.current;
    if (!row || looks.length < 2) return;

    measureAndInit();
    window.addEventListener("resize", measureAndInit);

    const loop = (time: number) => {
      const currentRow = rowRef.current;
      if (currentRow) {
        if (singleSetWidthRef.current <= 0) {
          measureAndInit();
        }
        const singleSet = singleSetWidthRef.current;

        if (lastTimeRef.current === null) lastTimeRef.current = time;
        const dt = Math.min(time - lastTimeRef.current, 64);
        lastTimeRef.current = time;

        if (singleSet > 0 && playing && !isDraggingRef.current) {
          // Continuous roll: even on hover it smoothly glides without stopping
          const speed = isHoveredRef.current ? 0.9 : 1.25;
          const delta = (speed * dt * directionRef.current) / 16.67;
          posRef.current += delta;

          // Seamless infinite round wrap within middle buffer [2 * singleSet, 3 * singleSet)
          if (posRef.current >= singleSet * 3) {
            posRef.current -= singleSet;
          } else if (posRef.current < singleSet * 2) {
            posRef.current += singleSet;
          }

          currentRow.scrollLeft = Math.round(posRef.current);
        }

        updateTransforms();
      }
      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    animFrameIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      window.removeEventListener("resize", measureAndInit);
    };
  }, [playing, looks.length, measureAndInit, updateTransforms]);

  // Manual slide step
  const stepSlide = (dir: 1 | -1) => {
    const row = rowRef.current;
    if (!row) return;
    const card = row.querySelector<HTMLElement>(".cin-look");
    const gap = 24;
    const step = (card?.offsetWidth || 340) + gap;
    posRef.current += dir * step;
    row.scrollTo({ left: Math.round(posRef.current), behavior: "smooth" });
  };

  // Pointer drag for smooth swipe
  const onPointerDown = (e: React.PointerEvent) => {
    const row = rowRef.current;
    if (!row) return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startXRef.current = e.clientX;
    scrollStartRef.current = row.scrollLeft;
    posRef.current = row.scrollLeft;
    try { row.setPointerCapture(e.pointerId); } catch {}
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const row = rowRef.current;
    if (!row) return;
    const dx = e.clientX - startXRef.current;
    if (Math.abs(dx) > 6) hasMovedRef.current = true;
    const newPos = scrollStartRef.current - dx;
    row.scrollLeft = newPos;
    posRef.current = newPos;
    updateTransforms();
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      const row = rowRef.current;
      if (row && singleSetWidthRef.current > 0) {
        const singleSet = singleSetWidthRef.current;
        while (posRef.current >= singleSet * 4) posRef.current -= singleSet;
        while (posRef.current < singleSet * 2) posRef.current += singleSet;
        row.scrollLeft = Math.round(posRef.current);
      }
      try { rowRef.current?.releasePointerCapture(e.pointerId); } catch {}
    }
  };

  return (
    <section className="cin-lookbook" id="lookbook" ref={ref}>
      <div className="cin-section-top reveal">
        <div>
          <div className="cin-micro">{c.micro || "04 / The lookbook"}</div>
          <h2>{lines(c.title || "Wear it\nyour way.")}</h2>
        </div>
        <p>{c.body || "Move through the looks. A little different in every frame, always unmistakably your own."}</p>
      </div>

      <div className="cin-lookbook-stage">
        <div
          className="cin-lookbook-row"
          ref={rowRef}
          tabIndex={0}
          aria-label="Continuous 360 round lookbook reel"
          onMouseEnter={() => { isHoveredRef.current = true; }}
          onMouseLeave={() => { isHoveredRef.current = false; }}
          onFocus={() => { isHoveredRef.current = true; }}
          onBlur={() => { isHoveredRef.current = false; }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") { event.preventDefault(); stepSlide(1); }
            if (event.key === "ArrowLeft") { event.preventDefault(); stepSlide(-1); }
            if (event.key === " ") { event.preventDefault(); setPlaying((p) => !p); }
          }}
        >
          {repeatList.map((item, i) => {
            const isCenter = item.origIndex === activeLookIndex;
            return (
              <figure
                className={`cin-look ${isCenter ? "is-active" : ""}`}
                key={item.key || i}
                data-orig-index={item.origIndex}
              >
                <button
                  type="button"
                  className="cin-look-media"
                  onClick={() => {
                    if (!hasMovedRef.current) {
                      go(item.look.link || "/shop", onNavigate);
                    }
                  }}
                  aria-label={item.look.label}
                >
                  <CImg src={item.look.image} alt={item.look.label} />
                  <span className="cin-look-pill">
                    <span className="pill-dot" />
                    LOOK 0{item.origIndex + 1}
                  </span>
                </button>
                <figcaption>
                  <span className="look-title">{item.look.label}</span>
                  <span className="look-arrow">↗</span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>

      {looks.length > 1 && (
        <div className="cin-look-deck">
          <div className="cin-look-indicator">
            <span className="roll-badge">
              <span className="roll-dot" />
              ROUND ROLL · 360° REEL
            </span>
            <span className="look-count">
              <b>0{activeLookIndex + 1}</b> / 0{looks.length}
            </span>
          </div>
          <div className="cin-look-controls" role="group" aria-label="Lookbook controls">
            <button
              type="button"
              onClick={() => stepSlide(-1)}
              aria-label="Previous look"
              title="Roll Backward"
            >
              ← PREV
            </button>
            <button
              type="button"
              className={playing ? "is-playing" : ""}
              onClick={() => setPlaying((v) => !v)}
              aria-pressed={!playing}
              aria-label={playing ? "Pause automatic rolling" : "Play automatic rolling"}
            >
              {playing ? "⏸ PAUSE" : "▶ ROLL"}
            </button>
            <button
              type="button"
              onClick={() => stepSlide(1)}
              aria-label="Next look"
              title="Roll Forward"
            >
              NEXT →
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

type ThreeDLook = { title: string; category: string; src: string; poster?: string };
const THREE_D_LOOKS: ThreeDLook[] = [
  { title: "Soft Form", category: "01 / DRESS STUDY", src: "/models/fashion-look.glb", poster: "/models/posters/fashion.jpg" },
  { title: "Redline", category: "02 / CHARACTER STUDY", src: "/models/makima-look.glb", poster: "/models/posters/makima.jpg" },
  { title: "Fighter Form", category: "03 / CHARACTER STUDY", src: "/models/tifa-look.glb", poster: "/models/posters/tifa.jpg" },
];
export function Cin3DLooks({ products, user, onNavigate }: { products: any[]; user?: any; onNavigate: (path: string) => void }) {
  const restoreFocusRef = useRef<HTMLButtonElement | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const [active3DLook, setActive3DLook] = useState<(typeof THREE_D_LOOKS)[number] | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [tryOnBusy, setTryOnBusy] = useState(false);
  const [tryOnError, setTryOnError] = useState("");
  const [tryOnResults, setTryOnResults] = useState<any[]>([]);
  const availableProducts = products.filter((product) => product?.status === "ACTIVE").slice(0, 40);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("atelier:model-viewer-modal", { detail: Boolean(active3DLook) }));
    return () => { window.dispatchEvent(new CustomEvent("atelier:model-viewer-modal", { detail: false })); };
  }, [active3DLook]);
  useEffect(() => {
    if (!active3DLook) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setActive3DLook(null); };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); restoreFocusRef.current?.focus(); };
  }, [active3DLook]);
  useEffect(() => {
    setSelectedProducts([]);
    setTryOnResults([]);
    setTryOnError("");
  }, [active3DLook]);
  const runTryOn = async () => {
    if (!user) { onNavigate("/login"); return; }
    if (!selectedProducts.length) { setTryOnError("Choose at least one product first."); return; }
    const canvas = viewerRef.current?.querySelector("canvas");
    if (!canvas) { setTryOnError("Wait for the 3D model to finish loading, then try again."); return; }
    setTryOnBusy(true);
    setTryOnError("");
    setTryOnResults([]);
    try {
      const photoDataUrl = canvas.toDataURL("image/jpeg", 0.9);
      const response = await api<any>("/ai/try-on", { method: "POST", body: JSON.stringify({ photoDataUrl, productIds: selectedProducts }) });
      const results = Array.isArray(response?.results) ? response.results.filter((result: any) => result?.image) : [];
      setTryOnResults(results);
      if (!results.length) {
        const code = String(response?.results?.find((result: any) => result?.error)?.error || "").toUpperCase();
        const messages: Record<string, string> = {
          TRY_ON_PROVIDER_ERROR: "The configured try-on engine failed. Check its provider status or local worker, then retry.",
          TRY_ON_NOT_CONFIGURED: "Virtual Try-On is not connected yet. Ask the store admin to configure an AI provider.",
          TRY_ON_DAILY_LIMIT: "Your daily try-on allowance is used up. Try again after it resets.",
          TRY_ON_MONTHLY_LIMIT: "The monthly try-on allowance is used up.",
          TRY_ON_PROVIDER_QUOTA: "The AI provider has reached its quota. Try again later.",
          TRY_ON_PROVIDER_AUTH: "The AI provider rejected its credentials or subscription.",
          TRY_ON_NOT_SUPPORTED: "This preview is not available for the selected model yet.",
          LOCAL_TRY_ON_UNAVAILABLE: "Start the local try-on model with backend/local-tryon/start-worker.ps1, then retry.",
          LOCAL_TRY_ON_TIMEOUT: "The local model is taking too long on this computer. Try again after it finishes.",
          LOCAL_TRY_ON_FAILED: "The local model could not create this preview. Try a clearer image or another garment.",
        };
        setTryOnError(messages[code] || `The try-on service returned ${code || "no result"}. Check its provider or local worker status.`);
      }
    } catch (error: any) {
      const code = String(error?.code || error?.message || "").split(":")[0].trim().toUpperCase();
      const messages: Record<string, string> = {
        API_UNAVAILABLE: "ATELIER's backend is offline. Start npm run dev, then try again.",
        HTTP_401: "Your sign-in session expired. Sign in again before creating a preview.",
        UNAUTHORIZED: "Your sign-in session expired. Sign in again before creating a preview.",
        HTTP_503: "No try-on engine is available. Start the local worker or configure a try-on provider in Admin.",
        TRY_ON_PROVIDER_ERROR: "The configured try-on engine failed. Check its provider status or local worker, then retry.",
        TRY_ON_NOT_CONFIGURED: "Virtual Try-On is not connected yet. Ask the store admin to configure an AI provider.",
        TRY_ON_DAILY_LIMIT: "Your daily try-on allowance is used up. Try again after it resets.",
        TRY_ON_MONTHLY_LIMIT: "The monthly try-on allowance is used up.",
        TRY_ON_PROVIDER_QUOTA: "The AI provider has reached its quota. Try again later.",
        TRY_ON_PROVIDER_AUTH: "The AI provider rejected its credentials or subscription.",
        LOCAL_TRY_ON_UNAVAILABLE: "Start the local try-on model with backend/local-tryon/start-worker.ps1, then retry.",
        LOCAL_TRY_ON_TIMEOUT: "The local model is taking too long on this computer. Try again after it finishes.",
        LOCAL_TRY_ON_FAILED: "The local model could not create this preview. Try a clearer image or another garment.",
      };
      setTryOnError(messages[code] || "The try-on preview could not be created. Check the AI provider setup and try again.");
    } finally { setTryOnBusy(false); }
  };
  return (
    <section className="cin-3d-section" aria-label="Three dimensional looks">
      <div className="cin-3d-edit" aria-labelledby="cin-3d-title">
        <div className="cin-3d-heading">
          <div><div className="cin-micro">06 / 3D LOOKS</div><h3 id="cin-3d-title">Switch the look.</h3></div>
          <p>Explore the supplied full-look GLB models in 3D. Each option switches the complete model.</p>
        </div>
        <div className="cin-3d-grid">
          {THREE_D_LOOKS.map((look, index) => (
            <article className={`cin-3d-card cin-3d-card-${index + 1}`} key={look.src}>
              <div className="cin-3d-art"><ModelViewer src={look.src} title={look.title} preview /><span>ATELIER / FIG. 0{index + 1}</span><i /><b>0{index + 1}</b><small>ROTATE<br />TO EXPLORE</small></div>
              <div className="cin-3d-card-copy"><div><span>{look.category}</span><h4>{look.title}</h4></div><button type="button" onClick={(event) => { restoreFocusRef.current = event.currentTarget; setActive3DLook(look); }}>Explore in 3D <span aria-hidden="true">↗</span></button></div>
            </article>
          ))}
        </div>
      </div>
      {active3DLook && (
        <div className="cin-3d-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActive3DLook(null); }}>
          <section className="cin-3d-dialog" role="dialog" aria-modal="true" aria-labelledby="cin-3d-dialog-title">
            <header className="cin-3d-dialog-head"><div><div className="cin-micro">INTERACTIVE LOOK / {active3DLook.category}</div><h3 id="cin-3d-dialog-title">{active3DLook.title}</h3></div><button type="button" onClick={() => setActive3DLook(null)} aria-label="Close 3D look">×</button></header>
            <div className="cin-3d-look-switcher" role="group" aria-label="Change 3D outfit">
              <span>CHANGE 3D LOOK</span>
              {THREE_D_LOOKS.map((look) => (
                <button
                  type="button"
                  key={look.src}
                  className={`cin-3d-look-option ${active3DLook.src === look.src ? "selected" : ""}`}
                  aria-pressed={active3DLook.src === look.src}
                  onClick={() => {
                    setActive3DLook(look);
                    setTryOnError("");
                    setTryOnResults([]);
                  }}
                >
                  <div className="cin-3d-look-thumbnail" aria-hidden="true">
                    {look.poster ? (
                      <img src={look.poster} alt="" className="cin-3d-thumb-img" />
                    ) : (
                      <div className="cin-3d-thumb-placeholder" />
                    )}
                  </div>
                  <span className="cin-3d-look-name">{look.title}</span>
                </button>
              ))}
            </div>
            <div ref={viewerRef} key={active3DLook.src}><ModelViewer src={active3DLook.src} title={active3DLook.title} /></div>
            <div className="cin-tryon">
      <div className="cin-tryon-head"><b>AI PHOTO PREVIEW · ALL GARMENTS</b><span>{selectedProducts.length}/5 selected</span></div>
              <div className="cin-tryon-products">
                {availableProducts.map((product) => {
                  const image = Array.isArray(product.images) ? product.images[0] : "";
                  const selected = selectedProducts.includes(product.id);
                  return <button type="button" key={product.id} className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => { setTryOnError(""); setSelectedProducts((current) => selected ? current.filter((id) => id !== product.id) : current.length < 5 ? [...current, product.id] : current); }} disabled={!selected && selectedProducts.length >= 5}><img src={image || "/images/fallback-fashion.svg"} alt="" /><span>{product.name}</span></button>;
                })}
                {!availableProducts.length && <p>No active products are available to try on.</p>}
              </div>
              <p className="cin-tryon-note">Choose any garment for any model. This creates a still AI image using the model view and product photo; it does not change the 3D garment or guarantee fit.</p>
              {tryOnError && <p className="cin-tryon-error" role="alert">{tryOnError}</p>}
              <button className="cin-tryon-submit" type="button" onClick={runTryOn} disabled={tryOnBusy || !selectedProducts.length}>{tryOnBusy ? "Creating preview…" : user ? "Generate try-on preview" : "Sign in to try on"}</button>
              {tryOnResults.length > 0 && <div className="cin-tryon-results" aria-live="polite">{tryOnResults.map((result, index) => <figure key={`${result.productId || "look"}-${index}`}><img src={result.image} alt={`AI try-on result ${index + 1}`} /><figcaption>{result.name || "Try-on result"}</figcaption></figure>)}</div>}
            </div>
            <p className="cin-3d-dialog-note">Drag to rotate · scroll or pinch to zoom · close to release the 3D resources</p>
          </section>
        </div>
      )}
    </section>
  );
}

export function CinLetter({ c }: { c: any }) {
  const [email, setEmail] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  const ref = useReveal([c]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(v)) {
      setStatus("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const r = await api<any>("/newsletter/subscribe", {
        method: "POST",
        body: JSON.stringify({ email: v }),
      });
      setStatus(
        r.alreadySubscribed
          ? "You’re already on the list."
          : "You’re on the list. Welcome to ATELIER.",
      );
      setEmail("");
    } catch (err: any) {
      setStatus(
        String(err?.message || "Something went wrong. Please try again."),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="cin-letter-wrap">
      <section className="cin-letter reveal" id="newsletter" ref={ref}>
        <div>
          <div className="cin-micro">{c.micro}</div>
          <h2>{lines(c.title)}</h2>
        </div>
        <div>
          <p>{c.body}</p>
          <form onSubmit={submit} noValidate>
            <div className="cin-signup">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setStatus("");
                }}
                placeholder={c.placeholder || "Your email address"}
                aria-label="Your email address"
              />
              <button type="submit" disabled={busy}>
                {busy ? "Saving…" : `${c.button || "Join us"} ↗`}
              </button>
            </div>
            <div className="cin-signup-status" role="status" aria-live="polite">
              {status}
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let pending = false;
    const apply = () => {
      pending = false;
      const max = document.documentElement.scrollHeight - innerHeight;
      if (ref.current)
        ref.current.style.width = (max > 0 ? (scrollY / max) * 100 : 0) + "%";
    };
    const req = () => {
      if (!pending) {
        pending = true;
        requestAnimationFrame(apply);
      }
    };
    apply();
    window.addEventListener("scroll", req, { passive: true });
    window.addEventListener("resize", req);
    return () => {
      window.removeEventListener("scroll", req);
      window.removeEventListener("resize", req);
    };
  }, []);
  return <div className="cin-progress" ref={ref} aria-hidden="true" />;
}

/** Soft acid ring that follows the pointer on desktop and grows over interactive elements (hidden on touch / reduced motion). */
export function CursorRing() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (
      !matchMedia("(pointer:fine) and (prefers-reduced-motion: no-preference)")
        .matches
    )
      return;
    const el = ref.current;
    if (!el) return;
    let x = -100,
      y = -100,
      cx = -100,
      cy = -100,
      raf = 0;
    const tick = () => {
      raf = 0;
      if (document.hidden) return;
      cx += (x - cx) * 0.22;
      cy += (y - cy) * 0.22;
      el.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`;
      if (Math.abs(x - cx) > 0.1 || Math.abs(y - cy) > 0.1)
        raf = requestAnimationFrame(tick);
    };
    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      el.classList.add("on");
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const over = (e: Event) => {
      const t = e.target as Element | null;
      el.classList.toggle(
        "hover",
        Boolean(
          t?.closest?.(
            "a,button,[role=button],input,select,textarea,label,summary",
          ),
        ),
      );
    };
    const leave = () => {
      el.classList.remove("on");
      cancelAnimationFrame(raf);
      raf = 0;
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerover", over, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerover", over);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, []);
  return <div className="cin-cursor" ref={ref} aria-hidden="true" />;
}
