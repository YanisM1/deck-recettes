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
