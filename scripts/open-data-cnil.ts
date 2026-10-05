// Import two CNIL open datasets (Licence Ouverte 2.0) as reference tables:
//   cnil_dpo           organisations that designated a DPO, with how to reach their DPO (shown on /entreprise/<siren>)
//   cnil_breach_stats  yearly aggregates of the personal data breaches notified to the CNIL (shown on /donnees-personnelles)
// Run: npx tsx scripts/open-data-cnil.ts, then npx tsx scripts/export-content.ts 2026-10-cnil-refs --cnil-refs
export {}; // every script declares its own main()
try { process.loadEnvFile(); } catch { /* no .env */ }

const headers = { "User-Agent": "Loila/1.0 (open data; +https://loila.fr/a-propos)" };

/** Semicolon CSV with "quoted" fields ("" escapes a quote). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === ";") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// ponytail: a DPO contact is published so people can write to the DPO, but a person's own mailbox (often a named
// consultant when the DPO is an external firm) or mobile should not become one indexed page per company. Keep only
// mailboxes whose local part has a whole function word ("dpo@", "informatique-et-libertes@", "protection.donnees@");
// "cecile.martin@" no longer passes for containing "cil". Upgrade path: a reveal button that loads the contact on demand.
const FUNCTION_WORDS = new Set(["dpo", "dpd", "rgpd", "gdpr", "privacy", "privacidad", "donnees", "data", "dataprotection", "cil", "cnil", "protection",
  "informatique", "libertes", "vieprivee", "contact", "juridique", "legal", "conformite", "compliance", "deontologie", "accueil", "mairie", "secretariat", "info", "infos"]);
export const functionMailbox = (email: string) =>
  email.split("@")[0].normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().split(/[._+-]+/).some((t) => FUNCTION_WORDS.has(t));

const frDate = (d: string) => (/^\d{2}\/\d{2}\/\d{4}$/.test(d) ? `${d.slice(6)}-${d.slice(3, 5)}-${d.slice(0, 2)}` : d || null);

async function resource(dataset: string) {
  const ds = (await (await fetch(`https://www.data.gouv.fr/api/1/datasets/${dataset}/`, { headers })).json()) as { resources: { format: string; url: string; title: string; last_modified: string }[] };
  const csv = ds.resources.find((r) => r.format?.toLowerCase() === "csv");
  if (!csv) throw new Error(`no CSV in ${dataset}`);
  const res = await fetch(csv.url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${csv.url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // The DPO file is UTF-8 (BOM); the breach file is Windows-1252.
  const text = buf.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])) ? buf.toString("utf8").slice(1) : new TextDecoder("windows-1252").decode(buf);
  return { csv, rows: parseCsv(text) };
}

async function main() {
  const { getDb } = await import("../src/lib/db");
  const { recordImport, SOURCES } = await import("../src/lib/sources");
  const db = getDb();

  // ---- DPO designations
  {
    const { csv, rows } = await resource("organismes-ayant-designe-un-e-delegue-e-a-la-protection-des-donnees-dpd-dpo");
    const [head, ...data] = rows;
    const col = (name: string) => {
      const i = head.findIndex((h) => h.trim() === name);
      if (i < 0) throw new Error(`missing column "${name}" in ${head.join(";").slice(0, 200)}`);
      return i;
    };
    const c = {
      siren: col("SIREN organisme désignant"), nom: col("Nom organisme désignant"), type: col("Type de DPO"), date: col("Date de la désignation"),
      dpoSiren: col("SIREN organisme désigné"), dpoNom: col("Nom organisme désigné"), email: col("Moyen contact DPO email"), url: col("Moyen contact DPO url"),
      tel: col("Moyen contact DPO téléphone"), adr: col("Moyen contact DPO adresse postale"), cp: col("Moyen contact DPO code postal"), ville: col("Moyen contact DPO ville"),
    };
    const src = recordImport(db, SOURCES["CNIL:dpo"], csv.title, { officialUrl: csv.url, matchQuality: "CERTAIN", updatedAt: csv.last_modified });
    const latest = new Map<string, string[]>();
    for (const r of data) {
      const siren = r[c.siren]?.replace(/\D/g, "");
      if (!/^\d{9}$/.test(siren)) continue;
      const prev = latest.get(siren);
      if (!prev || (frDate(r[c.date]) ?? "") >= (frDate(prev[c.date]) ?? "")) latest.set(siren, r);
    }
    const ins = db.prepare(`INSERT INTO cnil_dpo (siren, nom, type_dpo, date_designation, dpo_siren, dpo_nom, email, url, telephone, adresse, source_record_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    let withEmail = 0;
    db.transaction(() => {
      db.prepare("DELETE FROM cnil_dpo").run();
      for (const [siren, r] of latest) {
        const email = r[c.email].trim().toLowerCase();
        const keepEmail = email.includes("@") && functionMailbox(email) ? email : null;
        if (keepEmail) withEmail++;
        const url = /^https?:\/\//i.test(r[c.url].trim()) ? r[c.url].trim() : null;
        const adresse = [r[c.adr], [r[c.cp], r[c.ville]].filter(Boolean).join(" ")].map((s) => s.trim()).filter(Boolean).join(", ") || null;
        ins.run(siren, r[c.nom] || null, r[c.type] || null, frDate(r[c.date]), r[c.dpoSiren]?.replace(/\D/g, "") || null, r[c.dpoNom] || null,
          keepEmail, url, null, adresse, src); // phone dropped: often a consultant's mobile (same rule as the mailboxes)
      }
    })();
    if (latest.size < 50_000) throw new Error(`implausible DPO count ${latest.size}`);
    console.log(`[open-data-cnil] DPO: ${latest.size} organisations (${data.length} designations), ${withEmail} with a published function mailbox · ${csv.title}`);
  }

  // ---- Breach notifications → yearly aggregates
  {
    const { csv, rows } = await resource("notifications-a-la-cnil-de-violations-de-donnees-a-caractere-personnel");
    const h = rows.findIndex((r) => /^Date de réception/i.test(r[0]?.trim() ?? ""));
    if (h < 0) throw new Error("breach CSV: header not found");
    const head = rows[h].map((x) => x.trim());
    const idx = (re: RegExp) => {
      const i = head.findIndex((x) => re.test(x));
      if (i < 0) throw new Error(`breach CSV: no column ${re}`);
      return i;
    };
    const c = { date: 0, nature: idx(/^Natures/), personnes: idx(/^Nombre de personnes/), origine: idx(/^Origines/), cause: idx(/^Causes/), info: idx(/^Information/) };
    // Multi-valued cells: "A,B" (no space after the separator; labels themselves hold ", ").
    const split = (v: string) => v.split(/,(?=\S)/).map((s) => s.trim()).filter(Boolean);
    const counts = new Map<string, number>();
    const add = (year: string, dim: string, label: string) => counts.set(`${year}\t${dim}\t${label}`, (counts.get(`${year}\t${dim}\t${label}`) ?? 0) + 1);
    for (const r of rows.slice(h + 1)) {
      const year = r[c.date]?.slice(0, 4);
      if (!/^20\d\d$/.test(year ?? "")) continue;
      add(year, "total", "notifications");
      for (const v of split(r[c.nature] ?? "")) add(year, "nature", v);
      for (const v of split(r[c.origine] ?? "")) add(year, "origine", v);
      for (const v of split(r[c.cause] ?? "")) add(year, "cause", v);
      if (r[c.personnes]?.trim()) add(year, "personnes", r[c.personnes].trim());
      if (r[c.info]?.trim()) add(year, "information", r[c.info].trim());
    }
    // The file opens with a caveat line (a single subcontractor incident counted once per controller): kept for display.
    const note = rows.slice(0, h).map((r) => r.join(" ").trim()).find((l) => /nota/i.test(l));
    const src = recordImport(db, SOURCES["CNIL:violations"], csv.title, { officialUrl: csv.url, matchQuality: "CERTAIN", updatedAt: csv.last_modified });
    const ins = db.prepare("INSERT INTO cnil_breach_stats (year, dimension, label, n, source_record_id) VALUES (?, ?, ?, ?, ?)");
    db.transaction(() => {
      db.prepare("DELETE FROM cnil_breach_stats").run();
      for (const [k, n] of counts) ins.run(...k.split("\t"), n, src);
      if (note) ins.run("all", "note", note, 0, src);
    })();
    const totals = [...counts].filter(([k]) => k.includes("\ttotal\t")).map(([k, n]) => `${k.slice(0, 4)}: ${n}`).sort();
    if (!totals.length) throw new Error("breach CSV: no row parsed");
    console.log(`[open-data-cnil] breaches per year: ${totals.join(", ")} · ${csv.title}`);
  }
}

// Self-check of the privacy rule: npx tsx scripts/open-data-cnil.ts --check
if (process.argv.includes("--check")) {
  const keep = ["dpo@edf.fr", "informatique-et-libertes@edf.fr", "protection.donnees@cdg29.bzh", "contact.dpd@x.fr", "mairie.sigoyer@wanadoo.fr", "Données.Personnelles@x.fr"];
  const drop = ["cecile.martin@x.fr", "lucile.dupont@x.fr", "legall@x.fr", "jf.tardif@absys.re", "julien.winkin@luxgap.com", "infocnil@klesia.fr"];
  for (const e of keep) if (!functionMailbox(e)) throw new Error(`should keep ${e}`);
  for (const e of drop) if (functionMailbox(e)) throw new Error(`should drop ${e}`);
  console.log("open-data-cnil check: OK");
} else if (process.argv[1]?.endsWith("open-data-cnil.ts")) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
