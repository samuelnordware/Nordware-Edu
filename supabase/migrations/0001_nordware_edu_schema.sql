-- =====================================================================
-- Nordware Edu - schema inicial
-- Execute no Supabase: SQL Editor > New query > cole este arquivo > Run
-- =====================================================================

create schema if not exists private;

-- ---------------------------------------------------------------------
-- Perfis (um por usuario do Supabase Auth)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null default 'student' check (role in ('student', 'admin')),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Funcao auxiliar: o usuario atual e administrador?
-- Fica no schema "private", que nao e exposto pela Data API.
-- ---------------------------------------------------------------------
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke execute on function private.is_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

-- ---------------------------------------------------------------------
-- Cria o perfil automaticamente quando um usuario se cadastra.
-- O e-mail do ADM master recebe o papel "admin" ja no cadastro.
-- ---------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when lower(new.email) = 'samuel.bagolin@nordware.io' then 'admin' else 'student' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Impede que um aluno altere o proprio papel
create or replace function private.guard_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- auth.uid() nulo = SQL Editor / service role (administracao do projeto)
  if new.role is distinct from old.role
     and (select auth.uid()) is not null
     and not private.is_admin() then
    raise exception 'Somente administradores podem alterar papeis.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function private.guard_role_change();

-- ---------------------------------------------------------------------
-- Treinamentos (cursos) e aulas
-- ---------------------------------------------------------------------
create table if not exists public.courses (
  id            bigint generated always as identity primary key,
  title         text not null check (char_length(title) between 1 and 160),
  subtitle      text check (char_length(subtitle) <= 200),
  description   text,
  category      text,
  cover_url     text,
  accent_color  text not null default '#13C98E',
  is_featured   boolean not null default false,
  is_published  boolean not null default false,
  sort_order    integer not null default 0,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.lessons (
  id                bigint generated always as identity primary key,
  course_id         bigint not null references public.courses (id) on delete cascade,
  title             text not null check (char_length(title) between 1 and 160),
  description       text,
  video_provider    text not null check (video_provider in ('youtube', 'vimeo', 'upload')),
  video_ref         text not null,
  duration_minutes  integer check (duration_minutes is null or duration_minutes >= 0),
  is_published      boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now()
);
create index if not exists lessons_course_id_idx on public.lessons (course_id, sort_order);

-- ---------------------------------------------------------------------
-- Checklist da aula e progresso de cada aluno
-- ---------------------------------------------------------------------
create table if not exists public.checklist_items (
  id          bigint generated always as identity primary key,
  lesson_id   bigint not null references public.lessons (id) on delete cascade,
  label       text not null check (char_length(label) between 1 and 300),
  sort_order  integer not null default 0
);
create index if not exists checklist_items_lesson_id_idx on public.checklist_items (lesson_id, sort_order);

create table if not exists public.checklist_progress (
  user_id   uuid not null references public.profiles (id) on delete cascade,
  item_id   bigint not null references public.checklist_items (id) on delete cascade,
  done_at   timestamptz not null default now(),
  primary key (user_id, item_id)
);
create index if not exists checklist_progress_item_id_idx on public.checklist_progress (item_id);

-- ---------------------------------------------------------------------
-- Documentos anexados a aula
-- ---------------------------------------------------------------------
create table if not exists public.lesson_documents (
  id            bigint generated always as identity primary key,
  lesson_id     bigint not null references public.lessons (id) on delete cascade,
  name          text not null,
  storage_path  text not null unique,
  mime_type     text,
  size_bytes    bigint,
  created_at    timestamptz not null default now()
);
create index if not exists lesson_documents_lesson_id_idx on public.lesson_documents (lesson_id);

-- ---------------------------------------------------------------------
-- Comentarios (o nome do autor e gravado no momento do comentario,
-- assim os alunos nao precisam ler a tabela de perfis)
-- ---------------------------------------------------------------------
create table if not exists public.lesson_comments (
  id           bigint generated always as identity primary key,
  lesson_id    bigint not null references public.lessons (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  author_name  text,
  author_role  text,
  body         text not null check (char_length(body) between 1 and 2000),
  created_at   timestamptz not null default now()
);
create index if not exists lesson_comments_lesson_id_idx on public.lesson_comments (lesson_id, created_at);
create index if not exists lesson_comments_user_id_idx on public.lesson_comments (user_id);

create or replace function private.fill_comment_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select coalesce(p.full_name, split_part(p.email, '@', 1)), p.role
    into new.author_name, new.author_role
  from public.profiles p
  where p.id = new.user_id;
  return new;
end;
$$;

drop trigger if exists lesson_comments_author on public.lesson_comments;
create trigger lesson_comments_author
  before insert on public.lesson_comments
  for each row execute function private.fill_comment_author();

-- ---------------------------------------------------------------------
-- Progresso por aula (alimenta "Continuar assistindo")
-- ---------------------------------------------------------------------
create table if not exists public.lesson_progress (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  lesson_id     bigint not null references public.lessons (id) on delete cascade,
  completed_at  timestamptz,
  last_seen_at  timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index if not exists lesson_progress_lesson_id_idx on public.lesson_progress (lesson_id);

-- updated_at automatico
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists courses_touch on public.courses;
create trigger courses_touch
  before update on public.courses
  for each row execute function private.touch_updated_at();

-- =====================================================================
-- Acesso pela Data API (tabelas novas nao sao expostas automaticamente)
-- =====================================================================
grant select, insert, update, delete on
  public.profiles, public.courses, public.lessons, public.checklist_items,
  public.checklist_progress, public.lesson_documents, public.lesson_comments,
  public.lesson_progress
to authenticated;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles            enable row level security;
alter table public.courses             enable row level security;
alter table public.lessons             enable row level security;
alter table public.checklist_items     enable row level security;
alter table public.checklist_progress  enable row level security;
alter table public.lesson_documents    enable row level security;
alter table public.lesson_comments     enable row level security;
alter table public.lesson_progress     enable row level security;

-- Perfis
create policy profiles_select on public.profiles for select to authenticated
  using ((select auth.uid()) = id or (select private.is_admin()));
create policy profiles_update on public.profiles for update to authenticated
  using ((select auth.uid()) = id or (select private.is_admin()))
  with check ((select auth.uid()) = id or (select private.is_admin()));

-- Treinamentos: aluno ve publicados; ADM ve e edita tudo
create policy courses_select on public.courses for select to authenticated
  using (is_published or (select private.is_admin()));
create policy courses_admin_insert on public.courses for insert to authenticated
  with check ((select private.is_admin()));
create policy courses_admin_update on public.courses for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy courses_admin_delete on public.courses for delete to authenticated
  using ((select private.is_admin()));

-- Aulas: visiveis se publicadas e o treinamento for visivel (RLS de courses)
create policy lessons_select on public.lessons for select to authenticated
  using (
    (select private.is_admin())
    or (is_published and exists (select 1 from public.courses c where c.id = course_id))
  );
create policy lessons_admin_insert on public.lessons for insert to authenticated
  with check ((select private.is_admin()));
create policy lessons_admin_update on public.lessons for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy lessons_admin_delete on public.lessons for delete to authenticated
  using ((select private.is_admin()));

-- Itens de checklist
create policy checklist_items_select on public.checklist_items for select to authenticated
  using (exists (select 1 from public.lessons l where l.id = lesson_id));
create policy checklist_items_admin_insert on public.checklist_items for insert to authenticated
  with check ((select private.is_admin()));
create policy checklist_items_admin_update on public.checklist_items for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy checklist_items_admin_delete on public.checklist_items for delete to authenticated
  using ((select private.is_admin()));

-- Progresso do checklist: cada aluno so ve e altera o proprio
create policy checklist_progress_select on public.checklist_progress for select to authenticated
  using ((select auth.uid()) = user_id or (select private.is_admin()));
create policy checklist_progress_insert on public.checklist_progress for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.checklist_items i where i.id = item_id)
  );
create policy checklist_progress_delete on public.checklist_progress for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Documentos
create policy lesson_documents_select on public.lesson_documents for select to authenticated
  using (exists (select 1 from public.lessons l where l.id = lesson_id));
create policy lesson_documents_admin_insert on public.lesson_documents for insert to authenticated
  with check ((select private.is_admin()));
create policy lesson_documents_admin_update on public.lesson_documents for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy lesson_documents_admin_delete on public.lesson_documents for delete to authenticated
  using ((select private.is_admin()));

-- Comentarios
create policy lesson_comments_select on public.lesson_comments for select to authenticated
  using (exists (select 1 from public.lessons l where l.id = lesson_id));
create policy lesson_comments_insert on public.lesson_comments for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.lessons l where l.id = lesson_id)
  );
