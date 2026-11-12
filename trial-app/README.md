# CSE 594 Assignment 3 — Hateful Meme Annotation Study

This app hosts **two participant-facing study versions in one Netlify project**, backed by a shared Supabase events table:

- AI-assisted: \`https://YOUR-SITE.netlify.app/assisted/\`
- Without AI: \`https://YOUR-SITE.netlify.app/independent/\`

Use the explicit paths when distributing the assignment links. The root path defaults to the assisted condition. All AI predictions, trigger notices, softened captions, and explanations are **precomputed outputs from Assignment 2**; no live inference is performed.

## Updated participant flow — version 5.0.0

### Screen 1: concise consent
The CSE 594 assignment introduction explains the distinction between hateful content and material a participant personally finds triggering. It states the study condition and the risks of distressing content. A University of Michigan **uniqname is optional**. If entered, it is saved in the \`start.payload.uniqname\` and used for the same randomly seeded meme sample across conditions when the selected item count is equal. Unnamed participants are not linked across sessions.

### Screen 2: three **required** practice items
No timed animation or automatic slide changes. For each practice example, the participant must pick Hateful or Not hateful and receive immediate correctness feedback. Only a correct answer unlocks the next example, but unlimited retries are permitted. No practice answers are added to the research dataset.

1. **Hateful (correct answer: Hateful):** a mild, plainly sexist statement about girls belonging in science labs. No slurs.
2. **Non-hateful (correct answer: Not hateful):** an everyday joke about an overly long meeting.
3. **Non-hateful but potentially sensitive (correct answer: Not hateful):** a stylized fictional horror-film blood-splatter example with mild profanity. The assisted version initially blurs and softens it; the independent version does not.

These are purpose-built educational examples and are **not from the 200-item study dataset**. The setup step also lets users select **1–12 randomly sampled study trials** (default 12). Pilot test the entire flow, including the post-survey, for the assignment's under-ten-minute completion target; the additional practice and survey screens make timing important.

### Actual study trials — both versions
Every real meme includes:
- **Hatefulness:** five clickable options (1 definitely not hateful; 2 probably not hateful; 3 unsure/ambiguous; 4 probably hateful; 5 definitely hateful).
- **Triggering vote:** Yes/No, separate from hateful content.
- **Viewing preference:** Would you rather not have seen the sample? Yes/No. If Yes, choose **imagery**, **text**, or **both**.
- **Confidence:** five immediately selectable buttons, **3 preselected** as a valid default (no movement or adjustment required). \`confidence_default_used\` identifies responses retaining the default.
- Optional free-text rationale and an immediate **Skip entire example** action. Skips do not require any question or trigger the AI review; all skipped judgment fields are stored as null.

**AI-assisted:** Archived trigger flags can initially blur the meme image and soften the caption, with voluntary reveals. If the respondent's initial **binary** hateful answer (1–2 or 4–5) differs from the archived AI prediction, a highlighted **inline AI explanation** appears alongside the same meme and completed questionnaire (locked from further editing). The participant can keep the first answer or change to the AI's label. Both \`initial_classification\`/\`initial_hateful_likert\` and \`final_classification\`/\`final_hateful_likert\` are saved with the review verdict. A 3/unsure response never opens AI review.

**Independent:** Original, unfiltered image and caption. No AI prediction or rationale displayed.

### Mid-study attention checks
Two easily understood attention checks appear **between items**, after reaching approximately **30%** and **80%** of the selected real-meme count (rounding up to the next completed item). The first displays a mild, clearly exclusionary statement and asks Hateful (correct). The second displays a harmless pizza joke and asks Not hateful (correct). Incorrect answers receive feedback and **can be retried**; they do not automatically terminate the session.

**Important analytics note:** Attention attempts are separate Supabase \`response\` events with trial IDs \`ATTN_HATE_30\` and \`ATTN_NOT_HATE_80\`, and \`payload.is_attention_check: true\`. This reuses the existing event schema and avoids a database migration. **Filter these rows out** when computing real-trial counts, accuracy, response time, or other study outcomes. They are not members of the original Assignment 2 200-item dataset. When N is only 1 or 2, the thresholds may land on the same boundary and the checks run sequentially.

### Post-survey — 10 questions, two concise pages
After all real memes and attention checks, participants answer nine 1–5 agreement ratings (1 = strongly disagree; 5 = strongly agree), then have an optional tenth free-text suggestion question:

| ID | Statement |
|---|---|
| q1 | The instructions were clear and easy to follow. |
| q2 | The buttons, navigation, and layout were easy to use. |
| q3 | It was difficult to decide whether individual memes were hateful. |
| q4 | Sarcasm, context, or hidden meaning made some memes difficult to interpret. |
| q5 | I found some of the study content personally upsetting or triggering. |
| q6 | Strong or offensive language made me uncomfortable. |
| q7 | Graphic or disturbing imagery made me uncomfortable. |
| q8 | I would trust an AI system to help classify whether memes are hateful. |
| q9 | I would want AI to blur sensitive imagery or soften words while I annotate hateful memes. |
| q10 | What would you change about this interface or the use of AI? Any other suggestions? (free text, optional) |

Questions 1–5 appear on page one; 6–10 appear on page two, reducing survey overload. Nine ratings are required when submitting the survey; a participant may instead choose **Skip post-survey**.

The final Supabase \`finish.payload\` includes \`post_survey_completed\`, \`post_survey_version\`, and \`post_survey: {q1,...,q10}\` (or null if skipped), in addition to completed item counts and attention-check summary. The \`response\` events still contain each real trial's classification, triggering, viewing preference, confidence, elapsed time and AI review outcomes.

## Technical setup and persistence

Netlify builds the \`trial-app\` directory using \`npm run build\`, publishes \`dist\`, and serves functions from \`netlify/functions\`. The existing \`netlify.toml\` exposes both participant paths and routes \`/api/trials\` to the backend.

Netlify function environment:
- \`SUPABASE_URL=https://PROJECT-REF.supabase.co\`
- \`SUPABASE_SECRET_KEY=sb_secret_...\` (or legacy \`SUPABASE_SERVICE_ROLE_KEY\`)
- \`ADMIN_EXPORT_TOKEN\` (private randomly generated researcher token)
- \`ALLOWED_ORIGINS=https://YOUR-SITE.netlify.app\`

Run \`supabase/schema.sql\` in the SQL Editor if the table has not been created, and check \`https://YOUR-SITE.netlify.app/api/trials?health=1\`. Both attention events (as \`response\`) and the final nested survey payload are valid in the **existing \`payload jsonb\` field**, so no additional SQL migration is necessary.

The app preserves a locally queued event submission mechanism with Check storage and Retry upload. The v5 interface uses a **new local session-storage key** rather than resuming an older incomplete v3/v4 study. Participants should finish active older sessions before the deployment; previous unsynced events may remain under their previous browser key.

## Research data, ethics and reporting
The historical 12 November export, pseudonymized merged responses, paired participant summaries, and reproducibility script are under \`results/\`. Historical records are **not retroactively recoded** into v5. A participant's uniqname makes a session identifiable and must be protected; **never upload the raw Supabase CSV to public GitHub**. Strong or hateful content may still appear in either variant; users may skip examples or stop.

To download new results, use an authenticated \`GET /api/trials?limit=1000&offset=0\` (increase offset for more events) or export directly from Supabase. Analysis scripts must join participants only on explicit volunteered identifiers, use the session ID to group responses, and exclude attention-check events before calculating real-task outcomes.
