// IndexNow (Bing, Yandex, Seznam…): push the live sitemap URLs so they are crawled without waiting for a sitemap read.
// npm run indexnow                 → core, articles, contenus (the pages that answer a question)
// npm run indexnow -- --sections 5,6 → any sections of /sitemap/<n>.xml (5 = jo, 6 = prix: ~16k URLs, send sparingly)
// Reads https://loila.fr, not the local DB, so it only submits what production really serves. The key file
// public/<KEY>.txt proves ownership. Resubmitting unchanged URLs is harmless but pointless: run it after a deploy that
// adds or rewrites pages.
export {};

const SITE = "https://loila.fr";
const KEY = "8a6c64db2cbf461b8d2f0b19aa0dca14";
const BATCH = 10_000; // IndexNow limit per request

async function main() {
  const i = process.argv.indexOf("--sections");
  const sections = (i > 0 ? process.argv[i + 1] : "0,1,3").split(",").map(Number);
  const urls: string[] = [];
  for (const s of sections) {
    const res = await fetch(`${SITE}/sitemap/${s}.xml`);
    if (!res.ok) throw new Error(`sitemap/${s}.xml: HTTP ${res.status}`);
    const locs = [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    console.log(`sitemap/${s}.xml: ${locs.length} URLs`);
    urls.push(...locs);
  }
  for (let k = 0; k < urls.length; k += BATCH) {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: urls.slice(k, k + BATCH) }),
    });
    // 200 = accepted, 202 = accepted pending key check; 403/422 = key file missing or URLs outside the host.
    console.log(`batch ${k / BATCH + 1}: HTTP ${res.status} ${res.ok ? "" : await res.text()}`);
    if (!res.ok) process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
