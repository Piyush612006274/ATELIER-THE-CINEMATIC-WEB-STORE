// One-shot local DB bootstrap: creates/fixes the "atelier" role + database to match DATABASE_URL,
// then runs migrations and seeds the admin. Usage: npm run db:bootstrap
import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import readline from "node:readline/promises";
import { spawnSync } from "node:child_process";
import { stdin as input, stdout as output } from "node:process";

// Load .env the same way the API does (backend/.env preferred, then project root)
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(backendDir, "..");
const rootEnv = path.join(projectRoot, ".env");
const backendEnv = path.join(backendDir, ".env");
if (existsSync(rootEnv)) dotenv.config({ path: rootEnv });
if (existsSync(backendEnv)) dotenv.config({ path: backendEnv, override: true });

const databaseUrl = String(process.env.DATABASE_URL || "").trim();
if (!databaseUrl) {
  console.error(
    "DATABASE_URL is missing or empty.\n" +
    "1. Copy backend/.env.example → backend/.env\n" +
    "2. Set DATABASE_URL=postgresql://atelier:YOUR_PASSWORD@localhost:5432/atelier?schema=public\n" +
    "3. Replace CHANGE_ME / REPLACE_* placeholders with real values, then re-run: npm run db:bootstrap"
  );
  process.exit(1);
}

let url;
try {
  url = new URL(databaseUrl);
} catch {
  console.error(`DATABASE_URL is not a valid URL: "${databaseUrl}"`);
  process.exit(1);
}

const appUser = decodeURIComponent(url.username);
const appPass = decodeURIComponent(url.password);
const dbName = url.pathname.replace(/^\//, "").split("?")[0];
const host = url.hostname || "localhost";
const port = Number(url.port || 5432);
const ident = (s) => `"${s.replace(/"/g, '""')}"`;
const lit = (s) => `'${s.replace(/'/g, "''")}'`;


async function tryConnect(user, password, database) {
  const c = new pg.Client({ host, port, user, password, database });
  try { await c.connect(); return c; } catch (e) { return { error: e }; }
}

/** Try several maintenance DBs — some Windows installs omit the default "postgres" DB. */
async function tryConnectAny(user, password, databases) {
  const errors = [];
  for (const database of databases) {
    const result = await tryConnect(user, password, database);
    if (!result.error) return { client: result, database };
    errors.push(`${database}: ${result.error.code || result.error.message}`);
  }
  return { error: errors.join(" | ") };
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32", cwd: new URL("..", import.meta.url) });
  if (r.status !== 0) { console.error(`\n"${cmd} ${args.join(" ")}" failed.`); process.exit(r.status || 1); }
}

const superUser = process.env.PG_SUPERUSER || "postgres";
// Prefer postgres, then template1 (always present), then the target app DB if it already exists.
const maintenanceDbs = ["postgres", "template1", dbName].filter((v, i, a) => v && a.indexOf(v) === i);

const ok = await tryConnect(appUser, appPass, dbName);
if (ok.error) {
  console.log(`Cannot log in as "${appUser}" (${ok.error.code || ok.error.message}). Fixing using the PostgreSQL superuser...`);
  let superPass = process.env.PG_SUPERUSER_PASSWORD;
  if (superPass === undefined) {
    const rl = readline.createInterface({ input, output });
    superPass = await rl.question(`Password of PostgreSQL user '${superUser}' (set during PostgreSQL install): `);
    rl.close();
  }
  const adminTry = await tryConnectAny(superUser, superPass, maintenanceDbs);
  if (adminTry.error) {
    console.error("Superuser login failed. Tried databases:", adminTry.error);
    console.error(
      "\nTips:\n" +
      "1. Confirm PostgreSQL is running (Services → postgresql-x64-... → Start).\n" +
      "2. Confirm the superuser password (the one you set at install time).\n" +
      "3. Or create the role/DB manually in pgAdmin / psql, then re-run this script.\n" +
      `   CREATE ROLE ${appUser} WITH LOGIN PASSWORD '...';\n` +
      `   CREATE DATABASE ${dbName} OWNER ${appUser};`
    );
    process.exit(1);
  }
  const admin = adminTry.client;
  console.log(`Connected as "${superUser}" via database "${adminTry.database}".`);
  const role = await admin.query("select 1 from pg_roles where rolname=$1", [appUser]);
  await admin.query(`${role.rowCount ? "ALTER" : "CREATE"} ROLE ${ident(appUser)} WITH LOGIN PASSWORD ${lit(appPass)}`);
  const db = await admin.query("select 1 from pg_database where datname=$1", [dbName]);
  if (!db.rowCount) await admin.query(`CREATE DATABASE ${ident(dbName)} OWNER ${ident(appUser)}`);
  else await admin.query(`ALTER DATABASE ${ident(dbName)} OWNER TO ${ident(appUser)}`);
  await admin.end();
  const inDb = await tryConnect(superUser, superPass, dbName);
  if (!inDb.error) { await inDb.query(`ALTER SCHEMA public OWNER TO ${ident(appUser)}`); await inDb.end(); }
  const again = await tryConnect(appUser, appPass, dbName);
  if (again.error) { console.error("Still cannot connect as app user:", again.error.message); process.exit(1); }
  await again.end();
  console.log(`Role "${appUser}" and database "${dbName}" are ready.`);
} else {
  await ok.end();
  console.log(`Login as "${appUser}" works.`);
}

run("npx", ["prisma", "generate", "--config", "prisma.config.ts"]);
run("npx", ["prisma", "migrate", "deploy", "--config", "prisma.config.ts"]);
run("npx", ["prisma", "db", "seed", "--config", "prisma.config.ts"]);
console.log("\nDone. Now run: npm run dev");
