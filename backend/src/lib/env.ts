import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Env loading order (later overrides earlier):
 *  1) project-root /.env
 *  2) backend/.env  (preferred for API secrets)
 *
 * After changing any value, restart the API process (`npm run dev` / `npm run start`).
 * ADMIN_EMAIL / ADMIN_PASSWORD are synced into the admin record when the API starts
 * and the database is reachable. Restart the API after changing these values.
 * Frontend NEXT_PUBLIC_* values require a Next.js restart (and rebuild in production).
 */
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const projectRoot = path.resolve(backendDir, "..");
const rootEnv = path.join(projectRoot, ".env");
const backendEnv = path.join(backendDir, ".env");

if (existsSync(rootEnv)) dotenv.config({ path: rootEnv });
if (existsSync(backendEnv)) dotenv.config({ path: backendEnv, override: true });

/** Required at runtime for auth cookies / JWT. */
export function requireJwtSecret(): string {
  const value = String(process.env.JWT_SECRET || "").trim();
  if (!value || value.includes("REPLACE") || value.includes("CHANGE_ME")) {
    throw new Error(
      "JWT_SECRET is missing or still a placeholder. Set a long random secret in backend/.env and restart the API."
    );
  }
  return value;
}

/** Admin email used for seed + registration reservation. */
export function adminEmailFromEnv(): string {
  return String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
}

export const env = process.env;
