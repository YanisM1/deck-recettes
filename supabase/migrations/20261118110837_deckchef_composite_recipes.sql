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
