// Dossier wizard self-check with a fake LLM, no network: npx tsx scripts/check-wizard.ts
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "loila-wizard-"));
process.env.DATABASE_PATH = path.join(dir, "test.db");
process.env.AUTH_SECRET = "test-secret";
process.env.OPENROUTER_CHAT_MODEL = "fake/answer-model";
delete process.env.ADMIN_EMAILS;
delete process.env.WIZARD_ANALYSIS_MODEL;
delete process.env.WIZARD_PROVIDERS;

type Opts = { model?: string; json?: boolean; extra?: Record<string, unknown> };
type Msg = { role: string; content: string };

async function main() {
  const { getDb } = await import("../src/lib/db");
  const auth = await import("../src/lib/auth");
  const { getMe, grantBatch } = await import("../src/lib/billing");
  const w = await import("../src/lib/wizard");
  const db = getDb();
  console.warn = () => {}; // expected post-check warnings
  console.error = () => {};

  db.prepare(`INSERT INTO articles (id, code, num, texte, url) VALUES
    ('A22', 'loi-89-462', '22', 'Le dépôt de garantie est restitué dans un délai maximal d''un mois à compter de la remise des clés lorsque l''état des lieux de sortie est conforme à l''état des lieux d''entrée, deux mois dans le cas contraire. À défaut, le montant est majoré de 10 % du loyer mensuel.', 'u22'),
    ('A15', 'loi-89-462', '15', 'Le délai de préavis applicable au congé est de trois mois lorsqu''il émane du locataire. Il est d''un mois en zone tendue.', 'u15')`).run();

  // ---- fake LLM: per-step scripted replies, every request recorded
  const log: { step: string; opts: Opts; messages: Msg[] }[] = [];
  const script: Record<string, (string | Error)[]> = {};
  const stepOf = (m: Msg[]) => {
    const s = m[0].content;
    return s.includes("Tu analyses le récit") ? "analysis" : s.includes("questions de clarification") ? "questions" : s.includes("question de suivi") ? "followup" : "synthesis";
  };
  const ANALYSIS = JSON.stringify({ theme: "logement", title: "Restitution du dépôt de garantie", facts: ["clés rendues le 20/07/2026"], legal_terms: ["dépôt de garantie", "restitution", "état des lieux"], likely_articles: ["art. 22"], unknowns: ["état des lieux conforme ?"], high_stakes: false });
  const QUESTIONS = JSON.stringify({ enough_info: false, questions: [
    { id: "x", question: "L'état des lieux de sortie était-il conforme ?", type: "choice", options: ["Oui", "Non", "Je ne sais pas"], article: "22", condition: "…", why: "Le délai passe d'un à deux mois." },
    { id: "y", question: "Date de remise des clés ?", type: "date", options: [], article: "22", why: "Point de départ du délai." },
    { id: "z", question: "Autre ?", type: "text", options: [], article: "15" },
    { id: "w", question: "Quatrième question de trop ?", type: "text", options: [] },
  ] });
  const SYNTH = "## En bref\nDans une situation comme la vôtre, la loi prévoit un délai d'un mois (art. 22).\n## Prochaines étapes\nEnvoyer une lettre.";
  const reset = (s: Record<string, (string | Error)[]>) => {
    for (const k of Object.keys(script)) delete script[k];
    Object.assign(script, s);
  };
  w.wizardDeps.chat = async (messages: Msg[], opts: Opts = {}) => {
    const step = stepOf(messages);
    log.push({ step, opts, messages });
    const next = script[step]?.shift();
    if (next === undefined) throw new Error(`fake llm: nothing scripted for ${step}`);
    if (next instanceof Error) throw next;
    return { content: next, model: opts.model ?? "fake/answer-model", provider: opts.model?.startsWith("deepseek/") ? "DeepInfra" : "Anthropic", usage: { prompt_tokens: 1, completion_tokens: 1, cost: 0.001 } };
  };

  let ip = 0;
  const user = (email: string) => ({ userId: auth.upsertUser(email), email, anonId: "a", ipHash: `ip${ip++}` });
  const usage = (u: { userId: number }) => (db.prepare("SELECT COUNT(*) n FROM usage WHERE subject = ?").get(`user:${u.userId}`) as { n: number }).n;
  const rejects = async (p: Promise<unknown>, status: number) => {
    await assert.rejects(p, (e: unknown) => e instanceof w.WizardError && e.status === status);
  };
  const story = "J'ai quitté mon appartement le 20 juillet, le propriétaire ne me rend pas mon dépôt de garantie de 750 €.";

  // --- verdict regexes: broad on verdicts, quiet on rule statements
  for (const s of ["Votre propriétaire n'a pas le droit de garder la caution.", "vous avez droit à 75 €", "Votre assurance a raison.", "votre licenciement est abusif", "Vous êtes dans votre droit.", "Le bailleur est en tort.", "il vous doit 750 euros",
    "## En bref\n\nNon, le propriétaire n'a pas le droit de garder votre caution indéfiniment.", "1 mois si l'état des lieux est conforme (c'est votre cas)."]) {
    assert.ok(w.verdicts(s).length, `should flag: ${s}`);
  }
  for (const s of ["Dans une situation comme la vôtre, la loi prévoit que le bailleur restitue le dépôt dans un mois (art. 22).", "Si l'état des lieux est conforme, alors le délai est d'un mois.", "Le locataire peut demander la majoration.", "Si c'est le cas, le délai est de deux mois."]) {
    assert.deepEqual(w.verdicts(s), [], `should not flag: ${s}`);
  }
  assert.deepEqual(w.parseJson('```json\n{"a":1}\n```'), { a: 1 });

  // --- happy path: steps 1-4 free, synthesis and follow-up charge exactly one unit each
  const alice = user("alice@example.com");
  reset({ analysis: [ANALYSIS], questions: [QUESTIONS] });
  let d = await w.startDossier(alice, story);
  assert.equal(d.status, "questions");
  assert.equal(d.title, "Restitution du dépôt de garantie");
  assert.equal(d.questions.length, 3); // capped
  assert.deepEqual(d.questions[0].options, ["Oui", "Non", "Je ne sais pas"]);
  assert.equal(d.questions[1].type, "date");
  assert.equal(usage(alice), 0);
  const ds = log.filter((l) => l.step === "analysis" || l.step === "questions");
  assert.ok(ds.every((l) => l.opts.model === w.DEFAULT_ANALYSIS_MODEL));
  assert.deepEqual(ds[0].opts.extra?.provider, { only: w.DEFAULT_PROVIDERS, data_collection: "deny", allow_fallbacks: false });
  assert.deepEqual(ds[0].opts.extra?.reasoning, { enabled: false });

  reset({ synthesis: [SYNTH], followup: ["Dans une situation comme la vôtre, une lettre suffit (art. 22)."] });
  let r = await w.synthesizeDossier(alice, d.id, { items: { q1: "Oui", q2: "2026-07-20", q3: "", bogus: "x" }, note: "clés rendues en main propre" });
  assert.ok(!r.paywall);
  d = r.dossier;
  assert.equal(d.status, "done");
  assert.equal(d.synthesis_md, SYNTH);
  assert.deepEqual(d.articles.map((a) => a.num), ["22"]);
  assert.deepEqual(d.answers?.items.map((a) => a.answer), ["Oui", "20/07/2026", "Je ne sais pas"]);
  const synthCall = log.findLast((l) => l.step === "synthesis")!;
  assert.equal(synthCall.opts.model, "fake/answer-model");
  assert.deepEqual(synthCall.opts.extra?.provider, { data_collection: "deny" });
  assert.match(synthCall.messages[1].content, /Date de remise des clés \? → 20\/07\/2026/);
  assert.equal(usage(alice), 1);
  assert.equal((await w.synthesizeDossier(alice, d.id, {})).dossier.status, "done"); // replay: no second charge
  assert.equal(usage(alice), 1);
  r = await w.followUp(alice, d.id, "Comment envoyer une mise en demeure ?");
  assert.equal(r.dossier.messages.length, 1);
  assert.match(log.findLast((l) => l.step === "followup")!.messages[1].content, /Points clés de la synthèse :\nDans une situation comme la vôtre/);
  assert.equal(usage(alice), 2);
  await rejects(w.followUp(alice, d.id, "x"), 400);
  assert.equal(usage(alice), 2);

  // --- ownership: another account, anonymous, or unknown id → 404, never the content
  const mallory = user("mallory@example.com");
  assert.equal(w.getDossier(mallory, d.id), null);
  assert.equal(w.getDossier({ ...mallory, userId: null }, d.id), null);
  await rejects(w.synthesizeDossier(mallory, d.id, {}), 404);
  await rejects(w.followUp(mallory, d.id, "Et ensuite ?"), 404);
  await rejects(w.synthesizeDossier(mallory, "nope", {}), 404);
  assert.deepEqual(w.listDossiers(mallory.userId).length, 0);
  assert.deepEqual(w.listDossiers(alice.userId).map((x) => x.id), [d.id]);
  assert.equal(usage(mallory), 0);

  // --- invalid JSON → retry → fallback to the answer model (fenced JSON accepted)
  const bob = user("bob@example.com");
  reset({ analysis: ["pas du json", "{\"theme\": \"autre\"}", "```json\n" + ANALYSIS + "\n```"], questions: [new Error("OpenRouter 503"), QUESTIONS] });
  const before = log.length;
  d = await w.startDossier(bob, story);
  assert.equal(d.status, "questions");
  assert.deepEqual(log.slice(before).map((l) => [l.step, l.opts.model]), [
    ["analysis", w.DEFAULT_ANALYSIS_MODEL], ["analysis", w.DEFAULT_ANALYSIS_MODEL], ["analysis", "fake/answer-model"],
    ["questions", w.DEFAULT_ANALYSIS_MODEL], ["questions", w.DEFAULT_ANALYSIS_MODEL],
  ]);
  const steps = (id: string) => (JSON.parse((db.prepare("SELECT calls FROM dossiers WHERE id = ?").get(id) as { calls: string }).calls) as { step: string; note?: string }[]);
  assert.deepEqual(steps(d.id).map((c) => c.step), ["analysis", "analysis-retry", "analysis-fallback", "questions", "questions-retry"]);
  assert.equal(steps(d.id)[0].note, "invalid_json");

  // everything fails → 502, dossier marked failed, hidden from the list, nothing charged
  reset({ analysis: ["x", "y", "z"] });
  await rejects(w.startDossier(bob, story), 502);
  assert.equal(w.listDossiers(bob.userId).length, 1);
  assert.equal(usage(bob), 0);

  // --- synthesis failure: no charge, answers kept, retry works and charges once
  reset({ synthesis: [new Error("timeout")] });
  await rejects(w.synthesizeDossier(bob, d.id, { items: { q1: "Non" } }), 502);
  assert.equal(usage(bob), 0);
  assert.equal(w.getDossier(bob, d.id)?.status, "answered");
  assert.equal(w.getDossier(bob, d.id)?.answers?.items[0].answer, "Non");
  reset({ synthesis: [SYNTH] });
  assert.equal((await w.synthesizeDossier(bob, d.id, { items: { q1: "Non" } })).dossier.status, "done");
  assert.equal(usage(bob), 1);

  // --- follow-up failure: no charge, no message
  reset({ followup: [new Error("boom")] });
  await rejects(w.followUp(bob, d.id, "Et si le bailleur ne répond pas ?"), 502);
  assert.equal(usage(bob), 1);
  assert.equal(w.getDossier(bob, d.id)?.messages.length, 0);

  // --- canAsk false: paywall, state kept, no LLM call, no charge; resumes after purchase
  const carol = user("carol@example.com");
  for (let i = 0; i < 3; i++) db.prepare("INSERT INTO usage (subject, kind) VALUES (?, 'free')").run(`user:${carol.userId}`);
  assert.equal(getMe(carol).canAsk, false);
  reset({ analysis: [ANALYSIS], questions: [QUESTIONS] });
  d = await w.startDossier(carol, story); // steps 1-4 stay free
  reset({});
  const calls = log.length;
  r = await w.synthesizeDossier(carol, d.id, { items: { q1: "Oui" }, note: "à garder" });
  assert.equal(r.paywall, true);
  assert.equal(log.length, calls);
  assert.equal(r.dossier.status, "answered");
  assert.equal(r.dossier.answers?.note, "à garder");
  assert.equal(usage(carol), 3);
  grantBatch(carol.userId, 10, Math.floor(Date.now() / 1000), 30, "cs_carol");
  reset({ synthesis: [SYNTH] });
  r = await w.synthesizeDossier(carol, d.id, { items: { q1: "Oui" }, note: "à garder" });
  assert.equal(r.dossier.status, "done");
  assert.equal((db.prepare("SELECT credits_left n FROM credit_batches WHERE user_id = ?").get(carol.userId) as { n: number }).n, 9);
  db.prepare("UPDATE credit_batches SET credits_left = 0 WHERE user_id = ?").run(carol.userId);
  const followPaywall = await w.followUp(carol, d.id, "Et après ?");
  assert.equal(followPaywall.paywall, true);
  assert.equal(followPaywall.dossier.messages.length, 0);

  // --- double submit: a synthesis in progress is locked
  const dave = user("dave@example.com");
  reset({ analysis: [ANALYSIS], questions: [QUESTIONS] });
  d = await w.startDossier(dave, story);
  db.prepare("UPDATE dossiers SET status = 'generating', updated_at = unixepoch() WHERE id = ?").run(d.id);
  await rejects(w.synthesizeDossier(dave, d.id, {}), 409);
  assert.equal(usage(dave), 0);

  // --- verdict post-check: one stricter regeneration; still failing → kept, logged, charged once
  const erin = user("erin@example.com");
  reset({ analysis: [ANALYSIS, ANALYSIS], questions: [QUESTIONS, QUESTIONS], synthesis: ["## En bref\nVotre propriétaire n'a pas le droit de garder votre caution.", SYNTH] });
  d = await w.startDossier(erin, story);
  r = await w.synthesizeDossier(erin, d.id, {});
  assert.equal(r.dossier.synthesis_md, SYNTH);
  const strict = log.findLast((l) => l.step === "synthesis")!;
  assert.match(strict.messages[0].content, /première version a été refusée[\s\S]*n'a pas le droit/);
  assert.deepEqual(steps(d.id).slice(-2).map((c) => c.step), ["synthesis", "synthesis-strict"]);
  assert.equal(usage(erin), 1);
  const d2 = await w.startDossier(erin, story);
  reset({ synthesis: ["## En bref\nVous avez droit à 750 €.", "## En bref\nVotre bailleur vous doit 750 €."] });
  r = await w.synthesizeDossier(erin, d2.id, {});
  assert.match(r.dossier.synthesis_md!, /vous doit/);
  assert.match(steps(d2.id).at(-1)!.note!, /^still: /);
  assert.equal(usage(erin), 2);

  // high stakes: the lawyer referral must be in "En bref"
  const frank = user("frank@example.com");
  reset({
    analysis: [ANALYSIS.replace('"high_stakes":false', '"high_stakes":true')], questions: [QUESTIONS],
    synthesis: ["## En bref\nLa loi prévoit un mois (art. 22).\n## Quand consulter un professionnel\nConsultez un avocat.", "## En bref\nConsultez un avocat rapidement. La loi prévoit un mois (art. 22)."],
  });
  d = await w.startDossier(frank, story);
  r = await w.synthesizeDossier(frank, d.id, {});
  assert.match(r.dossier.synthesis_md!, /^## En bref\nConsultez un avocat/);
  assert.match(log.findLast((l) => l.step === "synthesis")!.messages[0].content, /toute première phrase de « En bref »/);

  // --- off-topic: stops after analysis, nothing to synthesize
  reset({ analysis: [JSON.stringify({ theme: "hors_sujet", title: "Voiture garée", legal_terms: [] })] });
  d = await w.startDossier(frank, "Une voiture bloque l'accès à mon garage depuis trois jours, que puis-je faire ?");
  assert.equal(d.status, "hors_sujet");
  assert.equal(log.at(-1)!.step, "analysis");
  await rejects(w.synthesizeDossier(frank, d.id, {}), 409);

  // --- validation and rate limits
  await rejects(w.startDossier(frank, "trop court"), 400);
  await rejects(w.startDossier({ ...frank, userId: null }, story), 401);
  const gina = user("gina@example.com");
  for (let i = 0; i < w.USER_DAILY_WIZARDS; i++) {
    reset({ analysis: [ANALYSIS], questions: [QUESTIONS] });
    await w.startDossier({ ...gina, ipHash: `gina-${i}` }, story);
  }
  const calls2 = log.length;
  await rejects(w.startDossier({ ...gina, ipHash: "gina-x" }, story), 429);
  assert.equal(log.length, calls2); // rejected before any LLM call
  const shared = "shared-ip";
  for (let i = 0; i < w.IP_DAILY_WIZARDS; i++) {
    reset({ analysis: [ANALYSIS], questions: [QUESTIONS] });
    await w.startDossier({ ...user(`ip${i}@example.com`), ipHash: shared }, story);
  }
  await rejects(w.startDossier({ ...user("ip-last@example.com"), ipHash: shared }, story), 429);

  console.log("check-wizard: OK");
}

main().finally(() => fs.rmSync(dir, { recursive: true, force: true }));
