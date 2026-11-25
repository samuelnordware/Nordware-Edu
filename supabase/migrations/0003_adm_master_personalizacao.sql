-- =====================================================================
-- Nordware Edu - 0003: ADM Master e personalizacao do site
-- Execute no SQL Editor DEPOIS da migracao 0002.
--
-- ADM Master: unico acesso que edita a tela de login, o destaque da
-- pagina inicial e os textos do site. Um ADM Master concede esse acesso
-- a outras pessoas. Ninguem remove o proprio acesso (evita ficar sem master).
-- =====================================================================

alter table public.profiles add column if not exists is_master boolean not null default false;
update public.profiles set is_master = true where lower(email) = 'samuel.bagolin@nordware.io';

create or replace function private.is_master()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and is_master
  );
$$;
revoke execute on function private.is_master() from public, anon;
grant  execute on function private.is_master() to authenticated;

-- Novo cadastro do e-mail do ADM master ja entra como gestor e master
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_master boolean := lower(new.email) = 'samuel.bagolin@nordware.io';
begin
  insert into public.profiles (id, email, full_name, role, is_master)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when v_master then 'manager' else 'student' end,
    v_master
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Travas de papel e de ADM Master
create or replace function private.guard_role_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  -- auth.uid() nulo = SQL Editor ou funcao de servidor
  if (select auth.uid()) is null then
    return new;
  end if;
  if new.role is distinct from old.role and not private.is_manager() then
    raise exception 'Somente gestores podem alterar papéis.';
  end if;
  if new.role is distinct from old.role and old.is_master and not private.is_master() then
    raise exception 'Somente um ADM Master pode alterar o papel de outro ADM Master.';
  end if;
  if new.is_master is distinct from old.is_master and not private.is_master() then
    raise exception 'Somente um ADM Master pode conceder ou remover este acesso.';
  end if;
  if old.is_master and not new.is_master and new.id = (select auth.uid()) then
    raise exception 'Você não pode remover o próprio acesso de ADM Master.';
  end if;
  return new;
end;
$$;

-- ADM Master precisa ver e atualizar perfis para conceder o acesso
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using ((select auth.uid()) = id or (select private.is_manager()) or (select private.is_master()));
create policy profiles_update on public.profiles for update to authenticated
  using ((select auth.uid()) = id or (select private.is_manager()) or (select private.is_master()))
  with check ((select auth.uid()) = id or (select private.is_manager()) or (select private.is_master()));

-- ---------------------------------------------------------------------
-- Configuracoes do site (uma unica linha)
-- ---------------------------------------------------------------------
create table if not exists public.site_settings (
  id              smallint primary key default 1 check (id = 1),
  login_title     text not null default 'Entre para continuar seus treinamentos'
                  check (char_length(login_title) between 1 and 120),
  login_text      text check (char_length(login_text) <= 300),
  login_images    text[] not null default '{}',
  hero_greeting   text check (char_length(hero_greeting) <= 80),
  hero_image_url  text,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id) on delete set null
);
insert into public.site_settings (id) values (1) on conflict (id) do nothing;

alter table public.site_settings enable row level security;

-- A tela de login e lida antes do login, por isso "anon" tambem le
grant select on public.site_settings to anon, authenticated;
grant update on public.site_settings to authenticated;
grant select, insert, update, delete on public.site_settings to service_role;

create policy site_settings_read on public.site_settings for select to anon, authenticated
  using (true);
create policy site_settings_master_update on public.site_settings for update to authenticated
  using ((select private.is_master())) with check ((select private.is_master()));

drop trigger if exists site_settings_touch on public.site_settings;
create trigger site_settings_touch
  before update on public.site_settings
  for each row execute function private.touch_updated_at();

-- Imagens do site (mural do login e destaque): leitura publica, escrita do master
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site', 'site', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy nw_site_select on storage.objects for select to authenticated
  using (bucket_id = 'site' and (select private.is_master()));
create policy nw_site_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'site' and (select private.is_master()));
create policy nw_site_update on storage.objects for update to authenticated
  using (bucket_id = 'site' and (select private.is_master()));
create policy nw_site_delete on storage.objects for delete to authenticated
  using (bucket_id = 'site' and (select private.is_master()));
