# CSE 594 Assignment 3 — Hateful Meme Task Trials

Two participant-facing study versions run from the **same Netlify project** and write to the **same Supabase table**. The 200 study memes and archived Gemma 4 predictions/trigger alerts come from Assignment 2; **no live model inference is required**.

## Participant URLs
- **AI-assisted:** \`https://YOUR-SITE.netlify.app/assisted/\`
- **Without AI:** \`https://YOUR-SITE.netlify.app/independent/\`

The root path defaults to assisted, so share the explicit links. Neither site automatically balances condition assignment; if counterbalancing is required, distribute the two links according to the study instructions.

## Protocol v4 (new prospective data)

All new study sessions:
1. See the research purpose and an explicit condition-specific consent/advisory page. They may optionally enter a University of Michigan uniqname; leaving it blank is allowed. If entered, it is stored in the Supabase start event and links responses by \`session_id\`.
2. Review a five-slide **manually navigated** demonstration with a harmless meme, plus a gentle **attention check** asking what the Skip button does. An incorrect answer gives feedback and can be retried. The start event logs pass status and attempts.
3. Choose **1–12 randomly sampled memes** (default **12**), targeting under ten minutes including instructions. When the same optional uniqname is given on both versions, the app uses deterministic seeded random selection so both show the **same memes** (when trial counts match), enabling stronger within-person/within-item comparisons. If no uniqname, a fresh random sample is assigned.
4. On each item choose a **five-point hatefulness rating**: 1 definitely not hateful; 2 probably not; 3 unsure; 4 probably hateful; 5 definitely hateful. For binary benchmark comparison, 1–2 map to 0, 4–5 map to 1, and 3 is **undetermined**, not a wrong answer. Separately, report whether the item was triggering, whether the respondent would rather not have seen it, and if Yes whether imagery, text or both prompted that preference. Give confidence (1–5) and an optional rationale.
5. **Skip example** skips the whole item immediately without requiring any answers. It saves a response event with \`skipped:true\`, \`skip_scope:'entire_example'\`, and null labels/trigger/preference fields.
6. After the planned N items, see a completion screen; start, response, finish events are sent to Supabase with local retry when saving fails.

**AI-assisted version:** when archived AI trigger flag is true, image is initially blurred and caption softened. The user can reveal original material separately. If the participant's *initial definite binary hateful/not-hateful judgment* disagrees with the archived AI binary judgment, a second-look screen shows the AI explanation and asks whether to keep or revise the answer. Save **both** \`initial_classification\` and \`final_classification\`, plus \`initial_hateful_likert\`, \`final_hateful_likert\`, \`ai_reasoning_verdict\`, and \`participant_changed_answer\`. No disagreement screen is shown for 3/unsure or skipped examples.

**Without-AI version:** original image and caption are always displayed unfiltered, no trigger warning/AI classification/reasoning is revealed, and there is no AI disagreement step. It collects the same human experience and preference questions.

**Important:** Historical sessions in the results dataset were created with previous binary-only, variable question protocols and **must not be reinterpreted as v4 data**.

## Deployment and storage
- Netlify build base directory: \`trial-app\`. Build command: \`npm run build\`, publish directory \`dist\`, functions directory \`netlify/functions\`. The file \`netlify.toml\` defines both routes and an API redirect.
- Set Functions-scope Netlify environment variables:
  - \`SUPABASE_URL=https://PROJECT-REF.supabase.co\`
  - \`SUPABASE_SECRET_KEY=sb_secret_...\` (or legacy \`SUPABASE_SERVICE_ROLE_KEY\`)
  - \`ADMIN_EXPORT_TOKEN\` (a researcher-owned randomly generated token)
  - \`ALLOWED_ORIGINS=https://YOUR-SITE.netlify.app\`
- Execute \`trial-app/supabase/schema.sql\` in your Supabase project's SQL Editor before using the study. The table's existing \`payload jsonb\` supports every added field: **no migration required**.
- \`GET https://YOUR-SITE.netlify.app/api/trials?health=1\` checks database availability without disclosing keys. The frontend has Check storage and Retry upload controls.
- Export data with \`curl -H 'Authorization: Bearer YOUR_ADMIN_EXPORT_TOKEN' 'https://YOUR-SITE.netlify.app/api/trials?limit=1000&offset=0' -o results.json\`; increment offset for additional pages.

## Assignment 3 analysis (historical export)
See [results/report.md](results/report.md) and the pseudonymized [merged trial data](results/merged_deidentified_trials.csv), plus [paired participant summary](results/paired_participant_comparison.csv). To reproduce major descriptive metrics and exact paired tests:

\`\`\`bash
pip install pandas numpy scipy
python results/reproduce.py
\`\`\`

The full polished course report is generated separately as editable DOCX and submission PDF. The analyzed export includes 211 events, five confidently matched uniqnames, and only three independent sessions with a finish event; **further valid completions may be needed** to satisfy the assignment's minimum of five per condition.

## Ethics and data handling
The independent interface **deliberately shows potentially distressing original content**, even if the archived model would flag it. AI filtering in the assisted interface is imperfect. Participants may skip items or exit. Uniqnames are optional but identifying; keep raw exports private. **Do not commit raw event CSVs, participant names, UUIDs, timestamps, or free-text rationales** to public GitHub. Results posted here are pseudonymized rather than guaranteed anonymous.

The original 200-meme source dataset is balanced on hateful label; triggering has **no universal reference ground truth**. Reports of distress are personal, not ground-truth labels for everyone.
