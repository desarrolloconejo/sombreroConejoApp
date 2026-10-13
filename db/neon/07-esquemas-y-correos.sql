-- ===========================================================================
-- 07 — Esquemas `portal` y `finanzas`, y la bandeja de salida de correos
--
-- Etapa 2 del plan del portal, seccion 6.
--
--   1. Crea los dos esquemas donde viviran las tablas del portal y da al rol
--      de la aplicacion los permisos por defecto sobre lo que se cree en ellos.
--   2. Crea las cuatro funciones con las que las politicas de seguridad por
--      fila leen quien hace la peticion.
--   3. Crea `portal.correos_salida`, con sus politicas: la lee un
--      administrador, y cada quien los correos que el mismo provoco.
--
-- Idempotente. Solo crea; no toca ninguna tabla existente. Necesita el rol
-- `conejo_app`, asi que va DESPUES del 05.
--
-- ORDEN: antes de subir la aplicacion.
-- ===========================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS portal;
CREATE SCHEMA IF NOT EXISTS finanzas;

GRANT USAGE ON SCHEMA portal, finanzas TO conejo_app;

-- Lo que se cree de aqui en adelante en estos esquemas nace con estos
-- permisos. Sin DELETE: en el portal las cosas se archivan o se anulan, y en
-- finanzas la aplicacion no borra nunca. Donde haga falta, se concede aparte.
ALTER DEFAULT PRIVILEGES IN SCHEMA portal
  GRANT SELECT, INSERT, UPDATE ON TABLES TO conejo_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA portal
  GRANT USAGE, SELECT ON SEQUENCES TO conejo_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA finanzas
  GRANT SELECT, INSERT, UPDATE ON TABLES TO conejo_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA finanzas
  GRANT USAGE, SELECT ON SEQUENCES TO conejo_app;

-- ---------------------------------------------------------------------------
-- Quien hace la peticion, visto desde la base.
--
-- La aplicacion lo declara al abrir cada transaccion (`conSesion`, en
-- src/lib/db.ts) y las politicas de seguridad por fila lo leen con estas
-- funciones. Sin sesion declarada devuelven NULL, y una politica que compara
-- contra NULL no deja pasar ninguna fila: lo seguro por defecto.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_usuario_id() RETURNS integer
  LANGUAGE sql STABLE
  AS $fn$ SELECT nullif(current_setting('app.usuario_id', true), '')::integer $fn$;

CREATE OR REPLACE FUNCTION app_rol() RETURNS text
  LANGUAGE sql STABLE
  AS $fn$ SELECT nullif(current_setting('app.rol', true), '') $fn$;

CREATE OR REPLACE FUNCTION app_cargo() RETURNS text
  LANGUAGE sql STABLE
  AS $fn$ SELECT nullif(current_setting('app.cargo', true), '') $fn$;

CREATE OR REPLACE FUNCTION app_empresa_id() RETURNS integer
  LANGUAGE sql STABLE
  AS $fn$ SELECT nullif(current_setting('app.empresa_id', true), '')::integer $fn$;

GRANT EXECUTE ON FUNCTION app_usuario_id(), app_rol(), app_cargo(), app_empresa_id()
  TO conejo_app;

