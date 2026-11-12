# Context Lab — two participant websites, one Netlify project

This is a controlled study about how humans interpret hateful memes, including sarcasm and implied meaning, and how AI-assisted review affects judgments. **Hateful / not hateful and triggering / not triggering are separate judgments.**

## Participant links

Both study variants run in the **same Netlify project and deployment**, with one Supabase table and common serverless API:

- **AI-assisted:** \`https://YOUR-SITE.netlify.app/assisted/\`
- **Independent, without AI assistance:** \`https://YOUR-SITE.netlify.app/independent/\`

The site root \`/\` defaults to assisted, so distribute explicit links rather than the root. URL determines the assigned variant; to randomize allocation, distribute the links with an independent assignment procedure. Each URL uses separate local browser session state, avoiding accidental cross-variant resumes.

### AI-assisted variant

- AI examines the *precomputed* trigger flag for each meme; flagged images are **blurred by default**, and a generated softened caption and trigger notice appear. Participants may voluntarily reveal the original image or text.
- Participant decides whether content is hateful (yes/no), whether the viewed meme felt triggering (yes/no), confidence (1–5), and can provide an optional rationale.
- **Only when initial participant hateful judgment differs from precomputed AI hateful prediction**, display the AI prediction and its archived reasoning on a second screen. Ask: **AI seems correct — change my answer** / **AI seems wrong — keep my answer**.
- Record the **initial hateful classification** before AI reasoning and the **final classification** after the review (plus \`ai_reasoning_verdict\` and \`participant_changed_answer\`), so research analysis can distinguish unaided vs post-explanation judgments.
- Skipping hateful judgment does not trigger AI review. The participant still votes triggering/not triggering on the trial.

### Independent variant — original content, **no protective filtering**

- Shows the **original unblurred image and original caption**, even when the dataset's AI trigger flag is true.
- Does **not** display any AI hateful prediction, explanation, trigger category, or shield.
- Participant decides **hateful / not hateful** and **triggering / not triggering** separately, selects confidence, and can add an optional comment.
- On **every item**, ask **"Would you have preferred not being shown this meme?"** (yes/no).
- If yes, require a reason: **Imagery**, **Text**, or **Both**.
- **No AI disagreement review** is shown in this variant. Skipping hateful classification still allows recording the other responses.

### Both versions

1. Purpose and consent screen explaining why human feedback helps catch sarcasm, subtext and context, and why hateful and triggering are independent categories.
2. Five-step animated practice walkthrough using a harmless illustration, with previous/next/replay and accessible reduced-motion behavior.
3. Choose **1–30 task trials** (default **12**).
4. Trial classifications, confidence, sensitivity and any requested preference/review fields are stored in the same Supabase database. Progress survives page refreshes via browser-local state.

**Content-risk disclosure is condition-specific.** The independent version warns explicitly that all examples are unfiltered and may contain hateful language, violent or disturbing imagery, abuse, or other sensitive content. The assisted version warns that AI shielding is imperfect and some content can still be sensitive. Participants can skip hateful classification or discontinue the study at any time.

## Database and event format

The current \`public.task_trial_events\` table stores study records with \`event_type\` start/response/finish, \`condition\` assisted/independent, and \`payload jsonb\`. **No schema migration is required**; all new fields go into \`payload\`.

Shared \`response.payload\` fields:

- \`initial_classification\` (\`0\` not hateful, \`1\` hateful, null if skipped)
- \`final_classification\` (same as initial unless the AI-assisted disagreement review changes it)
- \`classification\` (alias for initial response retained for backwards compatibility)
- \`triggering_vote\` (\`1\` triggering, \`0\` not triggering)
- \`confidence\`, \`reason\`, \`skipped\`, \`elapsed_ms\`, \`website_variant\`
- \`image_initially_blurred\`, \`caption_euphemized\`, \`image_revealed\`, \`caption_revealed\`

Assisted-only fields:

- \`ai_trigger_detected\` (boolean), \`ai_hateful_prediction\` (0/1), \`ai_disagreement\` (boolean)
- \`ai_reasoning_presented\` (boolean), \`ai_reasoning_verdict\` (\`ai_correct_changed\` / \`ai_wrong_kept\` / null)
- \`participant_changed_answer\` (boolean)

Independent-only fields:

- \`preferred_not_shown\` (1 yes, 0 no)
- \`preferred_not_shown_reason\` (\`imagery\`, \`text\`, \`both\`, or null when answer is no)
- \`ai_hateful_prediction\` and \`ai_trigger_detected\` are null in exported participant responses. Independent participants do not see these model outputs.

Every completed review has **both initial and final hatefulness labels in the same persisted response event**, with review outcome. If no review occurred, initial and final classifications are identical. As with any study using optional abandonment, unfinished individual trials are not submitted as response events.

The \`start\` payload includes \`planned_items\`, \`consented\`, \`study_version\`, \`content_shield\` and \`website_variant\`. Both variants use identical Supabase credentials and function endpoints.

## Deploy on Netlify

1. Merge this PR into \`main\`. When your Netlify project has GitHub continuous deployment enabled, Netlify rebuilds automatically.
2. Netlify build settings: repository \`rudrajyotiroy/hai-task-trial\`, **base directory \`trial-app\`**, build command \`npm run build\`, publish directory \`dist\`. The app's \`netlify.toml\` defines the common function rewrite plus both participant routes.
3. In **Project configuration → Environment variables**, add server-side:
   - \`SUPABASE_URL\`: \`https://YOUR-PROJECT.supabase.co\`
   - \`SUPABASE_SECRET_KEY\`: Supabase \`sb_secret_...\` key, or legacy \`SUPABASE_SERVICE_ROLE_KEY\`
   - \`ADMIN_EXPORT_TOKEN\`: your generated random secret for researcher exports
   - \`ALLOWED_ORIGINS\`: the Netlify site's **origin**, e.g. \`https://YOUR-SITE.netlify.app\` (same origin for both routes).
4. Check Supabase table exists: run \`trial-app/supabase/schema.sql\` in the project SQL Editor if not created already.
5. Check \`https://YOUR-SITE.netlify.app/api/trials?health=1\` — expected \`{"ok":true,"storage":"ready",...}\`. If not, inspect status hints, environment-variable scopes, Supabase status and Netlify Functions logs.
6. Visit both participant URLs, complete a small trial session, and check that Supabase \`task_trial_events.condition\` and \`payload.website_variant\` agree. For the independent route, verify no blur and that \`preferred_not_shown_reason\` is stored when Yes; for assisted, choose an item with AI disagreement and verify both initial and final labels. Confirm footer says responses saved, not queued.

## Research and content limitations

The AI trigger labels, softened captions and hateful classifications are archived model outputs in the 200-item study dataset, **not live AI requests**. They can be wrong or fail to protect participants. Blurring is client-side UI presentation and does not remove third-party image URL network requests; the independent route intentionally exposes the original content. Consult your research ethics/IRB requirements before recruiting participants, particularly for the unfiltered arm. The study uses random local item order but **does not automatically balance assignment across the two explicit URLs**.

The backend accepts anonymous participant submissions and implements locally queued retries. For large public deployments, consider rate limiting, more robust anti-abuse controls and regular backups. Free Supabase projects may pause with inactivity.

## Export study results

\`\`\`bash
curl -H "Authorization: Bearer YOUR_ADMIN_EXPORT_TOKEN" \
 "https://YOUR-SITE.netlify.app/api/trials?limit=1000&offset=0" \
 -o results.json
\`\`\`

Increment \`offset\` for subsequent pages of up to 1000 events. Never publish the export token or Supabase secret key.
