-- DeckChef : collection partagée publique, conformément au cahier des charges.
-- Toute personne possédant l'URL et la clé publique peut lire ET modifier les recettes.
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  category text not null check (category in ('sale', 'sucre')),
  ingredients jsonb not null default '[]'::jsonb check (jsonb_typeof(ingredients) = 'array'),
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  image_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.recipes enable row level security;
grant select, insert, update, delete on public.recipes to anon, authenticated;
create policy "deckchef_public_read" on public.recipes for select to anon, authenticated using (true);
create policy "deckchef_public_insert" on public.recipes for insert to anon, authenticated with check (true);
create policy "deckchef_public_update" on public.recipes for update to anon, authenticated using (true) with check (true);
create policy "deckchef_public_delete" on public.recipes for delete to anon, authenticated using (true);

create function public.deckchef_updated_at() returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger recipes_updated_at before update on public.recipes for each row execute function public.deckchef_updated_at();

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='recipes') then
    alter publication supabase_realtime add table public.recipes;
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-photos','recipe-photos',true,3000000,array['image/jpeg']) on conflict (id) do nothing;
create policy "deckchef_photo_read" on storage.objects for select to anon, authenticated using (bucket_id='recipe-photos');
create policy "deckchef_photo_insert" on storage.objects for insert to anon, authenticated with check (bucket_id='recipe-photos' and lower(storage.extension(name))='jpg');
create policy "deckchef_photo_delete" on storage.objects for delete to anon, authenticated using (bucket_id='recipe-photos');
