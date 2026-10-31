"use client";
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { campaignLayout } from '@/lib/campaign-layouts';
import { cardSceneMotion, scrollSceneState } from '@/lib/campaign-motion';

export function CampaignCards({ c, onNavigate }: { c: any; onNavigate: (path: string) => void }) {
  const frames = Array.isArray(c.frames) ? c.frames : [];
  const layout = campaignLayout(c.presentation);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const rail = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const meter = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  const [motionReduced, setMotionReduced] = useState(false);
  const reduced = useRef(false);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { reduced.current = media.matches; setMotionReduced(media.matches); };
    update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => { activeRef.current = 0; setActive(0); }, [layout, frames.length]);
  useEffect(() => {
    if (layout !== 'stack' || !frames.length) return;
    let pending = 0;
    const apply = () => {
      pending = 0;
      if (!track.current || !stage.current || !rail.current) return;
      const rect = track.current.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > innerHeight) return;
      const scene = scrollSceneState(rect.top, track.current.offsetHeight, stage.current.offsetHeight, frames.length);
      Array.from(rail.current.children).forEach((child, index) => {
        const element = child as HTMLElement;
        const motion = cardSceneMotion(scene.position, index, reduced.current);
        element.style.opacity = String(motion.opacity);
        element.style.setProperty('--scene-y', `${motion.y.toFixed(2)}px`);
        element.style.setProperty('--scene-scale', motion.scale.toFixed(4));
      });
      if (meter.current) meter.current.style.transform = `scaleX(${scene.progress})`;
      if (scene.active !== activeRef.current) { activeRef.current = scene.active; setActive(scene.active); }
    };
    const request = () => { if (!pending) pending = requestAnimationFrame(apply); };
    apply(); window.addEventListener('scroll', request, { passive: true }); window.addEventListener('resize', request);
    return () => { cancelAnimationFrame(pending); window.removeEventListener('scroll', request); window.removeEventListener('resize', request); };
  }, [layout, frames.length, motionReduced]);
  useEffect(() => {
    if (layout !== 'fade' || !c.autoplay || paused || frames.length < 2) return;
    const id = window.setInterval(() => { if (!document.hidden && !reduced.current && !rail.current?.matches(':hover, :focus-within')) setActive(value => (value + 1) % frames.length); }, Math.max(3000, Math.min(15000, Number(c.intervalMs) || 5500)));
    return () => window.clearInterval(id);
  }, [layout, c.autoplay, c.intervalMs, frames.length, paused]);
  const move = (index: number) => {
    const next = (index + frames.length) % frames.length;
    if (layout === 'stack' && track.current && stage.current && !reduced.current) {
      const start = window.scrollY + track.current.getBoundingClientRect().top;
      const travel = Math.max(1, track.current.offsetHeight - stage.current.offsetHeight);
      window.scrollTo({ top: start + travel * next / Math.max(1, frames.length - 1), behavior: 'smooth' });
      return;
    }
    setActive(next);
    if (layout === 'horizontal') (rail.current?.children[next] as HTMLElement | undefined)?.scrollIntoView({ behavior: reduced.current ? 'instant' : 'smooth', block: 'nearest', inline: 'center' });
  };
  if (!frames.length) return null;
  const customColours = c.cardTheme === 'custom';
  const background = customColours ? c.cardBackground || '#101311' : 'var(--c-ink-2, #101311)';
  const text = customColours ? c.cardTextColor || '#f1eee7' : 'var(--c-paper, #f1eee7)';
  const style = { '--campaign-radius': `${Math.max(0, Math.min(64, Number(c.cardRadius ?? 32)))}px`, '--campaign-background': background, '--campaign-text': text, '--campaign-speed': `${Math.max(150, Math.min(1600, Number(c.animationMs) || 600))}ms` } as CSSProperties;
  return <section id="film" className={`campaign-showcase layout-${layout} ${customColours ? 'theme-custom' : 'theme-site'}`} style={style} aria-label={c.heading || 'Explore the collection'}>
    <header className="campaign-heading"><span>{c.eyebrow || 'ATELIER / THE COLLECTION'}</span><h2>{c.heading || 'A look for every day.'}</h2><p>{c.hint || 'Explore the looks and find your favourite.'}</p></header>
    <div ref={track} className="campaign-scroll-track" style={layout === 'stack' ? { height: `${Math.max(2, frames.length) * 105}svh` } : undefined}>
    <div ref={stage} className="campaign-stage" onPointerMove={event => {
      if (reduced.current || event.pointerType === 'touch') return;
      const bounds = event.currentTarget.getBoundingClientRect();
      event.currentTarget.style.setProperty('--pointer-x', (((event.clientX - bounds.left) / Math.max(1, bounds.width) - .5) * 2).toFixed(3));
      event.currentTarget.style.setProperty('--pointer-y', (((event.clientY - bounds.top) / Math.max(1, bounds.height) - .5) * 2).toFixed(3));
    }} onPointerLeave={event => { event.currentTarget.style.setProperty('--pointer-x', '0'); event.currentTarget.style.setProperty('--pointer-y', '0'); }}>
    <div ref={rail} className="campaign-cards" onScroll={layout === 'horizontal' ? () => { const element = rail.current; if (!element) return; const children = Array.from(element.children) as HTMLElement[]; const closest = children.reduce((best, item, index) => Math.abs(item.offsetLeft - element.offsetLeft - element.scrollLeft) < Math.abs(children[best].offsetLeft - element.offsetLeft - element.scrollLeft) ? index : best, 0); setActive(closest); } : undefined}>
      {frames.map((frame: any, index: number) => {
        const link = String(frame.link || '/shop');
        const safeLink = link.startsWith('/') && !link.startsWith('//') ? link : '/shop';
        const inactive = (layout === 'fade' || (layout === 'stack' && !motionReduced)) && index !== active;
        return <article key={index} className={`campaign-card ${index === active ? 'is-active' : ''}`} aria-hidden={inactive ? true : undefined} inert={inactive ? true : undefined} style={{ '--card-order': index, '--card-ink': customColours ? frame.textColor || text : text, '--card-accent': customColours ? frame.textColor || text : 'var(--c-acid, #d7ff55)', background: customColours ? frame.background || undefined : undefined } as CSSProperties}>
          <div className="campaign-card-copy"><span className="campaign-card-number">{String(index + 1).padStart(2, '0')} / {frame.chapter}</span><h3>{frame.title} <em>{frame.emphasis}</em></h3><p>{frame.desc}</p><a className="campaign-card-link" href={safeLink} onClick={event => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0) { event.preventDefault(); onNavigate(safeLink); } }}>{frame.buttonText || 'Explore this look'} <span aria-hidden="true">↗</span></a></div>
          <figure><img src={frame.image} alt={frame.tag || `${frame.title || ''} ${frame.emphasis || ''}`} loading={index === 0 ? 'eager' : 'lazy'} style={{ objectFit: c.imageFit === 'cover' ? 'cover' : 'contain' }} />{frame.tag && <figcaption>{frame.tag}</figcaption>}</figure>
        </article>;
      })}
    </div>
    {(layout === 'stack' || layout === 'horizontal' || layout === 'fade') && <div className="campaign-navigation" role="group" aria-label="Choose a card"><button type="button" onClick={() => move(active - 1)} aria-label="Previous card">←</button>{frames.map((_: any, index: number) => <button key={index} type="button" aria-label={`Card ${index + 1}`} aria-pressed={active === index} onClick={() => move(index)}>{String(index + 1).padStart(2, '0')}</button>)}<button type="button" onClick={() => move(active + 1)} aria-label="Next card">→</button>{layout === 'fade' && c.autoplay && <button type="button" aria-label={paused ? 'Resume automatic cards' : 'Pause automatic cards'} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? '▶' : 'Ⅱ'}</button>}</div>}
    {layout === 'stack' && <div className="campaign-scroll-meter" aria-hidden="true"><div ref={meter} /></div>}
    </div></div>
  </section>;
}
