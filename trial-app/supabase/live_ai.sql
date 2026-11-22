-- Apply AFTER trial-app/supabase/schema.sql, before deploying live inference.
-- The complete model answer is server-side only, and is never readable using the anon key.
create table if not exists public.task_trial_ai_outputs (
 session_id uuid not null,
 trial_id text not null,
 model text not null,
 output jsonb not null,
 usage jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 primary key (session_id, trial_id)
);
create index if not exists task_trial_ai_outputs_created_idx
 on public.task_trial_ai_outputs(created_at);
alter table public.task_trial_ai_outputs enable row level security;
revoke all on public.task_trial_ai_outputs from anon, authenticated;
-- The Netlify function uses SUPABASE_SECRET_KEY / service role.
-- Existing task_trial_events rows and their analysis schema are unchanged.
