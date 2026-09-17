import { cookies } from "next/headers";
import { LOGIN_COOKIE, appUrl, consumeLoginToken, cookieOpts, safeNext, sameOrigin, startSession, upsertUser } from "@/lib/auth";

// Opening the emailed link must not log in: mail scanners (Google, Microsoft Safe Links, click trackers) fetch it
// first and would burn the single-use token. GET only parks the token in a cookie; the click on "Me connecter" POSTs.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const next = safeNext(url.searchParams.get("next"));
  if (!token) return Response.redirect(new URL("/connexion?erreur=lien", appUrl(request)), 303);
  (await cookies()).set(LOGIN_COOKIE, token, { ...cookieOpts(15 * 60), path: "/" });
  return Response.redirect(new URL(`/connexion/confirmer?next=${encodeURIComponent(next)}`, appUrl(request)), 303);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.redirect(new URL("/connexion?erreur=lien", appUrl(request)), 303);
  const jar = await cookies();
  const token = jar.get(LOGIN_COOKIE)?.value;
  const form = await request.formData().catch(() => null);
  const next = safeNext(typeof form?.get("next") === "string" ? (form.get("next") as string) : null);
  const email = token ? consumeLoginToken(token) : null;
  jar.delete(LOGIN_COOKIE);
  if (!email) return Response.redirect(new URL("/connexion?erreur=lien", appUrl(request)), 303);
  await startSession(upsertUser(email));
  return Response.redirect(new URL(next, appUrl(request)), 303);
}
