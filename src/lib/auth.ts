import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "./db";
import { SITE_URL } from "./seo";

const PROD = process.env.NODE_ENV === "production";
export const ANON_COOKIE = "loila_anon";
export const SESSION_COOKIE = "loila_session";
const SESSION_DAYS = 90;
const LOGIN_TOKEN_TTL = 15 * 60;

let warned = false;
function secret() {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  if (PROD) throw new Error("AUTH_SECRET is required in production");
  if (!warned) console.warn("[auth] AUTH_SECRET missing, using an insecure dev secret");
  warned = true;
  return "dev-insecure-secret";
}

const now = () => Math.floor(Date.now() / 1000);
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const hmac = (s: string) => createHmac("sha256", secret()).update(s).digest("base64url");
const token = () => randomBytes(32).toString("base64url");

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

// ponytail: in-memory, single-instance only; move to a shared store (Redis) when running several instances.
const hits = new Map<string, number[]>();
export function rateLimited(key: string, max: number, windowMs: number) {
  const t = Date.now();
  const recent = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
  recent.push(t);
  hits.set(key, recent);
  if (hits.size > 10_000) for (const [k, v] of hits) if (t - v[v.length - 1] >= 60 * 60_000) hits.delete(k);
  return recent.length > max;
}

// CSRF guard for cookie-authenticated POSTs: the browser's Origin must be this site.
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return new URL(origin).host === host || new URL(origin).origin === new URL(SITE_URL).origin;
  } catch {
    return false;
  }
}

// Absolute base for redirects and emailed links. Dev follows the request so localhost works.
export const appUrl = (req: Request) => (PROD ? SITE_URL : new URL(req.url).origin);

// Only same-origin paths ("/compte"), never "//evil.com" or "/\evil.com".
export const safeNext = (next: string | null, fallback = "/compte") =>
  next && /^\/(?![/\\])/.test(next) ? next : fallback;

export const isEmail = (s: unknown): s is string =>
  typeof s === "string" && s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

const cookieOpts = (maxAge: number) => ({ httpOnly: true, secure: PROD, sameSite: "lax" as const, path: "/", maxAge });

export type Identity = { userId: number | null; email: string | null; anonId: string; ipHash: string };

export function signAnon(id: string) {
  return `${id}.${hmac(`anon:${id}`)}`;
}
export function verifyAnon(value: string | undefined): string | null {
  const [id, sig] = value?.split(".") ?? [];
  if (!id || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(hmac(`anon:${id}`));
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}

export const ipHash = (ip: string) => hmac(`ip:${ip}`).slice(0, 32);

export function userBySessionToken(raw: string | undefined) {
  if (!raw) return undefined;
  return getDb()
    .prepare("SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?")
    .get(sha256(raw), now()) as { id: number; email: string } | undefined;
}

// Route handlers only (sets the anonymous cookie on first visit).
export async function getIdentity(req: Request): Promise<Identity> {
  const jar = await cookies();
  let anonId = verifyAnon(jar.get(ANON_COOKIE)?.value);
  if (!anonId) {
    anonId = randomBytes(16).toString("base64url");
    jar.set(ANON_COOKIE, signAnon(anonId), cookieOpts(2 * 365 * 86400));
  }
  const user = userBySessionToken(jar.get(SESSION_COOKIE)?.value);
  return { userId: user?.id ?? null, email: user?.email ?? null, anonId, ipHash: ipHash(clientIp(req)) };
}

export function upsertUser(email: string): number {
  const db = getDb();
  const e = email.trim().toLowerCase();
  db.prepare("INSERT INTO users (email) VALUES (?) ON CONFLICT(email) DO NOTHING").run(e);
  return (db.prepare("SELECT id FROM users WHERE email = ?").get(e) as { id: number }).id;
}

export function createLoginToken(email: string, at = now()) {
  const raw = token();
  getDb().prepare("INSERT INTO login_tokens (token_hash, email, expires_at) VALUES (?, ?, ?)").run(sha256(raw), email.trim().toLowerCase(), at + LOGIN_TOKEN_TTL);
  return raw;
}

// Single use: the UPDATE only matches an unused, unexpired token.
export function consumeLoginToken(raw: string, at = now()): string | null {
  const row = getDb()
    .prepare("UPDATE login_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? RETURNING email")
    .get(at, sha256(raw), at) as { email: string } | undefined;
  return row?.email ?? null;
}

export async function startSession(userId: number) {
  const raw = token();
  getDb().prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(sha256(raw), userId, now() + SESSION_DAYS * 86400);
  getDb().prepare("DELETE FROM sessions WHERE expires_at < ?").run(now());
  (await cookies()).set(SESSION_COOKIE, raw, cookieOpts(SESSION_DAYS * 86400));
}

export async function endSession() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (raw) getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(raw));
  jar.delete(SESSION_COOKIE);
}
