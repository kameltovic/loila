import { NextResponse, type NextRequest } from "next/server";
import { resolveId, resolvePath } from "@/lib/article-url";

const DEV = process.env.NODE_ENV === "development";
const UMAMI = "https://stats.coffee-beans.fr";
const UMAMI_DEV = process.env.NEXT_PUBLIC_UMAMI_DEV_URL ? new URL(process.env.NEXT_PUBLIC_UMAMI_DEV_URL).origin : "";
const MAPBOX = "https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com";

// Strict scripts (per-request nonce, applied by Next.js to its own scripts); styles stay 'unsafe-inline'
// because React SSR style="" attributes and mapbox-gl need it. Every page is already dynamically rendered.
function csp(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${UMAMI} ${UMAMI_DEV}${DEV ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${MAPBOX}`,
    "font-src 'self'",
    `connect-src 'self' ${UMAMI} ${UMAMI_DEV} ${MAPBOX} https://cadastre.data.gouv.fr`,
    "worker-src 'self' blob:",
    "child-src blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(DEV ? [] : ["upgrade-insecure-requests"]),
  ].join("; ").replace(/ {2,}/g, " ");
}

// Old /article/<Légifrance id> URLs (and other spellings) answer a real 301 here; pages would only send a 308.
function articleRedirect(req: NextRequest) {
  if (!/^\/article\/[^/]+(\/[^/]+(\/jurisprudence)?)?$/.test(req.nextUrl.pathname)) return null;
  const [, , first, second, third] = req.nextUrl.pathname.split("/");
  const jur = second === "jurisprudence" || third === "jurisprudence" ? "/jurisprudence" : "";
  const r = second && second !== "jurisprudence" ? resolvePath(first, second) : resolveId(first);
  if (!r || "choices" in r || !r.redirect) return null;
  const url = req.nextUrl.clone();
  url.pathname = r.redirect + jur;
  return NextResponse.redirect(url, 301);
}

export function proxy(req: NextRequest) {
  const redirect = articleRedirect(req);
  if (redirect) return redirect;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = csp(nonce);
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy); // Next.js reads the nonce from here while rendering
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", policy);
  return res;
}

// Pages only: API routes, static files and prefetches don't need a CSP.
export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