create policy lesson_comments_update on public.lesson_comments for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy lesson_comments_delete on public.lesson_comments for delete to authenticated
  using ((select auth.uid()) = user_id or (select private.is_admin()));

-- Progresso da aula
create policy lesson_progress_select on public.lesson_progress for select to authenticated
  using ((select auth.uid()) = user_id or (select private.is_admin()));
create policy lesson_progress_insert on public.lesson_progress for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.lessons l where l.id = lesson_id)
  );
create policy lesson_progress_update on public.lesson_progress for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- =====================================================================
-- Storage: capas (publico), videos e documentos (privados)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('covers',           'covers',           true,  10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('lesson-videos',    'lesson-videos',    false, null,     array['video/mp4', 'video/webm', 'video/quicktime']),
  ('lesson-documents', 'lesson-documents', false, 52428800, null)
on conflict (id) do nothing;

-- Capas: leitura publica pela URL; somente ADM grava
create policy nw_covers_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'covers' and (select private.is_admin()));
create policy nw_covers_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and (select private.is_admin()));
create policy nw_covers_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'covers' and (select private.is_admin()));
create policy nw_covers_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'covers' and (select private.is_admin()));

-- Videos enviados: o aluno so gera link se a aula for visivel para ele
create policy nw_videos_select on storage.objects for select to authenticated
  using (
    bucket_id = 'lesson-videos' and (
      (select private.is_admin())
      or exists (
        select 1 from public.lessons l
        where l.video_provider = 'upload' and l.video_ref = name
      )
    )
  );
