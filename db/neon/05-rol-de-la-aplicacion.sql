-- ===========================================================================
-- 05 — Rol de la aplicacion y vista de acceso
--
-- Etapa 1 del plan del portal, huecos 6 y 7.
--
--   1. Crea el rol `conejo_app`, con el que la aplicacion pasa a conectarse.
--      No es dueno de nada, no puede cambiar el esquema y no se salta la
--      seguridad por fila.
--   2. Le da solo los permisos que la aplicacion usa.
--   3. Crea `vw_usuarios_acceso`, la vista que usa el login nuevo para leer
--      el hash de la contrasena.
--
-- NO ROMPE LA VERSION QUE ESTA PUBLICADA. La vista general sigue trayendo el
-- hash, que es lo que lee la version anterior al iniciar sesion; se le quita
-- despues de publicar, con el archivo 06.
--
-- ANTES DE EJECUTAR: sustituye PEGA_AQUI_LA_CONTRASENA (aparece UNA vez, tres
-- lineas mas abajo del DO) por la contrasena del rol. Se sustituye AQUI, en el
-- editor de Neon: no la escribas en el archivo del repositorio. Si se te
-- olvida, el script se detiene sin cambiar nada.
--
-- Idempotente. Volver a pegarlo vuelve a fijar la contrasena que lleve.
--
-- ORDEN:
--   1. Pegar esto (con 01 a 04 ya pegados).
--   2. Mirar las comprobaciones del final.
--   3. Cambiar DATABASE_URL en Vercel para que use conejo_app.
--   4. Subir la aplicacion.
--   5. Con la version nueva ya publicada y probada, pegar el 06.
-- ===========================================================================

BEGIN;

DO $rol$
DECLARE
  clave CONSTANT text := 'PEGA_AQUI_LA_CONTRASENA';
BEGIN
  IF clave LIKE 'PEGA_AQUI%' THEN
    RAISE EXCEPTION 'Falta sustituir la contrasena del rol antes de ejecutar';
  END IF;

  IF length(clave) < 32 THEN
    RAISE EXCEPTION 'La contrasena del rol es demasiado corta: usa al menos 32 caracteres';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'conejo_app') THEN
    EXECUTE format('CREATE ROLE conejo_app LOGIN NOBYPASSRLS PASSWORD %L', clave);
  ELSE
    EXECUTE format('ALTER ROLE conejo_app LOGIN NOBYPASSRLS PASSWORD %L', clave);
  END IF;
END
$rol$;

DROP VIEW IF EXISTS vw_usuarios_acceso;

-- ---------------------------------------------------------------------------
-- Lo unico que necesita el inicio de sesion, y nada mas.
--
-- El hash de la contrasena vive aqui y NO en vw_usuarios_completos, que es la
-- que consultan las pages y los listados: asi ningun modelo lo puede traer por
-- descuido al anadir una columna a una consulta.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_usuarios_acceso
WITH (security_invoker = true) AS
SELECT
  u.id,
  u.password_hash,
  (u.bloqueado_hasta IS NOT NULL AND u.bloqueado_hasta > now()) AS bloqueado
FROM usuarios u;

-- ---------------------------------------------------------------------------
-- Lo que puede hacer el rol de la aplicacion.
--
-- La regla es dar lo justo: leer y escribir donde la aplicacion escribe, y
-- nada de lo que no hace nunca. Asi un fallo en el codigo —o una inyeccion—
-- no puede borrar una cuenta ni reescribir la auditoria aunque lo intente.
--
--   catalogos (roles, cargos)        solo lectura
--   personas, empresas y sesiones    sin DELETE: se desactivan o se revocan
--   auditoria                        solo INSERT y SELECT
--   hooks                            DELETE solo donde existe el borrado
--
-- Una tabla nueva nace con SELECT, INSERT y UPDATE para la aplicacion. Si
-- necesita DELETE, se le concede aqui de forma explicita.
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO conejo_app;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM conejo_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO conejo_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO conejo_app;

REVOKE INSERT, UPDATE ON roles, cargos FROM conejo_app;
REVOKE UPDATE ON auditoria FROM conejo_app;
GRANT DELETE ON fichas_hook, reglas_hook, referencias_hook TO conejo_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE ON TABLES TO conejo_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO conejo_app;

COMMIT;

-- Comprobacion 1. Debe devolver UNA fila con:
--   puede_entrar = true, se_salta_rls = false, es_superusuario = false,
--   crea_roles = false, en_neon_superuser = false
-- Si en_neon_superuser saliera true, NO cambies Vercel: avisa antes.
SELECT
  rolcanlogin   AS puede_entrar,
  rolbypassrls  AS se_salta_rls,
  rolsuper      AS es_superusuario,
  rolcreaterole AS crea_roles,
  EXISTS (
    SELECT 1
    FROM pg_auth_members m
    JOIN pg_roles padre ON padre.oid = m.roleid
    WHERE m.member = pg_roles.oid AND padre.rolname = 'neon_superuser'
  ) AS en_neon_superuser
FROM pg_roles
WHERE rolname = 'conejo_app';

-- Comprobacion 2. Sobre auditoria debe devolver solo INSERT y SELECT.
SELECT string_agg(privilege_type, ', ' ORDER BY privilege_type) AS permisos_en_auditoria
FROM information_schema.role_table_grants
WHERE grantee = 'conejo_app' AND table_name = 'auditoria';

-- Comprobacion 3. Debe devolver 1: la vista de acceso existe.
SELECT count(*) AS vista_de_acceso
FROM information_schema.views
WHERE table_name = 'vw_usuarios_acceso';
