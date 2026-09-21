// One-time Google consent for /admin/seo in production: gets a refresh token limited to webmasters.readonly
// and writes GSC_REFRESH_TOKEN into .env (never printed). Copy the three GSC_* values to the production env.
// Needs GSC_CLIENT_ID and GSC_CLIENT_SECRET in .env (OAuth client of type "Application de bureau", project loila-seo).
//   npx tsx scripts/gsc-auth.ts
import { execFile } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";

try { process.loadEnvFile(); } catch { /* no .env */ }

const { GSC_CLIENT_ID: id, GSC_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) {
  console.error("Set GSC_CLIENT_ID and GSC_CLIENT_SECRET in .env first.");
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const code = url.searchParams.get("code");
  if (!code) return res.end(url.searchParams.get("error") ?? "…");
  const { port } = server.address() as AddressInfo;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: `http://127.0.0.1:${port}`, grant_type: "authorization_code" }),
  });
  const j = (await r.json()) as { refresh_token?: string; error?: string };
  if (!j.refresh_token) {
    res.end("Échec, voir le terminal.");
    console.error("No refresh token:", j.error ?? r.status);
    process.exit(1);
  }
  const env = fs.existsSync(".env") ? fs.readFileSync(".env", "utf8") : "";
  const line = `GSC_REFRESH_TOKEN=${j.refresh_token}`;
  fs.writeFileSync(".env", /^GSC_REFRESH_TOKEN=.*$/m.test(env) ? env.replace(/^GSC_REFRESH_TOKEN=.*$/m, line) : `${env.replace(/\n?$/, "\n")}${line}\n`);
  res.end("C'est bon, vous pouvez fermer cet onglet.");
  console.log("✓ GSC_REFRESH_TOKEN written to .env. Copy GSC_CLIENT_ID, GSC_CLIENT_SECRET and GSC_REFRESH_TOKEN to the production env.");
  server.close();
});

server.listen(0, "127.0.0.1", () => {
  const { port } = server.address() as AddressInfo;
  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.search = new URLSearchParams({
    client_id: id,
    redirect_uri: `http://127.0.0.1:${port}`,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    access_type: "offline",
    prompt: "consent",
  }).toString();
  console.log(`Opening Google consent… (if nothing opens: ${auth})`);
  execFile("open", [auth.toString()]);
});
