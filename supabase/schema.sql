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
  is_cake boolean default false,
  pan_size integer check (pan_size in (20,26,28)),
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
    insert into public.recipes(sync_key,id,title,category,ingredients,steps,image_url,is_cake,pan_size,created_at,updated_at)
    select p_key,r.id,r.title,r.category,r.ingredients,r.steps,r.image_url,coalesce(r.is_cake,false),r.pan_size,r.created_at,r.updated_at
    from jsonb_to_recordset(p_recipes) as r(id uuid,title text,category text,ingredients jsonb,steps jsonb,image_url text,is_cake boolean,pan_size integer,created_at timestamptz,updated_at timestamptz) on conflict do nothing;
  end if;
end;
$$;
revoke execute on function public.deckchef_initialize(text,jsonb) from public;
grant execute on function public.deckchef_initialize(text,jsonb) to anon,authenticated;

-- A share token authorizes reading exactly one recipe. No cookbook key is returned.
create function public.deckchef_read_shared_recipe(p_id uuid, p_token text)
returns table (
  id uuid,
  title text,
  category text,
  ingredients jsonb,
  steps jsonb,
  image_url text,
  is_cake boolean,
  pan_size integer,
  created_at timestamptz,
  updated_at timestamptz
)
language sql stable strict security definer
set search_path = ''
as $$
  select r.id, r.title, r.category, r.ingredients, r.steps, r.image_url,
    r.is_cake, r.pan_size, r.created_at, r.updated_at
  from public.recipes as r
  where r.id = p_id and p_token ~ '^[a-f0-9]{64}$'
    and encode(extensions.hmac(
      convert_to('deckchef:recipe-share:v1:' || r.id::text, 'UTF8'),
      decode(case when r.sync_key ~ '^[a-f0-9]{64}$' then r.sync_key end, 'hex'),
      'sha256'
    ), 'hex') = p_token
  limit 1
$$;

revoke all on function public.deckchef_read_shared_recipe(uuid, text) from public;
grant execute on function public.deckchef_read_shared_recipe(uuid, text) to anon, authenticated;

-- Additive DeckChef-only metadata. Existing records and RLS are preserved.
alter table public.recipes add column if not exists servings integer not null default 2 check (servings between 1 and 999);
alter table public.recipes add column if not exists calories_info jsonb check (calories_info is null or jsonb_typeof(calories_info) = 'object');