create policy nw_videos_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'lesson-videos' and (select private.is_admin()));
create policy nw_videos_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'lesson-videos' and (select private.is_admin()));
create policy nw_videos_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'lesson-videos' and (select private.is_admin()));

-- Documentos: o aluno so baixa se o documento pertence a uma aula visivel
create policy nw_docs_select on storage.objects for select to authenticated
  using (
    bucket_id = 'lesson-documents' and (
      (select private.is_admin())
      or exists (select 1 from public.lesson_documents d where d.storage_path = name)
    )
  );
create policy nw_docs_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'lesson-documents' and (select private.is_admin()));
create policy nw_docs_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'lesson-documents' and (select private.is_admin()));
create policy nw_docs_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'lesson-documents' and (select private.is_admin()));

-- =====================================================================
-- Comentarios em tempo real
-- =====================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lesson_comments'
     ) then
    alter publication supabase_realtime add table public.lesson_comments;
  end if;
end $$;

-- =====================================================================
-- Usuarios que ja existiam antes desta migracao
-- =====================================================================
insert into public.profiles (id, email, full_name, role)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
  case when lower(u.email) = 'samuel.bagolin@nordware.io' then 'admin' else 'student' end
from auth.users u
on conflict (id) do update
  set role = case when lower(excluded.email) = 'samuel.bagolin@nordware.io' then 'admin' else public.profiles.role end;
