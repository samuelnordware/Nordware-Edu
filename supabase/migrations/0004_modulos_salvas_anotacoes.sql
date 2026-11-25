-- =====================================================================
-- Nordware Edu - 0004: modulos, aulas salvas, anotacoes, banners e
-- ultimo acesso. Execute no SQL Editor DEPOIS da 0003.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Modulos: treinamento > modulos > aulas
-- ---------------------------------------------------------------------
create table if not exists public.modules (
  id          bigint generated always as identity primary key,
  course_id   bigint not null references public.courses (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 160),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists modules_course_id_idx on public.modules (course_id, sort_order);

alter table public.lessons
  add column if not exists module_id bigint references public.modules (id) on delete set null;
create index if not exists lessons_module_id_idx on public.lessons (module_id);

-- Cada treinamento que ja tem aulas ganha um "Modulo 1" com elas
insert into public.modules (course_id, title, sort_order)
select distinct l.course_id, 'Módulo 1', 1
from public.lessons l
where l.module_id is null
  and not exists (select 1 from public.modules m where m.course_id = l.course_id);

update public.lessons l
   set module_id = (
     select m.id from public.modules m
     where m.course_id = l.course_id
     order by m.sort_order, m.id
     limit 1
   )
 where l.module_id is null;

-- A aula so pode estar em um modulo do proprio treinamento
create or replace function private.check_lesson_module()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.module_id is not null and not exists (
    select 1 from public.modules m where m.id = new.module_id and m.course_id = new.course_id
  ) then
    raise exception 'O módulo escolhido não pertence a este treinamento.';
  end if;
  return new;
end;
$$;

drop trigger if exists lessons_check_module on public.lessons;
create trigger lessons_check_module
  before insert or update of module_id, course_id on public.lessons
  for each row execute function private.check_lesson_module();

-- ---------------------------------------------------------------------
-- Aulas salvas e anotacoes (privadas de cada aluno)
-- ---------------------------------------------------------------------
create table if not exists public.saved_lessons (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  lesson_id   bigint not null references public.lessons (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index if not exists saved_lessons_lesson_id_idx on public.saved_lessons (lesson_id);

create table if not exists public.lesson_notes (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  lesson_id   bigint not null references public.lessons (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 5000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, lesson_id)
);
create index if not exists lesson_notes_lesson_id_idx on public.lesson_notes (lesson_id);

drop trigger if exists lesson_notes_touch on public.lesson_notes;
create trigger lesson_notes_touch
  before update on public.lesson_notes
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------
-- Ultimo acesso (painel de alunos) e banners da pagina Resumo
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.site_settings add column if not exists home_banners jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------
-- Permissoes
-- ---------------------------------------------------------------------
grant select, insert, update, delete on public.modules, public.saved_lessons, public.lesson_notes to authenticated;
grant select, insert, update, delete on public.modules, public.saved_lessons, public.lesson_notes to service_role;

alter table public.modules       enable row level security;
alter table public.saved_lessons enable row level security;
alter table public.lesson_notes  enable row level security;

create policy modules_select on public.modules for select to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id));
create policy modules_staff_insert on public.modules for insert to authenticated
  with check (private.can_edit_course(course_id));
create policy modules_staff_update on public.modules for update to authenticated
  using (private.can_edit_course(course_id)) with check (private.can_edit_course(course_id));
create policy modules_staff_delete on public.modules for delete to authenticated
  using (private.can_edit_course(course_id));

create policy saved_lessons_select on public.saved_lessons for select to authenticated
  using ((select auth.uid()) = user_id);
create policy saved_lessons_insert on public.saved_lessons for insert to authenticated
  with check ((select auth.uid()) = user_id and exists (select 1 from public.lessons l where l.id = lesson_id));
create policy saved_lessons_delete on public.saved_lessons for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy lesson_notes_select on public.lesson_notes for select to authenticated
  using ((select auth.uid()) = user_id);
create policy lesson_notes_insert on public.lesson_notes for insert to authenticated
  with check ((select auth.uid()) = user_id and exists (select 1 from public.lessons l where l.id = lesson_id));
create policy lesson_notes_update on public.lesson_notes for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy lesson_notes_delete on public.lesson_notes for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Professor acompanha o progresso nas aulas dos proprios treinamentos
drop policy if exists lesson_progress_select on public.lesson_progress;
create policy lesson_progress_select on public.lesson_progress for select to authenticated
  using (
    (select auth.uid()) = user_id
    or (select private.is_manager())
    or private.can_edit_lesson(lesson_id)
  );
