# Context Lab — HAI Content Shield Study

This deployable research app uses the 200 precomputed AI trigger assessments from Assignment 2. It separates **AI content shielding** from the participant's judgment of whether a meme is hateful.

## What changed

- The independent group sees the original meme and caption.
- The AI-assisted group sees original content when AI detected no trigger.
- When AI detected a trigger, the AI-assisted group sees a **blurred image, softened caption, and brief trigger notice**. Each can be revealed separately by participant choice.
- Shield decisions come from \`ai_trigger_flag\`, \`ai_trigger_categories\`, \`ai_trigger_notice\` and \`ai_euphemized_caption\` in the archived 200-row Cloudflare evaluation. **They are precomputed and are not a live model call.**
- The participant's classification, confidence, timing, whether AI shielding was applied, and voluntary reveal actions are logged.
- \`GET /api/trials?health=1\` returns a safe database status without revealing secrets.
- Submission errors retain a local queue and show the error code. Use **Check storage** and **Retry upload** in the footer.

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
