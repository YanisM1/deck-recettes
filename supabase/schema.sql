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
