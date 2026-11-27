-- Exécuter avec psql -v ON_ERROR_STOP=1 et deux variables privées :
-- source_digest (SHA-256 hex du carnet autorisé), expected_count.
-- Aucun droit client n'est ouvert par cette copie.
begin;
set local lock_timeout = '5s';

select set_config('deckchef.migration.source_digest', :'source_digest', true) as source_config,
       set_config('deckchef.migration.expected_count', :'expected_count', true) as count_config
\gset

lock table public.recipes in share mode;
lock table public.recipes_global in exclusive mode;

create temporary table deckchef_import_rows on commit drop as
select projected.*
from public.recipes r
cross join lateral jsonb_populate_record(null::public.recipes_global, to_jsonb(r) - 'sync_key') as projected
where encode(sha256(convert_to(r.sync_key, 'UTF8')), 'hex') =
      current_setting('deckchef.migration.source_digest');

do $$
declare
  expected_count integer := current_setting('deckchef.migration.expected_count')::integer;
  source_digest text := current_setting('deckchef.migration.source_digest');
begin
  if source_digest !~ '^[a-f0-9]{64}$' or expected_count <= 0 then
    raise exception 'Source ou nombre attendu invalide';
  end if;
  if (select count(*) from pg_temp.deckchef_import_rows) <> expected_count then
    raise exception 'Nombre différent de l’inventaire. Arrêt sans import';
  end if;
  if exists (
    select 1 from pg_temp.deckchef_import_rows r
    group by (to_jsonb(r) - array['id','created_at','updated_at'])
    having count(*) > 1
  ) then
    raise exception 'Doublons de contenu. Revue manuelle requise';
  end if;
  if exists (select 1 from public.recipes_global) then
    raise exception 'La table globale contient déjà des recettes';
  end if;

  insert into public.recipes_global select * from pg_temp.deckchef_import_rows;

  if exists (
    (select * from public.recipes_global except all select * from pg_temp.deckchef_import_rows)
    union all
    (select * from pg_temp.deckchef_import_rows except all select * from public.recipes_global)
  ) then
    raise exception 'La copie ne correspond pas à la source';
  end if;
end;
$$;

select count(*) as recipes_copied from public.recipes_global;
commit;
