import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { lstat, mkdir, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { deflateRawSync, inflateRawSync } from "node:zlib";

const root = path.join(os.tmpdir(), "virgo-dev-workspaces");
const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 500 * 1024 * 1024;
const MAX_FILES = 5000;
const MAX_COMMAND_MS = 30_000;
const MAX_OUTPUT_BYTES = 64 * 1024;

function workspacePath(userId: string, workspaceId: string) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(userId) || !/^[a-f0-9-]{36}$/i.test(workspaceId)) throw new Error("DEV_WORKSPACE_INVALID_ID");
  return path.join(root, userId, workspaceId);
}

export function createDevelopmentWorkspace(userId: string, base64: string) {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 === 1) throw new Error("DEV_WORKSPACE_INVALID_ARCHIVE");
  const archive = Buffer.from(base64, "base64");
  if (!archive.length || archive.length > MAX_ARCHIVE_BYTES) throw new Error("DEV_WORKSPACE_ARCHIVE_LIMIT");
  const eocd = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0 || eocd + 22 > archive.length) throw new Error("DEV_WORKSPACE_INVALID_ARCHIVE");
  const count = archive.readUInt16LE(eocd + 10);
  let cursor = archive.readUInt32LE(eocd + 16);
  if (count > MAX_FILES || cursor >= archive.length) throw new Error("DEV_WORKSPACE_ARCHIVE_LIMIT");
  const entries: Array<{ name: string; method: number; compressed: number; size: number; local: number; mode: number }> = [];
  let expanded = 0;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > archive.length || archive.readUInt32LE(cursor) !== 0x02014b50) throw new Error("DEV_WORKSPACE_INVALID_ARCHIVE");
    const flags = archive.readUInt16LE(cursor + 8);
    const method = archive.readUInt16LE(cursor + 10);
    const compressed = archive.readUInt32LE(cursor + 20);
    const size = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const external = archive.readUInt32LE(cursor + 38);
    const local = archive.readUInt32LE(cursor + 42);
    const name = archive.toString("utf8", cursor + 46, cursor + 46 + nameLength).replace(/\\/g, "/");
    const mode = external >>> 16;
    if ((flags & 1) !== 0 || (mode & 0o170000) === 0o120000 || name.startsWith("/") || /^[A-Za-z]:/.test(name) || name.split("/").includes("..")) throw new Error("DEV_WORKSPACE_UNSAFE_ARCHIVE");
    if (size > MAX_EXPANDED_BYTES || expanded + size > MAX_EXPANDED_BYTES) throw new Error("DEV_WORKSPACE_ARCHIVE_LIMIT");
    expanded += size;
    if (name && !name.endsWith("/")) entries.push({ name, method, compressed, size, local, mode });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  const workspaceId = randomUUID();
  const destination = workspacePath(userId, workspaceId);
  return (async () => {
    await mkdir(destination, { recursive: true });
    try {
      for (const entry of entries) {
        if (entry.local + 30 > archive.length || archive.readUInt32LE(entry.local) !== 0x04034b50) throw new Error("DEV_WORKSPACE_INVALID_ARCHIVE");
        const nameLength = archive.readUInt16LE(entry.local + 26);
        const extraLength = archive.readUInt16LE(entry.local + 28);
        const start = entry.local + 30 + nameLength + extraLength;
        const end = start + entry.compressed;
        if (end > archive.length) throw new Error("DEV_WORKSPACE_INVALID_ARCHIVE");
        const compressed = archive.subarray(start, end);
        const content = entry.method === 0 ? compressed : entry.method === 8 ? inflateRawSync(compressed, { maxOutputLength: MAX_EXPANDED_BYTES }) : null;
        if (!content || content.length !== entry.size) throw new Error("DEV_WORKSPACE_UNSUPPORTED_ARCHIVE");
        const target = path.resolve(destination, ...entry.name.split("/"));
        if (!target.startsWith(destination + path.sep)) throw new Error("DEV_WORKSPACE_UNSAFE_ARCHIVE");
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, content, { flag: "wx", mode: entry.mode & 0o111 ? 0o755 : 0o644 });
      }
      return { workspaceId, files: entries.map(entry => ({ path: entry.name, bytes: entry.size })) };
    } catch (error) {
      await rm(destination, { recursive: true, force: true });
      throw error;
    }
  })();
}

async function resolveWorkspaceFile(userId: string, workspaceId: string, relativePath: string) {
  if (!relativePath || relativePath.length > 500 || relativePath.includes("\\") || path.posix.isAbsolute(relativePath) || relativePath.split("/").some(part => !part || part === "." || part === "..")) throw new Error("DEV_WORKSPACE_INVALID_PATH");
  const base = workspacePath(userId, workspaceId);
  const target = path.resolve(base, ...relativePath.split("/"));
  if (!target.startsWith(base + path.sep)) throw new Error("DEV_WORKSPACE_INVALID_PATH");
  const canonicalBase = await realpath(base);
  let ancestor = path.dirname(target);
  while (ancestor.startsWith(base)) {
    try {
      const canonicalAncestor = await realpath(ancestor);
      if (!canonicalAncestor.startsWith(canonicalBase)) throw new Error("DEV_WORKSPACE_INVALID_PATH");
    } catch (error: any) { if (error?.code !== "ENOENT") throw error; }
    if (ancestor === base) break;
    ancestor = path.dirname(ancestor);
  }
  try { if ((await lstat(target)).isSymbolicLink()) throw new Error("DEV_WORKSPACE_INVALID_PATH"); }
  catch (error: any) { if (error?.code !== "ENOENT") throw error; }
  return { base, target };
}

