import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read only the API-base setting needed by this config. Next.js still loads
// the full .env files for the application itself. This deliberately avoids
// importing @next/env, preventing ESM/CommonJS named-export errors entirely.
function readApiBaseFromEnvFiles() {
  const candidates = [
    ".env",
    ".env.local",
    `.env.${process.env.NODE_ENV || "development"}`,
    `.env.${process.env.NODE_ENV || "development"}.local`,
  ];
  let value;
  for (const name of candidates) {
    const file = path.join(__dirname, name);
    if (!fs.existsSync(file)) continue;
    const contents = fs.readFileSync(file, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?NEXT_PUBLIC_API_BASE\s*=\s*(.*?)\s*$/);
      if (!match) continue;
      let nextValue = match[1];
      if ((nextValue.startsWith('"') && nextValue.endsWith('"')) ||
          (nextValue.startsWith("'") && nextValue.endsWith("'"))) {
        nextValue = nextValue.slice(1, -1);
      }
      // A later, more specific env file wins, matching dotenv conventions.
      value = nextValue;
    }
  }
  return value;
}


function readValueFromEnvFiles(key) {
  const candidates = [
    ".env",
    ".env.local",
    `.env.${process.env.NODE_ENV || "development"}`,
    `.env.${process.env.NODE_ENV || "development"}.local`,
  ];
  let value;
  for (const name of candidates) {
    const file = path.join(__dirname, name);
    if (!fs.existsSync(file)) continue;
    const contents = fs.readFileSync(file, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=\\s*(.*?)\\s*$`));
      if (!match) continue;
      let nextValue = match[1];
      if ((nextValue.startsWith('"') && nextValue.endsWith('"')) ||
          (nextValue.startsWith("'") && nextValue.endsWith("'"))) nextValue = nextValue.slice(1, -1);
      value = nextValue;
    }
  }
  return value;
}

const configuredApiBase = (
  process.env.NEXT_PUBLIC_API_BASE || readApiBaseFromEnvFiles() || ""
).trim();

if (process.env.NODE_ENV === "production" && !configuredApiBase) {
  throw new Error(
    "NEXT_PUBLIC_API_BASE must be explicitly configured for production. Set it in frontend/.env.local or the deployment environment."
  );
}
const configuredSecurityToken = (
  process.env.ATELIER_SECURITY_INTERNAL_TOKEN || readValueFromEnvFiles("ATELIER_SECURITY_INTERNAL_TOKEN") || ""
).trim();
if (process.env.NODE_ENV === "production" && (!configuredSecurityToken || configuredSecurityToken.length < 32 || /^(?:REPLACE|CHANGE_ME|PASTE|YOUR_)/i.test(configuredSecurityToken))) {
  throw new Error(
    "ATELIER_SECURITY_INTERNAL_TOKEN must be a unique random secret of at least 32 characters and must match SECURITY_INTERNAL_TOKEN in backend/.env."
  );
}

const apiBase = configuredApiBase || "http://localhost:4000/api";
const apiOrigin = apiBase.replace(/\/api\/?$/, "").replace(/\/$/, "");

const nextConfig = {
  devIndicators: false,
  // Keep build checks in worker threads: Windows can deny child-process
  // creation (spawn EPERM), preventing a usable production build.
  experimental: { workerThreads: true, useTypeScriptCli: false, cpus: 2 },
  turbopack: { root: path.resolve(__dirname, "..") },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/images/uploads/:path*",
          destination: `${apiOrigin}/uploads/:path*`,
        },
        {
          source: "/uploads/:path*",
          destination: `${apiOrigin}/uploads/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
