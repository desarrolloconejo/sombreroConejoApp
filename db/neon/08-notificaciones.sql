-- ===========================================================================
-- 08 — Notificaciones (la campana)
--
-- Etapa 2 del plan del portal. Crea `portal.notificaciones`: una fila por
-- aviso y por persona. Es lo que enciende la campana del panel.
--
-- Idempotente. Solo crea. Necesita los esquemas y las funciones del 07.
--
-- ORDEN: antes de subir la aplicacion, despues del 07.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- portal.notificaciones: los avisos de cada persona.
--
-- Una fila por aviso Y por destinatario: si algo se le avisa a tres
-- administradores son tres filas, porque cada uno lo lee cuando quiere.
--
-- Se escriben en la MISMA transaccion que el cambio que los provoca, igual que
-- la auditoria y los correos: no existe el aviso de algo que no ocurrio.
--
-- `href` es a donde lleva el aviso al pulsarlo. Solo admite rutas del panel:
-- un aviso no puede sacar a nadie de la aplicacion.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.notificaciones (
  id          BIGSERIAL   PRIMARY KEY,
  usuario_id  INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_id  INTEGER     REFERENCES empresas(id),

  tipo        TEXT        NOT NULL,
  titulo      TEXT        NOT NULL,
  cuerpo      TEXT,
  href        TEXT,

  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  leida_en    TIMESTAMPTZ,

  CONSTRAINT notificaciones_tipo_formato
    CHECK (tipo ~ '^[a-z_]+[.][a-z_]+$'),
  CONSTRAINT notificaciones_titulo_no_vacio
    CHECK (length(btrim(titulo)) > 0),
  CONSTRAINT notificaciones_href_interno
    CHECK (href IS NULL OR href ~ '^/dashboard(/|[?]|$)')
);

CREATE INDEX IF NOT EXISTS notificaciones_usuario_idx
  ON portal.notificaciones (usuario_id, creado_en DESC, id DESC);

-- El contador de la campana solo mira las que estan sin leer.
CREATE INDEX IF NOT EXISTS notificaciones_sin_leer_idx
  ON portal.notificaciones (usuario_id)
  WHERE leida_en IS NULL;

GRANT SELECT, INSERT, UPDATE ON portal.notificaciones TO conejo_app;
GRANT USAGE, SELECT ON SEQUENCE portal.notificaciones_id_seq TO conejo_app;

-- Cada quien ve y marca solo sus avisos; ni un administrador lee los de otro.
-- Avisar a otra persona si puede cualquiera con sesion declarada: es justo lo
-- que hace falta para que el trabajo de uno le llegue a quien lo espera.
ALTER TABLE portal.notificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notificaciones_lee ON portal.notificaciones;
CREATE POLICY notificaciones_lee ON portal.notificaciones
  FOR SELECT TO conejo_app
  USING (usuario_id = app_usuario_id());

DROP POLICY IF EXISTS notificaciones_escribe ON portal.notificaciones;
CREATE POLICY notificaciones_escribe ON portal.notificaciones
  FOR INSERT TO conejo_app
  WITH CHECK (app_usuario_id() IS NOT NULL);

DROP POLICY IF EXISTS notificaciones_marca ON portal.notificaciones;
CREATE POLICY notificaciones_marca ON portal.notificaciones
  FOR UPDATE TO conejo_app
  USING (usuario_id = app_usuario_id())
  WITH CHECK (usuario_id = app_usuario_id());

COMMIT;

-- Comprobacion. Debe devolver seguridad_por_fila = true y politicas = 3.
SELECT c.relrowsecurity AS seguridad_por_fila,
       (SELECT count(*) FROM pg_policies
         WHERE schemaname = 'portal' AND tablename = 'notificaciones') AS politicas
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'portal' AND c.relname = 'notificaciones';
