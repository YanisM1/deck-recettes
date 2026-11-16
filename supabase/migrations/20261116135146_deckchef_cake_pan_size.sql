-- Migration additive limitée à DeckChef. Les politiques RLS restent inchangées.
alter table public.recipes add column if not exists is_cake boolean default false;
alter table public.recipes add column if not exists pan_size integer check (pan_size in (20,26,28));

create or replace function public.deckchef_initialize(p_key text,p_recipes jsonb) returns void language plpgsql security invoker set search_path='' as $$
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