create or replace function public.deckchef_initialize(p_key text,p_recipes jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare inserted_key text;
begin
  if p_key is distinct from coalesce(current_setting('request.headers',true)::jsonb->>'x-deckchef-key','') then raise exception 'Invalid collection key'; end if;
  insert into public.recipe_collections(sync_key) values(p_key) on conflict do nothing returning sync_key into inserted_key;
  if inserted_key is not null then
    insert into public.recipes(sync_key,id,title,category,ingredients,steps,image_url,is_cake,pan_size,servings,calories_info,created_at,updated_at)
    select p_key,r.id,r.title,r.category,r.ingredients,r.steps,r.image_url,coalesce(r.is_cake,false),r.pan_size,coalesce(r.servings,2),r.calories_info,r.created_at,r.updated_at
    from jsonb_to_recordset(p_recipes) as r(id uuid,title text,category text,ingredients jsonb,steps jsonb,image_url text,is_cake boolean,pan_size integer,servings integer,calories_info jsonb,created_at timestamptz,updated_at timestamptz) on conflict do nothing;
  end if;
end;
$$;
revoke execute on function public.deckchef_initialize(text,jsonb) from public;
grant execute on function public.deckchef_initialize(text,jsonb) to anon,authenticated;
notify pgrst, 'reload schema';


-- Create the real migration filename with `supabase migration new ...` first.
-- This additive script touches only DeckChef recipes and its initializer.
alter table public.recipes
  add column if not exists linked_recipe_ids jsonb not null default '[]'::jsonb;

create or replace function public.deckchef_valid_recipe_links(p_ids jsonb, p_id uuid)
returns boolean language sql immutable security invoker set search_path = ''
as $$
  select case when jsonb_typeof(p_ids) = 'array' then
    jsonb_array_length(p_ids) <= 20
    and not exists (
      select 1 from jsonb_array_elements(p_ids) value
      where jsonb_typeof(value) <> 'string'
        or (value #>> '{}') !~ '^[a-f0-9]{8}-([a-f0-9]{4}-){3}[a-f0-9]{12}$'
        or (value #>> '{}') = p_id::text
    )
    and (select count(*) from jsonb_array_elements(p_ids)) =
        (select count(distinct value) from jsonb_array_elements(p_ids) value)
  else false end
$$;
revoke all on function public.deckchef_valid_recipe_links(jsonb, uuid) from public;
grant execute on function public.deckchef_valid_recipe_links(jsonb, uuid) to anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.recipes'::regclass and conname = 'deckchef_recipe_links_valid') then
    alter table public.recipes add constraint deckchef_recipe_links_valid
      check (public.deckchef_valid_recipe_links(linked_recipe_ids, id));
  end if;
end $$;

-- Stage1 already adds servings/calories_info. Keep all three fields in initialization.
create or replace function public.deckchef_initialize(p_key text,p_recipes jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare inserted_key text;
begin
  if p_key is distinct from coalesce(current_setting('request.headers',true)::jsonb->>'x-deckchef-key','') then raise exception 'Invalid collection key'; end if;
  insert into public.recipe_collections(sync_key) values(p_key) on conflict do nothing returning sync_key into inserted_key;
  if inserted_key is not null then
    insert into public.recipes(sync_key,id,title,category,ingredients,steps,image_url,is_cake,pan_size,servings,calories_info,linked_recipe_ids,created_at,updated_at)
    select p_key,r.id,r.title,r.category,r.ingredients,r.steps,r.image_url,coalesce(r.is_cake,false),r.pan_size,coalesce(r.servings,2),r.calories_info,coalesce(r.linked_recipe_ids,'[]'::jsonb),r.created_at,r.updated_at
    from jsonb_to_recordset(p_recipes) as r(id uuid,title text,category text,ingredients jsonb,steps jsonb,image_url text,is_cake boolean,pan_size integer,servings integer,calories_info jsonb,linked_recipe_ids jsonb,created_at timestamptz,updated_at timestamptz)
    on conflict do nothing;
  end if;
end;
$$;
revoke execute on function public.deckchef_initialize(text,jsonb) from public;
grant execute on function public.deckchef_initialize(text,jsonb) to anon,authenticated;

-- Additive DeckChef-only metadata. Existing rows and RLS are unchanged.
alter table public.recipes
  add column if not exists calories_value integer,
  add column if not exists calories_unit text,
  add column if not exists calories_note text,
  add column if not exists ai_scaling_data jsonb;

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.recipes'::regclass and conname = 'deckchef_calories_display_valid') then
    alter table public.recipes add constraint deckchef_calories_display_valid check (
      (calories_value is null and calories_unit is null)
      or (
        calories_value is not null and calories_unit is not null
        and calories_value between 0 and 100000
        and calories_unit in ('per_serving', 'per_100g', 'total', 'kcal / part (1/8)', 'kcal / 100g')
      )
    );
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.recipes'::regclass and conname = 'deckchef_calories_note_valid') then
    alter table public.recipes add constraint deckchef_calories_note_valid check (calories_note is null or char_length(calories_note) <= 500);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.recipes'::regclass and conname = 'deckchef_ai_scaling_valid') then
    alter table public.recipes add constraint deckchef_ai_scaling_valid check (
      ai_scaling_data is null or (jsonb_typeof(ai_scaling_data) = 'object' and octet_length(ai_scaling_data::text) <= 512000)
    );
  end if;
end $$;

create or replace function public.deckchef_initialize(p_key text,p_recipes jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare inserted_key text;
begin
  if p_key is distinct from coalesce(current_setting('request.headers',true)::jsonb->>'x-deckchef-key','') then raise exception 'Invalid collection key'; end if;
  insert into public.recipe_collections(sync_key) values(p_key) on conflict do nothing returning sync_key into inserted_key;
  if inserted_key is not null then
    insert into public.recipes(sync_key,id,title,category,ingredients,steps,image_url,is_cake,pan_size,servings,calories_info,linked_recipe_ids,calories_value,calories_unit,calories_note,ai_scaling_data,created_at,updated_at)
    select p_key,r.id,r.title,r.category,r.ingredients,r.steps,r.image_url,coalesce(r.is_cake,false),r.pan_size,coalesce(r.servings,2),r.calories_info,coalesce(r.linked_recipe_ids,'[]'::jsonb),r.calories_value,r.calories_unit,r.calories_note,r.ai_scaling_data,r.created_at,r.updated_at
    from jsonb_to_recordset(p_recipes) as r(id uuid,title text,category text,ingredients jsonb,steps jsonb,image_url text,is_cake boolean,pan_size integer,servings integer,calories_info jsonb,linked_recipe_ids jsonb,calories_value integer,calories_unit text,calories_note text,ai_scaling_data jsonb,created_at timestamptz,updated_at timestamptz)
    on conflict do nothing;
  end if;
end;
$$;
revoke execute on function public.deckchef_initialize(text,jsonb) from public;
grant execute on function public.deckchef_initialize(text,jsonb) to anon,authenticated;

-- Livre global DeckChef. Les carnets historiques restent privés.
begin;
set local lock_timeout = '5s';

create table public.recipes_global (
  like public.recipes including defaults including constraints
);
alter table public.recipes_global drop column sync_key;
alter table public.recipes_global add primary key (id);

alter table public.recipes_global enable row level security;
revoke all on table public.recipes_global from public, anon, authenticated;
grant select, insert, update, delete on table public.recipes_global to anon, authenticated, service_role;
create policy recipes_global_read on public.recipes_global for select to anon, authenticated using (true);
create policy recipes_global_add on public.recipes_global for insert to anon, authenticated with check (true);
create policy recipes_global_edit on public.recipes_global for update to anon, authenticated using (true) with check (true);
create policy recipes_global_delete on public.recipes_global for delete to anon, authenticated using (true);
create index recipes_global_created_at_id_idx on public.recipes_global (created_at, id);
create trigger recipes_global_updated_at before update on public.recipes_global
  for each row execute function public.deckchef_updated_at();

alter publication supabase_realtime add table public.recipes_global;
notify pgrst, 'reload schema';

commit;
