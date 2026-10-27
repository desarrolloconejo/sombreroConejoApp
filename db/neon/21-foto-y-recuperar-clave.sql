-- ===========================================================================
-- 21 — Foto de perfil en Drive y «Olvide mi contrasena»
--
-- usuarios.foto_archivo (donde esta guardada la foto; no sale en ninguna
-- vista), la tabla restablecimientos_clave (el hash de cada enlace para poner
-- una contrasena nueva, con su vencimiento) y las politicas de la bandeja de
-- salida, que pasan a aceptar al rol sistema para el correo de quien aun no
-- tiene sesion.
--
-- Idempotente. Solo anade: la version publicada no usa nada de esto, y las
-- politicas nuevas aceptan todo lo que aceptaban las anteriores.
--
-- ORDEN: antes de subir la aplicacion, despues del 20.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- La foto de perfil, en Drive. foto_url sigue siendo lo que se pinta (una ruta
-- de la aplicacion, /api/fotos/ID?v=…); foto_archivo es donde esta guardada,
-- y no sale en ninguna vista: solo la lee la ruta que la entrega.
-- ---------------------------------------------------------------------------
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_archivo TEXT;

-- ---------------------------------------------------------------------------
-- Los enlaces de «Olvide mi contrasena».
--
-- Se guarda el hash del token, nunca el token: quien lea esta tabla no puede
-- usar ningun enlace. Cada uno vence a los 30 minutos y sirve una vez; al
-- usarlo, los demas de la misma persona quedan usados tambien. No se borran:
-- son el rastro de quien pidio que y cuando.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS restablecimientos_clave (
  id          SERIAL      PRIMARY KEY,
  usuario_id  INTEGER     NOT NULL REFERENCES usuarios(id),
  token_hash  TEXT        NOT NULL UNIQUE,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  vence_en    TIMESTAMPTZ NOT NULL,
  usado_en    TIMESTAMPTZ,

  CONSTRAINT restablecimientos_vence_despues CHECK (vence_en > creado_en),
  CONSTRAINT restablecimientos_hash_formato  CHECK (token_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS restablecimientos_clave_usuario_idx
  ON restablecimientos_clave (usuario_id, creado_en DESC);

GRANT SELECT, INSERT, UPDATE ON restablecimientos_clave TO conejo_app;
GRANT USAGE, SELECT ON SEQUENCE restablecimientos_clave_id_seq TO conejo_app;

-- ---------------------------------------------------------------------------
-- La bandeja de salida acepta tambien al sistema: el correo de «Olvide mi
-- contrasena» lo escribe quien aun no tiene sesion, y no se le inventa una.
-- Lo del sistema va sin autor (creado_por NULL) y sin enlace de prospecto.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS correos_salida_lee ON portal.correos_salida;
CREATE POLICY correos_salida_lee ON portal.correos_salida
  FOR SELECT TO conejo_app
  USING (
    app_rol() = 'admin' OR creado_por = app_usuario_id()
    OR (app_rol() = 'prospecto' AND enlace_id = app_enlace_id())
    OR (app_rol() = 'sistema' AND creado_por IS NULL AND enlace_id IS NULL)
  );

DROP POLICY IF EXISTS correos_salida_escribe ON portal.correos_salida;
CREATE POLICY correos_salida_escribe ON portal.correos_salida
  FOR INSERT TO conejo_app
  WITH CHECK (
    creado_por = app_usuario_id()
    OR (app_rol() = 'prospecto' AND creado_por IS NULL AND enlace_id = app_enlace_id())
    OR (app_rol() = 'sistema' AND creado_por IS NULL AND enlace_id IS NULL)
  );

DROP POLICY IF EXISTS correos_salida_actualiza ON portal.correos_salida;
CREATE POLICY correos_salida_actualiza ON portal.correos_salida
  FOR UPDATE TO conejo_app
  USING (
    app_rol() = 'admin' OR creado_por = app_usuario_id()
    OR (app_rol() = 'prospecto' AND enlace_id = app_enlace_id())
    OR (app_rol() = 'sistema' AND creado_por IS NULL AND enlace_id IS NULL)
  )
  WITH CHECK (
    app_rol() = 'admin' OR creado_por = app_usuario_id()
    OR (app_rol() = 'prospecto' AND enlace_id = app_enlace_id())
    OR (app_rol() = 'sistema' AND creado_por IS NULL AND enlace_id IS NULL)
  );

COMMIT;

-- ---------------------------------------------------------------------------
-- Comprobacion. Debe devolver columna = 1, tabla = 1, permisos = 3 y
-- politicas_con_sistema = 3.
-- ---------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'foto_archivo')            AS columna,
  (SELECT count(*) FROM information_schema.tables
    WHERE table_name = 'restablecimientos_clave')                              AS tabla,
  (SELECT count(*) FROM information_schema.role_table_grants
    WHERE table_name = 'restablecimientos_clave' AND grantee = 'conejo_app')   AS permisos,
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'portal' AND tablename = 'correos_salida'
      AND (coalesce(qual, '') || coalesce(with_check, '')) LIKE '%sistema%')   AS politicas_con_sistema;
