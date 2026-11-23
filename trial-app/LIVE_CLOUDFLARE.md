# Live Cloudflare Workers AI deployment — stateless, no model-output cache

Status: Code is available on the feature branch. Merge and deploy it only after configuring Cloudflare. The deployed study remains unchanged until the branch is merged and Netlify publishes it.

## Required Netlify environment

Configure these in Netlify Functions (do not share secrets in chat or commit them):

| Variable | Why |
| --- | --- |
| CLOUDFLARE_ACCOUNT_ID | Cloudflare account used for Workers AI inference |
| CLOUDFLARE_API_TOKEN | Secret with Workers AI Run permission |
| SUPABASE_URL | **Existing task-event collection only**, not model-response caching |
| SUPABASE_SECRET_KEY | Existing event-write key (or SUPABASE_SERVICE_ROLE_KEY) |
| ALLOWED_ORIGINS | Exact site origins |
| ADMIN_EXPORT_TOKEN | Existing event export key |

**Do not run the previous `supabase/live_ai.sql` migration.** No new model-output table or database change is needed. The previously proposed `task_trial_ai_outputs` table is **not used** by this code. If it was created already, it can be reviewed and deleted separately after verifying no other systems depend on it; deploying this branch does not delete any stored historical records.

## Every new assisted request calls Cloudflare

Model: `@cf/google/gemma-4-26b-a4b-it` via the server-side Workers AI Chat Completions endpoint.

1. `POST /api/ai` with `phase:"screen"` for an **assisted** trial. The backend sends original image+caption to Cloudflare, returns **only a sanitized exposure advisory**, then discards the complete result. The browser hides hateful classification until the participant makes an initial judgment.
2. After an initial human classification is recorded, `POST /api/ai` with `phase:"review"` makes a **second fresh Cloudflare inference** of the original meme, compares the classification against the initial human label, and returns the model's reasoning **only on disagreement**. The backend discards the complete result after responding.
3. Retrying either endpoint **makes another Cloudflare request**. Repeat or concurrent requests are **not deduplicated** or served from cache. The independent version never invokes this model endpoint.
4. The frontend keeps the current meme's exposure/review fields **temporarily in runtime memory only** to display them. It does **not persist these model outputs in localStorage** and clears them when advancing to the next meme. Reloading while screening or reviewing causes re-screening or offers a review retry.

**Important trade-off:** Screening and review use two distinct model calls. Their results are **not guaranteed to agree**, even with deterministic-style sampling settings. Exposure advice and review classification therefore do not necessarily originate from the same model generation. This is intentional to satisfy stateless inference and preserve server-side initial-answer blindness.

**Important distinction:** The existing `task_trial_events` event log still records participant responses, model provenance, screening flags and prediction labels for **research analysis**. It is **not a lookup cache** for model output and is never queried by `/api/ai`. No full prompt/completion or full model reasoning is retained.

## Security / rate limits

Cloudflare credentials remain server-side. Trial identifiers must belong to the server-owned 200-meme manifest, and the condition must be `assisted`. Responses include `Cache-Control: no-store`. The Netlify Function uses a rate limit of 30 requests per 60 seconds per IP; this is a request-rate limit, **not a cache**. Screening and review together typically require **two billable inference calls per fully classified assisted meme**; retries add more. Monitor Cloudflare usage.

## Deploy and verify

1. Set Cloudflare environment variables in Netlify and confirm existing event collection is working.
2. Run `cd trial-app && npm install && npm test && npm run build` in a networked environment.
3. Merge the reviewed feature PR and publish with Netlify.
4. Check `GET /api/ai?health=1` for Cloudflare configuration status and `GET /api/trials?health=1` for the event database.
5. Test screening, review and retry. Confirm that each assisted `POST /api/ai` invokes Workers AI; repeat an identical request and verify it invokes AI again, while independent requests are rejected without inference.

The earlier precomputed-inference `data/trials.json` is retained for archival research only and **is not imported by the live frontend**. Historical v2–v6 data and the Notion report are unchanged; this branch records protocol **v7.1.0** for new sessions. Cloudflare secrets are not saved in this repository.
