import { appUrl, consumeLoginToken, safeNext, startSession, upsertUser } from "@/lib/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const email = token ? consumeLoginToken(token) : null;
  if (!email) return Response.redirect(new URL("/connexion?erreur=lien", appUrl(request)), 303);
  await startSession(upsertUser(email));
  return Response.redirect(new URL(safeNext(url.searchParams.get("next")), appUrl(request)), 303);
}
