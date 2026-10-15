-- ===========================================================================
-- 15 — Briefs
--
-- Etapa 6 del plan del portal. Anade los briefs y lo que los rodea:
-- prospectos y sus enlaces privados, las versiones congeladas al enviar, el
-- hilo de aclaraciones, la columna brief_id en proyectos y presupuestos, y
-- las funciones que guardan, envian y convierten. Tambien la funcion
-- app_enlace_id(), con la que la base reconoce a un prospecto, y las
-- politicas de la campana y de la bandeja de salida ampliadas para que un
-- prospecto avise y encole la copia de su brief.
--
-- Idempotente. Solo anade: tablas y funciones nuevas, tres columnas que
-- nacen vacias y la version publicada ignora, y politicas que dejan pasar
-- lo mismo que antes mas el rol prospecto.
--
-- ORDEN: antes de subir la aplicacion, despues del 14.
-- ===========================================================================

BEGIN;

-- ===========================================================================
-- BRIEFS
--
-- Etapa 6 del plan del portal. Lo que un cliente —o un prospecto, por un
-- enlace privado— pide por escrito antes de que exista un proyecto. Reglas:
-- appFacturas/docs/05-briefs.md, con los supuestos S-04 a S-09.
--
-- Lo que la base impone por si misma:
--
--   - Enviar pasa por `portal.enviar_brief`: la fecha de envio es la del
--     servidor, el codigo ECS-AAAAMMDD-XXXXXX lo pone la base con la fecha de
--     Caracas, y la fecha aspirada no puede ser anterior al dia de envio.
--   - Una version enviada no se edita ni se borra (disparador): es la copia
--     exacta de lo que se mando, con su hash.
--   - El codigo de un brief no cambia, y un brief enviado no se borra: se
--     descarta con motivo.
--   - Quien llena no tiene UPDATE sobre briefs: guarda su borrador con
--     `portal.guardar_borrador_brief`. El UPDATE es de quien decide.
--
-- Un prospecto no tiene cuenta. Entra por su enlace y la aplicacion declara a
-- la base el rol `prospecto` con el id del enlace (`conEnlace`, src/lib/db.ts):
-- las politicas le dejan ver su brief y nada mas.
--
-- Los conjuntos cerrados tienen su espejo en src/types/brief.ts.
-- ===========================================================================

-- El enlace con el que entra un prospecto, o NULL.
CREATE OR REPLACE FUNCTION app_enlace_id() RETURNS integer
  LANGUAGE sql STABLE
  AS $fn$ SELECT nullif(current_setting('app.enlace_id', true), '')::integer $fn$;

GRANT EXECUTE ON FUNCTION app_enlace_id() TO conejo_app;

