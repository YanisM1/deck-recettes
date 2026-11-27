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
