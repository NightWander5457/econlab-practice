create type public.user_role as enum ('student', 'teacher');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'student',
  display_name text not null default 'Student',
  student_code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  join_code text not null unique check (char_length(join_code) between 4 and 16),
  created_at timestamptz not null default now()
);

create table public.class_members (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

create table public.practice_sessions (
  id uuid primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  device_id text,
  started_at timestamptz not null,
  ended_at timestamptz,
  active_seconds integer not null default 0 check (active_seconds >= 0),
  completed_count integer not null default 0 check (completed_count >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  synced_at timestamptz not null default now()
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid references public.practice_sessions(id) on delete set null,
  question_id text not null,
  unit text not null check (unit in ('U1', 'U2', 'GRAPH')),
  topic text not null,
  correct boolean not null,
  answer_text text,
  response_ms integer check (response_ms is null or response_ms >= 0),
  help_level text not null check (help_level in ('assist', 'standard', 'exam')),
  attempted_at timestamptz not null default now()
);

create table public.question_progress (
  student_id uuid not null references public.profiles(id) on delete cascade,
  question_id text not null,
  attempts integer not null default 0 check (attempts >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  wrong_count integer not null default 0 check (wrong_count >= 0),
  streak integer not null default 0 check (streak >= 0),
  last_correct boolean not null default false,
  last_answered_at timestamptz not null default now(),
  primary key (student_id, question_id)
);

create index class_members_student_idx on public.class_members(student_id);
create index practice_sessions_student_started_idx on public.practice_sessions(student_id, started_at desc);
create index attempts_student_attempted_idx on public.attempts(student_id, attempted_at desc);
create index attempts_question_idx on public.attempts(question_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'Student'));
  return new;
end;
$$;

create trigger auth_user_created_profile
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

create or replace function public.is_class_teacher(target_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.classes
    where id = target_class_id and teacher_id = auth.uid()
  );
$$;

create or replace function public.teacher_can_view_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.class_members cm
    join public.classes c on c.id = cm.class_id
    where cm.student_id = target_student_id
      and c.teacher_id = auth.uid()
  );
$$;

create or replace function public.join_class(class_join_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_class_id uuid;
begin
  select id into target_class_id
  from public.classes
  where upper(join_code) = upper(trim(class_join_code));

  if target_class_id is null then
    raise exception 'Invalid class code';
  end if;

  insert into public.class_members (class_id, student_id)
  values (target_class_id, auth.uid())
  on conflict do nothing;

  return target_class_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.attempts enable row level security;
alter table public.question_progress enable row level security;

create policy profiles_select on public.profiles
for select to authenticated
using (id = auth.uid() or public.teacher_can_view_student(id));

create policy profiles_insert on public.profiles
for insert to authenticated
with check (id = auth.uid());

create policy profiles_update on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy classes_select on public.classes
for select to authenticated
using (teacher_id = auth.uid() or exists (
  select 1 from public.class_members cm
  where cm.class_id = id and cm.student_id = auth.uid()
));

create policy classes_insert on public.classes
for insert to authenticated
with check (teacher_id = auth.uid() and exists (
  select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'
));

create policy classes_update on public.classes
for update to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

create policy classes_delete on public.classes
for delete to authenticated
using (teacher_id = auth.uid());

create policy class_members_select on public.class_members
for select to authenticated
using (student_id = auth.uid() or public.is_class_teacher(class_id));

create policy class_members_insert on public.class_members
for insert to authenticated
with check (public.is_class_teacher(class_id));

create policy class_members_delete on public.class_members
for delete to authenticated
using (student_id = auth.uid() or public.is_class_teacher(class_id));

create policy practice_sessions_select on public.practice_sessions
for select to authenticated
using (student_id = auth.uid() or public.teacher_can_view_student(student_id));

create policy practice_sessions_insert on public.practice_sessions
for insert to authenticated
with check (student_id = auth.uid());

create policy practice_sessions_update on public.practice_sessions
for update to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

create policy attempts_select on public.attempts
for select to authenticated
using (student_id = auth.uid() or public.teacher_can_view_student(student_id));

create policy attempts_insert on public.attempts
for insert to authenticated
with check (student_id = auth.uid());

create policy question_progress_select on public.question_progress
for select to authenticated
using (student_id = auth.uid() or public.teacher_can_view_student(student_id));

create policy question_progress_insert on public.question_progress
for insert to authenticated
with check (student_id = auth.uid());

create policy question_progress_update on public.question_progress
for update to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

revoke all on public.profiles, public.classes, public.class_members, public.practice_sessions, public.attempts, public.question_progress from anon;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.classes to authenticated;
grant select, insert, delete on public.class_members to authenticated;
grant select, insert, update on public.practice_sessions to authenticated;
grant select, insert on public.attempts to authenticated;
grant select, insert, update on public.question_progress to authenticated;

revoke all on function public.is_class_teacher(uuid) from public;
revoke all on function public.teacher_can_view_student(uuid) from public;
revoke all on function public.join_class(text) from public;
grant execute on function public.is_class_teacher(uuid) to authenticated;
grant execute on function public.teacher_can_view_student(uuid) to authenticated;
grant execute on function public.join_class(text) to authenticated;
