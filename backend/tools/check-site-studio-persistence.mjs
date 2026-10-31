import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '../dist/database/prisma.js';
import { siteSettingValueSchema } from '../dist/lib/site-editor-settings.js';

const rollback = new Error('ROLLBACK_STUDIO_CHECK');
const key = `__atelier_studio_check_${randomUUID()}`;
const edits = {
  siteCopyOverrides: { '/:test': { original: 'Our story', text: 'A new chapter', route: '/', scope: 'section/H2:1' } },
  siteMediaOverrides: { '/:image': { original: '/old.jpg', src: '/uploads/new.jpg', route: '/' } },
  siteMotion: { style: 'glow' },
};
try {
  for (const value of Object.values(edits)) siteSettingValueSchema.parse(value);
  try {
    await prisma.$transaction(async tx => {
      await tx.siteSetting.create({ data: { key, value: edits } });
      const saved = await tx.siteSetting.findUnique({ where: { key } });
      assert.deepEqual(saved.value, edits);
      await tx.siteSetting.update({ where: { key }, data: { value: { presentation: 'fade', frames: [{ title: 'Edited card', image: '/image.jpg', link: '/shop' }] } } });
      const layout = await tx.siteSetting.findUnique({ where: { key } });
      assert.equal(layout.value.presentation, 'fade'); assert.equal(layout.value.frames[0].title, 'Edited card');
      throw rollback;
    });
  } catch (error) { if (error !== rollback && error.message !== rollback.message) throw error; }
  assert.equal(await prisma.siteSetting.findUnique({ where: { key } }), null);
  console.log('PASS: real database round-trip preserved website words, images, animation and card JSON; transaction rolled back.');
} catch { console.error('Website editor persistence check failed.'); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
