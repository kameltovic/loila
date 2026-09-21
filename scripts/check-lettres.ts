// Letter templates self-check: npx tsx scripts/check-lettres.ts
// Always: every {{placeholder}} has a field, selects have options, slugs/themes are valid.
// With a populated DB (data/loila.db): cited articles, FAQ slugs and internal tip links all resolve.
import assert from "node:assert/strict";
import { getLettres, lettresForFaq } from "../src/lib/lettres";
import { THEMES, faqUrl } from "../src/lib/themes";

const lettres = getLettres();
assert.ok(lettres.length > 0, "no letters in seed/lettres");
assert.equal(new Set(lettres.map((l) => l.slug)).size, lettres.length, "duplicate letter slug");

for (const l of lettres) {
  const names = new Set(l.fields.map((f) => f.name));
  const texts = [l.body, ...l.fields.flatMap((f) => f.options?.map((o) => o.text) ?? [])];
  for (const t of texts) for (const [, name] of t.matchAll(/\{\{(\w+)\}\}/g)) assert.ok(names.has(name), `${l.slug}: {{${name}}} has no field`);
  for (const f of l.fields) if (f.type === "select") assert.ok(f.options?.length, `${l.slug}: select ${f.name} without options`);
  assert.ok(THEMES.some((t) => t.slug === l.theme), `${l.slug}: unknown theme ${l.theme}`);
  assert.ok(l.seo.title.length <= 60 && l.seo.description.length <= 160, `${l.slug}: SEO title/description too long`);
}

async function withDb() {
  const { getDb } = await import("../src/lib/db");
  const { refArticles, faqsBySlugs } = await import("../src/lib/metiers");
  if (!(getDb().prepare("SELECT COUNT(*) AS n FROM faq").get() as { n: number }).n) return console.log("check-lettres: empty DB, skipped content checks");
  const paths = new Set(
    (getDb().prepare("SELECT theme, slug, topic FROM faq").all() as { theme: string; slug: string; topic: string | null }[]).map(faqUrl),
  );
  const pages = new Set(["/conventions", ...THEMES.map((t) => `/${t.slug}`), ...lettres.map((l) => `/modeles-lettres/${l.slug}`)]);
  for (const l of lettres) {
    for (const t of l.tips) {
      assert.equal(refArticles(t.refs).length, t.refs.length, `${l.slug}: unknown article in ${t.refs.join(", ")}`);
      if (t.link) assert.ok(paths.has(t.link.href) || pages.has(t.link.href), `${l.slug}: dead link ${t.link.href}`);
    }
    assert.equal(faqsBySlugs(l.faqSlugs).length, l.faqSlugs.length, `${l.slug}: unknown FAQ slug`);
    // The reverse link (question page → letter) must exist for every linked FAQ.
    for (const s of l.faqSlugs) assert.ok(lettresForFaq(s).some((x) => x.slug === l.slug));
  }
  console.log(`check-lettres: ${lettres.length} letters OK`);
}

withDb();
