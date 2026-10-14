-- ===========================================================================
-- 11 — Proyectos, piezas, fases y tareas
--
-- Etapa 3 del plan del portal. Crea la bateria de cinco fases: asignaciones
-- de ejecutivos, proyectos, piezas, su copy, sus fases, las tareas y los
-- comentarios internos, con sus politicas de seguridad por fila y las dos
-- vistas que calculan el avance.
--
-- Idempotente. Solo crea: nada de lo publicado cambia. No inserta datos: los
-- proyectos se crean desde la aplicacion, y las empresas se asignan a sus
-- ejecutivos desde Empresas.
--
-- ORDEN: antes de subir la aplicacion, despues del 07 (esquema portal y
-- funciones de sesion) y del 05 (rol conejo_app).
-- ===========================================================================

BEGIN;

-- ===========================================================================
-- PROYECTOS, PIEZAS, FASES Y TAREAS
--
-- La bateria de cinco fases. Las reglas completas estan en
-- docs/reglasBateria.md; aqui solo lo que la base tiene que imponer por si
-- misma.
--
-- El avance NO se guarda: no hay columna de porcentaje ni de fase actual. Lo
-- calculan las vistas del final del bloque.
--
-- Los conjuntos cerrados tienen su espejo en src/types/portal.ts.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- portal.asignaciones: que ejecutivo atiende a que empresa.
--
-- Un ejecutivo (cargo `cuentas`) solo ve los proyectos de sus empresas, y eso
-- lo decide esta tabla. Una empresa puede tener varios ejecutivos (P6).
--
-- Es una relacion, no una persona ni una empresa: quitar una asignacion es
-- borrar su fila, y queda en la auditoria.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.asignaciones (
  id          SERIAL      PRIMARY KEY,
  usuario_id  INTEGER     NOT NULL REFERENCES usuarios(id),
  empresa_id  INTEGER     NOT NULL REFERENCES empresas(id),
  creado_por  INTEGER     REFERENCES usuarios(id),
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT asignaciones_unica UNIQUE (usuario_id, empresa_id)
);

CREATE INDEX IF NOT EXISTS asignaciones_empresa_idx
  ON portal.asignaciones (empresa_id);

