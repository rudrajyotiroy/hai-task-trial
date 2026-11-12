-- Run once in the Supabase SQL editor. No public table access is granted.
create table if not exists public.task_trial_events (
 event_id uuid primary key,
 study_id text not null,
 session_id uuid not null,
 event_type text not null check (event_type in ('start','response','finish')),
 trial_id text,
 condition text not null check (condition in ('assisted','independent')),
 occurred_at timestamptz not null,
 payload jsonb not null default '{}'::jsonb,
 received_at timestamptz not null default now()
);
create index if not exists task_trial_events_session_idx on public.task_trial_events(study_id, session_id, occurred_at);
create index if not exists task_trial_events_trial_idx on public.task_trial_events(study_id,trial_id,event_type);
alter table public.task_trial_events enable row level security;
revoke all on public.task_trial_events from anon, authenticated;
-- The backend's service-role credential bypasses RLS; never expose it to the browser.
