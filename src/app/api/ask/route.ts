import { ask, AskValidationError } from "@/lib/ask";
import { clientIp, getIdentity, rateLimited, sameOrigin } from "@/lib/auth";
import { consume, getMe } from "@/lib/billing";
import { BudgetExceededError } from "@/lib/budget";
import { getDb } from "@/lib/db";
import { MissingApiKeyError } from "@/lib/openrouter";

// Stats only: logging must never break answering.
function logQuestion(userId: number | null, question: string, theme: string | undefined, outcome: string) {
  try {
    getDb().prepare("INSERT INTO question_log (user_id, question, theme, outcome) VALUES (?, ?, ?, ?)").run(userId, question.trim().slice(0, 1000), theme ?? null, outcome);
  } catch (e) {
    console.error("[api/ask] question log", e instanceof Error ? e.message : e);
  }
}

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
  const theme = (body.theme as string | undefined) || undefined;
  if (!id.userId) {
    logQuestion(null, body.question, theme, "auth");
    // Asking requires an account (free quota is account-scoped), so the client can open the sign-up gate.
    return Response.json(
      { error: "Créez votre compte pour poser une question.", code: "auth", me: getMe(id) },
      { status: 401 },
    );
  }
  try {
    const result = await ask(body.question, theme, undefined, undefined, () => getMe(id).canAsk);
    logQuestion(id.userId, body.question, theme, result.source);
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
    logQuestion(id.userId, body.question, theme, e instanceof BudgetExceededError ? "budget" : "error");
    if (e instanceof BudgetExceededError) {
      return Response.json({ error: "Le service a atteint sa limite de réponses pour aujourd'hui. Réessayez demain." }, { status: 503 });
    }
    if (e instanceof MissingApiKeyError) {
      return Response.json({ error: "Le service de réponse est momentanément indisponible." }, { status: 503 });
    }
    console.error("[api/ask]", e);
    return Response.json({ error: "Une erreur est survenue, réessayez plus tard." }, { status: 500 });
  }
}
