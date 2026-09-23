import { NextResponse, type NextRequest } from "next/server";
import { resolveId, resolvePath } from "@/lib/article-url";

// Old /article/<Légifrance id> URLs (and other spellings) answer a real 301 here; pages would only send a 308.
export function proxy(req: NextRequest) {
  const [, , first, second, third] = req.nextUrl.pathname.split("/");
  const jur = second === "jurisprudence" || third === "jurisprudence" ? "/jurisprudence" : "";
  const r = second && second !== "jurisprudence" ? resolvePath(first, second) : resolveId(first);
  if (!r || "choices" in r || !r.redirect) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = r.redirect + jur;
  return NextResponse.redirect(url, 301);
}

export const config = { matcher: ["/article/:id", "/article/:id/:num", "/article/:id/:num/jurisprudence"] };
