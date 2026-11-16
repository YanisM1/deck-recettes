-- DeckChef : carnets isolés par un code privé aléatoire transmis en en-tête.
-- Migration additive : aucune table des applications existantes n'est modifiée.
create table if not exists public.recipes (
  id uuid not null default gen_random_uuid(),
  sync_key text not null check (char_length(sync_key) = 64),
  title text not null check (char_length(title) between 1 and 160),
  category text not null check (category in ('sale', 'sucre')),
  ingredients jsonb not null default '[]'::jsonb check (jsonb_typeof(ingredients) = 'array'),
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  image_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (sync_key, id)
);
alter table public.recipes enable row level security;
grant select, insert, update, delete on public.recipes to anon, authenticated;
create policy "deckchef_private_read" on public.recipes for select to anon, authenticated using (sync_key = (select coalesce(current_setting('request.headers', true)::jsonb->>'x-deckchef-key','')));
create policy "deckchef_private_insert" on public.recipes for insert to anon, authenticated with check (sync_key = (select coalesce(current_setting('request.headers', true)::jsonb->>'x-deckchef-key','')));
create policy "deckchef_private_update" on public.recipes for update to anon, authenticated using (sync_key = (select coalesce(current_setting('request.headers', true)::jsonb->>'x-deckchef-key',''))) with check (sync_key = (select coalesce(current_setting('request.headers', true)::jsonb->>'x-deckchef-key','')));
create policy "deckchef_private_delete" on public.recipes for delete to anon, authenticated using (sync_key = (select coalesce(current_setting('request.headers', true)::jsonb->>'x-deckchef-key','')));

create function public.deckchef_updated_at() returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger recipes_updated_at before update on public.recipes for each row execute function public.deckchef_updated_at();

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='recipes') then
    alter publication supabase_realtime add table public.recipes;
  end if;
end $$;

-- Les JPEG compressés sont conservés dans image_url (data URI) et protégés
-- par les mêmes règles. Aucun bucket partagé ni aucune politique Storage modifiés.

-- Marqueur durable d'initialisation : un carnet volontairement vidé reste vide.
create table public.recipe_collections (
  sync_key text primary key check (char_length(sync_key)=64),
  created_at timestamptz not null default now()
);
alter table public.recipe_collections enable row level security;
grant select,insert on public.recipe_collections to anon,authenticated;
create policy deckchef_collection_read on public.recipe_collections for select to anon,authenticated using(sync_key=(select coalesce(current_setting('request.headers',true)::jsonb->>'x-deckchef-key','')));
create policy deckchef_collection_create on public.recipe_collections for insert to anon,authenticated with check(sync_key=(select coalesce(current_setting('request.headers',true)::jsonb->>'x-deckchef-key','')));
create function public.deckchef_initialize(p_key text,p_recipes jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare inserted_key text;
begin
  if p_key is distinct from coalesce(current_setting('request.headers',true)::jsonb->>'x-deckchef-key','') then raise exception 'Invalid collection key'; end if;
  insert into public.recipe_collections(sync_key) values(p_key) on conflict do nothing returning sync_key into inserted_key;
  if inserted_key is not null then
    insert into public.recipes(sync_key,id,title,category,ingredients,steps,image_url,created_at,updated_at)
    select p_key,r.id,r.title,r.category,r.ingredients,r.steps,r.image_url,r.created_at,r.updated_at
    from jsonb_to_recordset(p_recipes) as r(id uuid,title text,category text,ingredients jsonb,steps jsonb,image_url text,created_at timestamptz,updated_at timestamptz) on conflict do nothing;
  end if;
end;
$$;
revoke execute on function public.deckchef_initialize(text,jsonb) from public;
grant execute on function public.deckchef_initialize(text,jsonb) to anon,authenticated;
