"use client";
import { useEffect, useRef } from 'react';
import { copyReplacement, siteCopyKey, type SiteCopyMap } from '@/lib/site-copy';

const excluded = 'script,style,noscript,textarea,input,select,option,code,pre,[contenteditable],.admin-page,.aic-shell,.atelier-pet,[role="alert"],[role="status"],.toast,.price,.product-price,.cin-price,.checkout-summary,.order-summary,[data-private]';
export function SiteTextLayer({ settings, route, canvas }: { settings: Record<string, any>; route: string; canvas: boolean }) {
  const originals = useRef(new WeakMap<Text, { original: string; displayed: string }>());
  const originalImages = useRef(new WeakMap<HTMLImageElement, { original: string; srcSet: string | null; displayed: string }>());
  const entries = useRef<SiteCopyMap>({}); entries.current = settings.siteCopyOverrides || {};
  const media = useRef<Record<string, { original: string; src: string; route: string }>>({}); media.current = settings.siteMediaOverrides || {};
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.siteMotion = ['none', 'subtle', 'glow', 'lift', 'underline'].includes(settings.siteMotion?.style) ? settings.siteMotion.style : 'subtle';
    return () => { delete root.dataset.siteMotion; };
  }, [settings.siteMotion?.style]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const nodes = new Map<string, { original: string; text: string; route: string; scope: string }>();
    const scopeFor = (node: Text) => {
      const parent = node.parentElement;
      const anchor = parent?.closest('[data-cms-section-id]') || parent?.closest('header,footer,main') || document.body;
      const parts = [anchor.getAttribute('data-cms-section-id') || anchor.tagName];
      let element = parent;
      while (element && element !== anchor) {
        let index = 1, sibling = element.previousElementSibling;
        while (sibling) { if (sibling.tagName === element.tagName) index++; sibling = sibling.previousElementSibling; }
        parts.push(`${element.tagName}:${index}`); element = element.parentElement;
      }
      if (parent) parts.push(`text:${Array.from(parent.childNodes).filter(child => child.nodeType === Node.TEXT_NODE).indexOf(node)}`);
      return parts.join('/');
    };
    const eligible = (node: Text) => {
      const parent = node.parentElement;
      const text = (originals.current.get(node)?.original || node.data).trim();
      if (parent?.closest('.page-account,.page-checkout,.page-cart') && !parent.closest('label,h1,h2,h3,button')) return false;
      return parent && !parent.closest(excluded) && text.length > 1 && text.length < 1800 && /\p{L}/u.test(text) && !/[₹$€]|\S+@\S+/.test(text);
    };
    const sendList = () => { if (canvas && window.parent !== window) window.parent.postMessage({ type: 'atelier:canvas-copy-list', route, entries: [...nodes].map(([key, item]) => ({ key, ...item })).slice(0, 400) }, location.origin); };
    const scan = () => {
      observer.disconnect(); nodes.clear();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let raw: Node | null;
      while ((raw = walker.nextNode())) {
        const node = raw as Text;
        if (!eligible(node)) continue;
        let record = originals.current.get(node);
        if (!record || (node.data !== record.displayed && node.data !== record.original)) record = { original: node.data, displayed: node.data };
        const scope = scopeFor(node);
        const replacement = copyReplacement(entries.current, route, record.original, scope);
        if (node.data !== replacement) node.data = replacement;
        record.displayed = replacement; originals.current.set(node, record);
        nodes.set(siteCopyKey(route, record.original, scope), { original: record.original.trim(), text: replacement.trim(), route, scope });
      }
      const imageRows: Array<{ key: string; original: string; src: string; route: string; alt: string }> = [];
      document.querySelectorAll<HTMLImageElement>('img').forEach(image => {
        if (image.closest(`${excluded},.product-card,.cin-product,.product-gallery,.page-account,.page-checkout,.page-cart,a[href^="/product/"]`)) return;
        const src = image.getAttribute('src') || ''; if (!src || src.startsWith('data:') || src.startsWith('blob:')) return;
        let record = originalImages.current.get(image);
        if (!record || (src !== record.original && src !== record.displayed)) record = { original: src, displayed: src, srcSet: image.getAttribute('srcset') };
        const key = siteCopyKey(route, record.original, 'image');
        const override = media.current[key];
        const next = override?.original === record.original && override.route === route && typeof override.src === 'string' ? override.src : record.original;
        if (next !== src) image.setAttribute('src', next);
        if (override && next !== record.original) image.removeAttribute('srcset');
        else if (record.srcSet) image.setAttribute('srcset', record.srcSet);
        record.displayed = next; originalImages.current.set(image, record);
        imageRows.push({ key, original: record.original, src: next, route, alt: image.alt });
      });
      observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['src', 'srcset'] });
      if (canvas && window.parent !== window) window.parent.postMessage({ type: 'atelier:canvas-image-list', route, entries: [...new Map(imageRows.map(row => [row.key, row])).values()].slice(0, 200) }, location.origin);
      sendList();
    };
    const observer = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(scan, 180); });
    const onClick = (event: MouseEvent) => {
      if (!canvas || !(event.target instanceof Element) || event.target.closest(excluded)) return;
      if (event.target instanceof HTMLImageElement) {
        const image = event.target;
        const record = originalImages.current.get(image);
        if (record) window.parent.postMessage({ type: 'atelier:canvas-image-selected', key: siteCopyKey(route, record.original, 'image'), original: record.original, src: image.getAttribute('src') || record.original, alt: image.alt, route }, location.origin);
        return;
      }
      const range = document.caretRangeFromPoint?.(event.clientX, event.clientY);
      const text = range?.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer as Text : Array.from(event.target.childNodes).find(node => node.nodeType === Node.TEXT_NODE) as Text | undefined;
      if (!text || !eligible(text)) return;
      const record = originals.current.get(text); if (!record) return;
      const scope = scopeFor(text);
      window.parent.postMessage({ type: 'atelier:canvas-copy-selected', key: siteCopyKey(route, record.original, scope), original: record.original.trim(), text: text.data.trim(), route, scope }, location.origin);
    };
    scan(); document.addEventListener('click', onClick, true);
    return () => { observer.disconnect(); clearTimeout(timer); document.removeEventListener('click', onClick, true); };
  }, [route, canvas, settings.siteCopyOverrides, settings.siteMediaOverrides]);
  return null;
}
