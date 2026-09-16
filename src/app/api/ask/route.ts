import { ask, AskValidationError } from "@/lib/ask";
import { MissingApiKeyError } from "@/lib/openrouter";

// ponytail: in-memory, single-instance only; move to a shared store (Redis/DynamoDB) on AWS multi-instance.
const WINDOW_MS = 10 * 60_000;
const MAX_REQ = 20;
const hits = new Map<string, number[]>();

function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 10_000) for (const [k, v] of hits) if (now - v[v.length - 1] >= WINDOW_MS) hits.delete(k);
  return recent.length > MAX_REQ;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "local";
  if (limited(ip)) return Response.json({ error: "Trop de questions, réessayez dans quelques minutes." }, { status: 429 });

  let body: { question?: unknown; theme?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (typeof body?.question !== "string" || (body.theme != null && typeof body.theme !== "string")) {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }

  try {
    return Response.json(await ask(body.question, (body.theme as string | undefined) || undefined));
  } catch (e) {
    if (e instanceof AskValidationError) return Response.json({ error: e.message }, { status: 400 });
    if (e instanceof MissingApiKeyError) {
      return Response.json({ error: "Le service de réponse est momentanément indisponible." }, { status: 503 });
    }
    console.error("[api/ask]", e);
    return Response.json({ error: "Une erreur est survenue, réessayez plus tard." }, { status: 500 });
  }
}
