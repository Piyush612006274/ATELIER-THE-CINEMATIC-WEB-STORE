export async function readProviderStream(response: Response, preset: string, onDelta: (text: string) => void): Promise<string> {
  if (!response.body) throw new Error("AI_PROVIDER_EMPTY_RESPONSE");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "", result = "";
  const consume = (event: string) => {
    const data = event.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
    if (!data || data === "[DONE]") return;
    const value = JSON.parse(data);
    if (value.error || value.type === "error") throw new Error("AI_PROVIDER_STREAM_ERROR");
    const delta = preset === "gemini"
      ? (value.candidates?.[0]?.content?.parts || []).filter((p: any) => !p.thought).map((p: any) => p.text || "").join("")
      : preset === "anthropic" ? (value.delta?.type === "text_delta" ? value.delta.text || "" : "")
      : value.choices?.[0]?.delta?.content || "";
    if (typeof delta === "string" && delta) {
      result += delta;
      if (result.length > 100000) throw new Error("AI_PROVIDER_RESPONSE_TOO_LARGE");
      onDelta(delta);
    }
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      let boundary;
      while ((boundary = /\r?\n\r?\n/.exec(pending))) {
        consume(pending.slice(0, boundary.index));
        pending = pending.slice(boundary.index + boundary[0].length);
      }
      if (pending.length > 1000000) throw new Error("AI_PROVIDER_RESPONSE_TOO_LARGE");
      if (done) { if (pending.trim()) consume(pending); break; }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  if (!result.trim()) throw new Error("AI_PROVIDER_EMPTY_RESPONSE");
  return result;
}
