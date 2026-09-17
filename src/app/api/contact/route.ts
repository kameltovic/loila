import { clientIp, rateLimited, sameOrigin } from "@/lib/auth";
import { parseContact, submitContact } from "@/lib/contact";

const OK = { ok: true, message: "Merci, votre message est bien envoyé. Nous vous répondons par e-mail, en général sous 48 heures ouvrées." };

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  if (rateLimited(`contact:${clientIp(request)}`, 5, 60 * 60_000)) {
    return Response.json({ error: "Trop de messages envoyés, réessayez dans une heure." }, { status: 429 });
  }
  const input = parseContact(await request.json().catch(() => null));
  if ("spam" in input) return Response.json(OK); // honeypot: pretend success
  if ("error" in input) return Response.json({ error: input.error }, { status: 400 });
  await submitContact(input);
  return Response.json(OK);
}
