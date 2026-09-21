import { clientIp, getIdentity, isAdmin, rateLimited, sameOrigin } from "@/lib/auth";
import { consume, getMe } from "@/lib/billing";
import { BudgetExceededError } from "@/lib/budget";
import { getDb } from "@/lib/db";
import { askJuri } from "@/lib/juri-ask";
import { MissingApiKeyError } from "@/lib/openrouter";

// Case-law assistant: Pro subscribers (monthly quota) and admins only.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  if (rateLimited(`juri:${clientIp(request)}`, 20, 10 * 60_000)) {
    return Response.json({ error: "Trop de questions, réessayez dans quelques minutes." }, { status: 429 });
  }
  let body: { question?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (question.length < 10 || question.length > 1000) {
    return Response.json({ error: "La question doit faire entre 10 et 1 000 caractères." }, { status: 400 });
  }

  const id = await getIdentity(request);
  if (!id.userId) return Response.json({ error: "Connectez-vous pour utiliser l’assistant.", code: "auth" }, { status: 401 });
  const admin = isAdmin(id.email);
  const me = getMe(id);
  if (!admin && (me.plan !== "pro" || !me.canAsk)) {
    return Response.json({ error: "L’assistant jurisprudence est réservé à l’offre Pro.", code: "pro" }, { status: 402 });
  }
  try {
    const result = await askJuri(question);
    if (!admin) consume(id);
    try {
      getDb().prepare("INSERT INTO question_log (user_id, question, theme, outcome) VALUES (?, ?, 'juri', 'llm')").run(id.userId, question.slice(0, 1000));
    } catch { /* stats only */ }
    return Response.json(result);
  } catch (e) {
    if (e instanceof BudgetExceededError) return Response.json({ error: "Limite de réponses atteinte pour aujourd’hui. Réessayez demain." }, { status: 503 });
    if (e instanceof MissingApiKeyError) return Response.json({ error: "Service momentanément indisponible." }, { status: 503 });
    console.error("[api/juri-ask]", e);
    return Response.json({ error: "Une erreur est survenue, réessayez plus tard." }, { status: 500 });
  }
}
