-- ===========================================================================
-- 19 — Avisos a los ejecutivos de una empresa
--
-- Funcion nueva portal.ejecutivos_de_empresa: los ejecutivos de cuentas
-- activos asignados a una empresa. La usa la aplicacion para avisarles de lo
-- que pasa con los presupuestos de su cliente, porque administracion y el
-- cliente no pueden leer las asignaciones. Solo devuelve ids.
--
-- Idempotente. Solo anade una funcion que la version publicada no usa.
--
-- ORDEN: antes de subir la aplicacion, despues del 18.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Quien atiende una empresa: sus ejecutivos de cuentas asignados y activos.
-- Es a quienes se avisa de lo que pasa con el dinero de su cliente
-- (presupuestos creados, enviados y resueltos). Administracion y el cliente no
-- ven las asignaciones, por eso se pregunta aqui. Solo devuelve ids, y solo a
-- quien tiene sesion declarada.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.ejecutivos_de_empresa(p_empresa integer)
  RETURNS TABLE (id integer)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT u.id
    FROM portal.asignaciones a
    JOIN usuarios u ON u.id = a.usuario_id
    WHERE a.empresa_id = p_empresa AND u.activo AND app_usuario_id() IS NOT NULL
  $fn$;

REVOKE ALL ON FUNCTION portal.ejecutivos_de_empresa(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION portal.ejecutivos_de_empresa(integer) TO conejo_app;

COMMIT;

-- ---------------------------------------------------------------------------
-- Comprobacion. Debe devolver funcion = 1 y con_search_path = true.
-- ---------------------------------------------------------------------------
SELECT (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'portal' AND p.proname = 'ejecutivos_de_empresa') AS funcion,
       (SELECT proconfig IS NOT NULL FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'portal' AND p.proname = 'ejecutivos_de_empresa') AS con_search_path;
