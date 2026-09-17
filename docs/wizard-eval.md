# Wizard prototype: evaluation (17/09/2026)

Script: `scripts/wizard-proto.ts` · Cases: `scripts/wizard-cases.json` (20) · Raw transcripts, per-call logs and checks: `docs/wizard-results.json`.
Retrieval is the production one: `retrieve()` was pulled out of `ask()` in `src/lib/ask.ts`, with no behaviour change (`check-ask` still passes). `chat()` in `src/lib/openrouter.ts` now also accepts `extra` body fields and returns `provider` and `usage`. Both changes are backward compatible. The run used a copy of the DB (`data/loila.db` in the worktree), so production was never written to.

## TL;DR: conditional go

| Step | Recommendation |
|---|---|
| 1. Analysis and 3. Questions | **DeepSeek V4 Flash 0731, reasoning OFF** (`deepseek/deepseek-v4-flash-0731` + `reasoning: {enabled: false}`) |
| 5. Synthesis | **Keep Claude Haiku 4.5** (production `OPENROUTER_CHAT_MODEL`) |
| DeepSeek with reasoning ON | **No.** 15/20 wizards failed with an empty response, and the question step took a median of 55 s. |

Go, with conditions. The pipeline works end to end. It found the key article in 38 of the 42 applicable runs, never invented an article number (0 hallucinations in 80 syntheses) and caught the off-topic case every time. The **real failures do not depend on the model** and must be fixed before any UI: (1) long articles get truncated by `excerpt()`, so the decisive paragraph disappears; (2) the second round of questions mostly repeats the first; (3) the tone slides into verdicts ("votre propriétaire n'a pas le droit"). Details are in "Open risks".

Estimated cost per completed wizard (analysis x3, questions x2, synthesis; simulated user and judge excluded):
- DS fast + Haiku synthesis (recommended): **$0.012** (max $0.018)
- All Haiku: $0.030 (max $0.042)
- All DS fast: $0.0026 (max $0.0067)

Total evaluation spend: **about $1.49** (full run $1.354 + two smoke tests), under the $2 cap. $0.43 of that went to the Gemini judge.

## Setup

- **Models (slugs checked via `GET /api/v1/models` on 17/09).** `deepseek/deepseek-v4-flash` still resolves to the **0423** revision. The latest dated V4 Flash revision is **`deepseek/deepseek-v4-flash-0731`**, which is what `~deepseek/deepseek-v4-flash-latest` points to. I used 0731. `deepseek/deepseek-v4.1-flash` (10/09, new CED architecture) is too recent to call stable and was not tested. Production uses `anthropic/claude-haiku-4.5` for answers (BYOK: OpenRouter cost=0, so I counted `upstream_inference_cost`) and `google/gemini-3.5-flash-lite` for expansion.
- **Arms.** `dsfast` = DS 0731 without reasoning; `ds` = DS 0731 with default reasoning; `haiku`. Each arm runs analysis → retrieval → questions (up to 2 rounds) → simulated answers → re-analysis → final retrieval. Each transcript is then synthesised by **both** Haiku and DS fast, so step 5 is compared on identical input.
- **Simulated user:** `gemini-3.5-flash-lite` (same for every arm), which answers only from the hidden facts. **Question judge:** `gemini-3.5-flash` (a third model family, low reasoning).
- **Routing:** every call used `provider: { data_collection: "deny" }`. DeepSeek calls also used `sort: "throughput"`, because endpoint speeds vary 10x.

## Results table

### Steps 1 + 3 (per wizard arm, 20 cases)

