# Live Cloudflare Workers AI deployment (CSE 594 v7)

Status: **The code requires two Cloudflare environment variables and one Supabase migration before it can be safely merged into production.** Do not merge without completing these steps. There is intentionally no fallback to the archived predictions.

## Required Netlify variables

Set these under Netlify Site configuration → Environment variables, with Functions scope and appropriate deploy contexts:

| Name | Description |
| --- | --- |
| CLOUDFLARE_ACCOUNT_ID | Cloudflare account identifier (from dashboard) |
| CLOUDFLARE_API_TOKEN | Secret API token authorized for Workers AI Run; add it directly in Netlify, NEVER in chat or GitHub |
| SUPABASE_URL | Existing Supabase project endpoint |
| SUPABASE_SECRET_KEY | Existing backend secret (or legacy SUPABASE_SERVICE_ROLE_KEY) |
| ALLOWED_ORIGINS | Exact Netlify study origin |
| ADMIN_EXPORT_TOKEN | Existing event export secret |

Run supabase/live_ai.sql in the project's Supabase SQL Editor. It adds a private table named task_trial_ai_outputs, keyed by (session_id, trial_id), with complete model result, model identifier, token usage and timestamp. Existing task_trial_events data and schema are unchanged.

## Endpoint design

Cloudflare model: @cf/google/gemma-4-26b-a4b-it.

The server submits a resized original meme image (base64 JPEG) and its caption to Cloudflare's OpenAI-compatible Chat Completions endpoint, using the same distinct exposure-screening and hateful-classification tasks as Assignment 2. **Ground-truth labels are not sent to the model.**

1. POST /api/ai, phase screen, with assisted condition, session_id and trial_id: on cache miss, call Cloudflare once, store the COMPLETE response privately in Supabase. Return ONLY the neutral safety screening notice, categories and euphemized caption. Hateful prediction and reasoning are not yet disclosed.
2. The user makes their first judgment. POST /api/ai, phase review, additionally supplies initial_classification 0 or 1. Read the cached full response, compare labels and show the AI reasoning **only on disagreement**. Initial and final judgments stay separate in the event log. No second Cloudflare inference.
3. The independent version never calls this endpoint and never shows AI outputs. Attention checks and end survey remain intact.

During screening, the assisted site hides the original meme until the screening completes; on error, it offers retry or Skip entire example. Review errors offer retry or preservation of the original response. There is no archived-inference fallback.

The original data/trials.json remains for Assignment 2 reproducibility. New frontend code uses only data/trials-public.js, which contains 200 item IDs, image URLs and captions but NO precomputed AI flags, labels or explanations.

## Deployment and verification

1. Enter Netlify Cloudflare environment settings without exposing secrets.
2. Execute supabase/live_ai.sql in the existing Supabase project.
3. Merge the GitHub PR and confirm the Netlify deployment shows Published.
4. Confirm GET /api/trials?health=1 reports study storage ready.
5. Confirm GET /api/ai?health=1 reports model and database configured (no secrets shown).
6. Test at least one assisted meme with a live model call, one disagreement, one skip, and an independent meme; verify Supabase AI cache and response events.

From the trial-app directory, run npm install, npm test and npm run build. The app uses the native sharp library for image compression. Functions have a 60-second synchronous execution limit; Cloudflare inference is bounded to 38 seconds and image download to 12 seconds. Long model latency may affect the study's ten-minute participant target.

Netlify Function rate limit: 30 requests per 60 seconds per IP; Supabase per-session cache avoids repeat inference for the same meme and caps sessions at 12 unique live samples. Public endpoint traffic can still incur Cloudflare costs, so monitor account usage and configure cost alerts.

## Historical comparability

Protocol v7 records ai_inference_source, ai_inference_model, ai_screen_wait_ms, ai_review_wait_ms and ai_review_unavailable. Model outputs may change across calls; therefore separate these new live-inference responses from the historic v2-v6 precomputed-inference study when computing statistical comparisons. Existing reports remain unchanged.

The v7 browser storage key intentionally starts fresh sessions. Complete older sessions and flush pending events before deploying. No Cloudflare tokens or Supabase secrets are committed to GitHub.