-- ---------------------------------------------------------------------------
-- portal.proyectos: lo que pidio el cliente.
--
-- `servicio` es la entrada del catalogo de la que nacio (src/lib/portal/
-- catalogo.ts) y `tipo` la plantilla de fases que usa. Se guardan los dos:
-- el catalogo puede cambiar, y un proyecto ya armado no debe cambiar con el.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.proyectos (
  id                     SERIAL      PRIMARY KEY,
  empresa_id             INTEGER     NOT NULL REFERENCES empresas(id),
  ejecutivo_id           INTEGER     NOT NULL REFERENCES usuarios(id),

  servicio               TEXT        NOT NULL,
  tipo                   TEXT        NOT NULL,
  nombre                 TEXT        NOT NULL,
  descripcion            TEXT,

  estado                 TEXT        NOT NULL DEFAULT 'activo',
  fecha_inicio           DATE,
  fecha_estimada_cierre  DATE,
  cerrado_en             TIMESTAMPTZ,

  creado_por             INTEGER     REFERENCES usuarios(id),
  creado_en              TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT proyectos_servicio_formato CHECK (servicio ~ '^[a-z][a-z_]*$'),
  CONSTRAINT proyectos_tipo_valido      CHECK (tipo IN ('redes_sociales', 'especial')),
  CONSTRAINT proyectos_estado_valido
    CHECK (estado IN ('activo', 'pausado', 'cerrado', 'cancelado')),
  CONSTRAINT proyectos_nombre_no_vacio  CHECK (length(btrim(nombre)) > 0),
  CONSTRAINT proyectos_cierre_coherente
    CHECK ((estado = 'cerrado') = (cerrado_en IS NOT NULL)),
  CONSTRAINT proyectos_fechas_en_orden
    CHECK (fecha_inicio IS NULL OR fecha_estimada_cierre IS NULL
           OR fecha_estimada_cierre >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS proyectos_empresa_idx
  ON portal.proyectos (empresa_id, estado);
CREATE INDEX IF NOT EXISTS proyectos_ejecutivo_idx
  ON portal.proyectos (ejecutivo_id);

CREATE OR REPLACE TRIGGER proyectos_actualizado_en
  BEFORE UPDATE ON portal.proyectos
  FOR EACH ROW EXECUTE FUNCTION tocar_actualizado_en();

-- ---------------------------------------------------------------------------
-- portal.piezas: cada entregable que el cliente aprueba.
--
-- No se borran: se cancelan con motivo (P9), y una pieza cancelada deja de
-- contar para el avance.
--
-- `ronda` empieza en 1 y sube cada vez que el cliente pide una correccion.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.piezas (
  id                  SERIAL      PRIMARY KEY,
  proyecto_id         INTEGER     NOT NULL REFERENCES portal.proyectos(id),
  orden               SMALLINT    NOT NULL,
  tipo                TEXT        NOT NULL,
  titulo              TEXT        NOT NULL,
  responsable_id      INTEGER     REFERENCES usuarios(id),
  ronda               SMALLINT    NOT NULL DEFAULT 1,

  estado              TEXT        NOT NULL DEFAULT 'activa',
  motivo_cancelacion  TEXT,
  cancelada_en        TIMESTAMPTZ,
  cancelada_por       INTEGER     REFERENCES usuarios(id),

  creado_por          INTEGER     REFERENCES usuarios(id),
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT piezas_orden_unico   UNIQUE (proyecto_id, orden),
  CONSTRAINT piezas_orden_valido  CHECK (orden >= 1),
  CONSTRAINT piezas_ronda_valida  CHECK (ronda >= 1),
  CONSTRAINT piezas_tipo_valido
    CHECK (tipo IN ('post', 'carrusel', 'reel', 'historia', 'video', 'logo',
                    'entregable', 'otro')),
  CONSTRAINT piezas_titulo_no_vacio CHECK (length(btrim(titulo)) > 0),
  CONSTRAINT piezas_estado_valido CHECK (estado IN ('activa', 'cancelada')),
  CONSTRAINT piezas_cancelacion_completa
    CHECK ((estado = 'cancelada') = (
      cancelada_en IS NOT NULL AND cancelada_por IS NOT NULL
      AND motivo_cancelacion IS NOT NULL AND length(btrim(motivo_cancelacion)) > 0
    ))
);

CREATE INDEX IF NOT EXISTS piezas_responsable_idx
  ON portal.piezas (responsable_id);

CREATE OR REPLACE TRIGGER piezas_actualizado_en
  BEFORE UPDATE ON portal.piezas
  FOR EACH ROW EXECUTE FUNCTION tocar_actualizado_en();

-- ---------------------------------------------------------------------------
-- portal.pieza_contenido: el copy de la pieza, en tabla aparte.
--
-- La seguridad por fila decide por fila, no por columna. Separado, la base
-- misma le niega el copy al cliente hasta que la pieza llega a la fase 5.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.pieza_contenido (
  pieza_id        INTEGER     PRIMARY KEY REFERENCES portal.piezas(id),
  copy            TEXT        NOT NULL DEFAULT '',
  actualizado_por INTEGER     REFERENCES usuarios(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER pieza_contenido_actualizado_en
  BEFORE UPDATE ON portal.pieza_contenido
  FOR EACH ROW EXECUTE FUNCTION tocar_actualizado_en();

-- ---------------------------------------------------------------------------
-- portal.pieza_fases: cinco filas por pieza, una por fase.
--
-- La fase en curso es siempre la primera no completada, y solo hay una: lo
-- impone el indice unico parcial de abajo.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.pieza_fases (
  id                SERIAL      PRIMARY KEY,
  pieza_id          INTEGER     NOT NULL REFERENCES portal.piezas(id),
  fase              SMALLINT    NOT NULL,
  estado            TEXT        NOT NULL DEFAULT 'pendiente',
  fecha_estimada    DATE,
  responsable_id    INTEGER     REFERENCES usuarios(id),

  completada_en     TIMESTAMPTZ,
  completada_por    INTEGER     REFERENCES usuarios(id),
  ronda_completada  SMALLINT,

  actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pieza_fases_unica        UNIQUE (pieza_id, fase),
  CONSTRAINT pieza_fases_rango        CHECK (fase BETWEEN 1 AND 5),
  CONSTRAINT pieza_fases_estado_valido
    CHECK (estado IN ('pendiente', 'en_curso', 'completada')),
  CONSTRAINT pieza_fases_completada_coherente
    CHECK ((estado = 'completada') = (completada_en IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS pieza_fases_una_en_curso
  ON portal.pieza_fases (pieza_id)
  WHERE estado = 'en_curso';

CREATE INDEX IF NOT EXISTS pieza_fases_responsable_idx
  ON portal.pieza_fases (responsable_id);

CREATE OR REPLACE TRIGGER pieza_fases_actualizado_en
  BEFORE UPDATE ON portal.pieza_fases
  FOR EACH ROW EXECUTE FUNCTION tocar_actualizado_en();

-- ---------------------------------------------------------------------------
-- portal.tareas: el trabajo interno dentro de una fase.
--
-- Solo cuelgan de las fases de trabajo, la 1 y la 3: la llave foranea va a
-- la pareja (pieza, fase) y el CHECK cierra cuales. El cliente nunca las ve.
--
-- `herramienta` es la entrada del registro de src/lib/herramientas.ts que
-- ayuda a cumplirla, si la hay.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.tareas (
  id              SERIAL      PRIMARY KEY,
  pieza_id        INTEGER     NOT NULL,
  fase            SMALLINT    NOT NULL,
  orden           SMALLINT    NOT NULL DEFAULT 1,
  titulo          TEXT        NOT NULL,
  responsable_id  INTEGER     REFERENCES usuarios(id),
  herramienta     TEXT,
  fecha_estimada  DATE,

  estado          TEXT        NOT NULL DEFAULT 'pendiente',
  lista_en        TIMESTAMPTZ,
  lista_por       INTEGER     REFERENCES usuarios(id),

  creado_por      INTEGER     REFERENCES usuarios(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT tareas_fase_de_la_pieza
    FOREIGN KEY (pieza_id, fase) REFERENCES portal.pieza_fases (pieza_id, fase),
  CONSTRAINT tareas_fase_de_trabajo   CHECK (fase IN (1, 3)),
  CONSTRAINT tareas_titulo_no_vacio   CHECK (length(btrim(titulo)) > 0),
  CONSTRAINT tareas_herramienta_formato
    CHECK (herramienta IS NULL OR herramienta ~ '^[a-z][a-z_]*$'),
  CONSTRAINT tareas_estado_valido     CHECK (estado IN ('pendiente', 'lista')),
  CONSTRAINT tareas_lista_coherente
    CHECK ((estado = 'lista') = (lista_en IS NOT NULL AND lista_por IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS tareas_pieza_idx
  ON portal.tareas (pieza_id, fase, orden);
CREATE INDEX IF NOT EXISTS tareas_responsable_idx
  ON portal.tareas (responsable_id, estado);

CREATE OR REPLACE TRIGGER tareas_actualizado_en
  BEFORE UPDATE ON portal.tareas
  FOR EACH ROW EXECUTE FUNCTION tocar_actualizado_en();

-- ---------------------------------------------------------------------------
-- portal.comentarios_pieza: la conversacion interna sobre una pieza.
--
-- Solo se anaden: la aplicacion no tiene politica para cambiarlos. El cliente
-- no los ve nunca.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.comentarios_pieza (
  id         SERIAL      PRIMARY KEY,
  pieza_id   INTEGER     NOT NULL REFERENCES portal.piezas(id),
  autor_id   INTEGER     NOT NULL REFERENCES usuarios(id),
  texto      TEXT        NOT NULL,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT comentarios_pieza_texto_no_vacio CHECK (length(btrim(texto)) > 0)
);

CREATE INDEX IF NOT EXISTS comentarios_pieza_idx
  ON portal.comentarios_pieza (pieza_id, creado_en);

-- ---------------------------------------------------------------------------
-- Permisos. Sin DELETE salvo en asignaciones (quitar una) y tareas (quitar
-- una pendiente que el ejecutivo no quiere): lo demas se cancela o se cierra.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON
  portal.asignaciones, portal.proyectos, portal.piezas, portal.pieza_contenido,
  portal.pieza_fases, portal.tareas, portal.comentarios_pieza
  TO conejo_app;
GRANT DELETE ON portal.asignaciones, portal.tareas TO conejo_app;
GRANT USAGE, SELECT ON
  SEQUENCE portal.asignaciones_id_seq, portal.proyectos_id_seq,
           portal.piezas_id_seq, portal.pieza_fases_id_seq,
           portal.tareas_id_seq, portal.comentarios_pieza_id_seq
  TO conejo_app;

-- ---------------------------------------------------------------------------
-- Quien puede que, como funciones.
--
-- Las politicas de abajo se cruzan entre tablas: ver una pieza depende de su
-- proyecto, de sus fases y de sus tareas. Escrito directamente en cada
-- politica, una consulta pasaria por las politicas de la otra tabla y
-- terminaria en recursion. Estas funciones son SECURITY DEFINER: leen como
-- duena, sin politicas de por medio, y solo responden si o no.
--
-- No confian en nada que no venga de la sesion declarada (`conSesion`).
-- ---------------------------------------------------------------------------

-- Gestiona la empresa: el admin, o un ejecutivo asignado a ella.
CREATE OR REPLACE FUNCTION portal.gestiona_empresa(p_empresa integer)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT CASE
      WHEN app_rol() = 'admin' THEN true
      WHEN app_rol() = 'trabajador' AND app_cargo() = 'cuentas' THEN EXISTS (
        SELECT 1 FROM portal.asignaciones a
        WHERE a.usuario_id = app_usuario_id() AND a.empresa_id = p_empresa
      )
      ELSE false
    END
  $fn$;

CREATE OR REPLACE FUNCTION portal.gestiona_pieza(p_pieza integer)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT COALESCE((
      SELECT portal.gestiona_empresa(pr.empresa_id)
      FROM portal.piezas p
      JOIN portal.proyectos pr ON pr.id = p.proyecto_id
      WHERE p.id = p_pieza
    ), false)
  $fn$;

-- Tiene trabajo en la pieza: responsable de ella, de una fase o de una tarea.
CREATE OR REPLACE FUNCTION portal.trabaja_en_pieza(p_pieza integer)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT app_rol() IN ('admin', 'trabajador') AND app_usuario_id() IS NOT NULL AND (
      EXISTS (SELECT 1 FROM portal.piezas p
              WHERE p.id = p_pieza AND p.responsable_id = app_usuario_id())
      OR EXISTS (SELECT 1 FROM portal.pieza_fases f
                 WHERE f.pieza_id = p_pieza AND f.responsable_id = app_usuario_id())
      OR EXISTS (SELECT 1 FROM portal.tareas t
                 WHERE t.pieza_id = p_pieza AND t.responsable_id = app_usuario_id())
    )
  $fn$;

CREATE OR REPLACE FUNCTION portal.trabaja_en_proyecto(p_proyecto integer)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT EXISTS (
      SELECT 1 FROM portal.piezas p
      WHERE p.proyecto_id = p_proyecto AND portal.trabaja_en_pieza(p.id)
    )
  $fn$;

-- Lo que ve el cliente de su empresa: los proyectos y sus piezas activas.
CREATE OR REPLACE FUNCTION portal.cliente_ve_pieza(p_pieza integer)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT app_rol() = 'cliente' AND EXISTS (
      SELECT 1 FROM portal.piezas p
      JOIN portal.proyectos pr ON pr.id = p.proyecto_id
      WHERE p.id = p_pieza
        AND p.estado = 'activa'
        AND pr.empresa_id = app_empresa_id()
    )
  $fn$;

-- La pieza ya esta frente al cliente: fase 5 en curso, o aprobada.
CREATE OR REPLACE FUNCTION portal.pieza_en_revision(p_pieza integer)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT EXISTS (
      SELECT 1 FROM portal.pieza_fases f
      WHERE f.pieza_id = p_pieza AND f.fase = 5
        AND f.estado IN ('en_curso', 'completada')
    )
  $fn$;

REVOKE ALL ON FUNCTION
  portal.gestiona_empresa(integer), portal.gestiona_pieza(integer),
  portal.trabaja_en_pieza(integer), portal.trabaja_en_proyecto(integer),
  portal.cliente_ve_pieza(integer), portal.pieza_en_revision(integer)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  portal.gestiona_empresa(integer), portal.gestiona_pieza(integer),
  portal.trabaja_en_pieza(integer), portal.trabaja_en_proyecto(integer),
  portal.cliente_ve_pieza(integer), portal.pieza_en_revision(integer)
  TO conejo_app;

-- ---------------------------------------------------------------------------
-- Seguridad por fila.
-- ---------------------------------------------------------------------------
ALTER TABLE portal.asignaciones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.proyectos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.piezas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.pieza_contenido   ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.pieza_fases       ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.tareas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.comentarios_pieza ENABLE ROW LEVEL SECURITY;

-- Asignaciones: las lee el admin, cada ejecutivo las suyas y las de las
-- empresas que atiende (para saber con quien la comparte). Las toca el admin.
DROP POLICY IF EXISTS asignaciones_lee ON portal.asignaciones;
CREATE POLICY asignaciones_lee ON portal.asignaciones
  FOR SELECT TO conejo_app
  USING (
    app_rol() = 'admin'
    OR usuario_id = app_usuario_id()
    OR portal.gestiona_empresa(empresa_id)
  );

DROP POLICY IF EXISTS asignaciones_escribe ON portal.asignaciones;
CREATE POLICY asignaciones_escribe ON portal.asignaciones
  FOR INSERT TO conejo_app
  WITH CHECK (app_rol() = 'admin' AND creado_por = app_usuario_id());

DROP POLICY IF EXISTS asignaciones_quita ON portal.asignaciones;
CREATE POLICY asignaciones_quita ON portal.asignaciones
  FOR DELETE TO conejo_app
  USING (app_rol() = 'admin');

-- Proyectos.
DROP POLICY IF EXISTS proyectos_lee ON portal.proyectos;
CREATE POLICY proyectos_lee ON portal.proyectos
  FOR SELECT TO conejo_app
  USING (
    portal.gestiona_empresa(empresa_id)
    OR (app_rol() = 'cliente' AND empresa_id = app_empresa_id())
    OR portal.trabaja_en_proyecto(id)
  );

DROP POLICY IF EXISTS proyectos_crea ON portal.proyectos;
CREATE POLICY proyectos_crea ON portal.proyectos
  FOR INSERT TO conejo_app
  WITH CHECK (portal.gestiona_empresa(empresa_id) AND creado_por = app_usuario_id());

DROP POLICY IF EXISTS proyectos_edita ON portal.proyectos;
CREATE POLICY proyectos_edita ON portal.proyectos
  FOR UPDATE TO conejo_app
  USING (portal.gestiona_empresa(empresa_id))
  WITH CHECK (portal.gestiona_empresa(empresa_id));

-- Piezas.
DROP POLICY IF EXISTS piezas_lee ON portal.piezas;
CREATE POLICY piezas_lee ON portal.piezas
  FOR SELECT TO conejo_app
  USING (
    portal.gestiona_pieza(id)
    OR portal.trabaja_en_pieza(id)
    OR portal.cliente_ve_pieza(id)
  );

DROP POLICY IF EXISTS piezas_crea ON portal.piezas;
CREATE POLICY piezas_crea ON portal.piezas
  FOR INSERT TO conejo_app
  WITH CHECK (EXISTS (
    SELECT 1 FROM portal.proyectos pr
    WHERE pr.id = proyecto_id AND portal.gestiona_empresa(pr.empresa_id)
  ));

DROP POLICY IF EXISTS piezas_edita ON portal.piezas;
CREATE POLICY piezas_edita ON portal.piezas
  FOR UPDATE TO conejo_app
  USING (portal.gestiona_pieza(id))
  WITH CHECK (portal.gestiona_pieza(id));

-- Copy: el equipo de la pieza siempre; el cliente, desde la fase 5.
DROP POLICY IF EXISTS pieza_contenido_lee ON portal.pieza_contenido;
CREATE POLICY pieza_contenido_lee ON portal.pieza_contenido
  FOR SELECT TO conejo_app
  USING (
    portal.gestiona_pieza(pieza_id)
    OR portal.trabaja_en_pieza(pieza_id)
    OR (portal.cliente_ve_pieza(pieza_id) AND portal.pieza_en_revision(pieza_id))
  );

DROP POLICY IF EXISTS pieza_contenido_escribe ON portal.pieza_contenido;
CREATE POLICY pieza_contenido_escribe ON portal.pieza_contenido
  FOR INSERT TO conejo_app
  WITH CHECK (portal.gestiona_pieza(pieza_id) OR portal.trabaja_en_pieza(pieza_id));

DROP POLICY IF EXISTS pieza_contenido_edita ON portal.pieza_contenido;
CREATE POLICY pieza_contenido_edita ON portal.pieza_contenido
  FOR UPDATE TO conejo_app
  USING (portal.gestiona_pieza(pieza_id) OR portal.trabaja_en_pieza(pieza_id))
  WITH CHECK (portal.gestiona_pieza(pieza_id) OR portal.trabaja_en_pieza(pieza_id));

-- Fases: las ve quien ve la pieza; las mueve quien la gestiona.
DROP POLICY IF EXISTS pieza_fases_lee ON portal.pieza_fases;
CREATE POLICY pieza_fases_lee ON portal.pieza_fases
  FOR SELECT TO conejo_app
  USING (
    portal.gestiona_pieza(pieza_id)
    OR portal.trabaja_en_pieza(pieza_id)
    OR portal.cliente_ve_pieza(pieza_id)
  );

DROP POLICY IF EXISTS pieza_fases_crea ON portal.pieza_fases;
CREATE POLICY pieza_fases_crea ON portal.pieza_fases
  FOR INSERT TO conejo_app
  WITH CHECK (portal.gestiona_pieza(pieza_id));

DROP POLICY IF EXISTS pieza_fases_mueve ON portal.pieza_fases;
CREATE POLICY pieza_fases_mueve ON portal.pieza_fases
  FOR UPDATE TO conejo_app
  USING (portal.gestiona_pieza(pieza_id))
  WITH CHECK (portal.gestiona_pieza(pieza_id));

-- Tareas: nunca el cliente. Quien la tiene asignada puede marcarla, pero no
-- pasarsela a otra persona: el WITH CHECK le exige seguir siendo responsable.
DROP POLICY IF EXISTS tareas_lee ON portal.tareas;
CREATE POLICY tareas_lee ON portal.tareas
  FOR SELECT TO conejo_app
  USING (
    app_rol() IN ('admin', 'trabajador')
    AND (portal.gestiona_pieza(pieza_id) OR portal.trabaja_en_pieza(pieza_id))
  );

DROP POLICY IF EXISTS tareas_crea ON portal.tareas;
CREATE POLICY tareas_crea ON portal.tareas
  FOR INSERT TO conejo_app
  WITH CHECK (portal.gestiona_pieza(pieza_id) AND creado_por = app_usuario_id());

DROP POLICY IF EXISTS tareas_gestiona ON portal.tareas;
CREATE POLICY tareas_gestiona ON portal.tareas
  FOR UPDATE TO conejo_app
  USING (portal.gestiona_pieza(pieza_id))
  WITH CHECK (portal.gestiona_pieza(pieza_id));

DROP POLICY IF EXISTS tareas_marca_la_suya ON portal.tareas;
CREATE POLICY tareas_marca_la_suya ON portal.tareas
  FOR UPDATE TO conejo_app
  USING (responsable_id = app_usuario_id())
  WITH CHECK (responsable_id = app_usuario_id());

DROP POLICY IF EXISTS tareas_quita ON portal.tareas;
CREATE POLICY tareas_quita ON portal.tareas
  FOR DELETE TO conejo_app
  USING (portal.gestiona_pieza(pieza_id) AND estado = 'pendiente');

-- Comentarios: el equipo de la pieza, a su nombre. Sin politica de cambio.
DROP POLICY IF EXISTS comentarios_pieza_lee ON portal.comentarios_pieza;
CREATE POLICY comentarios_pieza_lee ON portal.comentarios_pieza
  FOR SELECT TO conejo_app
  USING (
    app_rol() IN ('admin', 'trabajador')
    AND (portal.gestiona_pieza(pieza_id) OR portal.trabaja_en_pieza(pieza_id))
  );

DROP POLICY IF EXISTS comentarios_pieza_escribe ON portal.comentarios_pieza;
CREATE POLICY comentarios_pieza_escribe ON portal.comentarios_pieza
  FOR INSERT TO conejo_app
  WITH CHECK (
    autor_id = app_usuario_id()
    AND app_rol() IN ('admin', 'trabajador')
    AND (portal.gestiona_pieza(pieza_id) OR portal.trabaja_en_pieza(pieza_id))
  );

-- ---------------------------------------------------------------------------
-- El avance, calculado. security_invoker: la vista se consulta con las
-- politicas de quien pregunta, no con las de su duena.
--
-- Las cuatro alertas usan la fecha de la fase en curso y el dia de Caracas.
-- Una pieza cancelada no tiene alertas y no cuenta para el proyecto.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW portal.v_progreso_pieza
  WITH (security_invoker = true) AS
WITH base AS (
  SELECT p.id AS pieza_id,
         p.proyecto_id,
         p.ronda,
         p.estado,
         count(*) FILTER (WHERE f.estado = 'completada')::int      AS fases_completadas,
         min(f.fase) FILTER (WHERE f.estado <> 'completada')::int  AS fase_actual
  FROM portal.piezas p
  JOIN portal.pieza_fases f ON f.pieza_id = p.id
  GROUP BY p.id, p.proyecto_id, p.ronda, p.estado
),
hoy AS (SELECT (now() AT TIME ZONE 'America/Caracas')::date AS dia)
SELECT b.pieza_id,
       b.proyecto_id,
       b.ronda,
       b.estado,
       b.fases_completadas,
       b.fases_completadas * 20                                   AS porcentaje,
       b.fase_actual,
       b.fase_actual IS NULL                                      AS aprobada,
       f.fecha_estimada                                           AS fecha_estimada_actual,
       f.responsable_id                                           AS responsable_actual_id,
       (b.estado = 'activa' AND COALESCE(b.fase_actual = 5, false)) AS esperando_cliente,
       (b.estado = 'activa' AND b.ronda > 1 AND b.fase_actual IS NOT NULL)
                                                                  AS en_correccion,
       (b.estado = 'activa' AND COALESCE(f.fecha_estimada < hoy.dia, false))
                                                                  AS atrasada,
       (b.estado = 'activa' AND COALESCE(f.fecha_estimada BETWEEN hoy.dia AND hoy.dia + 2, false))
                                                                  AS por_vencer
FROM base b
CROSS JOIN hoy
LEFT JOIN portal.pieza_fases f ON f.pieza_id = b.pieza_id AND f.fase = b.fase_actual;

CREATE OR REPLACE VIEW portal.v_progreso_proyecto
  WITH (security_invoker = true) AS
SELECT pr.id                                                      AS proyecto_id,
       count(DISTINCT pi.id)::int                                 AS total_piezas,
       (count(*) FILTER (WHERE f.estado = 'completada'))::int     AS fases_completadas,
       CASE WHEN count(DISTINCT pi.id) = 0 THEN 0
            ELSE round(100.0 * count(*) FILTER (WHERE f.estado = 'completada')
                       / (5 * count(DISTINCT pi.id)), 2)
       END                                                        AS porcentaje,
       (count(DISTINCT pi.id) FILTER (WHERE f.fase = 5 AND f.estado = 'completada'))::int
                                                                  AS piezas_aprobadas
FROM portal.proyectos pr
LEFT JOIN portal.piezas pi
       ON pi.proyecto_id = pr.id AND pi.estado = 'activa'
LEFT JOIN portal.pieza_fases f ON f.pieza_id = pi.id
GROUP BY pr.id;

GRANT SELECT ON portal.v_progreso_pieza, portal.v_progreso_proyecto TO conejo_app;

COMMIT;

-- Comprobacion 1. Debe devolver tablas = 7 y con_seguridad_por_fila = 7.
SELECT count(*)                            AS tablas,
       count(*) FILTER (WHERE rowsecurity) AS con_seguridad_por_fila
FROM pg_tables
WHERE schemaname = 'portal'
  AND tablename IN ('asignaciones', 'proyectos', 'piezas', 'pieza_contenido',
                    'pieza_fases', 'tareas', 'comentarios_pieza');

-- Comprobacion 2. Debe devolver politicas = 22.
SELECT count(*) AS politicas
FROM pg_policies
WHERE schemaname = 'portal'
  AND tablename IN ('asignaciones', 'proyectos', 'piezas', 'pieza_contenido',
                    'pieza_fases', 'tareas', 'comentarios_pieza');

-- Comprobacion 3. Debe devolver vistas = 2.
SELECT count(*) AS vistas
FROM pg_views
WHERE schemaname = 'portal'
  AND viewname IN ('v_progreso_pieza', 'v_progreso_proyecto');
