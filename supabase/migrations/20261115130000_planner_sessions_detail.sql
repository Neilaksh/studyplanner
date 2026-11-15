-- Planner detail: plan status, typed sessions with priority/status/details/start time,
-- and a link from study activity to the session that produced it.

alter table public.study_plans
  add column status text not null default 'active' check (status in ('active', 'paused'));

alter table public.study_sessions
  add column status text not null default 'todo' check (status in ('todo', 'in_progress', 'completed', 'skipped')),
  add column priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  add column activity text not null default 'read' check (activity in ('read', 'quiz', 'summary', 'review')),
  add column description text,
  add column requirements text[] not null default '{}',
  add column tips text[] not null default '{}',
  add column start_time time;

-- Existing completed sessions keep their state under the new status column.
update public.study_sessions set status = 'completed' where completed_at is not null;

-- Lets "mark incomplete" remove exactly the study time that "mark complete" logged.
alter table public.activity_events
  add column session_id uuid references public.study_sessions (id) on delete set null;
create index on public.activity_events (session_id);
