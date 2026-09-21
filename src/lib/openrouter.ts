import { reserveLlmCall } from "./budget";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export class MissingApiKeyError extends Error {
  constructor() {
    super("OPENROUTER_API_KEY is not set");
  }
}

export async function chat(
  messages: ChatMessage[],
  { model = process.env.OPENROUTER_CHAT_MODEL, maxTokens = 700, json = false, temperature = 0.2, timeoutMs = 30_000, extra, budget = true }:
    // extra: raw OpenRouter body fields, e.g. { provider: { data_collection: "deny" }, reasoning: {...} }
    // budget: false for owner-run batch jobs; live requests keep the global daily cap (src/lib/budget.ts)
    { model?: string; maxTokens?: number; json?: boolean; temperature?: number; timeoutMs?: number; extra?: Record<string, unknown>; budget?: boolean } = {},
): Promise<{ content: string; model: string; provider?: string; usage?: { prompt_tokens: number; completion_tokens: number; cost?: number } }> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new MissingApiKeyError();
  if (!model) throw new Error("No model: set OPENROUTER_CHAT_MODEL");
  // Throws BudgetExceededError before any network call once the day's cap is reached.
  if (budget) reserveLlmCall();

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.SITE_URL ?? "https://loila.fr",
      "X-Title": "Loilà",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      ...(json ? { response_format: { type: "json_object" } } : {}),
      provider: { data_collection: "deny" }, // no prompt retention or training by default (privacy policy); `extra` may override
      ...extra,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("OpenRouter: empty response");
  return { content, model: data.model ?? model, provider: data.provider, usage: data.usage };
}
