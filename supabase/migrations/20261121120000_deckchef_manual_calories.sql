-- Extend the existing validation to accept manual calorie units.
-- Historical units remain valid so the migration leaves every row intact.
alter table public.recipes
  drop constraint if exists deckchef_calories_display_valid,
  add constraint deckchef_calories_display_valid check (
    (calories_value is null and calories_unit is null)
    or (
      calories_value is not null and calories_unit is not null
      and calories_value between 0 and 100000
      and calories_unit in ('per_serving', 'per_100g', 'total', 'kcal / part (1/8)', 'kcal / 100g')
    )
  );
