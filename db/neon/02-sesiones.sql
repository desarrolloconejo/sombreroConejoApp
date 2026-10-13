-- ===========================================================================
-- 02 — Tabla `sesiones`
--
-- Etapa 1 del plan del portal, seccion 5.1. Cada inicio de sesion pasa a tener
-- una fila aqui: es lo que permite cerrar una sesion desde el servidor
-- (cambio de contrasena, cuenta desactivada, token copiado).
--
-- Idempotente. Solo crea; no toca ninguna tabla existente.
--
-- ORDEN: pegar ANTES de subir la aplicacion. La version nueva escribe en esta
-- tabla al iniciar sesion, y sin ella nadie podria entrar.
--
-- EFECTO AL PUBLICAR: los tokens emitidos por la version anterior no llevan
-- sesion, asi que quien este dentro vuelve a entrar una vez.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS sesiones (
  id                  BIGSERIAL   PRIMARY KEY,
  usuario_id          INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

  -- Del token de renovacion solo se guarda el hash: quien lea la tabla no
  -- puede hacerse pasar por nadie.
  token_hash          TEXT        NOT NULL,

  -- El token anterior a la ultima rotacion. Si alguien lo presenta pasado el
  -- margen, es que lo copiaron: se revoca la sesion entera.
  token_anterior_hash TEXT,
  rotada_en           TIMESTAMPTZ,

  navegador           TEXT,
  creada_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_uso          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Tope absoluto: aunque se renueve, la sesion termina aqui.
  caduca_en           TIMESTAMPTZ NOT NULL,

  revocada_en         TIMESTAMPTZ,
  motivo_revocacion   TEXT,

  CONSTRAINT sesiones_token_formato
    CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT sesiones_token_anterior_formato
    CHECK (token_anterior_hash IS NULL OR token_anterior_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT sesiones_motivo_valido
    CHECK (motivo_revocacion IS NULL OR motivo_revocacion IN (
      'salida', 'cerrada_por_usuario', 'clave_cambiada', 'clave_restablecida',
      'usuario_desactivado', 'empresa_desactivada', 'vinculo_cambiado',
      'token_reutilizado'
    )),
  CONSTRAINT sesiones_revocacion_completa
    CHECK ((revocada_en IS NULL) = (motivo_revocacion IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS sesiones_token_unico
  ON sesiones (token_hash);

CREATE INDEX IF NOT EXISTS sesiones_token_anterior_idx
  ON sesiones (token_anterior_hash)
  WHERE token_anterior_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS sesiones_usuario_vivas_idx
  ON sesiones (usuario_id)
  WHERE revocada_en IS NULL;

-- Comprobacion. Debe devolver 11 (las once columnas de la tabla).
SELECT count(*) AS columnas
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'sesiones';
