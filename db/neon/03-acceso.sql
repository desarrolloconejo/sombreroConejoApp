-- ===========================================================================
-- 03 — Bloqueo por intentos y cambio obligatorio de contrasena
--
-- Etapa 1 del plan del portal, huecos 3 y 4. Anade tres columnas a `usuarios`
-- y las expone en la vista `vw_usuarios_completos`.
--
-- Idempotente. Las tres columnas traen un valor por defecto que no cambia
-- nada para las cuentas que ya existen: nadie queda bloqueado ni obligado a
-- cambiar su contrasena al pegar esto.
--
-- ORDEN: pegar ANTES de subir la aplicacion. La version nueva lee estas
-- columnas al iniciar sesion.
--
-- La vista se suelta y se vuelve a crear porque CREATE OR REPLACE VIEW no
-- admite anadir columnas en medio. Va todo en una transaccion: si algo
-- falla, la vista anterior sigue en su sitio.
-- ===========================================================================

BEGIN;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS debe_cambiar_clave BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS intentos_fallidos  SMALLINT    NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bloqueado_hasta    TIMESTAMPTZ;

DO $acceso$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_intentos_no_negativos'
  ) THEN
    ALTER TABLE usuarios
      ADD CONSTRAINT usuarios_intentos_no_negativos CHECK (intentos_fallidos >= 0);
  END IF;
END
$acceso$;

DROP VIEW IF EXISTS vw_usuarios_completos;

CREATE OR REPLACE VIEW vw_usuarios_completos AS
SELECT
  u.id,
  u.nombre,
  u.apellido,
  u.email,
  u.password_hash,
  u.telefono,
  u.foto_url,
  u.tema,
  u.activo,
  u.ultimo_acceso,
  u.creado_en,
  u.actualizado_en,
  u.debe_cambiar_clave,
  u.bloqueado_hasta,
  CASE
    WHEN t.id IS NOT NULL THEN 'trabajador'
    WHEN c.id IS NOT NULL THEN 'cliente'
  END                                        AS tipo,
  CASE
    WHEN t.id IS NOT NULL THEN r.nombre
    WHEN c.id IS NOT NULL THEN 'cliente'
  END                                        AS rol,
  COALESCE(g.nombre, c.cargo)                AS cargo,
  g.slug                                     AS cargo_slug,
  t.cargo_id,
  t.fecha_ingreso,
  c.empresa_id,
  e.nombre                                   AS empresa_nombre,
  e.activo                                   AS empresa_activa
FROM usuarios u
LEFT JOIN trabajadores t ON t.usuario_id = u.id
LEFT JOIN roles        r ON r.id         = t.rol_id
LEFT JOIN cargos       g ON g.id         = t.cargo_id
LEFT JOIN clientes     c ON c.usuario_id = u.id
LEFT JOIN empresas     e ON e.id         = c.empresa_id;

COMMIT;

-- Comprobacion. Debe devolver una fila: 0 bloqueadas y 0 pendientes de cambio.
SELECT
  count(*) FILTER (WHERE bloqueado_hasta IS NOT NULL) AS bloqueadas,
  count(*) FILTER (WHERE debe_cambiar_clave)          AS pendientes_de_cambio
FROM vw_usuarios_completos;
