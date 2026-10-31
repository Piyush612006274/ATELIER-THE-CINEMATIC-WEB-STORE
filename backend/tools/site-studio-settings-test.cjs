const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const context = { exports: {}, require };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/lib/site-editor-settings.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const { siteSettingValueSchema, siteCopyOverridesSchema, siteMediaOverridesSchema } = context.exports;
test('saved text edits and image edits pass the real settings validator and survive serialization', () => {
  const words = { '/about:abc': { original: 'Our story', text: 'Our new story', route: '/about', scope: 'section/H2:1' } };
  const images = { '/:image': { original: '/old.webp', src: '/uploads/new.webp', route: '/' } };
  assert.deepEqual(JSON.parse(JSON.stringify(siteSettingValueSchema.parse(words))), words);
  assert.deepEqual(JSON.parse(JSON.stringify(siteSettingValueSchema.parse(images))), images);
  assert.deepEqual(siteSettingValueSchema.parse({ style: 'glow' }), { style: 'glow' });
  assert.equal(siteSettingValueSchema.parse('ATELIER'), 'ATELIER');
});
test('malformed, oversized and unbounded nested editor values are rejected', () => {
  assert.equal(siteCopyOverridesSchema.safeParse({ x: { original: 'Title', text: 'a'.repeat(4001), route: '/' } }).success, false);
  assert.equal(siteMediaOverridesSchema.safeParse({ x: { original: '/a.jpg', src: {}, route: '/' } }).success, false);
  assert.equal(siteSettingValueSchema.safeParse({ x: { deeply: { nested: 'value' } } }).success, false);
  assert.equal(siteCopyOverridesSchema.safeParse({ x: { original: 'Title', text: '', route: '/' } }).success, true);
});
