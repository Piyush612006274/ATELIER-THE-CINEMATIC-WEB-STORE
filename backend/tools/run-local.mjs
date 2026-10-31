import { spawn, execSync } from "node:child_process";
import net from "node:net";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

function cleanPort(port) {
  try {
    if (process.platform === "win32") {
      const output = execSync(`netstat -ano | findstr LISTENING | findstr :${port}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      const lines = output.trim().split("\n");
      const killed = new Set();
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== "0" && Number(pid) !== process.pid && !killed.has(pid)) {
          killed.add(pid);
          try {
            execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" });
            console.log(`[atelier] Cleared stale process tree ${pid} on port ${port}.`);
          } catch {}
        }
      }
      if (killed.size > 0) {
        // Allow brief moment for Windows kernel to close sockets
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 400);
      }
    } else {
      execSync(`fuser -k ${port}/tcp 2>/dev/null || true`, { stdio: "ignore" });
    }
  } catch {}
}

const mode = process.argv[2] === "start" ? "start" : "dev";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const children = new Map();
const serviceEnv = mode === "start" ? { ...process.env, NODE_ENV: "production" } : process.env;

// The API loads root .env and then backend/.env (backend values win). Read only
// API_PORT here so the supervisor waits on the same port without passing all
// backend secrets into the storefront process environment.
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(backendDir, "..");
const rootEnvPath = path.join(projectRoot, ".env");
const backendEnvPath = path.join(backendDir, ".env");
const rootEnv = existsSync(rootEnvPath) ? dotenv.parse(readFileSync(rootEnvPath)) : {};
const backendEnv = existsSync(backendEnvPath) ? dotenv.parse(readFileSync(backendEnvPath)) : {};
let apiPortValue = process.env.API_PORT ?? rootEnv.API_PORT ?? "4000";
if (Object.prototype.hasOwnProperty.call(backendEnv, "API_PORT")) apiPortValue = backendEnv.API_PORT;
const apiPort = Number(apiPortValue);
if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) {
  console.error(`[atelier] Invalid API_PORT value: ${String(apiPortValue)}. Set an integer from 1 to 65535 in backend/.env.`);
  process.exit(1);
}

function waitForPort(host, port, timeoutMs = 30000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const probe = () => {
      const socket = net.createConnection({ host, port });
      socket.once("connect", () => { socket.destroy(); resolve(); });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - started >= timeoutMs) reject(new Error(`API did not open port ${port} within ${timeoutMs / 1000}s`));
        else setTimeout(probe, 250);
      });
    };
    probe();
  });
}

function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children.values()) {
    try {
      if (process.platform === "win32" && child.pid) {
        execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: "ignore" });
      } else {
        child.kill("SIGTERM");
      }
    } catch {}
  }
  cleanPort(apiPort);
  cleanPort(3000);
  setTimeout(() => process.exit(code), 300);
}

let stopping = false;
const restartTimestamps = new Map();
const pendingRestarts = new Set();

function restartService(name, workspace, scriptName) {
  if (stopping) return;
  const now = Date.now();
  const timestamps = (restartTimestamps.get(name) || []).filter(t => now - t < 60000);
  timestamps.push(now);
  restartTimestamps.set(name, timestamps);

  if (timestamps.length > 5) {
    console.error(`[${name}] crashed too frequently (>5 times in 1 minute). Halting.`);
    stopAll(1);
    return;
  }

  pendingRestarts.add(name);
  console.log(`[atelier] Auto-restarting ${name} in 1s...`);
  setTimeout(() => {
    pendingRestarts.delete(name);
    if (!stopping) {
      spawnService(name, workspace, scriptName);
    }
  }, 1000);
}

function spawnService(name, workspace, scriptName) {
  const workspacePath = workspace === "@atelier/api" ? "backend" : "frontend";
  let cmd = npmCommand;
  let args = ["--prefix", workspacePath, "run", scriptName];
  let cwd = projectRoot;
  let useShell = process.platform === "win32";

  if (mode === "start") {
    // In production start, spawn node directly to avoid Windows batch file / cmd.exe wrapper detachment
    if (workspace === "@atelier/api") {
      cmd = process.execPath;
      args = [path.join(backendDir, "dist", "index.js")];
      cwd = backendDir;
      useShell = false;
    } else {
      cmd = process.execPath;
      args = [path.join(projectRoot, "frontend", "node_modules", "next", "dist", "bin", "next"), "start", "-p", "3000"];
      cwd = path.join(projectRoot, "frontend");
      useShell = false;
    }
  }

  const child = spawn(cmd, args, {
    cwd,
    stdio: ["ignore", "inherit", "inherit"],
    env: serviceEnv,
    shell: useShell
  });
  children.set(name, child);
  child.on("error", (err) => {
    console.error(`[${name}] failed to start: ${err.message}`);
    stopAll(1);
  });
  child.on("exit", (code, signal) => {
    children.delete(name);
    if (!stopping && code !== 0) {
      console.error(`[${name}] exited with code ${code ?? "null"}${signal ? ` (${signal})` : ""}`);
      stopAll(code || 1);
    } else if (!stopping && children.size === 0) {
      stopAll(code || 0);
    }
  });
  return child;
}

async function main() {
  cleanPort(apiPort);
  cleanPort(3000);
  // Start the API first. This avoids the frontend racing the Express server on a cold launch.
  spawnService("api", "@atelier/api", mode);
  try {
    await waitForPort("127.0.0.1", apiPort, Number(process.env.ATELIER_API_START_TIMEOUT_MS || 30000));
    console.log(`[atelier] API is listening on ${apiPort}; starting storefront.`);
  } catch (error) {
    console.error(`[atelier] ${error.message}`);
    stopAll(1);
    return;
  }
  cleanPort(3000);
  spawnService("storefront", "@atelier/storefront", mode);
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
main().catch((error) => { console.error(`[atelier] ${error.message}`); stopAll(1); });
