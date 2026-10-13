-- ===========================================================================
-- 04 — Tabla `auditoria`
--
-- Etapa 1 del plan del portal, seccion 5.2 y hueco 9. Una linea por cada cosa
-- que alguien hace en la aplicacion: quien, que, sobre que, y los valores de
-- antes y de despues.
--
-- Idempotente. Solo crea; no toca ninguna tabla existente.
--
-- ORDEN: pegar ANTES de subir la aplicacion. La version nueva escribe aqui en
-- la misma transaccion que cada cambio: sin la tabla, iniciar sesion o crear
-- un usuario fallaria.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS auditoria (
  id          BIGSERIAL   PRIMARY KEY,

  -- Quien. Nulo cuando no hay nadie identificado: un intento de entrar con un
  -- correo que no existe. El rol y el cargo se COPIAN: dentro de un ano
  -- importa lo que esa persona era entonces, no lo que es ahora.
  actor_id    INTEGER     REFERENCES usuarios(id),
  actor_rol   TEXT,
  actor_cargo TEXT,

  -- Que. Siempre con la forma `entidad.hecho`.
  accion      TEXT        NOT NULL,

  -- Sobre que, y de que empresa.
  entidad     TEXT,
  entidad_id  BIGINT,
  empresa_id  INTEGER     REFERENCES empresas(id),

  -- Solo los campos que cambiaron. Nunca contrasenas ni tokens.
  antes       JSONB,
  despues     JSONB,

  ip          TEXT,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT auditoria_accion_formato CHECK (accion ~ '^[a-z_]+[.][a-z_]+$')
);

CREATE INDEX IF NOT EXISTS auditoria_fecha_idx   ON auditoria (creado_en DESC, id DESC);
CREATE INDEX IF NOT EXISTS auditoria_actor_idx   ON auditoria (actor_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS auditoria_entidad_idx ON auditoria (entidad, entidad_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS auditoria_empresa_idx ON auditoria (empresa_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS auditoria_accion_idx  ON auditoria (accion);

-- Solo se anade. Ni la aplicacion ni nadie con acceso a la base puede cambiar
-- o borrar una linea sin quitar antes estos triggers, y eso deja rastro.
CREATE OR REPLACE FUNCTION auditoria_solo_anadir() RETURNS trigger AS $fn$
BEGIN
  RAISE EXCEPTION 'La auditoria solo admite lineas nuevas: no se cambia ni se borra'
    USING ERRCODE = 'insufficient_privilege';
END;
$fn$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER auditoria_inmutable
  BEFORE UPDATE OR DELETE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION auditoria_solo_anadir();

CREATE OR REPLACE TRIGGER auditoria_sin_vaciar
  BEFORE TRUNCATE ON auditoria
  FOR EACH STATEMENT EXECUTE FUNCTION auditoria_solo_anadir();

-- Comprobacion. Debe devolver 2 (los dos triggers que la hacen inmutable).
SELECT count(*) AS triggers
FROM pg_trigger
WHERE tgrelid = 'auditoria'::regclass AND NOT tgisinternal;
