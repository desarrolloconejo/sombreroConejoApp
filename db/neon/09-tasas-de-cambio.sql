-- ===========================================================================
-- 09 — Tasas de cambio
--
-- Etapa 2 del plan del portal, seccion 6.1. Crea `finanzas.tasas_cambio`, el
-- historico de lo que publica el BCV, y abre la puerta a que la tarea
-- programada —que no es ninguna persona— pueda escribir y notificar.
--
-- Idempotente. Necesita los esquemas del 07 y las notificaciones del 08.
--
-- ORDEN: antes de subir la aplicacion, despues del 08.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- finanzas.tasas_cambio: una fila por fuente, moneda y fecha valor.
--
-- Es un HISTORICO: una tasa registrada no se pisa. Cuando una factura la usa,
-- ademas la copia, asi que lo que pase despues con esta tabla no la toca.
--
-- El valor es NUMERIC, no un numero de coma flotante: son bolivares por
-- unidad de moneda, con los ocho decimales que publica el BCV, y con ellos se
-- calcula dinero.
--
-- Los conjuntos cerrados tienen su espejo en src/types/tasa.ts.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finanzas.tasas_cambio (
  id              BIGSERIAL     PRIMARY KEY,

  fuente          TEXT          NOT NULL,
  moneda          TEXT          NOT NULL,
  fecha_valor     DATE          NOT NULL,
  valor           NUMERIC(20,8) NOT NULL,

  -- Como llego: la leyo la aplicacion de la pagina, o la escribio una persona.
  origen          TEXT          NOT NULL,
  registrada_por  INTEGER       REFERENCES usuarios(id),
  obtenida_en     TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT tasas_cambio_fuente_valida
    CHECK (fuente IN ('bcv')),
  CONSTRAINT tasas_cambio_moneda_formato
    CHECK (moneda ~ '^[A-Z]{3}$'),
  CONSTRAINT tasas_cambio_valor_positivo
    CHECK (valor > 0),
  CONSTRAINT tasas_cambio_origen_valido
    CHECK (origen IN ('automatica', 'manual')),
  -- Una tasa escrita a mano tiene que decir quien la escribio.
  CONSTRAINT tasas_cambio_manual_con_autor
    CHECK (origen <> 'manual' OR registrada_por IS NOT NULL),
  CONSTRAINT tasas_cambio_unica
    UNIQUE (fuente, moneda, fecha_valor)
);

CREATE INDEX IF NOT EXISTS tasas_cambio_recientes_idx
  ON finanzas.tasas_cambio (moneda, fecha_valor DESC);

GRANT SELECT, INSERT ON finanzas.tasas_cambio TO conejo_app;
REVOKE UPDATE ON finanzas.tasas_cambio FROM conejo_app;
GRANT USAGE, SELECT ON SEQUENCE finanzas.tasas_cambio_id_seq TO conejo_app;

-- La tasa del dia no es un secreto: la lee cualquiera con sesion, y tambien
-- la tarea programada. Escribirla, solo quien opera finanzas y esa tarea.
--
-- `sistema` es la identidad con la que la aplicacion actua cuando no hay
-- ninguna persona detras (`conSistema`, en src/lib/db.ts).
ALTER TABLE finanzas.tasas_cambio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tasas_cambio_lee ON finanzas.tasas_cambio;
CREATE POLICY tasas_cambio_lee ON finanzas.tasas_cambio
  FOR SELECT TO conejo_app
  USING (app_usuario_id() IS NOT NULL OR app_rol() = 'sistema');

DROP POLICY IF EXISTS tasas_cambio_escribe ON finanzas.tasas_cambio;
CREATE POLICY tasas_cambio_escribe ON finanzas.tasas_cambio
  FOR INSERT TO conejo_app
  WITH CHECK (
    app_rol() IN ('admin', 'sistema') OR app_cargo() = 'administracion'
  );

-- La tarea programada tambien notifica: cuando lee algo raro, se lo dice a
-- los administradores. Se amplia la politica del 08 para dejarla.
DROP POLICY IF EXISTS notificaciones_escribe ON portal.notificaciones;
CREATE POLICY notificaciones_escribe ON portal.notificaciones
  FOR INSERT TO conejo_app
  WITH CHECK (app_usuario_id() IS NOT NULL OR app_rol() = 'sistema');

COMMIT;

-- Comprobacion 1. Debe devolver seguridad_por_fila = true y politicas = 2.
SELECT c.relrowsecurity AS seguridad_por_fila,
       (SELECT count(*) FROM pg_policies
         WHERE schemaname = 'finanzas' AND tablename = 'tasas_cambio') AS politicas
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'finanzas' AND c.relname = 'tasas_cambio';

-- Comprobacion 2. Debe devolver INSERT, SELECT: las tasas no se modifican.
SELECT string_agg(privilege_type, ', ' ORDER BY privilege_type) AS permisos
FROM information_schema.role_table_grants
WHERE grantee = 'conejo_app'
  AND table_schema = 'finanzas' AND table_name = 'tasas_cambio';
