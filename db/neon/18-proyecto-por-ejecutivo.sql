-- ===========================================================================
-- 18 — Un proyecto lo puede llevar un ejecutivo de otra cuenta
--
-- El administrador puede darle un proyecto concreto a un ejecutivo de cuentas
-- que no esta asignado a la empresa. Ese ejecutivo gestiona ese proyecto y
-- sus piezas, fases, tareas, versiones y comentarios, y nada mas de la
-- empresa: los briefs y los demas proyectos siguen yendo por la empresa.
--
--   - Funcion nueva portal.gestiona_proyecto, y portal.gestiona_pieza pasa a
--     usarla (las politicas de piezas, fases, tareas... lo heredan).
--   - proyectos_lee, proyectos_edita y piezas_crea la aplican.
--   - Trigger: solo un administrador cambia quien lleva un proyecto.
--
-- Idempotente. La version publicada todavia no tiene proyectos, asi que nada
-- de esto la toca.
--
-- ORDEN: antes de subir la aplicacion, despues del 17.
-- ===========================================================================

BEGIN;

CREATE OR REPLACE FUNCTION portal.gestiona_proyecto(p_proyecto integer)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT COALESCE((
      SELECT portal.gestiona_empresa(pr.empresa_id)
          OR (app_rol() = 'trabajador' AND app_cargo() = 'cuentas'
              AND pr.ejecutivo_id = app_usuario_id())
      FROM portal.proyectos pr
      WHERE pr.id = p_proyecto
    ), false)
  $fn$;

CREATE OR REPLACE FUNCTION portal.gestiona_pieza(p_pieza integer)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT COALESCE((
      SELECT portal.gestiona_proyecto(p.proyecto_id)
      FROM portal.piezas p
      WHERE p.id = p_pieza
    ), false)
  $fn$;

REVOKE ALL ON FUNCTION portal.gestiona_proyecto(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION portal.gestiona_proyecto(integer) TO conejo_app;

DROP POLICY IF EXISTS proyectos_lee ON portal.proyectos;
CREATE POLICY proyectos_lee ON portal.proyectos
  FOR SELECT TO conejo_app
  USING (
    portal.gestiona_empresa(empresa_id)
    OR (app_rol() = 'trabajador' AND app_cargo() = 'cuentas' AND ejecutivo_id = app_usuario_id())
    OR (app_rol() = 'cliente' AND empresa_id = app_empresa_id())
    OR portal.trabaja_en_proyecto(id)
  );

DROP POLICY IF EXISTS proyectos_edita ON portal.proyectos;
CREATE POLICY proyectos_edita ON portal.proyectos
  FOR UPDATE TO conejo_app
  USING (
    portal.gestiona_empresa(empresa_id)
    OR (app_rol() = 'trabajador' AND app_cargo() = 'cuentas' AND ejecutivo_id = app_usuario_id())
  )
  WITH CHECK (
    portal.gestiona_empresa(empresa_id)
    OR (app_rol() = 'trabajador' AND app_cargo() = 'cuentas' AND ejecutivo_id = app_usuario_id())
  );

CREATE OR REPLACE FUNCTION portal.proyectos_solo_admin_reasigna() RETURNS trigger AS $fn$
BEGIN
  IF NEW.ejecutivo_id IS DISTINCT FROM OLD.ejecutivo_id
     AND app_rol() IS NOT NULL AND app_rol() <> 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador cambia quien lleva un proyecto'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END
$fn$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER proyectos_solo_admin_reasigna
  BEFORE UPDATE OF ejecutivo_id ON portal.proyectos
  FOR EACH ROW EXECUTE FUNCTION portal.proyectos_solo_admin_reasigna();

DROP POLICY IF EXISTS piezas_crea ON portal.piezas;
CREATE POLICY piezas_crea ON portal.piezas
  FOR INSERT TO conejo_app
  WITH CHECK (portal.gestiona_proyecto(proyecto_id));

COMMIT;

-- ---------------------------------------------------------------------------
-- Comprobacion. Debe devolver funcion = 1, pieza_la_usa = true, trigger = 1 y
-- politicas = 3.
-- ---------------------------------------------------------------------------
SELECT (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'portal' AND p.proname = 'gestiona_proyecto') AS funcion,
       (SELECT prosrc LIKE '%gestiona_proyecto%' FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'portal' AND p.proname = 'gestiona_pieza') AS pieza_la_usa,
       (SELECT count(*) FROM pg_trigger
        WHERE tgname = 'proyectos_solo_admin_reasigna' AND NOT tgisinternal) AS trigger,
       (SELECT count(*) FROM pg_policies
        WHERE schemaname = 'portal'
          AND ((tablename = 'proyectos' AND policyname IN ('proyectos_lee', 'proyectos_edita')
                AND qual LIKE '%ejecutivo_id%')
            OR (tablename = 'piezas' AND policyname = 'piezas_crea'
                AND with_check LIKE '%gestiona_proyecto%'))) AS politicas;