export async function readDevelopmentWorkspaceFile(userId: string, workspaceId: string, relativePath: string) {
  const { target } = await resolveWorkspaceFile(userId, workspaceId, relativePath);
  const metadata = await stat(target);
  if (!metadata.isFile() || metadata.size > 2 * 1024 * 1024) throw new Error("DEV_WORKSPACE_FILE_LIMIT");
  return (await readFile(target)).toString("utf8");
}

export async function writeDevelopmentWorkspaceFile(userId: string, workspaceId: string, relativePath: string, content: string) {
  if (content.length > 2 * 1024 * 1024) throw new Error("DEV_WORKSPACE_FILE_LIMIT");
  const { target } = await resolveWorkspaceFile(userId, workspaceId, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
  return { path: relativePath, bytes: Buffer.byteLength(content) };
}

export async function listDevelopmentWorkspaceFiles(userId: string, workspaceId: string) {
  const base = workspacePath(userId, workspaceId);
  const result: Array<{ path: string; bytes: number }> = [];
  const visit = async (directory: string) => {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, item.name);
      if (item.isSymbolicLink()) continue;
      if (item.isDirectory()) await visit(full);
      else if (item.isFile()) result.push({ path: path.relative(base, full).split(path.sep).join("/"), bytes: (await stat(full)).size });
    }
  };
  await visit(base);
  return result;
}

export async function exportDevelopmentWorkspace(userId: string, workspaceId: string) {
  const base = workspacePath(userId, workspaceId);
  const files = await listDevelopmentWorkspaceFiles(userId, workspaceId);
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    if (/(?:^|\/)(?:\.env(?:\.(?!example$)[^/]*)?|\.npmrc|credentials?\.json|id_rsa|id_ed25519|[^/]+\.(?:pem|key|p12|pfx|crt|cer))$/i.test(file.path)) continue;
    if (file.bytes > 20 * 1024 * 1024) continue;
    const name = Buffer.from(file.path, "utf8");
    const source = await readFile(path.join(base, ...file.path.split("/")));
    const compressed = deflateRawSync(source);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(source), 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(source.length, 22); local.writeUInt16LE(name.length, 26);
    locals.push(local, name, compressed);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt16LE(0x0800, 8); entry.writeUInt16LE(8, 10);
    entry.writeUInt32LE(crc32(source), 16); entry.writeUInt32LE(compressed.length, 20); entry.writeUInt32LE(source.length, 24); entry.writeUInt16LE(name.length, 28); entry.writeUInt32LE(offset, 42);
    central.push(entry, name);
    offset += local.length + name.length + compressed.length;
  }
  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10); end.writeUInt32LE(centralBytes.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBytes, end]);
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}

export async function runDevelopmentWorkspaceCommand(userId: string, workspaceId: string, command: string) {
  if (!command.trim() || command.length > 1000) throw new Error("DEV_WORKSPACE_INVALID_COMMAND");
  const { base } = await resolveWorkspaceFile(userId, workspaceId, "workspace.check");
  const docker = process.env.VIRGO_SANDBOX_DOCKER || "docker";
  const image = process.env.VIRGO_SANDBOX_IMAGE || "node:22-bookworm";
  const containerName = `virgo-run-${randomUUID()}`;
  const args = ["run", "--name", containerName, "--rm", "--network", "none", "--memory", "1g", "--cpus", "1", "--pids-limit", "128", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--stop-timeout", "1", "--tmpfs", "/tmp:rw,noexec,nosuid,size=128m", "-v", `${base}:/workspace:rw`, "-w", "/workspace", image, "sh", "-lc", command];
  return new Promise<{ exitCode: number; output: string; timedOut: boolean }>((resolve, reject) => {
    const child = spawn(docker, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let timedOut = false;
    const append = (chunk: Buffer) => { output = (output + chunk.toString("utf8")).slice(-MAX_OUTPUT_BYTES); };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
      const killer = spawn(docker, ["kill", containerName], { windowsHide: true, stdio: "ignore" });
      killer.unref();
    }, MAX_COMMAND_MS);
    child.on("error", error => { clearTimeout(timer); reject(error.message.includes("ENOENT") ? new Error("DEV_WORKSPACE_DOCKER_UNAVAILABLE") : new Error("DEV_WORKSPACE_RUN_FAILED")); });
    child.on("close", code => {
      clearTimeout(timer);
      if (!timedOut && code !== 0 && /docker desktop is unable to start|cannot connect to the docker daemon|error during connect/i.test(output)) return reject(new Error("DEV_WORKSPACE_DOCKER_UNAVAILABLE"));
      resolve({ exitCode: code ?? 1, output, timedOut });
    });
  });
}
