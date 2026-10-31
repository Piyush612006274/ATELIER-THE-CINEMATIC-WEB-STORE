import { prisma } from '../dist/database/prisma.js';
try {
  const sections = await prisma.siteSection.findMany({ where: { type: 'CIN_FILM', page: { slug: 'home' } }, orderBy: { sortOrder: 'asc' }, select: { id: true, content: true } });
  console.log(sections.map(section => ({ id: section.id, presentation: section.content?.presentation || '(default)', frames: section.content?.frames?.length || 0 })));
} finally { await prisma.$disconnect(); }
