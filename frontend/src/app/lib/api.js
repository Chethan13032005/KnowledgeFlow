import { API_BASE } from "./constants";

export async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  let data = null;

  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const detail = data?.detail || data?.message || `Request failed with ${res.status}`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  return data;
}

/**
 * Stream RAG query via Server-Sent Events (SSE).
 * Handles 'start', 'metadata', 'token', and 'done' events.
 */
export async function streamQuery({
  collection_name,
  question,
  top_k = 5,
  mode = "standard",
  persona = "standard",
  chat_history = [],
  onStart,
  onMetadata,
  onToken,
  onDone,
  onError,
  signal,
}) {
  try {
    const res = await fetch(`${API_BASE}/query/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        collection_name,
        question,
        top_k,
        mode,
        persona: mode || persona,
        chat_history,
      }),
      signal,
    });

    if (!res.ok) {
      let errText = `Query stream failed with status ${res.status}`;
      try {
        const errJson = await res.json();
        errText = errJson.detail || errJson.message || errText;
      } catch {}
      throw new Error(errText);
    }

    if (!res.body) {
      throw new Error("ReadableStream not supported in this environment");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      // Keep incomplete trailing line in buffer
      buffer = events.pop() || "";

      for (const eventStr of events) {
        const trimmed = eventStr.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;

        try {
          const jsonStr = trimmed.slice(5).trim();
          const parsed = JSON.parse(jsonStr);

          if (parsed.type === "start") {
            onStart?.(parsed);
          } else if (parsed.type === "metadata") {
            onMetadata?.(parsed);
          } else if (parsed.type === "token") {
            onToken?.(parsed.token);
          } else if (parsed.type === "done") {
            onDone?.(parsed.telemetry);
          }
        } catch (e) {
          console.warn("[SSE Parse Warning]", e, trimmed);
        }
      }
    }

    // Flush any remaining buffer
    if (buffer.trim() && buffer.trim().startsWith("data:")) {
      try {
        const parsed = JSON.parse(buffer.trim().slice(5).trim());
        if (parsed.type === "token") onToken?.(parsed.token);
        if (parsed.type === "done") onDone?.(parsed.telemetry);
      } catch {}
    }
  } catch (err) {
    if (err.name === "AbortError") return;
    if (onError) {
      onError(err);
    } else {
      throw err;
    }
  }
}
