-- ===========================================================================
-- 10 — Verificacion en dos pasos
--
-- Seccion 5.3 del plan del portal. Tras la contrasena, quien lo tenga activado
-- escribe un codigo de seis digitos de su app de codigos (Google
-- Authenticator, Microsoft Authenticator, Authy).
--
--   1. Cuatro columnas en `usuarios`: el secreto (cifrado), cuando se
--      activo, el ultimo codigo usado y si la persona prefirio no usarlos.
--   2. La tabla `codigos_respaldo`: diez codigos de un solo uso por persona,
--      para cuando no tenga el telefono.
--   3. `vw_usuarios_acceso` gana tres columnas, que solo lee el login.
--
-- Idempotente. Solo anade, y la version publicada no se entera. Necesita el
-- rol y la vista del 05.
--
-- EFECTO AL PUBLICAR: los dos pasos se piden por defecto. La primera vez que
-- cada persona entre con la version nueva vera la pantalla para
-- configurarlos, con la opcion de entrar sin usarlos.
--
-- ORDEN: antes de subir la aplicacion, despues del 05.
-- ===========================================================================

BEGIN;

-- El secreto NO va en claro: va cifrado con una clave que vive en una variable
-- de entorno (TOTP_CLAVE). Quien lea la tabla no puede generar codigos.
--
--   totp_secreto       el secreto compartido con la app, cifrado. Existe desde
--                      que se empieza a activar.
--   totp_activado_en   cuando se confirmo con un codigo. Nulo = sin activar,
--                      aunque haya secreto: la activacion quedo a medias.
--   totp_ultimo_paso   el intervalo de 30 segundos del ultimo codigo aceptado.
--                      Un codigo no vale dos veces, ni dentro de su ventana.
--   dos_pasos_omitido  la persona dijo que prefiere no usarlos.
--
-- LOS DOS PASOS SE PIDEN POR DEFECTO. `dos_pasos_omitido` nace en falso para
-- todo el mundo, tambien para las cuentas que ya existen: al entrar, quien no
-- los tenga activados vera la pantalla para configurarlos, y ahi mismo puede
-- decir que no. Sin esta columna no habria forma de distinguir «aun no se lo
-- hemos preguntado» de «ya dijo que no», y se le preguntaria en cada entrada.
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS totp_secreto      TEXT,
  ADD COLUMN IF NOT EXISTS totp_activado_en  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS totp_ultimo_paso  BIGINT,
  ADD COLUMN IF NOT EXISTS dos_pasos_omitido BOOLEAN NOT NULL DEFAULT FALSE;

DO $dospasos$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_totp_activado_con_secreto'
  ) THEN
    ALTER TABLE usuarios
      ADD CONSTRAINT usuarios_totp_activado_con_secreto
      CHECK (totp_activado_en IS NULL OR totp_secreto IS NOT NULL);
  END IF;
END
$dospasos$;

-- ---------------------------------------------------------------------------
-- codigos_respaldo: la salida para quien no tiene el telefono a mano.
--
-- Se guarda el hash, no el codigo: se muestran una sola vez, al activar. Cada
-- uno sirve una vez; al usarlo se marca, no se borra, para que quede cuando.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS codigos_respaldo (
  id          BIGSERIAL   PRIMARY KEY,
  usuario_id  INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  codigo_hash TEXT        NOT NULL,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  usado_en    TIMESTAMPTZ,

  CONSTRAINT codigos_respaldo_hash_formato CHECK (codigo_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT codigos_respaldo_unico UNIQUE (usuario_id, codigo_hash)
);

CREATE INDEX IF NOT EXISTS codigos_respaldo_vivos_idx
  ON codigos_respaldo (usuario_id)
  WHERE usado_en IS NULL;

-- Con DELETE: al desactivar los dos pasos, o al volver a activarlos, los
-- codigos anteriores se retiran.
GRANT SELECT, INSERT, UPDATE, DELETE ON codigos_respaldo TO conejo_app;
GRANT USAGE, SELECT ON SEQUENCE codigos_respaldo_id_seq TO conejo_app;

-- La vista del login gana lo que necesita el segundo paso. Las columnas
-- nuevas van AL FINAL: es lo que CREATE OR REPLACE VIEW permite sin soltarla.
CREATE OR REPLACE VIEW vw_usuarios_acceso
WITH (security_invoker = true) AS
SELECT
  u.id,
  u.password_hash,
  (u.bloqueado_hasta IS NOT NULL AND u.bloqueado_hasta > now()) AS bloqueado,
  u.totp_secreto,
  (u.totp_activado_en IS NOT NULL) AS dos_pasos,
  u.totp_ultimo_paso
FROM usuarios u;

COMMIT;

-- Comprobacion 1. Debe devolver con_dos_pasos = 0 y los_omitieron = 0: nadie
-- los tiene activados todavia, y a nadie se le ha preguntado.
SELECT count(*) FILTER (WHERE totp_activado_en IS NOT NULL) AS con_dos_pasos,
       count(*) FILTER (WHERE dos_pasos_omitido)            AS los_omitieron
FROM usuarios;

-- Comprobacion 2. Debe devolver DELETE, INSERT, SELECT, UPDATE.
SELECT string_agg(privilege_type, ', ' ORDER BY privilege_type) AS permisos
FROM information_schema.role_table_grants
WHERE grantee = 'conejo_app' AND table_name = 'codigos_respaldo';
