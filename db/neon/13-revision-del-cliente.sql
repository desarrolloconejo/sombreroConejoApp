-- ===========================================================================
-- 13 — Revision del cliente
--
-- Etapa 4 del plan del portal. Anade lo que hace falta para que el cliente
-- decida en la fase 5: el permiso de aprobar de cada persona (y su columna en
-- la vista de usuarios, al final), las versiones de cada pieza, las
-- decisiones, el almacen del modo simulado de archivos y la funcion que es la
-- unica via del cliente sobre las fases.
--
-- Idempotente. Solo anade: la vista gana una columna al final, que la version
-- publicada ignora.
--
-- ORDEN: antes de subir la aplicacion, despues del 12.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- clientes.puede_aprobar: quien de la empresa decide en la fase 5. Nace en
-- falso para todos: lo concede el administrador persona por persona.
-- ---------------------------------------------------------------------------
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS puede_aprobar BOOLEAN NOT NULL DEFAULT FALSE;

-- La vista de usuarios gana la columna, al final: es lo que CREATE OR REPLACE
-- VIEW permite sin soltarla.
CREATE OR REPLACE VIEW vw_usuarios_completos
WITH (security_invoker = true) AS
SELECT
  u.id,
  u.nombre,
  u.apellido,
  u.email,
  u.telefono,
  u.foto_url,
  u.tema,
  u.activo,
  u.ultimo_acceso,
  u.creado_en,
  u.actualizado_en,
  u.debe_cambiar_clave,
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
  e.activo                                   AS empresa_activa,
  c.puede_aprobar                            AS puede_aprobar
FROM usuarios u
LEFT JOIN trabajadores t ON t.usuario_id = u.id
LEFT JOIN roles        r ON r.id         = t.rol_id
LEFT JOIN cargos       g ON g.id         = t.cargo_id
LEFT JOIN clientes     c ON c.usuario_id = u.id
LEFT JOIN empresas     e ON e.id         = c.empresa_id;

-- ===========================================================================
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- clientes.puede_aprobar: quien de la empresa decide en la fase 5.
--
-- Nace en falso para todos: aprobar compromete a la empresa, y lo concede el
-- administrador persona por persona (C1: si nadie lo tiene, nadie aprueba, y
-- el ejecutivo ve el aviso).
-- ---------------------------------------------------------------------------
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS puede_aprobar BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- portal.archivos_simulados: donde guarda el adaptador de archivos en modo
-- simulado (src/lib/externos/archivos.ts).
--
-- En modo real los archivos van a Google Drive y esta tabla no se usa. Con
-- limite pequeno a proposito: es para desarrollo y pruebas, no un almacen.
-- Nadie la lee directamente: solo el adaptador, y solo para entregar una
-- version a quien ya se comprobo que puede verla.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.archivos_simulados (
  id          SERIAL      PRIMARY KEY,
  nombre      TEXT        NOT NULL,
  mime        TEXT        NOT NULL,
  tamano      INTEGER     NOT NULL,
  contenido   BYTEA       NOT NULL,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT archivos_simulados_tamano CHECK (tamano > 0 AND tamano <= 4194304)
);

