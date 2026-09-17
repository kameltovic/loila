import { ask, AskValidationError } from "@/lib/ask";
import { clientIp, getIdentity, rateLimited, sameOrigin } from "@/lib/auth";
import { consume, getMe } from "@/lib/billing";
import { MissingApiKeyError } from "@/lib/openrouter";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  if (rateLimited(`ask:${clientIp(request)}`, 20, 10 * 60_000)) {
    return Response.json({ error: "Trop de questions, réessayez dans quelques minutes." }, { status: 429 });
  }

  let body: { question?: unknown; theme?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (typeof body?.question !== "string" || (body.theme != null && typeof body.theme !== "string")) {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }

  const id = await getIdentity(request);
  try {
    const result = await ask(body.question, (body.theme as string | undefined) || undefined, undefined, undefined, () => getMe(id).canAsk);
    if (result.source === "paywall") {
      return Response.json(
        { error: "Vous avez utilisé vos questions gratuites. Choisissez une offre pour continuer.", code: "paywall", me: getMe(id) },
        { status: 402 },
      );
    }
    // Charged only once the LLM actually answered. ponytail: two concurrent last-unit requests can both get an answer (one unpaid); reserve before the call if abused.
    if (result.source === "llm") consume(id);
    return Response.json({ ...result, me: getMe(id) });
  } catch (e) {
    if (e instanceof AskValidationError) return Response.json({ error: e.message }, { status: 400 });
    if (e instanceof MissingApiKeyError) {
      return Response.json({ error: "Le service de réponse est momentanément indisponible." }, { status: 503 });
    }
    console.error("[api/ask]", e);
    return Response.json({ error: "Une erreur est survenue, réessayez plus tard." }, { status: 500 });
  }
}