-- ---------------------------------------------------------------------------
-- portal.prospectos: quien pide un brief sin ser todavia cliente.
--
-- Al aceptarse su brief se convierte: nace su empresa (`empresa_id`) y,
-- despues, su cuenta.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.prospectos (
  id               SERIAL      PRIMARY KEY,
  empresa_nombre   TEXT        NOT NULL,
  contacto_nombre  TEXT        NOT NULL,
  email            TEXT        NOT NULL,
  telefono         TEXT,
  empresa_id       INTEGER     REFERENCES empresas(id),
  creado_por       INTEGER     NOT NULL REFERENCES usuarios(id),
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT prospectos_empresa_no_vacia CHECK (length(btrim(empresa_nombre)) > 0),
  CONSTRAINT prospectos_contacto_no_vacio CHECK (length(btrim(contacto_nombre)) > 0),
  CONSTRAINT prospectos_email_formato CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- ---------------------------------------------------------------------------
-- portal.enlaces_brief: el enlace privado de un prospecto.
--
-- Solo se guarda el hash del token (SHA-256, en hexadecimal): el token viaja
-- una vez, en el enlace. Atado a un formato y a un correo, vence a los 7 dias
-- (se renueva con cada mensaje del ejecutivo, S-06) y se puede revocar.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.enlaces_brief (
  id               SERIAL      PRIMARY KEY,
  token_hash       TEXT        NOT NULL UNIQUE,
  prospecto_id     INTEGER     NOT NULL REFERENCES portal.prospectos(id),
  formato          TEXT        NOT NULL,
  formato_version  SMALLINT    NOT NULL,
  vence_en         TIMESTAMPTZ NOT NULL,
  revocado_en      TIMESTAMPTZ,
  creado_por       INTEGER     NOT NULL REFERENCES usuarios(id),
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT enlaces_brief_hash_formato CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT enlaces_brief_formato_clave CHECK (formato ~ '^[a-z][a-z-]*$')
);

-- ---------------------------------------------------------------------------
-- portal.briefs
--
-- Estados (S-07): borrador -> enviado (en la bandeja, «fase 0») -> aceptado
-- y en validacion (proyecto abierto, fase 1) -> validado (fase 1 completa).
-- Desde enviado tambien: en presupuesto, o descartado con motivo.
--
-- El borrador vive en la propia fila (`borrador`, la fecha aspirada que se
-- va escribiendo, quien lleno cada paso). Al enviar se congela en
-- brief_versiones; una version 2 vuelve a abrir el borrador con lo ultimo
-- enviado.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.briefs (
  id                       SERIAL      PRIMARY KEY,
  codigo                   TEXT        UNIQUE,
  formato                  TEXT        NOT NULL,
  formato_version          SMALLINT    NOT NULL,
  empresa_id               INTEGER     REFERENCES empresas(id),
  prospecto_id             INTEGER     REFERENCES portal.prospectos(id),
  enlace_id                INTEGER     REFERENCES portal.enlaces_brief(id),

  estado                   TEXT        NOT NULL DEFAULT 'borrador',
  version_actual           SMALLINT    NOT NULL DEFAULT 0,

  borrador                 JSONB       NOT NULL DEFAULT '{}'::jsonb,
  borrador_abierto         BOOLEAN     NOT NULL DEFAULT TRUE,
  fecha_aspirada_borrador  DATE,
  autores                  JSONB       NOT NULL DEFAULT '{}'::jsonb,

  fecha_aspirada           DATE,
  fecha_propuesta          DATE,
  motivo_fecha_propuesta   TEXT,
  motivo_descarte          TEXT,

  proyecto_id              INTEGER     REFERENCES portal.proyectos(id),

  creado_por               INTEGER     REFERENCES usuarios(id),
  creado_en                TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviado_en               TIMESTAMPTZ,
  resuelto_por             INTEGER     REFERENCES usuarios(id),
  resuelto_en              TIMESTAMPTZ,

  CONSTRAINT briefs_estado_valido CHECK (estado IN
    ('borrador', 'enviado', 'en_validacion', 'en_presupuesto', 'aceptado', 'descartado')),
  CONSTRAINT briefs_codigo_formato CHECK (codigo IS NULL OR codigo ~ '^ECS-[0-9]{8}-[0-9A-F]{6}$'),
  -- De una empresa o de un prospecto; un prospecto convertido tiene las dos.
  CONSTRAINT briefs_solicitante CHECK (empresa_id IS NOT NULL OR prospecto_id IS NOT NULL),
  CONSTRAINT briefs_envio_completo CHECK (
    (estado = 'borrador') = (codigo IS NULL)
    AND (codigo IS NULL) = (enviado_en IS NULL)
    AND (codigo IS NULL) = (version_actual = 0)
    AND (codigo IS NULL OR fecha_aspirada IS NOT NULL)
  ),
  CONSTRAINT briefs_descarte_con_motivo CHECK (
    estado <> 'descartado' OR length(btrim(coalesce(motivo_descarte, ''))) > 0
  ),
  CONSTRAINT briefs_fecha_propuesta_con_motivo CHECK (
    fecha_propuesta IS NULL OR length(btrim(coalesce(motivo_fecha_propuesta, ''))) > 0
  ),
  CONSTRAINT briefs_formato_clave CHECK (formato ~ '^[a-z][a-z-]*$')
);

CREATE INDEX IF NOT EXISTS briefs_empresa_idx ON portal.briefs (empresa_id, estado);
CREATE INDEX IF NOT EXISTS briefs_prospecto_idx ON portal.briefs (prospecto_id);
CREATE UNIQUE INDEX IF NOT EXISTS briefs_un_brief_por_enlace
  ON portal.briefs (enlace_id) WHERE enlace_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- portal.brief_versiones: lo que se envio, congelado con el texto exacto de
-- cada pregunta y su hash. Una por envio; la 2 y siguientes conservan el
-- codigo del brief.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.brief_versiones (
  id                  SERIAL      PRIMARY KEY,
  brief_id            INTEGER     NOT NULL REFERENCES portal.briefs(id),
  numero              SMALLINT    NOT NULL,
  contenido           JSONB       NOT NULL,
  contenido_sha256    TEXT        NOT NULL,
  -- Las respuestas tal cual, para abrir la version siguiente con ellas.
  respuestas          JSONB       NOT NULL,
  autores             JSONB       NOT NULL DEFAULT '{}'::jsonb,
  fecha_aspirada      DATE        NOT NULL,
  enviado_en          TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviado_por         INTEGER     REFERENCES usuarios(id),
  enviado_por_nombre  TEXT        NOT NULL,

  CONSTRAINT brief_versiones_numero_unico UNIQUE (brief_id, numero),
  CONSTRAINT brief_versiones_numero_valido CHECK (numero >= 1),
  CONSTRAINT brief_versiones_hash_formato CHECK (contenido_sha256 ~ '^[0-9a-f]{64}$')
);

-- ---------------------------------------------------------------------------
-- portal.brief_aclaraciones: el hilo entre el ejecutivo y quien pidio el
-- brief. Un prospecto escribe sin usuario: queda su nombre.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.brief_aclaraciones (
  id            SERIAL      PRIMARY KEY,
  brief_id      INTEGER     NOT NULL REFERENCES portal.briefs(id),
  autor_id      INTEGER     REFERENCES usuarios(id),
  autor_nombre  TEXT        NOT NULL,
  del_equipo    BOOLEAN     NOT NULL,
  texto         TEXT        NOT NULL,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT brief_aclaraciones_texto_no_vacio CHECK (length(btrim(texto)) > 0)
);

CREATE INDEX IF NOT EXISTS brief_aclaraciones_brief_idx ON portal.brief_aclaraciones (brief_id, creado_en);

-- Un proyecto y un presupuesto pueden nacer de un brief.
ALTER TABLE portal.proyectos ADD COLUMN IF NOT EXISTS brief_id INTEGER REFERENCES portal.briefs(id);
ALTER TABLE finanzas.presupuestos ADD COLUMN IF NOT EXISTS brief_id INTEGER REFERENCES portal.briefs(id);

-- ---------------------------------------------------------------------------
-- Inmutabilidad.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.versiones_brief_inmutables()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $fn$
  BEGIN
    RAISE EXCEPTION 'Una version enviada de un brief no se modifica'
      USING ERRCODE = 'check_violation';
  END
  $fn$;

DROP TRIGGER IF EXISTS brief_versiones_inmutables ON portal.brief_versiones;
CREATE TRIGGER brief_versiones_inmutables
  BEFORE UPDATE OR DELETE ON portal.brief_versiones
  FOR EACH ROW EXECUTE FUNCTION portal.versiones_brief_inmutables();

-- El codigo y la fecha del primer envio no cambian; lo descartado o validado
-- es final, y lo enviado no vuelve a borrador.
CREATE OR REPLACE FUNCTION portal.briefs_coherentes()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $fn$
  BEGIN
    IF OLD.codigo IS NOT NULL AND NEW.codigo IS DISTINCT FROM OLD.codigo THEN
      RAISE EXCEPTION 'El codigo de un brief no cambia' USING ERRCODE = 'check_violation';
    END IF;
    IF OLD.enviado_en IS NOT NULL AND NEW.enviado_en IS DISTINCT FROM OLD.enviado_en THEN
      RAISE EXCEPTION 'La fecha de envio no cambia' USING ERRCODE = 'check_violation';
    END IF;
    IF OLD.estado IN ('descartado', 'aceptado') AND NEW.estado IS DISTINCT FROM OLD.estado THEN
      RAISE EXCEPTION 'Un brief descartado o validado no cambia de estado'
        USING ERRCODE = 'check_violation';
    END IF;
    IF OLD.estado <> 'borrador' AND NEW.estado = 'borrador' THEN
      RAISE EXCEPTION 'Un brief enviado no vuelve a borrador' USING ERRCODE = 'check_violation';
    END IF;
    IF OLD.formato IS DISTINCT FROM NEW.formato OR OLD.formato_version IS DISTINCT FROM NEW.formato_version THEN
      RAISE EXCEPTION 'El formato de un brief no cambia' USING ERRCODE = 'check_violation';
    END IF;
    NEW.actualizado_en := now();
    RETURN NEW;
  END
  $fn$;

DROP TRIGGER IF EXISTS briefs_coherentes ON portal.briefs;
CREATE TRIGGER briefs_coherentes
  BEFORE UPDATE ON portal.briefs
  FOR EACH ROW EXECUTE FUNCTION portal.briefs_coherentes();

-- ---------------------------------------------------------------------------
-- Quien ve y quien decide. SECURITY DEFINER: las politicas de las tablas del
-- brief lo preguntan aqui, sin consultarse unas a otras.
-- ---------------------------------------------------------------------------

-- Quien genero el enlace de un brief de prospecto.
CREATE OR REPLACE FUNCTION portal.creo_el_enlace(p_enlace integer)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT EXISTS (
      SELECT 1 FROM portal.enlaces_brief e
      WHERE e.id = p_enlace AND e.creado_por = app_usuario_id()
    )
  $fn$;

-- Quien decide sobre un brief: el admin, el ejecutivo de su empresa o quien
-- genero el enlace del prospecto.
CREATE OR REPLACE FUNCTION portal.gestiona_brief(p_brief integer)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT EXISTS (
      SELECT 1 FROM portal.briefs b
      WHERE b.id = p_brief
        AND (
          app_rol() = 'admin'
          OR (b.empresa_id IS NOT NULL AND portal.gestiona_empresa(b.empresa_id))
          OR (b.enlace_id IS NOT NULL AND portal.creo_el_enlace(b.enlace_id))
        )
    )
  $fn$;

-- Quien lo llena: un cliente de su empresa, el prospecto de su enlace, o el
-- ejecutivo que lo empezo a nombre del cliente (S-04).
CREATE OR REPLACE FUNCTION portal.llena_brief(p_brief integer)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT EXISTS (
      SELECT 1 FROM portal.briefs b
      WHERE b.id = p_brief
        AND (
          (app_rol() = 'cliente' AND b.empresa_id = app_empresa_id())
          OR (app_rol() = 'prospecto' AND b.enlace_id = app_enlace_id())
          OR portal.gestiona_brief(p_brief)
        )
    )
  $fn$;

-- Quien lo ve: quien lo llena o lo decide, y quien opera finanzas cuando ya
-- se envio (para armar su presupuesto).
CREATE OR REPLACE FUNCTION portal.ve_brief(p_brief integer)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT portal.llena_brief(p_brief) OR EXISTS (
      SELECT 1 FROM portal.briefs b
      WHERE b.id = p_brief AND b.estado <> 'borrador' AND finanzas.es_operador()
    )
  $fn$;

REVOKE ALL ON FUNCTION
  portal.creo_el_enlace(integer), portal.gestiona_brief(integer),
  portal.llena_brief(integer), portal.ve_brief(integer)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  portal.creo_el_enlace(integer), portal.gestiona_brief(integer),
  portal.llena_brief(integer), portal.ve_brief(integer)
  TO conejo_app;

-- ---------------------------------------------------------------------------
-- Permisos. Los briefs se escriben con sus funciones; el UPDATE directo es de
-- quien decide. Nada se borra.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON portal.prospectos, portal.enlaces_brief, portal.briefs TO conejo_app;
GRANT SELECT, INSERT ON portal.brief_aclaraciones TO conejo_app;
GRANT SELECT ON portal.brief_versiones TO conejo_app;
REVOKE INSERT, UPDATE, DELETE ON portal.brief_versiones FROM conejo_app;
REVOKE UPDATE, DELETE ON portal.brief_aclaraciones FROM conejo_app;
GRANT USAGE, SELECT ON SEQUENCE
  portal.prospectos_id_seq, portal.enlaces_brief_id_seq, portal.briefs_id_seq,
  portal.brief_aclaraciones_id_seq
  TO conejo_app;

ALTER TABLE portal.prospectos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.enlaces_brief      ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.briefs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.brief_versiones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.brief_aclaraciones ENABLE ROW LEVEL SECURITY;

-- Prospectos y enlaces: los ve quien los creo, y el admin. Los crea el admin
-- o un ejecutivo de cuentas.
DROP POLICY IF EXISTS prospectos_lee ON portal.prospectos;
CREATE POLICY prospectos_lee ON portal.prospectos
  FOR SELECT TO conejo_app
  USING (
    app_rol() = 'admin' OR creado_por = app_usuario_id()
    OR (app_rol() = 'prospecto' AND EXISTS (
      SELECT 1 FROM portal.enlaces_brief e
      WHERE e.id = app_enlace_id() AND e.prospecto_id = prospectos.id))
  );

DROP POLICY IF EXISTS prospectos_crea ON portal.prospectos;
CREATE POLICY prospectos_crea ON portal.prospectos
  FOR INSERT TO conejo_app
  WITH CHECK (
    creado_por = app_usuario_id()
    AND (app_rol() = 'admin' OR (app_rol() = 'trabajador' AND app_cargo() = 'cuentas'))
  );

DROP POLICY IF EXISTS prospectos_edita ON portal.prospectos;
CREATE POLICY prospectos_edita ON portal.prospectos
  FOR UPDATE TO conejo_app
  USING (app_rol() = 'admin' OR creado_por = app_usuario_id())
  WITH CHECK (app_rol() = 'admin' OR creado_por = app_usuario_id());

DROP POLICY IF EXISTS enlaces_brief_lee ON portal.enlaces_brief;
CREATE POLICY enlaces_brief_lee ON portal.enlaces_brief
  FOR SELECT TO conejo_app
  USING (
    app_rol() = 'admin' OR creado_por = app_usuario_id()
    OR (app_rol() = 'prospecto' AND id = app_enlace_id())
  );

DROP POLICY IF EXISTS enlaces_brief_crea ON portal.enlaces_brief;
CREATE POLICY enlaces_brief_crea ON portal.enlaces_brief
  FOR INSERT TO conejo_app
  WITH CHECK (
    creado_por = app_usuario_id()
    AND (app_rol() = 'admin' OR (app_rol() = 'trabajador' AND app_cargo() = 'cuentas'))
  );

-- Revocar o renovar: quien lo creo, y el admin.
DROP POLICY IF EXISTS enlaces_brief_edita ON portal.enlaces_brief;
CREATE POLICY enlaces_brief_edita ON portal.enlaces_brief
  FOR UPDATE TO conejo_app
  USING (app_rol() = 'admin' OR creado_por = app_usuario_id())
  WITH CHECK (app_rol() = 'admin' OR creado_por = app_usuario_id());

-- Briefs. Las politicas miran las columnas de la propia fila, no la tabla:
-- consultarla por id dejaria fuera la fila que se esta insertando, y un
-- INSERT ... RETURNING no podria leer lo que acaba de escribir. Las tablas
-- hijas si preguntan a ve_brief y llena_brief.
DROP POLICY IF EXISTS briefs_lee ON portal.briefs;
CREATE POLICY briefs_lee ON portal.briefs
  FOR SELECT TO conejo_app
  USING (
    app_rol() = 'admin'
    OR (empresa_id IS NOT NULL AND portal.gestiona_empresa(empresa_id))
    OR (enlace_id IS NOT NULL AND portal.creo_el_enlace(enlace_id))
    OR (app_rol() = 'cliente' AND empresa_id = app_empresa_id())
    OR (app_rol() = 'prospecto' AND enlace_id = app_enlace_id())
    OR (estado <> 'borrador' AND finanzas.es_operador())
  );

DROP POLICY IF EXISTS briefs_crea ON portal.briefs;
CREATE POLICY briefs_crea ON portal.briefs
  FOR INSERT TO conejo_app
  WITH CHECK (
    estado = 'borrador' AND codigo IS NULL
    AND (
      (app_rol() = 'cliente' AND empresa_id = app_empresa_id() AND creado_por = app_usuario_id())
      OR (app_rol() = 'prospecto' AND enlace_id = app_enlace_id() AND creado_por IS NULL)
      OR (empresa_id IS NOT NULL AND portal.gestiona_empresa(empresa_id)
          AND creado_por = app_usuario_id())
    )
  );

DROP POLICY IF EXISTS briefs_decide ON portal.briefs;
CREATE POLICY briefs_decide ON portal.briefs
  FOR UPDATE TO conejo_app
  USING (
    app_rol() = 'admin'
    OR (empresa_id IS NOT NULL AND portal.gestiona_empresa(empresa_id))
    OR (enlace_id IS NOT NULL AND portal.creo_el_enlace(enlace_id))
  )
  WITH CHECK (
    app_rol() = 'admin'
    OR (empresa_id IS NOT NULL AND portal.gestiona_empresa(empresa_id))
    OR (enlace_id IS NOT NULL AND portal.creo_el_enlace(enlace_id))
  );

DROP POLICY IF EXISTS brief_versiones_lee ON portal.brief_versiones;
CREATE POLICY brief_versiones_lee ON portal.brief_versiones
  FOR SELECT TO conejo_app
  USING (portal.ve_brief(brief_id));

DROP POLICY IF EXISTS brief_aclaraciones_lee ON portal.brief_aclaraciones;
CREATE POLICY brief_aclaraciones_lee ON portal.brief_aclaraciones
  FOR SELECT TO conejo_app
  USING (portal.llena_brief(brief_id));

-- Escribe en el hilo quien lo llena o lo decide, a su nombre; el prospecto,
-- sin usuario. Solo en un brief ya enviado.
DROP POLICY IF EXISTS brief_aclaraciones_escribe ON portal.brief_aclaraciones;
CREATE POLICY brief_aclaraciones_escribe ON portal.brief_aclaraciones
  FOR INSERT TO conejo_app
  WITH CHECK (
    portal.llena_brief(brief_id)
    AND EXISTS (SELECT 1 FROM portal.briefs b WHERE b.id = brief_id AND b.estado <> 'borrador')
    AND (
      (app_rol() = 'prospecto' AND autor_id IS NULL AND NOT del_equipo)
      OR (autor_id = app_usuario_id() AND del_equipo = (app_rol() <> 'cliente'))
    )
  );

-- ---------------------------------------------------------------------------
-- El enlace de un token, si sigue valido. Es lo unico que se consulta sin
-- identidad: quien llega por el enlace aun no es nadie para la base. Devuelve
-- vacio si no existe, vencio o se revoco, sin decir cual de las tres.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.enlace_por_token(p_hash text)
  RETURNS TABLE (id integer, prospecto_id integer, formato text, formato_version smallint)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT e.id, e.prospecto_id, e.formato, e.formato_version
    FROM portal.enlaces_brief e
    WHERE e.token_hash = p_hash AND e.revocado_en IS NULL AND e.vence_en > now()
  $fn$;

REVOKE ALL ON FUNCTION portal.enlace_por_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION portal.enlace_por_token(text) TO conejo_app;

-- ---------------------------------------------------------------------------
-- Guardar el borrador. Lo puede quien llena el brief, mientras el borrador
-- este abierto.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.guardar_borrador_brief(
  p_brief integer,
  p_respuestas jsonb,
  p_fecha_aspirada date,
  p_autores jsonb
)
  RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
  BEGIN
    IF NOT portal.llena_brief(p_brief) THEN
      RAISE EXCEPTION 'No autorizado' USING ERRCODE = 'insufficient_privilege';
    END IF;

    UPDATE portal.briefs
    SET borrador = coalesce(p_respuestas, '{}'::jsonb),
        fecha_aspirada_borrador = p_fecha_aspirada,
        autores = coalesce(p_autores, autores)
    WHERE id = p_brief AND borrador_abierto
      AND estado IN ('borrador', 'enviado', 'en_validacion', 'en_presupuesto');

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Este brief ya no se puede editar' USING ERRCODE = 'check_violation';
    END IF;
  END
  $fn$;

-- ---------------------------------------------------------------------------
-- Abrir una version nueva (S-08): mientras este enviado, en validacion o en
-- presupuesto. El borrador arranca con lo ultimo que se envio.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.abrir_version_brief(p_brief integer)
  RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
  BEGIN
    IF NOT portal.llena_brief(p_brief) THEN
      RAISE EXCEPTION 'No autorizado' USING ERRCODE = 'insufficient_privilege';
    END IF;

    UPDATE portal.briefs b
    SET borrador_abierto = TRUE,
        borrador = v.respuestas,
        autores = v.autores,
        fecha_aspirada_borrador = b.fecha_aspirada
    FROM portal.brief_versiones v
    WHERE b.id = p_brief AND v.brief_id = b.id AND v.numero = b.version_actual
      AND NOT b.borrador_abierto
      AND b.estado IN ('enviado', 'en_validacion', 'en_presupuesto');

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Este brief no admite una version nueva' USING ERRCODE = 'check_violation';
    END IF;
  END
  $fn$;

-- ---------------------------------------------------------------------------
-- Enviar. El contenido congelado y su hash los calcula la aplicacion a partir
-- de las respuestas guardadas (src/lib/portal/briefs.ts); la base pone lo que
-- no puede venir de fuera: la fecha, el codigo y el numero de version.
--
-- Devuelve el codigo y el numero de la version enviada.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.enviar_brief(
  p_brief integer,
  p_contenido jsonb,
  p_sha256 text,
  p_respuestas jsonb,
  p_fecha_aspirada date,
  p_nombre text
)
  RETURNS TABLE (codigo text, numero smallint)
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
  DECLARE
    v_brief portal.briefs;
    v_hoy date := (now() AT TIME ZONE 'America/Caracas')::date;
    v_codigo text;
    v_numero smallint;
    v_intento integer := 0;
  BEGIN
    IF NOT portal.llena_brief(p_brief) THEN
      RAISE EXCEPTION 'No autorizado' USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT * INTO v_brief FROM portal.briefs WHERE id = p_brief FOR UPDATE;

    IF NOT v_brief.borrador_abierto
       OR v_brief.estado NOT IN ('borrador', 'enviado', 'en_validacion', 'en_presupuesto') THEN
      RAISE EXCEPTION 'Este brief no tiene nada que enviar' USING ERRCODE = 'check_violation';
    END IF;

    IF p_fecha_aspirada IS NULL OR p_fecha_aspirada < v_hoy THEN
      RAISE EXCEPTION 'La fecha de entrega no puede ser anterior a hoy'
        USING ERRCODE = 'check_violation';
    END IF;

    -- El codigo, solo la primera vez: con la fecha de envio en Caracas y
    -- seis hexadecimales al azar. Ante una colision, otro intento.
    v_codigo := v_brief.codigo;
    WHILE v_codigo IS NULL LOOP
      v_intento := v_intento + 1;
      v_codigo := 'ECS-' || to_char(v_hoy, 'YYYYMMDD') || '-'
        || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      IF EXISTS (SELECT 1 FROM portal.briefs b WHERE b.codigo = v_codigo) THEN
        IF v_intento >= 5 THEN
          RAISE EXCEPTION 'No se pudo asignar un codigo' USING ERRCODE = 'unique_violation';
        END IF;
        v_codigo := NULL;
      END IF;
    END LOOP;

    v_numero := v_brief.version_actual + 1;

    INSERT INTO portal.brief_versiones
      (brief_id, numero, contenido, contenido_sha256, respuestas, autores,
       fecha_aspirada, enviado_por, enviado_por_nombre)
    VALUES
      (p_brief, v_numero, p_contenido, p_sha256, p_respuestas, v_brief.autores,
       p_fecha_aspirada, app_usuario_id(), p_nombre);

    UPDATE portal.briefs
    SET codigo = v_codigo,
        version_actual = v_numero,
        estado = CASE WHEN estado = 'borrador' THEN 'enviado' ELSE estado END,
        enviado_en = coalesce(enviado_en, now()),
        fecha_aspirada = p_fecha_aspirada,
        borrador = p_respuestas,
        borrador_abierto = FALSE
    WHERE id = p_brief;

    RETURN QUERY SELECT v_codigo, v_numero;
  END
  $fn$;

-- ---------------------------------------------------------------------------
-- Convertir al prospecto de un brief: nace su empresa y, si quien decide es
-- un ejecutivo de cuentas, queda asignado a ella. Su cuenta la crea la
-- aplicacion despues. Devuelve el id de la empresa (la que ya tuviera, si
-- se convirtio antes).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.convertir_prospecto(p_brief integer)
  RETURNS integer
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
  DECLARE
    v_brief portal.briefs;
    v_prospecto portal.prospectos;
    v_empresa integer;
  BEGIN
    IF NOT portal.gestiona_brief(p_brief) THEN
      RAISE EXCEPTION 'No autorizado' USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT * INTO v_brief FROM portal.briefs WHERE id = p_brief FOR UPDATE;
    IF v_brief.empresa_id IS NOT NULL THEN
      RETURN v_brief.empresa_id;
    END IF;

    SELECT * INTO v_prospecto FROM portal.prospectos WHERE id = v_brief.prospecto_id FOR UPDATE;

    v_empresa := v_prospecto.empresa_id;
    IF v_empresa IS NULL THEN
      INSERT INTO empresas (nombre, telefono) VALUES (v_prospecto.empresa_nombre, v_prospecto.telefono)
      RETURNING id INTO v_empresa;
      UPDATE portal.prospectos SET empresa_id = v_empresa WHERE id = v_prospecto.id;
    END IF;

    UPDATE portal.briefs SET empresa_id = v_empresa WHERE id = p_brief;

    IF app_rol() = 'trabajador' AND app_cargo() = 'cuentas' THEN
      INSERT INTO portal.asignaciones (usuario_id, empresa_id, creado_por)
      VALUES (app_usuario_id(), v_empresa, app_usuario_id())
      ON CONFLICT (usuario_id, empresa_id) DO NOTHING;
    END IF;

    RETURN v_empresa;
  END
  $fn$;

REVOKE ALL ON FUNCTION
  portal.guardar_borrador_brief(integer, jsonb, date, jsonb),
  portal.abrir_version_brief(integer),
  portal.enviar_brief(integer, jsonb, text, jsonb, date, text),
  portal.convertir_prospecto(integer)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  portal.guardar_borrador_brief(integer, jsonb, date, jsonb),
  portal.abrir_version_brief(integer),
  portal.enviar_brief(integer, jsonb, text, jsonb, date, text),
  portal.convertir_prospecto(integer)
  TO conejo_app;

-- ---------------------------------------------------------------------------
-- Quien atiende un brief: los ejecutivos asignados a su empresa o, si es de
-- un prospecto sin convertir, quien genero su enlace. Activos. Es a quienes
-- se avisa cuando se envia o se escribe en el hilo; el cliente no ve las
-- asignaciones, por eso se pregunta aqui. Solo a quien ve el brief.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.atienden_brief(p_brief integer)
  RETURNS TABLE (id integer, nombre text, email text)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT DISTINCT u.id, u.nombre, u.email
    FROM portal.briefs b
    LEFT JOIN portal.asignaciones a ON a.empresa_id = b.empresa_id
    LEFT JOIN portal.enlaces_brief e ON e.id = b.enlace_id
    JOIN usuarios u ON u.id = coalesce(a.usuario_id, e.creado_por)
    WHERE b.id = p_brief AND u.activo AND portal.ve_brief(p_brief)
  $fn$;

REVOKE ALL ON FUNCTION portal.atienden_brief(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION portal.atienden_brief(integer) TO conejo_app;

-- ---------------------------------------------------------------------------
-- El prospecto deja rastro sin usuario: al enviar su brief avisa a quien lo
-- atiende y encola la copia por correo. Las politicas de la campana y de la
-- bandeja de salida exigen un usuario; aqui se amplian para su rol. Sus
-- correos llevan el enlace que los provoco (lo pone la base), y solo esos
-- puede leer y anotar al entregarlos.
-- ---------------------------------------------------------------------------
ALTER TABLE portal.correos_salida
  ADD COLUMN IF NOT EXISTS enlace_id INTEGER REFERENCES portal.enlaces_brief(id);
ALTER TABLE portal.correos_salida ALTER COLUMN enlace_id SET DEFAULT app_enlace_id();

DROP POLICY IF EXISTS notificaciones_escribe ON portal.notificaciones;
CREATE POLICY notificaciones_escribe ON portal.notificaciones
  FOR INSERT TO conejo_app
  WITH CHECK (
    app_usuario_id() IS NOT NULL OR app_rol() = 'sistema'
    OR (app_rol() = 'prospecto' AND app_enlace_id() IS NOT NULL)
  );

DROP POLICY IF EXISTS correos_salida_lee ON portal.correos_salida;
CREATE POLICY correos_salida_lee ON portal.correos_salida
  FOR SELECT TO conejo_app
  USING (
    app_rol() = 'admin' OR creado_por = app_usuario_id()
    OR (app_rol() = 'prospecto' AND enlace_id = app_enlace_id())
  );

DROP POLICY IF EXISTS correos_salida_escribe ON portal.correos_salida;
CREATE POLICY correos_salida_escribe ON portal.correos_salida
  FOR INSERT TO conejo_app
  WITH CHECK (
    creado_por = app_usuario_id()
    OR (app_rol() = 'prospecto' AND creado_por IS NULL AND enlace_id = app_enlace_id())
  );

DROP POLICY IF EXISTS correos_salida_actualiza ON portal.correos_salida;
CREATE POLICY correos_salida_actualiza ON portal.correos_salida
  FOR UPDATE TO conejo_app
  USING (
    app_rol() = 'admin' OR creado_por = app_usuario_id()
    OR (app_rol() = 'prospecto' AND enlace_id = app_enlace_id())
  )
  WITH CHECK (
    app_rol() = 'admin' OR creado_por = app_usuario_id()
    OR (app_rol() = 'prospecto' AND enlace_id = app_enlace_id())
  );

COMMIT;

-- ---------------------------------------------------------------------------
-- Comprobacion 1. Debe devolver tablas = 5 y con_seguridad_por_fila = 5.
-- ---------------------------------------------------------------------------
SELECT count(*) AS tablas,
       count(*) FILTER (WHERE rowsecurity) AS con_seguridad_por_fila
FROM pg_tables
WHERE schemaname = 'portal'
  AND tablename IN ('prospectos', 'enlaces_brief', 'briefs', 'brief_versiones', 'brief_aclaraciones');

-- Comprobacion 2. Debe devolver politicas = 12, funciones = 12 y columnas = 3.
SELECT (SELECT count(*) FROM pg_policies
        WHERE schemaname = 'portal'
          AND tablename IN ('prospectos', 'enlaces_brief', 'briefs', 'brief_versiones', 'brief_aclaraciones')) AS politicas,
       (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'portal'
          AND p.proname IN ('versiones_brief_inmutables', 'briefs_coherentes', 'creo_el_enlace',
                            'gestiona_brief', 'llena_brief', 've_brief', 'enlace_por_token',
                            'guardar_borrador_brief', 'abrir_version_brief', 'enviar_brief',
                            'convertir_prospecto', 'atienden_brief')) AS funciones,
       (SELECT count(*) FROM information_schema.columns
        WHERE (column_name = 'brief_id'
               AND ((table_schema = 'portal' AND table_name = 'proyectos')
                 OR (table_schema = 'finanzas' AND table_name = 'presupuestos')))
           OR (column_name = 'enlace_id' AND table_schema = 'portal' AND table_name = 'correos_salida')) AS columnas;

-- Comprobacion 3. Todavia no hay ningun brief: debe devolver 0.
SELECT count(*) AS briefs FROM portal.briefs;
