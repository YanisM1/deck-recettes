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
      or (calories_value is not null and calories_unit is not null and calories_value between 0 and 100000 and calories_unit in ('kcal / part (1/8)', 'kcal / 100g'))
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
