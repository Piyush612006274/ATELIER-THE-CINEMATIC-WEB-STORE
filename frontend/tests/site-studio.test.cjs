const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
function load(file, dependencies = {}, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const context = { exports: {}, require: name => dependencies[name] || require(name), ...globals };
  vm.runInNewContext(code, context); return context.exports;
}
const copy = load('lib/site-copy.ts');
const layouts = load('lib/campaign-layouts.ts');
const motion = load('lib/campaign-motion.ts');
const { CampaignCards } = load('components/storefront/campaign-cards.tsx', { '@/lib/campaign-layouts': layouts, '@/lib/campaign-motion': motion });
const { CinFilm } = load('components/storefront/cinematic.tsx', { '@/lib/api': {}, '@/lib/campaign-layouts': layouts, './campaign-cards': { CampaignCards }, 'next/dynamic': { default: () => () => null } });

test('copy edits remain scoped to the page and individual text location', () => {
  const key = copy.siteCopyKey('/about', 'Our story', 'section-one/H2:1');
  const saved = JSON.parse(JSON.stringify({ [key]: { route: '/about', original: 'Our story', text: 'Our new story' } }));
  assert.equal(copy.copyReplacement(saved, '/about', 'Our story', 'section-one/H2:1'), 'Our new story');
  assert.equal(copy.copyReplacement(saved, '/about', 'Our story', 'section-two/H2:1'), 'Our story');
  assert.equal(copy.copyReplacement(saved, '/', 'Our story', 'section-one/H2:1'), 'Our story');
  assert.equal(copy.copyReplacement(saved, '/about', 'Changed source', 'section-one/H2:1'), 'Changed source');
  assert.equal(copy.copyReplacement({}, '/about', 'Our story', 'section-one/H2:1'), 'Our story');
});

