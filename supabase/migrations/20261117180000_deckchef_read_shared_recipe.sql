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
