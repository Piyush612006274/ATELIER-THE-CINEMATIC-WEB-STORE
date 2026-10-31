import { inflateRawSync, inflateSync } from "node:zlib";

export type ChatAttachmentInput = { name: string; mimeType: string; dataBase64: string };
export type ChatImageAttachment = { name: string; mimeType: string; dataBase64: string };
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_DEV_FILE_BYTES = 500 * 1024 * 1024;
const MAX_TOTAL_BYTES = 500 * 1024 * 1024;
const MAX_DEV_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_TEXT_CHARS = 300_000;
const MAX_DEV_TEXT_CHARS = 32_000_000;
const TEXT_MIMES = new Set(["text/plain", "text/markdown", "text/csv", "application/json", "application/xml", "text/xml"]);
const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_MIMES = new Set(["video/mp4", "video/webm"]);
const OFFICE_EXTS = new Set(["docx", "xlsx", "pptx"]);

function decodeData(input: ChatAttachmentInput, developmentMode = false): Buffer {
  // File names are only used as labels; reject only control characters / path separators / absurd length.
  if (!input.name || input.name.length > 180 || /[\u0000-\u001f\\/]/.test(input.name)) throw new Error("CHAT_ATTACHMENT_INVALID_NAME");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(input.dataBase64) || input.dataBase64.length % 4 === 1) throw new Error("CHAT_ATTACHMENT_INVALID_DATA");
  const bytes = Buffer.from(input.dataBase64, "base64");
  if (!bytes.length) throw new Error("CHAT_ATTACHMENT_INVALID_DATA");
  if (bytes.length > (developmentMode ? MAX_DEV_FILE_BYTES : MAX_FILE_BYTES)) throw new Error("CHAT_ATTACHMENT_TOO_LARGE");
  return bytes;
}
function xmlText(xml: string): string {
  return xml.replace(/<w:tab\b[^>]*\/>|<a:tab\b[^>]*\/>/g, "\t").replace(/<\/w:p>|<\/a:p>|<\/row>|<\/si>|<\/c>/g, "\n")
    .replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
}
function readZipText(bytes: Buffer, ext: string, textLimit = MAX_TEXT_CHARS, developmentMode = false): string {
  const eocd = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0 || eocd + 22 > bytes.length) throw new Error("CHAT_ATTACHMENT_INVALID_ARCHIVE");
  const count = bytes.readUInt16LE(eocd + 10);
  const directoryOffset = bytes.readUInt32LE(eocd + 16);
  if (count > 3000 || directoryOffset >= bytes.length) throw new Error("CHAT_ATTACHMENT_ARCHIVE_LIMIT");
  const selected: Array<{ name: string; method: number; compressed: number; uncompressed: number; local: number }> = [];
  let cursor = directoryOffset;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > bytes.length || bytes.readUInt32LE(cursor) !== 0x02014b50) throw new Error("CHAT_ATTACHMENT_INVALID_ARCHIVE");
    const method = bytes.readUInt16LE(cursor + 10);
    const compressed = bytes.readUInt32LE(cursor + 20);
    const uncompressed = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const local = bytes.readUInt32LE(cursor + 42);
    const rawName = bytes.toString("utf8", cursor + 46, cursor + 46 + nameLength);
    const name = rawName.replace(/\\/g, "/");
    if (name.startsWith("/") || /^[A-Za-z]:/.test(name) || name.split("/").includes("..")) throw new Error("CHAT_ATTACHMENT_INVALID_ARCHIVE");
    const expandedLimit = developmentMode ? MAX_DEV_TOTAL_BYTES : MAX_TOTAL_BYTES;
    if (uncompressed > expandedLimit || selected.reduce((sum, item) => sum + item.uncompressed, 0) + uncompressed > expandedLimit) throw new Error("CHAT_ATTACHMENT_ARCHIVE_LIMIT");
    const isUseful = ext === "zip" ? /\.(?:txt|md|csv|json|xml|html|css|js|jsx|ts|tsx|mjs|cjs|py|rs|go|java|kt|swift|c|cc|cpp|h|hpp|cs|php|rb|sh|ps1|toml|ya?ml|ini|sql|graphql|vue|svelte|astro|env\.example)$/i.test(name) : ext === "docx" ? /^word\/(?:document|footnotes|endnotes)\.xml$/i.test(name) : ext === "xlsx" ? /^xl\/(?:sharedStrings|worksheets\/sheet\d+)\.xml$/i.test(name) : /^ppt\/slides\/slide\d+\.xml$/i.test(name);
    if (isUseful && uncompressed) selected.push({ name, method, compressed, uncompressed, local });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  const chunks: string[] = [];
  for (const item of selected) {
    if (item.local + 30 > bytes.length || bytes.readUInt32LE(item.local) !== 0x04034b50) throw new Error("CHAT_ATTACHMENT_INVALID_ARCHIVE");
    const nameLength = bytes.readUInt16LE(item.local + 26);
    const extraLength = bytes.readUInt16LE(item.local + 28);
    const start = item.local + 30 + nameLength + extraLength;
    const end = start + item.compressed;
    if (end > bytes.length) throw new Error("CHAT_ATTACHMENT_INVALID_ARCHIVE");
    const compressed = bytes.subarray(start, end);
    let content: Buffer;
    if (item.method === 0) content = compressed;
    else if (item.method === 8) content = inflateRawSync(compressed, { maxOutputLength: developmentMode ? MAX_DEV_TOTAL_BYTES : MAX_TOTAL_BYTES });
    else continue;
    const raw = content.toString("utf8");
    chunks.push(`[${item.name}]\n${/\.xml$/i.test(item.name) ? xmlText(raw) : raw}`);
  }
  return chunks.join("\n").slice(0, textLimit);
}
function readPdfText(bytes: Buffer): string {
  const source = bytes.toString("latin1");
  const output: string[] = [];
  const streams = source.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g);
  for (const match of streams) {
    const raw = Buffer.from(match[1], "latin1");
    let decoded = raw.toString("latin1");
    try { if (/\/FlateDecode/.test(source.slice(Math.max(0, (match.index || 0) - 300), match.index || 0))) decoded = inflateSync(raw, { maxOutputLength: 8 * 1024 * 1024 }).toString("latin1"); } catch { continue; }
    for (const text of decoded.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) output.push(text[1].replace(/\\([()\\])/g, "$1").replace(/\\n/g, "\n"));
    for (const array of decoded.matchAll(/\[((?:[^\]]|\\\])*)\]\s*TJ/g)) for (const text of array[1].matchAll(/\(((?:\\.|[^\\)])*)\)/g)) output.push(text[1].replace(/\\([()\\])/g, "$1").replace(/\\n/g, "\n"));
  }
  return output.join(" ").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARS);
}
export function prepareChatAttachments(inputs: ChatAttachmentInput[], developmentMode = false): { images: ChatImageAttachment[]; text: string } {
  if (inputs.length > (developmentMode ? 40 : 8)) throw new Error("CHAT_ATTACHMENT_COUNT_LIMIT");
  let total = 0;
  const images: ChatImageAttachment[] = [];
  const documents: string[] = [];
  for (const input of inputs) {
    const bytes = decodeData(input, developmentMode);
    total += bytes.length;
    if (total > (developmentMode ? MAX_DEV_TOTAL_BYTES : MAX_TOTAL_BYTES)) throw new Error("CHAT_ATTACHMENT_TOTAL_LIMIT");
    const textLimit = developmentMode ? MAX_DEV_TEXT_CHARS : MAX_TEXT_CHARS;
    const ext = input.name.split(".").pop()?.toLowerCase() || "";
    const suppliedMime = input.mimeType.toLowerCase();
    const mime = !suppliedMime || suppliedMime === "application/octet-stream" ? ({ pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", zip: "application/zip", mp4: "video/mp4", webm: "video/webm", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" } as Record<string, string>)[ext] || suppliedMime : suppliedMime;
    if (IMAGE_MIMES.has(mime) || VIDEO_MIMES.has(mime)) {
      const valid = mime === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : mime === "image/jpeg" ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff : mime === "image/webp" ? bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" : mime === "video/mp4" ? bytes.toString("ascii", 4, 8) === "ftyp" : bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
      if (!valid) throw new Error("CHAT_ATTACHMENT_MIME_MISMATCH");
      images.push({ name: input.name.slice(0, 180), mimeType: mime, dataBase64: bytes.toString("base64") });
    } else if (TEXT_MIMES.has(mime) || ["txt", "md", "csv", "json", "xml", "ts", "tsx", "js", "jsx", "mjs", "cjs", "html", "htm", "css", "scss", "yaml", "yml", "toml", "ini", "log", "py", "rs", "go", "java", "c", "h", "cpp", "hpp", "cs", "php", "rb", "sh", "ps1", "sql", "graphql", "vue", "svelte", "astro", "env", "properties"].includes(ext)) {
      documents.push(`[${input.name}]\n${bytes.toString("utf8").replace(/\u0000/g, "").slice(0, textLimit)}`);
    } else if (ext === "pdf" || mime === "application/pdf") {
      if (bytes.toString("ascii", 0, 5) !== "%PDF-") throw new Error("CHAT_ATTACHMENT_MIME_MISMATCH");
      documents.push(`[${input.name}]\n${readPdfText(bytes) || "No extractable text found (the PDF may be scanned or protected)."}`);
    } else if (OFFICE_EXTS.has(ext) || ext === "zip" || mime === "application/zip" || mime === "application/x-zip-compressed") {
      if (bytes.toString("ascii", 0, 2) !== "PK") throw new Error("CHAT_ATTACHMENT_INVALID_ARCHIVE");
      documents.push(`[${input.name}]\n${readZipText(bytes, OFFICE_EXTS.has(ext) ? ext : "zip", textLimit, developmentMode) || "No supported text files were found in this archive."}`);
    } else {
      throw new Error("CHAT_ATTACHMENT_UNSUPPORTED_TYPE");
    }
  }
  return { images, text: documents.join("\n\n").slice(0, developmentMode ? MAX_DEV_TEXT_CHARS : MAX_TEXT_CHARS) };
}
