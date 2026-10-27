-- ===========================================================================
-- 22 — Lecturas de la tasa
--
-- Crea `finanzas.lecturas_tasa`: una fila por cada vez que corre la tarea
-- diaria del BCV, tambien cuando no trae nada nuevo o la lectura se rechaza.
-- Con ella Ajustes de finanzas dice si la app ya leyo la tasa hoy, como le
-- fue y cuando vuelve, para que quien opera finanzas sepa si le toca
-- registrarla a mano.
--
-- Idempotente. Solo anade: la version publicada no la usa. No inserta datos.
--
-- ORDEN: antes de subir la aplicacion, despues del 21.
-- ===========================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS finanzas.lecturas_tasa (
  id           BIGSERIAL     PRIMARY KEY,
  leida_en     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  resultado    TEXT          NOT NULL,
  fecha_valor  DATE,
  motivo       TEXT,

  CONSTRAINT lecturas_tasa_resultado_valido
    CHECK (resultado IN ('registrada', 'sin_novedad', 'rechazada')),
  CONSTRAINT lecturas_tasa_rechazo_con_motivo
    CHECK (resultado <> 'rechazada' OR motivo IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS lecturas_tasa_recientes_idx
  ON finanzas.lecturas_tasa (leida_en DESC);

GRANT SELECT, INSERT ON finanzas.lecturas_tasa TO conejo_app;
REVOKE UPDATE ON finanzas.lecturas_tasa FROM conejo_app;
GRANT USAGE, SELECT ON SEQUENCE finanzas.lecturas_tasa_id_seq TO conejo_app;

-- La escribe solo la tarea programada (rol sistema). La lee quien opera
-- finanzas: el administrador y el cargo administracion.
ALTER TABLE finanzas.lecturas_tasa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lecturas_tasa_lee ON finanzas.lecturas_tasa;
CREATE POLICY lecturas_tasa_lee ON finanzas.lecturas_tasa
  FOR SELECT TO conejo_app
  USING (app_rol() IN ('admin', 'sistema') OR app_cargo() = 'administracion');

DROP POLICY IF EXISTS lecturas_tasa_escribe ON finanzas.lecturas_tasa;
CREATE POLICY lecturas_tasa_escribe ON finanzas.lecturas_tasa
  FOR INSERT TO conejo_app
  WITH CHECK (app_rol() = 'sistema');

COMMIT;

-- Comprobacion. Debe devolver seguridad_por_fila = true, politicas = 2 y
-- permisos = INSERT, SELECT.
SELECT c.relrowsecurity AS seguridad_por_fila,
       (SELECT count(*) FROM pg_policies
         WHERE schemaname = 'finanzas' AND tablename = 'lecturas_tasa') AS politicas,
       (SELECT string_agg(privilege_type, ', ' ORDER BY privilege_type)
          FROM information_schema.role_table_grants
         WHERE grantee = 'conejo_app'
           AND table_schema = 'finanzas' AND table_name = 'lecturas_tasa') AS permisos
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'finanzas' AND c.relname = 'lecturas_tasa';