| | DS fast | Haiku 4.5 | DS reasoning |
|---|---|---|---|
| Completed wizards | 20/20 | 20/20 | **5/20** (15 empty responses) |
| Strict JSON (raw `JSON.parse`) | 94/95 | **0/93** (always wrapped in ```json fences) | 62/63 |
| Valid JSON schema after lenient parse (+1 retry) | 94/95 → 95/95 | 93/93 | 62/63 |
| Median latency: analysis / questions | **2.5 s / 3.6 s** (p90 5.9 / 8.7) | 3.3 s / 5.1 s (p90 4.4 / 6.7) | 9.9 s / 55 s |
| Model time per wizard (analysis+questions, median) | 15 s | 20 s | 102 s |
| Questions per wizard (round 1 + round 2) | 4.7 (3.3 + 1.7) | 4.2 (2.8 + 1.7) | 2.2 |
| Cited article was actually retrieved | 91/94 | 77/85 | 11/11 |
| "condition" quote found in the article (≥80 % of tokens) | 91/94 | 74/85 | 11/11 |
| Judge: grounded | 75/94 (80 %) | 67/85 (79 %) | 11/11 |
| Judge: changes the outcome | 65/94 (69 %) | 59/85 (69 %) | 11/11 |
| Judge: already known (asked for nothing) | 32/94 (34 %) | 22/85 (26 %) | 3/11 |
| … of which round 2 | **17/32 (53 %)** | **19/32 (59 %)** | – |
| "Je ne sais pas" option present | 75/94 | 67/85 | 10/11 |
| At least one key article in final retrieval | 18/19 cases | 16/19 cases | 4/4 |
| Off-topic detected (hs-01) | yes | yes | yes |
| Ambiguous case (hs-02): disambiguation question | yes (round 1) | yes (round 1) | – |
| Cost of steps 1+3 per wizard | $0.0017 | $0.0188 | $0.0035 |

The judge is lenient (it scored all 11 `ds` questions positive). Treat its percentages as upper bounds. The "already known" signal matches my own reading.

### Step 5 (synthesis, same transcripts for both models)

| | Haiku (Haiku transcript) | Haiku (DS transcript) | DS fast (DS transcript) | DS fast (Haiku transcript) |
|---|---|---|---|---|
| n | 19 | 19 | 19 | 19 |
| Median latency | 10.8 s | 10.4 s | **6.9 s** | 7.7 s |
| Articles cited / answer | 2.6 | 3.1 | 3.5 | 3.3 |
| Cites a number outside the given set | 1 | 1 | 1 | 4 |
| … relayed from a given article's text (e.g. "article 1731 du code civil" inside art. 3-2) | 1 | 1 | 1 | 4 |
| **Hallucinated article numbers** | **0** | **0** | **0** | **0** |
| Verdict phrasing (regex) | 3 | 2 | 1 | 2 |
| Formatting glitches (stray combining ´, `(art..`, unclosed parentheses, blank runs) | 0 | 0 | **16/38 across both DS columns** | (counted left) |
| Cost / synthesis | $0.0101 | $0.0099 | $0.0008 | $0.0008 |

Note on the checker. The first version flagged "D353-200" (an "Annexe III à l'article D353-200" was in the set), "3" (from "art. L1234-1, 3°") and quoted references as hallucinations. After the fix (`citationCheck()`, `--recheck` mode, `--selfcheck`), every out-of-set number is legitimately relayed from a given article's text. The regex misses verdicts without an amount ("n'a pas le droit", "le bailleur est en retard", "votre assurance a raison"), so the real verdict rate is higher (see the reading below).

## My qualitative grading (9 syntheses read in full)

| Case | Synthesis | Grade | Why |
|---|---|---|---|
| tr-01 rupture conv. deadlines | DS fast > DS fast | **A-** | Withdrawal period until 23/09/2026, 15 working days for homologation, uses the date agreed in the agreement (15/10). Formatting glitches; suggests the ADIL (a housing body) for a labour dispute. |
| tr-01 | Haiku > Haiku | B+ | Same rules, clear timeline table. But it never had the 15/10 date, so it projects the end of the contract at "about 9-10 October", which is misleading. |
| tr-05 protected employee | DS transcript > Haiku | **A-** | Correctly identifies L1237-15 (labour inspector's authorisation), L2411-1 and harassment, and says "avocat maintenant". A few sentences read as verdicts ("la rupture n'est pas valide"). |
| dg-01 classic deposit | Haiku > Haiku | B | Deadline 20/08, month started late, 10 % increase: all correct (art. 22). Opens with "Non, votre propriétaire n'a pas le droit…", a verdict the regex does not catch. |
| dg-06 amount too high | DS transcript > Haiku | **C** | Deposit capped at 1 month: correct. "Demander 1 mois d'avance est légal": **unsupported** by the given articles (none cited), and doubtful. Irrelevant digression about automatic debit. |
| pr-01 Bordeaux | DS fast > DS fast | C | The 1-month rule is right, but it cites "art. 15, III" (it is I), **ignores the "zone tendue: Oui" answer** ("vous devez vérifier"), and has garbage characters (`art.  ́15`). |
| pr-06 care home (health) | DS fast > DS fast | C- | Art. 15 was retrieved, but `excerpt()` cut the "3° état de santé… certificat médical" list out of the article (11,871 chars → 2,500). The model says honestly that the texts do not specify it, but concludes "en principe 3 mois". |
| pr-06 | Haiku > Haiku | **D** | Retrieval returned only HLM model-lease annexes (D353-*), not art. 15. So the answer covers the social-housing regime, calls care-home entry a "raison familiale grave" (an invented assimilation) and, for an ordinary lease, says "consultez le bail". That is wrong: 1 month under art. 15 I 3°. |
| dg-07 summons (see a lawyer) | Haiku > Haiku | **D** | "Consultez un avocat MAINTENANT" does appear, but only at the end, after a full adversarial brief: "Votre assurance a raison", "ce n'est pas votre responsabilité", and misuse of art. 3-2 ("ne peut pas réclamer sans état des lieux"). |

Summary: **the two models have the same level of legal accuracy** on identical input. Most errors come from what reaches the model (retrieval, excerpt, noisy answers). Haiku reads better and never garbles text. DS fast sticks closer to the texts but has formatting glitches in 42 % of outputs and sometimes ignores answers. In 9/9 syntheses of the two "see a lawyer" cases, the professional section says "maintenant/immédiatement", but never in the "En bref" (0/9 in the first 600 chars).

## 3 best transcripts (short)

1. **tr-01 (DS fast > DS fast).** *Story:* "signé une rupture conventionnelle le 8 septembre… je peux encore changer d'avis ?" · Q: "Date de rupture prévue dans la convention ?" → 15 octobre 2026 · Q: "Homologation déjà rendue ?" → Non, pas encore · **Synthesis:** "délai de rétractation de 15 jours calendaires… expire le 23 septembre 2026 (art. L1237-13)… la rupture ne peut intervenir avant le lendemain de l'homologation… libre de partir le 15 octobre sous réserve que l'homologation soit intervenue."
2. **tr-05 (DS transcript > Haiku).** *Story:* CSE representative under pressure to sign after reporting harassment. **Synthesis:** "elle doit d'abord être autorisée par l'inspecteur du travail (art. L1237-15)… Ne signez rien… Consultez immédiatement un avocat spécialisé / l'inspecteur du travail."
3. **hs-02 ambiguous (all arms).** *Story:* "j'ai un problème avec mon contrat, ils veulent me faire partir" · Q1 (Haiku): "S'agit-il d'un contrat de travail ou d'un bail ?" → travail · Q (round 2): "Vous propose-t-il un accord… ou cherche-t-il à vous licencier ?" → rupture conventionnelle → retrieves L1237-11/13. (hs-01, the car blocking a garage, came out `hors_sujet` in all 3 arms with no LLM synthesis.)

## 3 worst transcripts (short)

1. **pr-06 (Haiku > Haiku).** Retrieval failure. Final set = 8 D353-* annexes (HLM model leases), no art. 15. "Si le logement n'est pas conventionné… consultez le contrat de bail". **Wrong** (art. 15 I 3°: 1 month with a medical certificate). Earlier, Haiku had asked twice about "logement conventionné APL".
2. **dg-07 (Haiku > Haiku).** Summons, hearing in 3 weeks, EUR 9,000 claimed. The answer reads like a legal brief ("Votre assurance a raison", "Le bailleur ne peut pas vous réclamer des réparations sans état des lieux contradictoire (art. 3-2)", a misreading) before "consultez un avocat".
3. **dg-01 (DS fast wizard).** Q: "L'état des lieux de sortie a-t-il été réalisé… le 20 juillet **2024** ?" (invented year) → simulated user: "Non" (the hidden facts said yes) · Round 2 repeats: "date exacte de la remise des clés ?" · Haiku, same case: "plus d'un mois s'est-il écoulé depuis le 20 juillet ?" (it can compute that) → "Je ne sais pas". **The question step asks for what it could compute and repeats itself.**

## Final prompts and JSON schemas

Full text lives in `scripts/wizard-proto.ts` (`ANALYSE_PROMPT`, `QUESTIONS_PROMPT`, `USER_SIM_PROMPT`, `SYNTH_PROMPT`, `JUDGE_PROMPT`). Summary:

**Analysis** (`json: true`, max_tokens 4000, temp 0). Validation: `theme ∈ enum && Array.isArray(legal_terms)`, otherwise 1 retry.
```json
{ "theme": "logement|travail|ambigu|hors_sujet",
  "facts": ["… dates JJ/MM/AAAA"], "legal_terms": ["5-10 termes tels que dans les textes"],
  "likely_articles": ["22", "L1237-13"], "unknowns": ["faits manquants qui changent la règle"] }
```
`legal_terms` → `words`, `likely_articles` → `nums` of `retrieve()` (it replaces `expandQuery`). `hors_sujet` stops the flow. `ambigu` searches logement+travail. On each round, the analysis runs again on story + answers.

**Questions** (max_tokens 5000). Validation: `questions[]` of strings. Key rules: ask only about a condition written in a given article; never ask what is already known; quote the condition word for word (lets us check the quote automatically); choices + "Je ne sais pas" last; `enough_info`.
```json
{ "enough_info": false,
  "questions": [{ "id": "q1", "question": "…", "type": "choice|date|text",
    "options": ["…", "Je ne sais pas"], "article": "22",
    "condition": "passage recopié de l'article (10-30 mots)", "why": "ce que la réponse change" }] }
```
Articles are passed through `excerpt(…, 1500)`, 8 articles, about 3.2k input tokens.

**Synthesis** (Markdown, max_tokens 4000). "INFORMATION JURIDIQUE GÉNÉRALE"; forbids "vous avez droit à X €" / "votre bailleur vous doit" / "vous allez gagner" in favour of "dans une situation comme la vôtre, la loi prévoit… si… alors…"; only the given articles, cited as `(art. 22)`; date calculations with "nous sommes le …"; fixed sections En bref / Les règles qui s'appliquent / Délais / Prochaines étapes / Quand consulter un professionnel.

**Automatic checks:** `citedNums()` (strips "3°"), `citationCheck()` (given / relayed / hallucinated / non-existent in the DB), `VERDICT_RES` (8 regexes). Run `npx tsx scripts/wizard-proto.ts --selfcheck`.

## Data routing

- `data_collection: "deny"` was **accepted on every call** (no refusals, no "no endpoints" errors).
- **Which providers served DeepSeek V4 Flash 0731** (202 calls): Wafer 84, Reka 48, CoreWeave 33, OpenInference 16, **Baidu 11**, Phala 7, Makora 2, BaseTen 1. In smoke tests: DeepInfra, StreamLake, Sail Research, Inceptron.
- **DeepSeek's own endpoint (China) was never used.** It is not even listed for V4 Flash 0423/0731, only for `deepseek-v4.1-flash`.
- **But `data_collection: deny` does not exclude China-based providers.** Baidu (Baidu AI Cloud) served 11 calls, and StreamLake (Kuaishou) served one smoke test. Both declare no retention/training, so they pass the filter. If the goal includes "no processing in China" (GDPR transfers, user trust), add `provider.ignore: ["baidu", "streamlake", "alibaba", "siliconflow"]`, or better, an `order`/`only` whitelist (DeepInfra, CoreWeave, Together, Fireworks, Azure) + `allow_fallbacks: false`. The OpenRouter `zdr: true` option is worth testing too.
- Quantisation varies by provider (fp8, fp4 for Reka/AtlasCloud/Inceptron). A whitelist also fixes the quality variance.
- Haiku was served by Anthropic 131/131 (BYOK). Gemini by Google / Google AI Studio.

## Open risks (fix before the UI)

1. **Truncated long articles.** `excerpt()` keeps 2,500 chars by keyword overlap. Art. 15 (11.9k), 24 (14.4k) and 25-8 (4.5k) lose their enumerated lists ("3° état de santé…"), because those lines do not share the user's words. Fix: slice by paragraph/° and pass the paragraph the question cites (`condition`) to the synthesis, or excerpt against `legal_terms` + Q/A.
2. **Retrieval pulls in off-target neighbours.** HLM model-lease annexes (D353-*) crowd out the loi 89 in several "préavis" cases, and even displace art. 15 entirely (pr-06 Haiku, pr-05 Haiku). Fix: exclude `Annexe…` articles from the logement theme, or force `likely_articles` first (they already are: the model has to suggest "15").
3. **Round 2 is mostly noise.** 53-59 % of round-2 questions ask for what is already known. Also, questions ask for what the model can compute ("plus d'un mois écoulé depuis le 20 juillet ?"). Recommendation: **1 round of at most 3 questions**, then a second round only if `enough_info=false` AND deterministic dedup (similarity against earlier questions), and pass the current date to the question step.
4. **Tone slides into verdicts.** The regex catches 1-3/19 per column; reading shows more ("n'a pas le droit", "votre assurance a raison"). Fix: a post-generation filter/rewrite using a broader regex list, or a cheap second pass ("réécris sans verdict"). For contentious cases (summons, protected employee, amount > X), put the lawyer referral **in "En bref"** and shorten the analysis. A deterministic `needs_lawyer` flag from the analysis would do it.
5. **The simulated user is noisy** (gemini flash-lite: wrong answers, "Je ne sais pas" when the fact is deducible, 55-62 % "Je ne sais pas" overall). The question metrics are therefore conservative, but a real user will also answer badly. The UI must allow "je ne sais pas" and edits.
6. **DeepSeek:** keep reasoning off (on: 75 % empty responses, 55 s). Formatting glitches in 42 % of syntheses (a reason to keep Haiku for step 5). Latency varies by provider (p90 questions 8.7 s, max 16 s).
7. **Haiku ignores `response_format`**: always ```json fences. Lenient parsing is required (`parseJson` in the script).
8. **Out of scope in this proto:** collective agreements (`searchArticles` narrows to a named CCN and would drop the Code du travail; tr-03 Syntec is therefore answered with the legal notice periods only), Code civil (art. 1731/1732 referenced but not retrievable in the logement theme), unemployment benefits (tr-04).
9. **Small evaluation:** 20 cases, 1 run, temp 0, LLM judge = leniency bias; only 9 syntheses read by hand. The table numbers give orders of magnitude, not a benchmark.

## Reproduce

```bash
cp ../loila/.env . && ln -s ../loila/node_modules node_modules
sqlite3 ../loila/data/loila.db ".backup data/loila.db"   # read-only copy
DATABASE_PATH=./data/loila.db npx tsx --env-file=.env scripts/wizard-proto.ts [caseId…] [--resume]
DATABASE_PATH=./data/loila.db npx tsx scripts/wizard-proto.ts --recheck     # automatic checks only, no LLM calls
DATABASE_PATH=./data/loila.db npx tsx scripts/wizard-proto.ts --selfcheck
```
