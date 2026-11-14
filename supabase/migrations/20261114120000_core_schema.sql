-- Core schema for the study app (single owner, no usage limits).
-- Every user-owned row carries user_id, defaulted from the signed-in user, so RLS stays a single equality check.

create type public.doc_status as enum ('not_started', 'in_progress', 'completed');
create type public.session_kind as enum ('session', 'exam');

-- Profiles --------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  output_language text, -- null = use the PDF's language
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Library ---------------------------------------------------------------------
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  title text not null check (char_length(title) between 1 and 300),
  storage_path text not null unique, -- '<user_id>/<document_id>.pdf' in the pdfs bucket
  size_bytes bigint not null check (size_bytes >= 0),
  page_count integer check (page_count >= 0),
  language text,
  status public.doc_status not null default 'not_started',
  last_studied_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.document_pages (
  document_id uuid not null references public.documents (id) on delete cascade,
  page_number integer not null check (page_number >= 1),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content text not null,
  primary key (document_id, page_number)
);

create table public.document_chapters (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position integer not null,
  title text not null,
  start_page integer not null check (start_page >= 1),
  end_page integer not null,
  check (end_page >= start_page),
  unique (document_id, position)
);

create table public.summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  chapter_id uuid references public.document_chapters (id) on delete cascade, -- null = whole document
  language text,
  content text not null,
  created_at timestamptz not null default now()
);

-- Quizzes ---------------------------------------------------------------------
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  chapter_id uuid references public.document_chapters (id) on delete set null,
  title text not null,
  created_at timestamptz not null default now()
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position integer not null,
  prompt text not null,
  choices jsonb not null check (jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) between 2 and 6),
  correct_index integer not null check (correct_index >= 0),
  explanation text,
  unique (quiz_id, position)
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  answers jsonb not null default '[]'::jsonb, -- chosen index per question position
  score numeric(5, 2) check (score between 0 and 100),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Planner ---------------------------------------------------------------------
create table public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  document_id uuid references public.documents (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  exam_date date not null,
  minutes_per_day integer not null default 60 check (minutes_per_day between 5 and 1440),
  created_at timestamptz not null default now()
);

create table public.study_plan_chapters (
  plan_id uuid not null references public.study_plans (id) on delete cascade,
  chapter_id uuid not null references public.document_chapters (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (plan_id, chapter_id)
);

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id uuid not null references public.study_plans (id) on delete cascade,
  chapter_id uuid references public.document_chapters (id) on delete set null,
  kind public.session_kind not null default 'session',
  title text not null,
  scheduled_for date not null,
  duration_minutes integer not null default 30 check (duration_minutes between 0 and 1440),
  completed_at timestamptz
);

-- Activity and AI accounting ----------------------------------------------------
create table public.activity_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('upload', 'study', 'quiz', 'summary', 'explanation', 'plan')),
  document_id uuid references public.documents (id) on delete set null,
  minutes integer not null default 0 check (minutes >= 0),
  occurred_at timestamptz not null default now()
);

create table public.ai_calls (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  feature text not null,
  provider text not null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  duration_ms integer,
  ok boolean not null,
  error text,
  created_at timestamptz not null default now()
);

-- Indexes for the access paths the pages use -----------------------------------
create index on public.folders (user_id);
create index on public.documents (user_id, created_at desc);
create index on public.documents (folder_id);
create index on public.document_pages (user_id);
create index on public.document_chapters (document_id);
create index on public.document_chapters (user_id);
create index on public.summaries (document_id);
create index on public.summaries (chapter_id);
create index on public.summaries (user_id);
create index on public.quizzes (user_id, created_at desc);
create index on public.quizzes (document_id);
create index on public.quizzes (chapter_id);
create index on public.quiz_questions (user_id);
create index on public.quiz_attempts (user_id, completed_at desc);
create index on public.quiz_attempts (quiz_id);
create index on public.study_plans (user_id);
create index on public.study_plans (document_id);
create index on public.study_plan_chapters (chapter_id);
create index on public.study_plan_chapters (user_id);
create index on public.study_sessions (user_id, scheduled_for);
create index on public.study_sessions (plan_id);
create index on public.study_sessions (chapter_id);
create index on public.activity_events (user_id, occurred_at desc);
create index on public.activity_events (document_id);
create index on public.ai_calls (user_id, created_at desc);
