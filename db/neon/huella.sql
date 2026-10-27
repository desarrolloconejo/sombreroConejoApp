-- ===========================================================================
-- Huella del esquema: una linea por objeto de public, portal y finanzas.
--
-- SOLO LEE. Se ejecuta en la base local y en la de Neon, y las dos salidas se
-- comparan con diff: tienen que ser iguales. Es como se comprobo el
-- 2026-10-27 que produccion quedo identica a db/schema.sql.
--
--   docker compose exec -T db psql -U conejo -d conejo_app -At < db/neon/huella.sql
--
-- Las definiciones van como md5: cambia la huella si cambia el cuerpo de una
-- funcion, una politica o una vista. PostgreSQL 18 (Neon) anota los NOT NULL
-- como restricciones `*_not_null` y el 17 (local) no: se descartan antes de
-- comparar (grep -v '_not_null ').
-- ===========================================================================

WITH esq AS (SELECT unnest(ARRAY['public','portal','finanzas']) AS n)
SELECT linea FROM (
  SELECT 'columna ' || table_schema || '.' || table_name || '.' || column_name || ' ' || data_type
         || ' null=' || is_nullable || ' def=' || coalesce(column_default, '') AS linea
  FROM information_schema.columns WHERE table_schema IN (SELECT n FROM esq)
  UNION ALL
  SELECT 'funcion ' || n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') '
         || md5(pg_get_functiondef(p.oid)) || ' secdef=' || p.prosecdef || ' cfg=' || coalesce(array_to_string(p.proconfig, ','), '')
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname IN (SELECT n FROM esq) AND p.prokind IN ('f', 'p')
  UNION ALL
  SELECT 'politica ' || schemaname || '.' || tablename || '.' || policyname || ' ' || cmd || ' ' || array_to_string(roles, ',')
         || ' ' || md5(coalesce(qual, '') || '|' || coalesce(with_check, ''))
  FROM pg_policies WHERE schemaname IN (SELECT n FROM esq)
  UNION ALL
  SELECT 'vista ' || schemaname || '.' || viewname || ' ' || md5(definition)
  FROM pg_views WHERE schemaname IN (SELECT n FROM esq)
  UNION ALL
  SELECT 'indice ' || schemaname || '.' || indexname || ' ' || md5(indexdef)
  FROM pg_indexes WHERE schemaname IN (SELECT n FROM esq)
  UNION ALL
  SELECT 'restriccion ' || n.nspname || '.' || c.relname || '.' || k.conname || ' ' || md5(pg_get_constraintdef(k.oid))
  FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN (SELECT n FROM esq)
  UNION ALL
  SELECT 'trigger ' || n.nspname || '.' || c.relname || '.' || t.tgname || ' ' || md5(pg_get_triggerdef(t.oid))
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE NOT t.tgisinternal AND n.nspname IN (SELECT n FROM esq)
  UNION ALL
  SELECT 'rls ' || n.nspname || '.' || c.relname || ' ' || c.relrowsecurity || ' ' || c.relforcerowsecurity
         || ' opciones=' || coalesce(array_to_string(c.reloptions, ','), '')
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN (SELECT n FROM esq) AND c.relkind IN ('r', 'v')
  UNION ALL
  SELECT 'permiso_tabla ' || table_schema || '.' || table_name || ' ' || grantee || ' ' || privilege_type
  FROM information_schema.role_table_grants
  WHERE table_schema IN (SELECT n FROM esq) AND grantee IN ('conejo_app', 'PUBLIC')
  UNION ALL
  SELECT 'permiso_funcion ' || routine_schema || '.' || routine_name || ' ' || grantee
  FROM information_schema.role_routine_grants
  WHERE routine_schema IN (SELECT n FROM esq) AND grantee IN ('conejo_app', 'PUBLIC')
  UNION ALL
  SELECT 'permiso_secuencia ' || c.relname || ' ' || has_sequence_privilege('conejo_app', c.oid, 'USAGE')
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'S' AND n.nspname IN (SELECT n FROM esq)
  UNION ALL
  SELECT 'rol conejo_app login=' || rolcanlogin || ' bypassrls=' || rolbypassrls || ' super=' || rolsuper
  FROM pg_roles WHERE rolname = 'conejo_app'
) x ORDER BY linea
;
