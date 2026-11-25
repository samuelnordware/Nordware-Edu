-- =====================================================================
-- Nordware Edu - 0002: papeis (aluno, professor, gestor) e foto de perfil
-- Execute no SQL Editor DEPOIS da migracao 0001.
--
--   Aluno     (student) : assiste, marca checklist, baixa documentos, comenta
--   Professor (teacher) : tudo do aluno + cria e edita os PROPRIOS treinamentos
--   Gestor    (manager) : tudo + edita qualquer treinamento e gerencia usuarios
-- =====================================================================

-- ---------------------------------------------------------------------
-- Papeis: "admin" passa a se chamar "manager" (gestor)
-- ---------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'manager' where role = 'admin';
alter table public.profiles
  add constraint profiles_role_check check (role in ('student', 'teacher', 'manager'));

alter table public.profiles add column if not exists avatar_url text;
alter table public.lesson_comments add column if not exists author_avatar text;

-- ---------------------------------------------------------------------
-- Funcoes de permissao (schema privado, fora da Data API)
-- ---------------------------------------------------------------------
create or replace function private.is_manager()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'manager'
  );
$$;

-- Mantida por compatibilidade: "admin" agora significa gestor
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select private.is_manager(); $$;

create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('teacher', 'manager')
  );
$$;

-- Gestor edita tudo; professor edita apenas os treinamentos que criou
create or replace function private.can_edit_course(p_course_id bigint)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and (
        p.role = 'manager'
        or (
          p.role = 'teacher'
          and exists (
            select 1 from public.courses c
            where c.id = p_course_id and c.created_by = p.id
          )
        )
      )
  );
$$;

create or replace function private.can_edit_lesson(p_lesson_id bigint)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.can_edit_course(
    (select l.course_id from public.lessons l where l.id = p_lesson_id)
  );
$$;

-- Pastas do Storage: "<id do treinamento>/arquivo"
create or replace function private.can_edit_course_folder(p_folder text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select case
    when p_folder ~ '^[0-9]+$' then private.can_edit_course(p_folder::bigint)
    else false
  end;
$$;

revoke execute on function private.is_manager()                   from public, anon;
revoke execute on function private.is_staff()                     from public, anon;
revoke execute on function private.can_edit_course(bigint)        from public, anon;
revoke execute on function private.can_edit_lesson(bigint)        from public, anon;
revoke execute on function private.can_edit_course_folder(text)   from public, anon;
grant  execute on function private.is_manager()                   to authenticated;
grant  execute on function private.is_staff()                     to authenticated;
grant  execute on function private.can_edit_course(bigint)        to authenticated;
grant  execute on function private.can_edit_lesson(bigint)        to authenticated;
grant  execute on function private.can_edit_course_folder(text)   to authenticated;

-- ---------------------------------------------------------------------
-- Novo usuario: ADM master entra como gestor
-- ---------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when lower(new.email) = 'samuel.bagolin@nordware.io' then 'manager' else 'student' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Comentario grava nome, papel e foto do autor
create or replace function private.fill_comment_author()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  select coalesce(p.full_name, split_part(p.email, '@', 1)), p.role, p.avatar_url
    into new.author_name, new.author_role, new.author_avatar
  from public.profiles p
  where p.id = new.user_id;
  return new;
end;
$$;

-- Ao trocar nome, foto ou papel, os comentarios antigos acompanham
create or replace function private.sync_comment_author()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.lesson_comments
     set author_name   = coalesce(new.full_name, split_part(new.email, '@', 1)),
         author_role   = new.role,
         author_avatar = new.avatar_url
   where user_id = new.id;
  return new;
end;
$$;

drop trigger if exists profiles_sync_comments on public.profiles;
create trigger profiles_sync_comments
  after update of full_name, avatar_url, role on public.profiles
  for each row execute function private.sync_comment_author();

update public.lesson_comments c
   set author_role = p.role, author_avatar = p.avatar_url
  from public.profiles p
 where p.id = c.user_id;

-- ---------------------------------------------------------------------
-- A funcao de servidor (gestao de usuarios) usa a chave de servico
-- ---------------------------------------------------------------------
grant select, insert, update, delete on
  public.profiles, public.courses, public.lessons, public.checklist_items,
  public.checklist_progress, public.lesson_documents, public.lesson_comments,
  public.lesson_progress
to service_role;

-- =====================================================================
-- Politicas de conteudo
-- =====================================================================
drop policy if exists courses_select       on public.courses;
drop policy if exists courses_admin_insert on public.courses;
drop policy if exists courses_admin_update on public.courses;
drop policy if exists courses_admin_delete on public.courses;

create policy courses_select on public.courses for select to authenticated
  using (is_published or private.can_edit_course(id));
create policy courses_staff_insert on public.courses for insert to authenticated
  with check (
    (select private.is_staff())
    and (created_by = (select auth.uid()) or (select private.is_manager()))
  );
create policy courses_staff_update on public.courses for update to authenticated
  using (private.can_edit_course(id))
  with check (created_by = (select auth.uid()) or (select private.is_manager()));
create policy courses_staff_delete on public.courses for delete to authenticated
  using (private.can_edit_course(id));

drop policy if exists lessons_select       on public.lessons;
drop policy if exists lessons_admin_insert on public.lessons;
drop policy if exists lessons_admin_update on public.lessons;
drop policy if exists lessons_admin_delete on public.lessons;

create policy lessons_select on public.lessons for select to authenticated
  using (
    private.can_edit_course(course_id)
    or (is_published and exists (select 1 from public.courses c where c.id = course_id))
  );
create policy lessons_staff_insert on public.lessons for insert to authenticated
  with check (private.can_edit_course(course_id));
create policy lessons_staff_update on public.lessons for update to authenticated
  using (private.can_edit_course(course_id))
  with check (private.can_edit_course(course_id));
create policy lessons_staff_delete on public.lessons for delete to authenticated
  using (private.can_edit_course(course_id));

drop policy if exists checklist_items_admin_insert on public.checklist_items;
drop policy if exists checklist_items_admin_update on public.checklist_items;
drop policy if exists checklist_items_admin_delete on public.checklist_items;

create policy checklist_items_staff_insert on public.checklist_items for insert to authenticated
  with check (private.can_edit_lesson(lesson_id));
create policy checklist_items_staff_update on public.checklist_items for update to authenticated
  using (private.can_edit_lesson(lesson_id)) with check (private.can_edit_lesson(lesson_id));
create policy checklist_items_staff_delete on public.checklist_items for delete to authenticated
  using (private.can_edit_lesson(lesson_id));

drop policy if exists lesson_documents_admin_insert on public.lesson_documents;
drop policy if exists lesson_documents_admin_update on public.lesson_documents;
drop policy if exists lesson_documents_admin_delete on public.lesson_documents;

create policy lesson_documents_staff_insert on public.lesson_documents for insert to authenticated
  with check (private.can_edit_lesson(lesson_id));
create policy lesson_documents_staff_update on public.lesson_documents for update to authenticated
  using (private.can_edit_lesson(lesson_id)) with check (private.can_edit_lesson(lesson_id));
create policy lesson_documents_staff_delete on public.lesson_documents for delete to authenticated
  using (private.can_edit_lesson(lesson_id));

-- Professor modera comentarios dos proprios treinamentos; gestor, de todos
drop policy if exists lesson_comments_delete on public.lesson_comments;
create policy lesson_comments_delete on public.lesson_comments for delete to authenticated
  using ((select auth.uid()) = user_id or private.can_edit_lesson(lesson_id));

-- =====================================================================
-- Storage
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Capas: pasta "<id do usuario>/"; gestor gerencia todas
drop policy if exists nw_covers_admin_select on storage.objects;
drop policy if exists nw_covers_admin_insert on storage.objects;
drop policy if exists nw_covers_admin_update on storage.objects;
drop policy if exists nw_covers_admin_delete on storage.objects;

create policy nw_covers_staff_select on storage.objects for select to authenticated
  using (bucket_id = 'covers' and (select private.is_staff()));
create policy nw_covers_staff_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'covers' and (select private.is_staff())
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_manager()))
  );
