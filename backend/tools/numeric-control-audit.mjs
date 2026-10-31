import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadGlobalCssParts } from "./css-source.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cms = fs.readFileSync(path.join(root, 'frontend/components/admin/cms-kit.tsx'), 'utf8');
const storefront = fs.readFileSync(path.join(root, 'frontend/components/storefront/storefront.tsx'), 'utf8');
const cssParts = loadGlobalCssParts(root);
const css = cssParts.join('\n');
const checks = [];
const pass = (name, ok, detail='') => { checks.push({name, ok, detail}); console.log(`${ok ? 'PASS' : 'FAIL'} :: ${name}${detail ? ` :: ${detail}` : ''}`); };

pass('shared RangeControl exported', /export function RangeControl\(/.test(cms));
pass('wheel adjustment enabled', /onWheel=\{e => \{ e\.preventDefault\(\);[^}]*e\.deltaY/.test(cms));
pass('native keyboard adjustment preserved', /type="range"[\s\S]*aria-label=\{label\}/.test(cms));
pass('image height uses range', /<RangeControl label="Height"[\s\S]*d\.height/.test(cms));
pass('image-list interval uses range', /<RangeControl label="Change every"[\s\S]*intervalMs/.test(cms));
pass('hero slider interval uses range', /<RangeControl label="Slide every"[\s\S]*d\.intervalMs/.test(cms));
pass('hero slider height uses range', /<RangeControl label="Slider height"[\s\S]*d\.height/.test(cms));
pass('image panel height uses range', /<RangeControl label="Image panel height"[\s\S]*d\.imageHeight/.test(cms));
pass('desktop columns uses range', /<RangeControl label="Cards per row \(desktop\)"[\s\S]*d\.columns/.test(cms));
pass('spacer height uses range', /t === "SPACER"\) form = <RangeControl label="Height"/.test(cms));
pass('section spacing uses range', /<RangeControl label="Extra top\/bottom spacing"[\s\S]*d\.spacing/.test(cms));
pass('category sort order uses range', /<RangeControl label="Sort order"[\s\S]*editing\.sortOrder/.test(storefront));
pass('category image height uses range', /<RangeControl label="Image height"[\s\S]*editing\.imageHeight/.test(storefront));
pass('no numeric input controls remain', !/type="number"/.test(cms) && !/type="number"/.test(storefront));
pass('range styling present', /\.range-input\{/.test(css) && /\.range-control-head output\{/.test(css) && /cursor:ew-resize/.test(css));
pass('range mobile styling present', /@media\(max-width:600px\)\{\.range-control/.test(css));

const fails = checks.filter(x => !x.ok);
console.log(`NUMERIC_CONTROL_AUDIT=${checks.length - fails.length}/${checks.length} PASS`);
process.exit(fails.length ? 1 : 0);