test('live preview applies and restores text and page photos without replacing DOM nodes or changing amounts', () => {
  class Element {
    nodeType = 1; childNodes = []; attrs = {}; tagName; parentElement = null; previousElementSibling = null;
    constructor(tag, parent) { this.tagName = tag; this.parentElement = parent || null; if (parent) parent.childNodes.push(this); }
    closest(selector) {
      for (let node = this; node; node = node.parentElement) {
        if (selector === '[data-cms-section-id]' && node.attrs['data-cms-section-id']) return node;
        if (selector === 'header,footer,main' && ['HEADER','FOOTER','MAIN'].includes(node.tagName)) return node;
      }
      return null;
    }
    getAttribute(key) { return this.attrs[key] ?? null; }
    setAttribute(key, value) { this.attrs[key] = value; }
    removeAttribute(key) { delete this.attrs[key]; }
  }
  class Image extends Element { alt = 'Editorial photo'; }
  const body = new Element('BODY'), main = new Element('MAIN', body), heading = new Element('H2', main), price = new Element('SPAN', main);
  const text = { nodeType: 3, data: 'Our story', parentElement: heading }; heading.childNodes.push(text);
  const amount = { nodeType: 3, data: '₹1,999', parentElement: price }; price.childNodes.push(amount);
  const photo = new Image('IMG', main); photo.setAttribute('src', '/original.jpg'); photo.setAttribute('srcset', '/original-large.jpg 2x');
  const messages = [], listeners = new Map(), refs = []; let refIndex = 0, effects = [], cleanups = [];
  const parent = { postMessage: data => messages.push(data) };
  const windowMock = { parent };
  const documentMock = { body, documentElement: { dataset: {} }, querySelectorAll: () => [photo],
    createTreeWalker: () => { let index = 0; const texts = [text, amount]; return { nextNode: () => texts[index++] || null }; },
    addEventListener: (key, handler) => listeners.set(key, handler), removeEventListener: key => listeners.delete(key),
    caretRangeFromPoint: () => ({ startContainer: text }),
  };
  const { SiteTextLayer } = load('components/storefront/site-text-layer.tsx', {
    '@/lib/site-copy': copy,
    react: { useRef: value => { const index = refIndex++; return refs[index] ||= { current: value }; }, useEffect: effect => effects.push(effect) },
  }, { document: documentMock, window: windowMock, location: { origin: 'https://atelier.test' }, Element, HTMLImageElement: Image, Node: { TEXT_NODE: 3 }, NodeFilter: { SHOW_TEXT: 4 }, MutationObserver: class { observe() {} disconnect() {} }, setTimeout, clearTimeout });
  const render = settings => { cleanups.forEach(cleanup => cleanup?.()); refIndex = 0; effects = []; SiteTextLayer({ settings, route: '/', canvas: true }); cleanups = effects.map(effect => effect()); };
  render({});
  listeners.get('click')({ target: heading, clientX: 0, clientY: 0 });
  const chosen = messages.find(message => message.type === 'atelier:canvas-copy-selected');
  assert.equal(chosen.original, 'Our story'); assert.ok(chosen.scope);
  const imageKey = copy.siteCopyKey('/', '/original.jpg', 'image');
  render({ siteCopyOverrides: { [chosen.key]: { original: chosen.original, route: '/', text: '<b>New story</b>' } }, siteMediaOverrides: { [imageKey]: { original: '/original.jpg', src: '/replacement.jpg', route: '/' } }, siteMotion: { style: 'glow' } });
  assert.equal(text.data, '<b>New story</b>'); assert.equal(heading.childNodes[0], text);
  assert.equal(amount.data, '₹1,999'); assert.equal(photo.getAttribute('src'), '/replacement.jpg'); assert.equal(photo.getAttribute('srcset'), null);
  assert.equal(documentMock.documentElement.dataset.siteMotion, 'glow');
  render({});
  assert.equal(text.data, 'Our story'); assert.equal(photo.getAttribute('src'), '/original.jpg'); assert.equal(photo.getAttribute('srcset'), '/original-large.jpg 2x');
  cleanups.forEach(cleanup => cleanup?.());
});
test('copy replacement preserves inline spacing, supports empty text, and does not interpret HTML', () => {
  const key = copy.siteCopyKey('/', ' Explore ');
  const saved = { [key]: { route: '/', original: 'Explore', text: '<img src=x onerror=alert(1)>' } };
  assert.equal(copy.copyReplacement(saved, '/', ' Explore '), ' <img src=x onerror=alert(1)> ');
  saved[key].text = '';
  assert.equal(copy.copyReplacement(saved, '/', ' Explore '), '  ');
  saved[key].route = '/other'; assert.equal(copy.copyReplacement(saved, '/', ' Explore '), ' Explore ');
});
test('six presentation choices survive a JSON save/load with the same card content', () => {
  assert.equal(layouts.CAMPAIGN_LAYOUTS.length, 6);
  assert.equal(layouts.campaignLayout('unrecognised'), 'film');
  const card = { title: 'Weekend', emphasis: 'essentials', desc: 'Everyday comfort', image: '/images/one.jpg', buttonText: 'View collection', link: '/shop?gender=Men' };
  for (const layout of layouts.CAMPAIGN_LAYOUTS) {
    const persisted = JSON.parse(JSON.stringify({ presentation: layout.id, show3D: false, frames: [card, { ...card, title: 'Evening', image: '/images/two.jpg' }] }));
    const html = renderToStaticMarkup(React.createElement(CinFilm, { c: persisted, onNavigate() {} }));
    assert.ok(html.includes(layout.id === 'film' ? 'cin-film' : `layout-${layout.id}`)); assert.ok(html.includes('Weekend'));
    assert.ok(html.includes('/images/one.jpg'));
    if (layout.id !== 'film') { assert.ok(html.includes('View collection')); assert.ok(html.includes('/shop?gender=Men')); }
    if (layout.id === 'fade') assert.ok(html.includes('inert=""'));
  }
});
test('card actions cannot navigate to an executable or external URL', () => {
  for (const link of ['javascript:alert(1)', '//external.example', 'https://external.example']) {
    const html = renderToStaticMarkup(React.createElement(CampaignCards, { c: { frames: [{ title: 'Look', image: '/look.jpg', link }] }, onNavigate() {} }));
    assert.ok(html.includes('href="/shop"')); assert.ok(!html.includes('href="javascript:'));
  }
});

test('legacy homepage content retains the original interactive film by default', () => {
  const html = renderToStaticMarkup(React.createElement(CinFilm, { c: { show3D: false, frames: [{ title: 'Original film', image: '/film.jpg', chapter: 'First' }] }, onNavigate() {} }));
  assert.ok(html.includes('cin-film-stage')); assert.ok(html.includes('cin-film-controls'));
  assert.ok(!html.includes('campaign-card'));
});

test('scroll scenes advance continuously from first to last and clamp outside the track', () => {
  const first = motion.scrollSceneState(100, 3000, 1000, 3);
  assert.equal(first.active, 0); assert.equal(first.progress, 0);
  const middle = motion.scrollSceneState(-1000, 3000, 1000, 3);
  assert.equal(middle.active, 1); assert.equal(middle.progress, .5);
  const end = motion.scrollSceneState(-4000, 3000, 1000, 3);
  assert.equal(end.active, 2); assert.equal(end.progress, 1);
  assert.equal(motion.scrollSceneState(-500, 0, 0, 0).active, 0);
  assert.equal(motion.cardSceneMotion(1, 1, false).opacity, 1);
  assert.equal(motion.cardSceneMotion(1, 0, false).opacity, 0);
  assert.equal(motion.cardSceneMotion(.5, 0, false).opacity, .5);
  assert.ok(motion.cardSceneMotion(.5, 1, false).y > 0);
  assert.equal(motion.cardSceneMotion(2, 0, true).opacity, 1);
  assert.equal(motion.cardSceneMotion(2, 0, true).scale, 1);
});