-- ---------------------------------------------------------------------------
-- portal.correos_salida: cada correo que la aplicacion envia.
--
-- Es una bandeja de salida en el sentido estricto: la fila se escribe en la
-- MISMA transaccion que el cambio que provoca el correo, y la entrega ocurre
-- despues. Asi no existe un correo de «tu contrasena se restablecio» sin que
-- la contrasena se haya restablecido, ni al reves.
--
-- Con el correo en modo simulado es ademas lo que lo hace usable: nadie
-- recibe nada, y el administrador lee aqui el mensaje para entregarlo a mano.
--
-- NUNCA guarda contrasenas ni tokens. Los conjuntos cerrados tienen su espejo
-- en src/types/correo.ts.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.correos_salida (
  id               BIGSERIAL   PRIMARY KEY,

  para             TEXT        NOT NULL,
  para_usuario_id  INTEGER     REFERENCES usuarios(id),
  empresa_id       INTEGER     REFERENCES empresas(id),

  tipo             TEXT        NOT NULL,
  asunto           TEXT        NOT NULL,
  cuerpo           TEXT        NOT NULL,

  -- Con que modo se proceso, y como acabo.
  modo             TEXT        NOT NULL,
  estado           TEXT        NOT NULL,
  id_externo       TEXT,
  error            TEXT,
  intentos         SMALLINT    NOT NULL DEFAULT 0,

  -- Quien lo provoco. Nulo si lo origino el sistema.
  creado_por       INTEGER     REFERENCES usuarios(id),
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviado_en       TIMESTAMPTZ,

  -- Para el modo simulado: quien lo entrego a mano, y cuando.
  entregado_por    INTEGER     REFERENCES usuarios(id),
  entregado_en     TIMESTAMPTZ,

  CONSTRAINT correos_salida_tipo_formato
    CHECK (tipo ~ '^[a-z_]+$'),
  CONSTRAINT correos_salida_modo_valido
    CHECK (modo IN ('simulado', 'real')),
  CONSTRAINT correos_salida_estado_valido
    CHECK (estado IN ('simulado', 'pendiente', 'enviado', 'fallido')),
  CONSTRAINT correos_salida_para_no_vacio
    CHECK (length(btrim(para)) > 0),
  CONSTRAINT correos_salida_entrega_completa
    CHECK ((entregado_por IS NULL) = (entregado_en IS NULL))
);

CREATE INDEX IF NOT EXISTS correos_salida_fecha_idx
  ON portal.correos_salida (creado_en DESC, id DESC);
CREATE INDEX IF NOT EXISTS correos_salida_estado_idx
  ON portal.correos_salida (estado);

GRANT SELECT, INSERT, UPDATE ON portal.correos_salida TO conejo_app;
GRANT USAGE, SELECT ON SEQUENCE portal.correos_salida_id_seq TO conejo_app;

-- La bandeja la lee un administrador. Ademas, cada quien alcanza los correos
-- que el mismo provoco: sin eso, quien envia un correo no podria anotar
-- despues si la entrega salio bien, porque una fila que no se ve tampoco se
-- puede actualizar.
--
-- Escribir exige sesion declarada y que el correo vaya a nombre de quien la
-- declara: nadie puede dejar un correo como si lo hubiera provocado otro.
ALTER TABLE portal.correos_salida ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS correos_salida_lee_admin ON portal.correos_salida;
DROP POLICY IF EXISTS correos_salida_lee ON portal.correos_salida;
CREATE POLICY correos_salida_lee ON portal.correos_salida
  FOR SELECT TO conejo_app
  USING (app_rol() = 'admin' OR creado_por = app_usuario_id());

DROP POLICY IF EXISTS correos_salida_escribe_con_sesion ON portal.correos_salida;
DROP POLICY IF EXISTS correos_salida_escribe ON portal.correos_salida;
CREATE POLICY correos_salida_escribe ON portal.correos_salida
  FOR INSERT TO conejo_app
  WITH CHECK (creado_por = app_usuario_id());

DROP POLICY IF EXISTS correos_salida_actualiza_admin ON portal.correos_salida;
DROP POLICY IF EXISTS correos_salida_actualiza ON portal.correos_salida;
CREATE POLICY correos_salida_actualiza ON portal.correos_salida
  FOR UPDATE TO conejo_app
  USING (app_rol() = 'admin' OR creado_por = app_usuario_id())
  WITH CHECK (app_rol() = 'admin' OR creado_por = app_usuario_id());

COMMIT;

-- Comprobacion 1. Debe devolver 2: los dos esquemas existen.
SELECT count(*) AS esquemas
FROM information_schema.schemata
WHERE schema_name IN ('portal', 'finanzas');

-- Comprobacion 2. Debe devolver seguridad_por_fila = true y politicas = 3.
SELECT c.relrowsecurity AS seguridad_por_fila,
       (SELECT count(*) FROM pg_policies
         WHERE schemaname = 'portal' AND tablename = 'correos_salida') AS politicas
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'portal' AND c.relname = 'correos_salida';
