# Context Lab — Task Trial

Deployable HAI research application with 200 meme examples, randomized independent/AI-assisted conditions, 12 evaluations per session, optional rationales, confidence ratings and Supabase event storage.

## Netlify setup

1. Create a free Supabase project and run the SQL in supabase/schema.sql from its SQL Editor.
2. Connect this repository on Netlify. Set the Base directory to trial-app. The included netlify.toml sets the build command (npm run build), publish directory (dist) and functions directory (netlify/functions).
3. Set environment variables on Netlify:
   - SUPABASE_URL: Your Supabase project URL.
   - SUPABASE_SECRET_KEY: Your Supabase server-side secret key. Keep private.
   - ADMIN_EXPORT_TOKEN: A unique, random, long secret for exporting results.
   - ALLOWED_ORIGINS: Your exact deployed site origin, e.g. https://your-site.netlify.app
4. Redeploy after saving environment variables. Complete one test participant session and confirm events in public.task_trial_events in Supabase's Table Editor.

## Vercel setup

Choose trial-app as Root Directory, set the same four environment variables, and deploy. Vite and the api/trials.js endpoint are configured by vercel.json.

## Data export

GET /api/trials?limit=1000&offset=0 with Authorization: Bearer YOUR_ADMIN_EXPORT_TOKEN. Repeat increasing offset to paginate.

## Participant experience

Participants aged 18+ see a content warning and opt-in consent. Each browser session is randomized between independent and AI-assisted review. Each participant evaluates twelve randomized memes and selects a hateful/non-hateful label plus confidence, with optional notes or skip. Start, response, and finish events are saved to PostgreSQL. The browser queues failed uploads locally and retries.

## Research caveats

The app uses third-party meme images and may display hateful or distressing content. Customize consent language and obtain any required institutional approval before recruitment. Browser randomization may not exactly balance conditions. Regularly back up your data. Supabase Free projects may pause after inactivity. No private ground-truth labels or server-side credentials are embedded in the frontend.
