import { cookies } from "next/headers";
import { SESSION_COOKIE, adminBySessionToken, appUrl, sameOrigin } from "@/lib/auth";
import { purgeCacheCitingLong } from "@/lib/ask";

export const dynamic = "force-dynamic";

// POST from /admin/questions: purge cached answers citing long articles (backup JSON written next to the DB).
export async function POST(request: Request) {
  if (!adminBySessionToken((await cookies()).get(SESSION_COOKIE)?.value)) return new Response("Not Found", { status: 404 });
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const { deleted } = purgeCacheCitingLong();
  console.log(`[admin] cache purge: ${deleted} answers citing long articles`);
  return Response.redirect(new URL(`/admin/questions?purge=${deleted}#cache`, appUrl(request)), 303);
}
