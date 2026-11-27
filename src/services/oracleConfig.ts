export const ORACLE_APP_ORIGIN = "https://recipe.84.235.237.224.sslip.io";
export const ORACLE_SUPABASE_ORIGIN = "https://supabase-recipe.84.235.237.224.sslip.io";

export function oracleSupabaseUrl(value: string | undefined) {
  return value === ORACLE_SUPABASE_ORIGIN || value === ORACLE_SUPABASE_ORIGIN + "/"
    ? ORACLE_SUPABASE_ORIGIN
    : undefined;
}