-- ---------------------------------------------------------------------------
-- portal.versiones: lo que se produce para una pieza.
--
-- Un archivo (guardado por el adaptador: `archivo_id` es su identificador en
-- Drive o en la tabla simulada) o un enlace externo de la lista blanca. Nunca
-- los dos.
--
-- El cliente solo ve la version marcada como enviada, y solo con la pieza en
-- la fase 5 o aprobada. Los borradores no salen nunca del equipo.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.versiones (
  id                SERIAL      PRIMARY KEY,
  pieza_id          INTEGER     NOT NULL REFERENCES portal.piezas(id),
  numero            SMALLINT    NOT NULL,
  ronda             SMALLINT    NOT NULL,
  fase              SMALLINT    NOT NULL,

  origen            TEXT        NOT NULL,
  archivo_id        TEXT,
  enlace            TEXT,
  nombre            TEXT        NOT NULL,
  mime              TEXT,
  tamano            INTEGER,

  subida_por        INTEGER     NOT NULL REFERENCES usuarios(id),
  creada_en         TIMESTAMPTZ NOT NULL DEFAULT now(),

  enviada_en        TIMESTAMPTZ,
  enviada_por       INTEGER     REFERENCES usuarios(id),

  CONSTRAINT versiones_numero_unico   UNIQUE (pieza_id, numero),
  CONSTRAINT versiones_numero_valido  CHECK (numero >= 1),
  CONSTRAINT versiones_ronda_valida   CHECK (ronda >= 1),
  CONSTRAINT versiones_fase_valida    CHECK (fase BETWEEN 1 AND 5),
  CONSTRAINT versiones_origen_valido  CHECK (origen IN ('archivo', 'enlace')),
  CONSTRAINT versiones_origen_coherente
    CHECK ((origen = 'archivo' AND archivo_id IS NOT NULL AND enlace IS NULL)
        OR (origen = 'enlace' AND enlace IS NOT NULL AND archivo_id IS NULL)),
  CONSTRAINT versiones_enlace_https   CHECK (enlace IS NULL OR enlace ~ '^https://'),
  CONSTRAINT versiones_envio_completo
    CHECK ((enviada_en IS NULL) = (enviada_por IS NULL))
);

-- Una sola version enviada por pieza y ronda: la que el cliente revisa.
CREATE UNIQUE INDEX IF NOT EXISTS versiones_una_enviada_por_ronda
  ON portal.versiones (pieza_id, ronda)
  WHERE enviada_en IS NOT NULL;

-- ---------------------------------------------------------------------------
-- portal.revisiones: la decision del cliente en la fase 5, una por ronda.
--
-- Solo se anaden. La correccion guarda que fases reabrio; el ejecutivo puede
-- ajustarlas mientras no se haya completado ninguna fase de la ronda nueva, y
-- entonces queda quien las ajusto.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.revisiones (
  id                SERIAL      PRIMARY KEY,
  pieza_id          INTEGER     NOT NULL REFERENCES portal.piezas(id),
  ronda             SMALLINT    NOT NULL,
  decision          TEXT        NOT NULL,
  tipo_correccion   TEXT,
  comentario        TEXT,
  fases_reabiertas  SMALLINT[]  NOT NULL DEFAULT '{}',
  version_id        INTEGER     REFERENCES portal.versiones(id),

  autor_id          INTEGER     NOT NULL REFERENCES usuarios(id),
  creada_en         TIMESTAMPTZ NOT NULL DEFAULT now(),

  ajustada_por      INTEGER     REFERENCES usuarios(id),
  ajustada_en       TIMESTAMPTZ,

  CONSTRAINT revisiones_una_por_ronda UNIQUE (pieza_id, ronda),
  CONSTRAINT revisiones_decision_valida CHECK (decision IN ('aprobada', 'correccion')),
  CONSTRAINT revisiones_tipo_valido
    CHECK (tipo_correccion IS NULL OR tipo_correccion IN ('redaccion', 'diseno', 'ambas')),
  CONSTRAINT revisiones_correccion_completa
    CHECK ((decision = 'aprobada' AND tipo_correccion IS NULL AND cardinality(fases_reabiertas) = 0)
        OR (decision = 'correccion' AND tipo_correccion IS NOT NULL
            AND comentario IS NOT NULL AND length(btrim(comentario)) > 0
            AND cardinality(fases_reabiertas) > 0)),
  CONSTRAINT revisiones_fases_validas CHECK (fases_reabiertas <@ ARRAY[1, 2, 3, 4, 5]::smallint[]),
  CONSTRAINT revisiones_ajuste_completo CHECK ((ajustada_por IS NULL) = (ajustada_en IS NULL))
);

-- ---------------------------------------------------------------------------
-- Permisos. Los archivos simulados no llevan politicas por fila: solo los lee
-- el adaptador, por id, desde la ruta de entrega, despues de que la version
-- haya pasado las politicas de `versiones`. Sin DELETE: no se borran.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON portal.versiones, portal.revisiones TO conejo_app;
GRANT USAGE, SELECT ON SEQUENCE portal.versiones_id_seq, portal.revisiones_id_seq TO conejo_app;
GRANT SELECT, INSERT ON portal.archivos_simulados TO conejo_app;
GRANT USAGE, SELECT ON SEQUENCE portal.archivos_simulados_id_seq TO conejo_app;

