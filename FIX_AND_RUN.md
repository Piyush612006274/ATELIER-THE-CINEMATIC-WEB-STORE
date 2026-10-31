# ATELIER V18 — database and run commands

## What changed

- Added a forward-only migration `0008_reconcile_site_snapshot_table`. It recognises either `SiteSnapshot` (older local migration) or `SiteDesignSnapshot` (current Prisma schema). It renames the old table when appropriate, creates the expected table if neither exists, and merges old rows if both tables exist. It does not delete the old table or overwrite matching IDs.
- `npm run dev` now deploys pending database migrations before Prisma Client generation and starting the API.
- `npm run prod` is now defined; it builds the app then starts both services. The API start hook deploys pending migrations before listening.
- `npm run install:all` uses the committed frontend/backend lockfiles to install dependencies. It does not package `node_modules` into the project ZIP.
- Production start sets `NODE_ENV=production` for the API process.

## First run on Windows PowerShell

Run from the folder containing the root `package.json`:

```powershell
npm run install:all
npm run db:status
npm run dev
```

`backend/.env` must point `DATABASE_URL` to the intended, already-created PostgreSQL database. Keep your real `.env` files out of ZIPs and source control. `npm run dev` deploys pending migrations; it does not reset or seed the database.

To build and run production mode locally:

```powershell
npm run prod
```

Before `npm run prod`, make sure `frontend/.env.local` has a correct `NEXT_PUBLIC_API_BASE` and a unique `ATELIER_SECURITY_INTERNAL_TOKEN` that matches `SECURITY_INTERNAL_TOKEN` in `backend/.env`. Production builds deliberately fail if these are not configured.

## Are website snapshots required?

No—not for ordinary page rendering, storefront browsing, or saving the current CMS design. They are used by the Visual Builder's **History**, manual checkpoints, restore, and safety backups before page/factory resets or a design upgrade. This patch keeps that feature and fixes its database-table mismatch. Removing the snapshot feature entirely would also mean removing those History/restore controls and backup calls.

## Verification notes

Static project verification and CMS/security/admin audits were run successfully after these changes. A full TypeScript/Next production build and live database migration could not be verified in this packaging environment because npm dependency installation timed out and no project database credentials are included in the ZIP. Run the commands above on the Windows machine with network access and the project's configured database.
