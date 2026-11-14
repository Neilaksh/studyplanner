-- Row-level security: each signed-in user sees and writes only their own rows.

alter table public.profiles enable row level security;
create policy "own profile: read" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "own profile: update" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare
  t text;
begin
  foreach t in array array[
    'folders', 'documents', 'document_pages', 'document_chapters', 'summaries',
    'quizzes', 'quiz_questions', 'quiz_attempts', 'study_plans', 'study_plan_chapters',
    'study_sessions', 'activity_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end;
$$;

-- ai_calls is written only by Edge Functions; the owner may read it.
alter table public.ai_calls enable row level security;
create policy "own ai calls: read" on public.ai_calls for select to authenticated using (user_id = (select auth.uid()));

-- Storage: private PDF bucket, files stored under '<user_id>/...'. ------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pdfs', 'pdfs', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

create policy "pdfs: read own" on storage.objects for select to authenticated
  using (bucket_id = 'pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "pdfs: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "pdfs: update own" on storage.objects for update to authenticated
  using (bucket_id = 'pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "pdfs: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Dashboard read models. SECURITY INVOKER, so RLS applies to every row they read. ---

create function public.dashboard_stats()
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  select json_build_object(
    'documents', (select count(*) from public.documents),
    'quizzes', (select count(*) from public.quizzes),
    'questions', (select count(*) from public.quiz_questions),
    'avg_score', (select round(avg(score)) from public.quiz_attempts where completed_at is not null),
    'study_minutes', (select coalesce(sum(minutes), 0) from public.activity_events)
  );
$$;

-- Daily activity counts for the heatmap and streak, bucketed in the caller's time zone.
create function public.activity_by_day(p_since date, p_tz text default 'UTC')
returns table (day date, events integer, minutes integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select (occurred_at at time zone p_tz)::date as day,
         count(*)::integer as events,
         coalesce(sum(minutes), 0)::integer as minutes
  from public.activity_events
  where (occurred_at at time zone p_tz)::date >= p_since
  group by 1
  order by 1;
$$;

-- Functions are executable by PUBLIC by default; restrict them to signed-in users.
revoke execute on function public.dashboard_stats() from public, anon;
revoke execute on function public.activity_by_day(date, text) from public, anon;
grant execute on function public.dashboard_stats() to authenticated;
grant execute on function public.activity_by_day(date, text) to authenticated;