create policy nw_covers_staff_update on storage.objects for update to authenticated
  using (
    bucket_id = 'covers' and (select private.is_staff())
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_manager()))
  );
create policy nw_covers_staff_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'covers' and (select private.is_staff())
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_manager()))
  );

-- Videos: pasta "<id do treinamento>/"
drop policy if exists nw_videos_select       on storage.objects;
drop policy if exists nw_videos_admin_insert on storage.objects;
drop policy if exists nw_videos_admin_update on storage.objects;
drop policy if exists nw_videos_admin_delete on storage.objects;

create policy nw_videos_select on storage.objects for select to authenticated
  using (
    bucket_id = 'lesson-videos' and (
      private.can_edit_course_folder((storage.foldername(name))[1])
      or exists (
        select 1 from public.lessons l
        where l.video_provider = 'upload' and l.video_ref = name
      )
    )
  );
create policy nw_videos_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'lesson-videos' and private.can_edit_course_folder((storage.foldername(name))[1]));
create policy nw_videos_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'lesson-videos' and private.can_edit_course_folder((storage.foldername(name))[1]));
create policy nw_videos_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'lesson-videos' and private.can_edit_course_folder((storage.foldername(name))[1]));

-- Documentos: pasta "<id do treinamento>/<id da aula>/"
drop policy if exists nw_docs_select       on storage.objects;
drop policy if exists nw_docs_admin_insert on storage.objects;
drop policy if exists nw_docs_admin_update on storage.objects;
drop policy if exists nw_docs_admin_delete on storage.objects;

create policy nw_docs_select on storage.objects for select to authenticated
  using (
    bucket_id = 'lesson-documents' and (
      private.can_edit_course_folder((storage.foldername(name))[1])
      or exists (select 1 from public.lesson_documents d where d.storage_path = name)
    )
  );
create policy nw_docs_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'lesson-documents' and private.can_edit_course_folder((storage.foldername(name))[1]));
create policy nw_docs_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'lesson-documents' and private.can_edit_course_folder((storage.foldername(name))[1]));
create policy nw_docs_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'lesson-documents' and private.can_edit_course_folder((storage.foldername(name))[1]));

-- Fotos de perfil: cada usuario so altera a propria pasta "<id do usuario>/"
create policy nw_avatars_select on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy nw_avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy nw_avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy nw_avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Mensagem da trava de papel com a nova nomenclatura
create or replace function private.guard_role_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and (select auth.uid()) is not null
     and not private.is_manager() then
    raise exception 'Somente gestores podem alterar papéis.';
  end if;
  return new;
end;
$$;
