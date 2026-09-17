import { appUrl, clientIp, createLoginToken, isEmail, rateLimited, safeNext, sameOrigin } from "@/lib/auth";
import { sendMagicLink } from "@/lib/email";

// Same answer whether or not the account exists (no enumeration).
const OK = { ok: true, message: "Si l'adresse est valide, un lien de connexion vient de vous être envoyé." };

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  let body: { email?: unknown; next?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isEmail(email)) return Response.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  if (rateLimited(`login-ip:${clientIp(request)}`, 10, 60 * 60_000) || rateLimited(`login-email:${email}`, 3, 15 * 60_000)) {
    return Response.json({ error: "Trop de demandes, réessayez dans quelques minutes." }, { status: 429 });
  }

  const link = new URL("/api/auth/verify", appUrl(request));
  link.searchParams.set("token", createLoginToken(email));
  const next = safeNext(typeof body.next === "string" ? body.next : null, "");
  if (next) link.searchParams.set("next", next);
  if (!(await sendMagicLink(email, link.toString()))) {
    return Response.json({ error: "L'e-mail n'a pas pu être envoyé, réessayez plus tard." }, { status: 502 });
  }
  return Response.json(OK);
}
