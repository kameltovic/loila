import { getIdentity, isAdmin } from "@/lib/auth";
import { getMe } from "@/lib/billing";

export async function GET(request: Request) {
  const me = getMe(await getIdentity(request));
  return Response.json(isAdmin(me.email) ? { ...me, admin: true } : me, { headers: { "Cache-Control": "no-store" } });
}
