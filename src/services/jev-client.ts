import { TypeSafeClient } from "@typesafe-ai/sdk";

export function hasJevKey() {
  return Boolean(import.meta.env.VITE_TYPESAFE_API_KEY?.trim());
}

export function requireJevKey() {
  const apiKey = import.meta.env.VITE_TYPESAFE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Set VITE_TYPESAFE_API_KEY in .env — Jev is required.");
  }
  return apiKey;
}

async function tauriJevFetch(_input: RequestInfo | URL, init?: RequestInit) {
  const { invoke } = await import("@tauri-apps/api/core");
  const payload = init?.body ? JSON.parse(String(init.body)) : {};
  try {
    const data = await invoke<unknown>("jev_system_one", { payload });
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(message, { status: 502, headers: { "Content-Type": "text/plain" } });
  }
}

export function createJevClient() {
  const inTauri = "__TAURI_INTERNALS__" in window;
  return new TypeSafeClient({
    apiKey: requireJevKey(),
    defaultModel: "jev-1.13.0",
    dangerouslyAllowBrowser: true,
    timeout: 30000,
    baseURL: inTauri ? "https://api.typesafe.ai" : "/typesafe-api",
    fetch: inTauri ? tauriJevFetch : undefined,
  });
}