-- Si el cliente con sesion puede decidir sobre la pieza: es de su empresa,
-- tiene el permiso de aprobar y su cuenta sigue activa.
CREATE OR REPLACE FUNCTION portal.cliente_aprueba(p_pieza integer)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT portal.cliente_ve_pieza(p_pieza) AND EXISTS (
      SELECT 1 FROM clientes c
      JOIN usuarios u ON u.id = c.usuario_id
      WHERE c.usuario_id = app_usuario_id()
        AND c.empresa_id = app_empresa_id()
        AND c.puede_aprobar
        AND u.activo
    )
  $fn$;

REVOKE ALL ON FUNCTION portal.cliente_aprueba(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION portal.cliente_aprueba(integer) TO conejo_app;

ALTER TABLE portal.versiones  ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.revisiones ENABLE ROW LEVEL SECURITY;

-- Versiones: el equipo de la pieza, todas; el cliente, solo la enviada, y
-- solo con la pieza frente a el.
DROP POLICY IF EXISTS versiones_lee ON portal.versiones;
CREATE POLICY versiones_lee ON portal.versiones
  FOR SELECT TO conejo_app
  USING (
    portal.gestiona_pieza(pieza_id)
    OR portal.trabaja_en_pieza(pieza_id)
    OR (enviada_en IS NOT NULL
        AND portal.cliente_ve_pieza(pieza_id)
        AND portal.pieza_en_revision(pieza_id))
  );

DROP POLICY IF EXISTS versiones_sube ON portal.versiones;
CREATE POLICY versiones_sube ON portal.versiones
  FOR INSERT TO conejo_app
  WITH CHECK (
    subida_por = app_usuario_id()
    AND (portal.gestiona_pieza(pieza_id) OR portal.trabaja_en_pieza(pieza_id))
  );

-- Marcar la enviada es del ejecutivo.
DROP POLICY IF EXISTS versiones_envia ON portal.versiones;
CREATE POLICY versiones_envia ON portal.versiones
  FOR UPDATE TO conejo_app
  USING (portal.gestiona_pieza(pieza_id))
  WITH CHECK (portal.gestiona_pieza(pieza_id));

-- Revisiones: las lee quien ve la pieza. Las escribe el cliente con permiso
-- de aprobar, a su nombre; el ejecutivo solo ajusta la ruta.
DROP POLICY IF EXISTS revisiones_lee ON portal.revisiones;
CREATE POLICY revisiones_lee ON portal.revisiones
  FOR SELECT TO conejo_app
  USING (
    portal.gestiona_pieza(pieza_id)
    OR portal.trabaja_en_pieza(pieza_id)
    OR portal.cliente_ve_pieza(pieza_id)
  );

DROP POLICY IF EXISTS revisiones_decide ON portal.revisiones;
CREATE POLICY revisiones_decide ON portal.revisiones
  FOR INSERT TO conejo_app
  WITH CHECK (autor_id = app_usuario_id() AND portal.cliente_aprueba(pieza_id));

DROP POLICY IF EXISTS revisiones_ajusta ON portal.revisiones;
CREATE POLICY revisiones_ajusta ON portal.revisiones
  FOR UPDATE TO conejo_app
  USING (portal.gestiona_pieza(pieza_id))
  WITH CHECK (portal.gestiona_pieza(pieza_id) AND ajustada_por = app_usuario_id());

-- ---------------------------------------------------------------------------
-- La decision del cliente sobre las fases.
--
-- El cliente no tiene permiso para mover fases: la politica de pieza_fases es
-- del ejecutivo. Esta funcion es la UNICA via, y solo hace lo que la decision
-- pide: completar la fase 5, o reabrir las fases de la ruta y subir la ronda.
-- Comprueba ella misma que quien llama puede aprobar y que la pieza esta
-- esperandole, con la pieza bloqueada.
--
-- La ruta la calcula la aplicacion con el catalogo; aqui solo se exige que
-- sea creible: dentro de 1..5 y pasando siempre por los controles 4 y 5.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.decidir_fase_5(
  p_pieza integer,
  p_aprobar boolean,
  p_reabre smallint[]
)
  RETURNS smallint
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
  DECLARE
    v_ronda smallint;
    v_en_curso smallint;
  BEGIN
    IF NOT portal.cliente_aprueba(p_pieza) THEN
      RAISE EXCEPTION 'No autorizado' USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT ronda INTO v_ronda FROM portal.piezas
    WHERE id = p_pieza AND estado = 'activa'
    FOR UPDATE;

    SELECT fase INTO v_en_curso FROM portal.pieza_fases
    WHERE pieza_id = p_pieza AND estado = 'en_curso';

    IF v_ronda IS NULL OR v_en_curso IS DISTINCT FROM 5 THEN
      RAISE EXCEPTION 'La pieza no esta esperando una decision'
        USING ERRCODE = 'check_violation';
    END IF;

    IF p_aprobar THEN
      UPDATE portal.pieza_fases
      SET estado = 'completada', completada_en = now(),
          completada_por = app_usuario_id(), ronda_completada = v_ronda
      WHERE pieza_id = p_pieza AND fase = 5;

      RETURN v_ronda;
    END IF;

    IF p_reabre IS NULL OR cardinality(p_reabre) = 0
       OR NOT (p_reabre <@ ARRAY[1, 2, 3, 4, 5]::smallint[])
       OR NOT (ARRAY[4, 5]::smallint[] <@ p_reabre) THEN
      RAISE EXCEPTION 'Ruta de correccion no valida' USING ERRCODE = 'check_violation';
    END IF;

    -- La que estaba en curso (la 5) deja de estarlo antes de abrir otra: la
    -- base solo admite una fase en curso por pieza.
    UPDATE portal.pieza_fases
    SET estado = 'pendiente', completada_en = NULL, completada_por = NULL,
        ronda_completada = NULL
    WHERE pieza_id = p_pieza AND fase = ANY (p_reabre);

    UPDATE portal.pieza_fases
    SET estado = 'en_curso'
    WHERE pieza_id = p_pieza
      AND fase = (SELECT min(f) FROM unnest(p_reabre) AS f);

    -- Las tareas de las fases de trabajo reabiertas vuelven a estar por hacer.
    UPDATE portal.tareas
    SET estado = 'pendiente', lista_en = NULL, lista_por = NULL
    WHERE pieza_id = p_pieza AND fase = ANY (p_reabre) AND estado = 'lista';

    UPDATE portal.piezas SET ronda = ronda + 1 WHERE id = p_pieza;

    RETURN v_ronda + 1;
  END
  $fn$;

REVOKE ALL ON FUNCTION portal.decidir_fase_5(integer, boolean, smallint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION portal.decidir_fase_5(integer, boolean, smallint[]) TO conejo_app;

COMMIT;

-- Comprobacion 1. Debe devolver tablas = 3 y con_seguridad_por_fila = 2
-- (archivos_simulados no lleva politicas: solo la lee el adaptador por id).
SELECT count(*) AS tablas, count(*) FILTER (WHERE rowsecurity) AS con_seguridad_por_fila
FROM pg_tables
WHERE schemaname = 'portal' AND tablename IN ('versiones', 'revisiones', 'archivos_simulados');

-- Comprobacion 2. Debe devolver politicas = 6 y funciones = 2.
SELECT (SELECT count(*) FROM pg_policies
        WHERE schemaname = 'portal' AND tablename IN ('versiones', 'revisiones')) AS politicas,
       (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'portal' AND p.proname IN ('cliente_aprueba', 'decidir_fase_5')) AS funciones;

-- Comprobacion 3. Debe devolver nadie_aprueba_aun = numero de clientes: el
-- permiso nace apagado para todos.
SELECT count(*) FILTER (WHERE NOT puede_aprobar) AS nadie_aprueba_aun, count(*) AS clientes
FROM clientes;
