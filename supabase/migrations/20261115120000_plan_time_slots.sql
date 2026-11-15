-- Preferred study time windows for a plan, and the window each scheduled session falls in.
alter table public.study_plans
  add column preferred_slots text[] not null default '{}'
    check (preferred_slots <@ array['morning', 'afternoon', 'evening', 'night']::text[]);

alter table public.study_sessions
  add column time_slot text
    check (time_slot in ('morning', 'afternoon', 'evening', 'night'));
