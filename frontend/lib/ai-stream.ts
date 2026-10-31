import { API_BASE, ApiError } from "./api";

export async function streamChat(body: Record<string, any>, onDelta: (delta: string) => void, signal: AbortSignal) {
  const response = await fetch(`${API_BASE}/ai/chat`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, stream: true }), signal });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new ApiError(data.error || `HTTP_${response.status}`, response.status); }
  if (!response.body) throw new Error("AI_REPLY_UNAVAILABLE");
  const reader = response.body.getReader(); const decoder = new TextDecoder();
  let pending = "", reply = "", finished = false;
  let lastChunkAt = Date.now();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === "error") throw new Error(event.error || "AI_REPLY_UNAVAILABLE");
    if (event.type === "delta") { reply += event.delta; onDelta(event.delta); }
    if (event.type === "done") { reply = event.reply || reply; finished = true; }
  };
  try {
    while (true) {
      const chunk = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => { timeoutId = setTimeout(() => reject(new Error("AI_REPLY_INTERRUPTED")), 120_000); }),
      ]);
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = undefined;
      const { value, done } = chunk;
      if (value?.length) lastChunkAt = Date.now();
      if (Date.now() - lastChunkAt > 120_000) throw new Error("AI_REPLY_INTERRUPTED");
      pending += decoder.decode(value, { stream: !done });
      let index;
      while ((index = pending.indexOf("\n")) >= 0) { consume(pending.slice(0, index)); pending = pending.slice(index + 1); }
      if (done) { if (pending.trim()) consume(pending); break; }
    }
  } finally { if (timeoutId) clearTimeout(timeoutId); await reader.cancel().catch(() => {}); reader.releaseLock(); }
  if (!finished) throw new Error("AI_REPLY_INTERRUPTED");
  return reply;
}
