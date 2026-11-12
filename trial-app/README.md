# Context Lab — HAI Content Shield Study

This deployable research app uses the 200 precomputed AI trigger assessments from Assignment 2. It separates **AI content shielding** from the participant's judgment of whether a meme is hateful.

## What changed

- Both routes use the same AI trigger-based safety filter; the independent route omits AI feedback on hateful classifications.
- The AI-assisted route shows extra triggering and AI disagreement questions; the independent route asks about participant preference not to see each sample.
- When AI detected a trigger, the AI-assisted group sees a **blurred image, softened caption, and brief trigger notice**. Each can be revealed separately by participant choice.
- Shield decisions come from \`ai_trigger_flag\`, \`ai_trigger_categories\`, \`ai_trigger_notice\` and \`ai_euphemized_caption\` in the archived 200-row Cloudflare evaluation. **They are precomputed and are not a live model call.**
- The participant's classification, confidence, timing, whether AI shielding was applied, and voluntary reveal actions are logged.
- \`GET /api/trials?health=1\` returns a safe database status without revealing secrets.
- Submission errors retain a local queue and show the error code. Use **Check storage** and **Retry upload** in the footer.


## Two websites from one Netlify project (v3.1)

A single Netlify build serves **two participant URLs** on the SAME domain (no second Netlify project, second database, or additional credentials):

- **AI-assisted**: \`https://YOUR-SITE.netlify.app/assisted/\`
- **Without AI assistance**: \`https://YOUR-SITE.netlify.app/independent/\`

Both routes load the same Vite bundle and use the same **precomputed AI trigger-based safety filter**: flagged images are initially blurred and their captions softened, with the option to reveal them. This is a safety measure, not experimental AI assistance. Trigger filtering is not guaranteed to catch everything.

The **condition is determined exclusively by the URL**; do not use the root \`/\` URL to assign participants because that defaults to the AI-assisted interface. Distribute the two explicit links in your study protocol. Session state is stored under a separate browser-local key per route, so a participant opening both variants cannot mix in-progress sessions.

### Participant flow (shared)

1. Brief purpose page explains human feedback for hate detection, sarcasm and nuanced context, and why hateful and sensitive are *independent categories*. Collects voluntary informed consent.
2. Animated, **safe illustrative** walkthrough; participants may use dots/Previous/Next/Replay, with automatic rotation (unless reduced motion is preferred). Trial count selectable from **1 to 30**, default **12**.
3. For each trial, the participant judges *hateful / not hateful*, adjusts a 1–5 confidence rating, optionally enters a rationale, and may skip the hateful-label judgment.

### AI-assisted route only

- After judging hatefulness, vote **triggering / not triggering** for each sample, irrespective of the AI trigger flag or whether the participant revealed original material. This is a required response even when hateful classification is skipped.
- If the *initial hateful judgment* differs from the precomputed AI hateful prediction, show the AI explanation **only after** the participant has answered. Ask **AI seems correct — change my answer**, or **AI seems wrong — keep my answer**. A skipped hateful judgment has no AI review.
- Database JSONB response fields: \`triggering_vote\` (0/1), \`ai_hateful_prediction\`, \`ai_disagreement\`, \`ai_reasoning_presented\`, \`ai_reasoning_verdict\` (\`ai_correct_changed\` or \`ai_wrong_kept\`), \`initial_classification\`, \`final_classification\`.

### Independent route only (no AI assistance beyond filtering)

- **Do not ask** the triggering/not-triggering question or show the AI disagreement/reasoning review.
- Instead ask **"Would you have preferred not to be shown this sample?"** (Yes/No), including if the participant skipped hateful classification.
- Database JSONB response fields: \`preferred_not_shown\` (1 Yes / 0 No), \`triggering_vote: null\`, \`ai_reasoning_presented: false\`, \`ai_reasoning_verdict: null\`, plus the participant's initial/final hateful judgments and confidence.

### Database and deployment

Both versions write to **the same Supabase \`public.task_trial_events\` table**. The \`condition\` SQL column is \`assisted\` or \`independent\` according to the URL; \`payload.website_variant\` repeats the route identifier on responses, and \`start\` also logs \`website_variant\`, \`planned_items\`, and \`content_shield:true\`. The existing \`payload jsonb\` accommodates all fields **without any new SQL migration**.

A single merge to \`main\` triggers one automatic Netlify deployment when GitHub continuous deployment is enabled. Configure Netlify base directory \`trial-app\` and retain the same environment variables. \`trial-app/netlify.toml\` routes both participant paths to \`index.html\` and \`/api/trials\` to the Netlify function. If either route is 404, inspect deployed redirect rules and verify the site built from main.

**Study design note:** These are two different *assistance-interface versions*, not a filtered-vs-unfiltered comparison. Distribute explicit URLs using externally assigned groups if randomized assignment is desired. A cross-group comparison may be influenced by participants choosing their own URL.


## Deploy on Netlify

1. Merge the PR. In Netlify, deploy from main with **base directory** \`trial-app\`, **build command** \`npm run build\`, **publish directory** \`dist\`. Netlify functions default to \`netlify/functions\` relative to the base.
2. Create your free Supabase project and execute \`trial-app/supabase/schema.sql\` in Supabase SQL Editor. Verify the \`public.task_trial_events\` table exists.
3. In Netlify **Project configuration > Environment variables**, add:
   - \`SUPABASE_URL\`: the exact project URL, for example \`https://your-ref.supabase.co\`.
   - \`SUPABASE_SECRET_KEY\`: a Supabase server-side \`sb_secret_...\` key (or use \`SUPABASE_SERVICE_ROLE_KEY\` for the legacy service-role JWT).
   - \`ADMIN_EXPORT_TOKEN\`: your own strong random token (only for researcher export).
   - \`ALLOWED_ORIGINS\`: the full deployed origin, such as \`https://your-site.netlify.app\` without the ending slash. For deploy previews or custom domains, include each origin separated by commas.
4. Set environment variable scopes to **Functions** (or all scopes), then trigger a fresh deployment.
5. Visit \`https://your-site.netlify.app/api/trials?health=1\`. It should show \`{"ok":true,"storage":"ready"...}\` without requiring your export token. If this fails:
   - \`BACKEND_NOT_CONFIGURED\` or missing variables: check Netlify environment names, scopes, and redeploy.
   - \`SUPABASE_401\` / \`SUPABASE_403\`: check server-side key and project URL; never share the secret key.
   - \`SUPABASE_404\`: execute the included SQL schema in the correct Supabase project.
   - \`NETWORK_ERROR\`: check Supabase project activity and Netlify Functions logs.
   - If you see HTML instead of JSON, verify \`netlify.toml\` redirect and functions deployment.
6. Complete a trial and confirm rows exist in **Supabase > Table Editor > task_trial_events**. The UI footer should say **All responses saved**, not pending. Test at least a start, a response, and a finish event.

## Data export

Send an authenticated request:
\`\`\`bash
curl -H "Authorization: Bearer YOUR_ADMIN_EXPORT_TOKEN" \
 "https://your-site.netlify.app/api/trials?limit=1000&offset=0" -o results.json
\`\`\`
Increase offset to export additional batches. Never put the token in browser source or share it with participants.

## Privacy and study caveats

Content warnings are approximate. Existing AI trigger labels sometimes over- or under-detect harmful material. The words in the softened captions were generated earlier by the evaluation pipeline and may not always be fully euphemized. This is a **UI blur**, not secure redaction of the original remote image, and a participant can reveal it. Original meme image URLs are third-party-hosted and may expose visitor network metadata to the image host. Consult institutional research requirements for consent and disclosure. The study currently uses browser-local randomization, not a centrally balanced allocation.

The backend accepts anonymous writes and uses an event schema with unique event IDs to allow upload retries; for large public studies, add rate limiting and anti-abuse controls. Back up results regularly; free Supabase projects can pause with inactivity.

## Vercel

Select \`trial-app\` as Root Directory, add the same four environment variables, and deploy. The API entry point is \`api/trials.js\`. Verify the health route first.
