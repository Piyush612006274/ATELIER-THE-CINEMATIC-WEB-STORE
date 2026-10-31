# ATELIER — project layout (V21)

```
ATELIER/
├─ backend/                       API (Node + Express + Prisma)
│  ├─ database/                   everything about the database
│  │   ├─ schema.prisma           data model
│  │   ├─ migrations/             SQL migrations (run: npm run db:deploy)
│  │   └─ seed.ts                 demo products/categories (npm run db:seed)
│  ├─ src/
│  │   ├─ index.ts                API entry + routes
│  │   ├─ admin/                  admin-dashboard backend logic
│  │   │   ├─ siteHistory.ts      daily website snapshots, restore, factory reset
│  │   │   ├─ paymentConfig.ts    Razorpay keys saved from the dashboard (encrypted)
│  │   │   ├─ aiProviders.ts      AI providers registry (chat / image / try-on)
│  │   │   └─ imageGeneration.ts  image generation through the chosen AI
│  │   ├─ database/               data access + built-in content
│  │   │   ├─ prisma.ts           Prisma client
│  │   │   ├─ cmsDefaults.ts      default pages / sections (used by "Reset page")
│  │   │   ├─ cinematicDefaults.ts default content of the cinematic home
│  │   │   ├─ siteDefaults.ts     default site settings
│  │   │   └─ catalog.ts          catalogue helpers
│  │   ├─ lib/                    auth, email, env, razorpay, security, whatsapp, ai
│  │   └─ middleware/
│  ├─ tools/                      audits, QA and setup scripts
│  └─ prisma.config.ts            Prisma CLI config (points to database/)
├─ frontend/                      Next.js storefront + admin dashboard
│  ├─ app/                        routes + global CSS
│  ├─ components/
│  │   ├─ storefront/             shop UI (storefront.tsx, cinematic.tsx)
│  │   └─ admin/                  dashboard UI (visual-site-builder, cms-kit, cin-form,
│  │                              ai-provider-studio, admin-extras ...)
│  ├─ lib/                        api client, shared defaults
│  └─ public/                     images
└─ package.json                   root scripts (npm run dev / build / db:* / qa:static)
```
