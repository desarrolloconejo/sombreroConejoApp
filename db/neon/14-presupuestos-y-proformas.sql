-- ===========================================================================
-- 14 — Presupuestos y proformas
--
-- Etapa 5 del plan del portal. Anade el permiso de finanzas de cada cliente
-- (y su columna en la vista de usuarios, al final), los presupuestos, las
-- proformas, sus renglones y los proyectos de cada proforma, con su seguridad
-- por fila, los contadores de numeracion y las funciones que calculan,
-- copian y deciden.
--
-- Anade tambien una politica de lectura sobre portal.proyectos: quien opera
-- finanzas ve los proyectos para ligarlos a una proforma.
--
-- Idempotente. Solo anade: la vista gana una columna al final, que la version
-- publicada ignora, y nada de lo que existe cambia de comportamiento.
--
-- ORDEN: antes de subir la aplicacion, despues del 13.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- clientes.puede_ver_finanzas: quien de la empresa ve sus presupuestos,
-- proformas y facturas, y aprueba presupuestos (etapa 5).
--
-- Nace en falso para todos, como puede_aprobar: los importes de la empresa no
-- los ve cualquiera de su gente, y lo concede el administrador.
-- ---------------------------------------------------------------------------
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS puede_ver_finanzas BOOLEAN NOT NULL DEFAULT FALSE;

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
  c.puede_aprobar                            AS puede_aprobar,
  c.puede_ver_finanzas                       AS puede_ver_finanzas
FROM usuarios u
LEFT JOIN trabajadores t ON t.usuario_id = u.id
LEFT JOIN roles        r ON r.id         = t.rol_id
LEFT JOIN cargos       g ON g.id         = t.cargo_id
LEFT JOIN clientes     c ON c.usuario_id = u.id
LEFT JOIN empresas     e ON e.id         = c.empresa_id;

-- ===========================================================================
-- PRESUPUESTOS Y PROFORMAS
--
-- Etapa 5 del plan del portal (seccion 7). Los dos documentos digitales del
-- ciclo de cobro: el presupuesto, que el cliente aprueba en linea, y la
-- proforma, que nace del presupuesto aprobado y se liga a sus proyectos.
--
-- Lo que la base impone por si misma:
--
--   - Los importes los calcula PostgreSQL, en NUMERIC, al guardar los
--     renglones (`finanzas.guardar_renglones`). La aplicacion no escribe
--     totales: una vista previa en el navegador es orientativa.
--   - Un documento fuera de borrador no cambia de importes ni de renglones.
--   - La numeracion es consecutiva y sin saltos (`finanzas.siguiente_numero`).
--   - La aplicacion no borra en finanzas. Rehacer los renglones de un
--     borrador, o los proyectos de una proforma, pasa por funciones que lo
--     comprueban todo antes de tocar nada.
--   - El cliente no tiene UPDATE sobre presupuestos: podria cambiar montos.
--     Aprueba o rechaza con `finanzas.cliente_resuelve_presupuesto`.
--
-- Los conjuntos cerrados tienen su espejo en src/types/finanzas.ts.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Quien opera finanzas: el administrador, o un trabajador de administracion.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION finanzas.es_operador()
  RETURNS boolean
  LANGUAGE sql STABLE
  AS $fn$
    SELECT coalesce(
      app_rol() = 'admin'
      OR (app_rol() = 'trabajador' AND app_cargo() = 'administracion'),
      false
    )
  $fn$;

-- Si el cliente con sesion ve las finanzas de su empresa: tiene el permiso, y
-- su cuenta y su empresa siguen activas.
CREATE OR REPLACE FUNCTION finanzas.cliente_ve_finanzas()
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT app_rol() = 'cliente' AND EXISTS (
      SELECT 1 FROM clientes c
      JOIN usuarios u ON u.id = c.usuario_id
      JOIN empresas e ON e.id = c.empresa_id
      WHERE c.usuario_id = app_usuario_id()
        AND c.empresa_id = app_empresa_id()
        AND c.puede_ver_finanzas
        AND u.activo
        AND e.activo
    )
  $fn$;

REVOKE ALL ON FUNCTION finanzas.cliente_ve_finanzas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finanzas.es_operador(), finanzas.cliente_ve_finanzas()
  TO conejo_app;

-- El dia de hoy en Caracas: la validez de un presupuesto se mide en dias de
-- aqui, no en los del servidor.
CREATE OR REPLACE FUNCTION finanzas.hoy()
  RETURNS date
  LANGUAGE sql STABLE
  AS $fn$ SELECT (now() AT TIME ZONE 'America/Caracas')::date $fn$;

GRANT EXECUTE ON FUNCTION finanzas.hoy() TO conejo_app;

-- ---------------------------------------------------------------------------
-- finanzas.secuencias: los contadores de cada serie de documentos.
--
-- Nadie la toca directamente: solo `siguiente_numero`, que bloquea la fila
-- del contador hasta que termina la transaccion. Si la transaccion falla, el
-- numero no se consume: no quedan huecos.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finanzas.secuencias (
  clave  TEXT    PRIMARY KEY,
  ultimo INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT secuencias_ultimo_valido CHECK (ultimo >= 0)
);

ALTER TABLE finanzas.secuencias ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION finanzas.siguiente_numero(p_clave text)
  RETURNS integer
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
  DECLARE
    v_numero integer;
  BEGIN
    IF NOT finanzas.es_operador() THEN
      RAISE EXCEPTION 'No autorizado' USING ERRCODE = 'insufficient_privilege';
    END IF;

    INSERT INTO finanzas.secuencias (clave) VALUES (p_clave)
    ON CONFLICT (clave) DO NOTHING;

    UPDATE finanzas.secuencias SET ultimo = ultimo + 1
    WHERE clave = p_clave
    RETURNING ultimo INTO v_numero;

    RETURN v_numero;
  END
  $fn$;

REVOKE ALL ON FUNCTION finanzas.siguiente_numero(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finanzas.siguiente_numero(text) TO conejo_app;

-- ---------------------------------------------------------------------------
-- finanzas.presupuestos
--
-- Estados: borrador -> enviado -> aprobado o rechazado. «Vencido» no se
-- guarda: es un enviado cuya validez ya paso, y sale de la fecha.
--
-- Lo resuelve el cliente desde su cuenta o, si la empresa no tiene a nadie
-- con cuenta, un operador a su nombre (F14): `resuelto_por` dice quien fue y
-- `a_nombre_del_cliente` que no fue el cliente.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finanzas.presupuestos (
  id                   SERIAL        PRIMARY KEY,
  numero               INTEGER       NOT NULL UNIQUE,
  empresa_id           INTEGER       NOT NULL REFERENCES empresas(id),
  proyecto_id          INTEGER       REFERENCES portal.proyectos(id),

  titulo               TEXT          NOT NULL,
  estado               TEXT          NOT NULL DEFAULT 'borrador',
  moneda               TEXT          NOT NULL DEFAULT 'USD',

  base_imponible       NUMERIC(14,2) NOT NULL DEFAULT 0,
  monto_exento         NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva_pct              NUMERIC(5,2)  NOT NULL DEFAULT 16,
  iva_monto            NUMERIC(14,2) NOT NULL DEFAULT 0,
  total                NUMERIC(14,2) NOT NULL DEFAULT 0,

  valido_hasta         DATE          NOT NULL,
  notas                TEXT,

  creado_por           INTEGER       NOT NULL REFERENCES usuarios(id),
  creado_en            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  enviado_por          INTEGER       REFERENCES usuarios(id),
  enviado_en           TIMESTAMPTZ,
  resuelto_por         INTEGER       REFERENCES usuarios(id),
  resuelto_en          TIMESTAMPTZ,
  a_nombre_del_cliente BOOLEAN       NOT NULL DEFAULT FALSE,
  motivo_rechazo       TEXT,

  CONSTRAINT presupuestos_titulo_no_vacio
    CHECK (length(btrim(titulo)) > 0),
  CONSTRAINT presupuestos_estado_valido
    CHECK (estado IN ('borrador', 'enviado', 'aprobado', 'rechazado')),
  CONSTRAINT presupuestos_moneda_valida
    CHECK (moneda IN ('USD')),
  CONSTRAINT presupuestos_importes_validos
    CHECK (base_imponible >= 0 AND monto_exento >= 0 AND iva_monto >= 0
           AND iva_pct >= 0 AND iva_pct <= 100),
  CONSTRAINT presupuestos_totales_cuadran
    CHECK (total = base_imponible + monto_exento + iva_monto),
  CONSTRAINT presupuestos_envio_completo
    CHECK ((estado = 'borrador') = (enviado_en IS NULL)
       AND (enviado_en IS NULL) = (enviado_por IS NULL)),
  CONSTRAINT presupuestos_resolucion_completa
    CHECK ((estado IN ('aprobado', 'rechazado')) = (resuelto_en IS NOT NULL)
       AND (resuelto_en IS NULL) = (resuelto_por IS NULL)),
  CONSTRAINT presupuestos_rechazo_con_motivo
    CHECK (estado <> 'rechazado' OR length(btrim(coalesce(motivo_rechazo, ''))) > 0)
);

CREATE INDEX IF NOT EXISTS presupuestos_empresa_idx
  ON finanzas.presupuestos (empresa_id, estado);

-- ---------------------------------------------------------------------------
-- finanzas.proformas
--
-- Estados: borrador -> emitida -> facturada (etapa 7) o anulada. Nace del
-- presupuesto aprobado, o a mano. Una recurrente (contratos mensuales) dice
-- cuando toca la siguiente: nunca se emite sola. Cuando toca, un operador
-- prepara la copia en borrador, que apunta a su origen.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finanzas.proformas (
  id               SERIAL        PRIMARY KEY,
  numero           INTEGER       NOT NULL UNIQUE,
  empresa_id       INTEGER       NOT NULL REFERENCES empresas(id),
  presupuesto_id   INTEGER       REFERENCES finanzas.presupuestos(id),
  origen_id        INTEGER       REFERENCES finanzas.proformas(id),

  titulo           TEXT          NOT NULL,
  estado           TEXT          NOT NULL DEFAULT 'borrador',
  moneda           TEXT          NOT NULL DEFAULT 'USD',

  base_imponible   NUMERIC(14,2) NOT NULL DEFAULT 0,
  monto_exento     NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva_pct          NUMERIC(5,2)  NOT NULL DEFAULT 16,
  iva_monto        NUMERIC(14,2) NOT NULL DEFAULT 0,
  total            NUMERIC(14,2) NOT NULL DEFAULT 0,

  recurrente       BOOLEAN       NOT NULL DEFAULT FALSE,
  proxima_emision  DATE,
  notas            TEXT,

  creado_por       INTEGER       NOT NULL REFERENCES usuarios(id),
  creado_en        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  emitida_por      INTEGER       REFERENCES usuarios(id),
  emitida_en       TIMESTAMPTZ,
  anulada_por      INTEGER       REFERENCES usuarios(id),
  anulada_en       TIMESTAMPTZ,
  motivo_anulacion TEXT,

  CONSTRAINT proformas_titulo_no_vacio
    CHECK (length(btrim(titulo)) > 0),
  CONSTRAINT proformas_estado_valido
    CHECK (estado IN ('borrador', 'emitida', 'facturada', 'anulada')),
  CONSTRAINT proformas_moneda_valida
    CHECK (moneda IN ('USD')),
  CONSTRAINT proformas_importes_validos
    CHECK (base_imponible >= 0 AND monto_exento >= 0 AND iva_monto >= 0
           AND iva_pct >= 0 AND iva_pct <= 100),
  CONSTRAINT proformas_totales_cuadran
    CHECK (total = base_imponible + monto_exento + iva_monto),
  CONSTRAINT proformas_recurrente_con_fecha
    CHECK (NOT recurrente OR proxima_emision IS NOT NULL),
  CONSTRAINT proformas_emision_completa
    CHECK ((emitida_en IS NULL) = (emitida_por IS NULL)
       AND (estado IN ('borrador', 'anulada') OR emitida_en IS NOT NULL)),
  CONSTRAINT proformas_anulacion_completa
    CHECK ((estado = 'anulada') = (anulada_en IS NOT NULL)
       AND (anulada_en IS NULL) = (anulada_por IS NULL)
       AND (estado <> 'anulada' OR length(btrim(coalesce(motivo_anulacion, ''))) > 0))
);

CREATE INDEX IF NOT EXISTS proformas_empresa_idx
  ON finanzas.proformas (empresa_id, estado);
CREATE INDEX IF NOT EXISTS proformas_recurrentes_idx
  ON finanzas.proformas (proxima_emision) WHERE recurrente;

-- A que proyectos corresponde una proforma. Solo de su misma empresa.
CREATE TABLE IF NOT EXISTS finanzas.proforma_proyectos (
  proforma_id INTEGER NOT NULL REFERENCES finanzas.proformas(id),
  proyecto_id INTEGER NOT NULL REFERENCES portal.proyectos(id),

  PRIMARY KEY (proforma_id, proyecto_id)
);

CREATE INDEX IF NOT EXISTS proforma_proyectos_proyecto_idx
  ON finanzas.proforma_proyectos (proyecto_id);

-- ---------------------------------------------------------------------------
-- finanzas.documento_items: los renglones de presupuestos y proformas (y, en
-- la etapa 7, de facturas). Cada renglon tiene exactamente un documento.
--
-- El subtotal es cantidad por precio, redondeado a dos decimales. Lo escribe
-- `guardar_renglones`, nunca la aplicacion.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finanzas.documento_items (
  id              SERIAL        PRIMARY KEY,
  presupuesto_id  INTEGER       REFERENCES finanzas.presupuestos(id),
  proforma_id     INTEGER       REFERENCES finanzas.proformas(id),

  orden           SMALLINT      NOT NULL,
  descripcion     TEXT          NOT NULL,
  cantidad        NUMERIC(12,3) NOT NULL,
  precio_unitario NUMERIC(14,2) NOT NULL,
  exento          BOOLEAN       NOT NULL DEFAULT FALSE,
  subtotal        NUMERIC(14,2) NOT NULL,

  CONSTRAINT documento_items_un_documento
    CHECK (num_nonnulls(presupuesto_id, proforma_id) = 1),
  CONSTRAINT documento_items_descripcion_no_vacia
    CHECK (length(btrim(descripcion)) > 0),
  CONSTRAINT documento_items_montos_validos
    CHECK (cantidad > 0 AND precio_unitario >= 0),
  CONSTRAINT documento_items_subtotal_cuadra
    CHECK (subtotal = round(cantidad * precio_unitario, 2))
);

CREATE INDEX IF NOT EXISTS documento_items_presupuesto_idx
  ON finanzas.documento_items (presupuesto_id, orden);
CREATE INDEX IF NOT EXISTS documento_items_proforma_idx
  ON finanzas.documento_items (proforma_id, orden);

-- ---------------------------------------------------------------------------
-- Un documento fuera de borrador no cambia de importes, de empresa ni de
-- renglones. Lo que si cambia: el estado, quien y cuando, y en la proforma la
-- recurrencia (cuando toca la siguiente).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION finanzas.congelar_documento()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $fn$
  BEGIN
    IF OLD.estado <> 'borrador' AND (
         NEW.empresa_id     IS DISTINCT FROM OLD.empresa_id
      OR NEW.numero         IS DISTINCT FROM OLD.numero
      OR NEW.titulo         IS DISTINCT FROM OLD.titulo
      OR NEW.moneda         IS DISTINCT FROM OLD.moneda
      OR NEW.base_imponible IS DISTINCT FROM OLD.base_imponible
      OR NEW.monto_exento   IS DISTINCT FROM OLD.monto_exento
      OR NEW.iva_pct        IS DISTINCT FROM OLD.iva_pct
      OR NEW.iva_monto      IS DISTINCT FROM OLD.iva_monto
      OR NEW.total          IS DISTINCT FROM OLD.total
    ) THEN
      RAISE EXCEPTION 'Un documento fuera de borrador no cambia de importes'
        USING ERRCODE = 'check_violation';
    END IF;

    -- Un documento enviado no vuelve a borrador.
    IF OLD.estado <> 'borrador' AND NEW.estado = 'borrador' THEN
      RAISE EXCEPTION 'Un documento enviado no vuelve a borrador'
        USING ERRCODE = 'check_violation';
    END IF;

    -- Y uno resuelto ya no cambia: lo aprobado o rechazado queda asi, y una
    -- proforma anulada no se reactiva.
    IF OLD.estado IN ('aprobado', 'rechazado', 'anulada')
       AND NEW.estado IS DISTINCT FROM OLD.estado THEN
      RAISE EXCEPTION 'Un documento resuelto no cambia de estado'
        USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
  END
  $fn$;

DROP TRIGGER IF EXISTS presupuestos_congelados ON finanzas.presupuestos;
CREATE TRIGGER presupuestos_congelados
  BEFORE UPDATE ON finanzas.presupuestos
  FOR EACH ROW EXECUTE FUNCTION finanzas.congelar_documento();

DROP TRIGGER IF EXISTS proformas_congeladas ON finanzas.proformas;
CREATE TRIGGER proformas_congeladas
  BEFORE UPDATE ON finanzas.proformas
  FOR EACH ROW EXECUTE FUNCTION finanzas.congelar_documento();

-- Los renglones de un documento fuera de borrador no se tocan.
CREATE OR REPLACE FUNCTION finanzas.congelar_renglones()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $fn$
  DECLARE
    v_fila finanzas.documento_items;
    v_estado text;
  BEGIN
    v_fila := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;

    IF v_fila.presupuesto_id IS NOT NULL THEN
      SELECT estado INTO v_estado FROM finanzas.presupuestos WHERE id = v_fila.presupuesto_id;
    ELSE
      SELECT estado INTO v_estado FROM finanzas.proformas WHERE id = v_fila.proforma_id;
    END IF;

    IF v_estado IS DISTINCT FROM 'borrador' THEN
      RAISE EXCEPTION 'Los renglones de un documento fuera de borrador no cambian'
        USING ERRCODE = 'check_violation';
    END IF;

    RETURN v_fila;
  END
  $fn$;

DROP TRIGGER IF EXISTS documento_items_congelados ON finanzas.documento_items;
CREATE TRIGGER documento_items_congelados
  BEFORE INSERT OR UPDATE OR DELETE ON finanzas.documento_items
  FOR EACH ROW EXECUTE FUNCTION finanzas.congelar_renglones();

-- ---------------------------------------------------------------------------
-- Permisos. La aplicacion no borra en finanzas, y los renglones y los
-- proyectos de una proforma solo se escriben a traves de sus funciones.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON finanzas.presupuestos, finanzas.proformas TO conejo_app;
GRANT SELECT ON finanzas.documento_items, finanzas.proforma_proyectos TO conejo_app;
REVOKE INSERT, UPDATE, DELETE ON finanzas.documento_items, finanzas.proforma_proyectos
  FROM conejo_app;
REVOKE ALL ON finanzas.secuencias FROM conejo_app;
GRANT USAGE, SELECT ON SEQUENCE
  finanzas.presupuestos_id_seq, finanzas.proformas_id_seq TO conejo_app;

ALTER TABLE finanzas.presupuestos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE finanzas.proformas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE finanzas.proforma_proyectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE finanzas.documento_items    ENABLE ROW LEVEL SECURITY;

-- El operador ve y escribe todo. El cliente con permiso de finanzas lee lo de
-- su empresa que ya no es borrador; no escribe nada directamente.
DROP POLICY IF EXISTS presupuestos_lee ON finanzas.presupuestos;
CREATE POLICY presupuestos_lee ON finanzas.presupuestos
  FOR SELECT TO conejo_app
  USING (
    finanzas.es_operador()
    OR (estado <> 'borrador'
        AND empresa_id = app_empresa_id()
        AND finanzas.cliente_ve_finanzas())
  );

DROP POLICY IF EXISTS presupuestos_crea ON finanzas.presupuestos;
CREATE POLICY presupuestos_crea ON finanzas.presupuestos
  FOR INSERT TO conejo_app
  WITH CHECK (finanzas.es_operador() AND creado_por = app_usuario_id() AND estado = 'borrador');

DROP POLICY IF EXISTS presupuestos_edita ON finanzas.presupuestos;
CREATE POLICY presupuestos_edita ON finanzas.presupuestos
  FOR UPDATE TO conejo_app
  USING (finanzas.es_operador())
  WITH CHECK (finanzas.es_operador());

DROP POLICY IF EXISTS proformas_lee ON finanzas.proformas;
CREATE POLICY proformas_lee ON finanzas.proformas
  FOR SELECT TO conejo_app
  USING (
    finanzas.es_operador()
    OR (estado <> 'borrador'
        AND empresa_id = app_empresa_id()
        AND finanzas.cliente_ve_finanzas())
  );

DROP POLICY IF EXISTS proformas_crea ON finanzas.proformas;
CREATE POLICY proformas_crea ON finanzas.proformas
  FOR INSERT TO conejo_app
  WITH CHECK (finanzas.es_operador() AND creado_por = app_usuario_id() AND estado = 'borrador');

DROP POLICY IF EXISTS proformas_edita ON finanzas.proformas;
CREATE POLICY proformas_edita ON finanzas.proformas
  FOR UPDATE TO conejo_app
  USING (finanzas.es_operador())
  WITH CHECK (finanzas.es_operador());

-- Quien opera finanzas lee los proyectos: para ligarlos a una proforma y ver
-- a cual corresponde un presupuesto. Solo leerlos, y solo la tabla de
-- proyectos: ni sus piezas ni sus tareas. Es una politica mas, que se suma a
-- las de la etapa 3.
DROP POLICY IF EXISTS proyectos_lee_finanzas ON portal.proyectos;
CREATE POLICY proyectos_lee_finanzas ON portal.proyectos
  FOR SELECT TO conejo_app
  USING (finanzas.es_operador());

-- Renglones y proyectos de una proforma: los lee quien ve su documento.
DROP POLICY IF EXISTS documento_items_lee ON finanzas.documento_items;
CREATE POLICY documento_items_lee ON finanzas.documento_items
  FOR SELECT TO conejo_app
  USING (
    EXISTS (SELECT 1 FROM finanzas.presupuestos p WHERE p.id = presupuesto_id)
    OR EXISTS (SELECT 1 FROM finanzas.proformas p WHERE p.id = proforma_id)
  );

DROP POLICY IF EXISTS proforma_proyectos_lee ON finanzas.proforma_proyectos;
CREATE POLICY proforma_proyectos_lee ON finanzas.proforma_proyectos
  FOR SELECT TO conejo_app
  USING (EXISTS (SELECT 1 FROM finanzas.proformas p WHERE p.id = proforma_id));

-- ---------------------------------------------------------------------------
-- Guardar los renglones de un borrador: los sustituye todos y recalcula los
-- importes del documento. Es la unica escritura de renglones.
--
-- p_tipo es 'presupuesto' o 'proforma'. p_renglones, un arreglo JSON de
-- objetos { descripcion, cantidad, precioUnitario, exento }, en orden; las
-- cantidades y los precios viajan como texto decimal.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION finanzas.guardar_renglones(
  p_tipo text,
  p_documento integer,
  p_renglones jsonb
)
  RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
  DECLARE
    v_estado text;
    v_iva_pct numeric;
  BEGIN
    IF NOT finanzas.es_operador() THEN
      RAISE EXCEPTION 'No autorizado' USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF p_tipo = 'presupuesto' THEN
      SELECT estado, iva_pct INTO v_estado, v_iva_pct
      FROM finanzas.presupuestos WHERE id = p_documento FOR UPDATE;
    ELSIF p_tipo = 'proforma' THEN
      SELECT estado, iva_pct INTO v_estado, v_iva_pct
      FROM finanzas.proformas WHERE id = p_documento FOR UPDATE;
    ELSE
      RAISE EXCEPTION 'Tipo de documento no valido' USING ERRCODE = 'check_violation';
    END IF;

    IF v_estado IS DISTINCT FROM 'borrador' THEN
      RAISE EXCEPTION 'Solo se editan los borradores' USING ERRCODE = 'check_violation';
    END IF;

    IF jsonb_typeof(p_renglones) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Renglones no validos' USING ERRCODE = 'check_violation';
    END IF;

    IF p_tipo = 'presupuesto' THEN
      DELETE FROM finanzas.documento_items WHERE presupuesto_id = p_documento;
    ELSE
      DELETE FROM finanzas.documento_items WHERE proforma_id = p_documento;
    END IF;

    INSERT INTO finanzas.documento_items
      (presupuesto_id, proforma_id, orden, descripcion, cantidad,
       precio_unitario, exento, subtotal)
    SELECT
      CASE WHEN p_tipo = 'presupuesto' THEN p_documento END,
      CASE WHEN p_tipo = 'proforma' THEN p_documento END,
      r.orden,
      btrim(r.valor ->> 'descripcion'),
      (r.valor ->> 'cantidad')::numeric(12,3),
      (r.valor ->> 'precioUnitario')::numeric(14,2),
      coalesce((r.valor ->> 'exento')::boolean, false),
      round((r.valor ->> 'cantidad')::numeric(12,3)
            * (r.valor ->> 'precioUnitario')::numeric(14,2), 2)
    FROM jsonb_array_elements(p_renglones) WITH ORDINALITY AS r(valor, orden);

    -- Los importes salen de los renglones recien escritos. El IVA se
    -- redondea una vez, sobre la base, nunca sobre acumulados.
    IF p_tipo = 'presupuesto' THEN
      UPDATE finanzas.presupuestos d SET
        base_imponible = s.base,
        monto_exento   = s.exento,
        iva_monto      = round(s.base * v_iva_pct / 100, 2),
        total          = s.base + s.exento + round(s.base * v_iva_pct / 100, 2)
      FROM (
        SELECT coalesce(sum(subtotal) FILTER (WHERE NOT exento), 0) AS base,
               coalesce(sum(subtotal) FILTER (WHERE exento), 0)     AS exento
        FROM finanzas.documento_items WHERE presupuesto_id = p_documento
      ) s
      WHERE d.id = p_documento;
    ELSE
      UPDATE finanzas.proformas d SET
        base_imponible = s.base,
        monto_exento   = s.exento,
        iva_monto      = round(s.base * v_iva_pct / 100, 2),
        total          = s.base + s.exento + round(s.base * v_iva_pct / 100, 2)
      FROM (
        SELECT coalesce(sum(subtotal) FILTER (WHERE NOT exento), 0) AS base,
               coalesce(sum(subtotal) FILTER (WHERE exento), 0)     AS exento
        FROM finanzas.documento_items WHERE proforma_id = p_documento
      ) s
      WHERE d.id = p_documento;
    END IF;
  END
  $fn$;

REVOKE ALL ON FUNCTION finanzas.guardar_renglones(text, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finanzas.guardar_renglones(text, integer, jsonb) TO conejo_app;

-- ---------------------------------------------------------------------------
-- Los proyectos de una proforma en borrador: sustituye la lista entera. Solo
-- proyectos de la misma empresa.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION finanzas.ligar_proyectos(p_proforma integer, p_proyectos integer[])
  RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
  DECLARE
    v_estado text;
    v_empresa integer;
  BEGIN
    IF NOT finanzas.es_operador() THEN
      RAISE EXCEPTION 'No autorizado' USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT estado, empresa_id INTO v_estado, v_empresa
    FROM finanzas.proformas WHERE id = p_proforma FOR UPDATE;

    IF v_estado IS DISTINCT FROM 'borrador' THEN
      RAISE EXCEPTION 'Solo se editan los borradores' USING ERRCODE = 'check_violation';
    END IF;

    IF EXISTS (
      SELECT 1 FROM unnest(coalesce(p_proyectos, '{}')) AS x(id)
      LEFT JOIN portal.proyectos pr ON pr.id = x.id
      WHERE pr.id IS NULL OR pr.empresa_id <> v_empresa
    ) THEN
      RAISE EXCEPTION 'Un proyecto no es de la empresa de la proforma'
        USING ERRCODE = 'check_violation';
    END IF;

    DELETE FROM finanzas.proforma_proyectos WHERE proforma_id = p_proforma;

    INSERT INTO finanzas.proforma_proyectos (proforma_id, proyecto_id)
    SELECT DISTINCT p_proforma, x.id FROM unnest(coalesce(p_proyectos, '{}')) AS x(id);
  END
  $fn$;

REVOKE ALL ON FUNCTION finanzas.ligar_proyectos(integer, integer[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finanzas.ligar_proyectos(integer, integer[]) TO conejo_app;

-- ---------------------------------------------------------------------------
-- Una proforma en borrador copiada de otro documento: de un presupuesto
-- aprobado, o de una proforma recurrente a la que le toca. Copia cabecera,
-- renglones y proyectos, y devuelve el id nuevo.
--
-- En la recurrente, ademas, la fecha de la siguiente avanza un mes: asi la
-- portada deja de pedirla hasta que vuelva a tocar.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION finanzas.proforma_desde(p_tipo text, p_origen integer)
  RETURNS integer
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
  DECLARE
    v_nueva integer;
    v_fila record;
  BEGIN
    IF NOT finanzas.es_operador() THEN
      RAISE EXCEPTION 'No autorizado' USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF p_tipo = 'presupuesto' THEN
      SELECT * INTO v_fila FROM finanzas.presupuestos WHERE id = p_origen FOR UPDATE;

      IF v_fila.estado IS DISTINCT FROM 'aprobado' THEN
        RAISE EXCEPTION 'El presupuesto no esta aprobado' USING ERRCODE = 'check_violation';
      END IF;

      -- Una sola proforma vigente por presupuesto. Si la que tenia se anulo,
      -- se puede generar otra.
      IF EXISTS (
        SELECT 1 FROM finanzas.proformas
        WHERE presupuesto_id = p_origen AND origen_id IS NULL AND estado <> 'anulada'
      ) THEN
        RAISE EXCEPTION 'El presupuesto ya tiene su proforma' USING ERRCODE = 'unique_violation';
      END IF;

      INSERT INTO finanzas.proformas
        (numero, empresa_id, presupuesto_id, titulo, moneda, iva_pct, notas, creado_por)
      VALUES
        (finanzas.siguiente_numero('PROFORMA'), v_fila.empresa_id, v_fila.id,
         v_fila.titulo, v_fila.moneda, v_fila.iva_pct, v_fila.notas, app_usuario_id())
      RETURNING id INTO v_nueva;

      INSERT INTO finanzas.documento_items
        (proforma_id, orden, descripcion, cantidad, precio_unitario, exento, subtotal)
      SELECT v_nueva, orden, descripcion, cantidad, precio_unitario, exento, subtotal
      FROM finanzas.documento_items WHERE presupuesto_id = p_origen;

      IF v_fila.proyecto_id IS NOT NULL THEN
        INSERT INTO finanzas.proforma_proyectos (proforma_id, proyecto_id)
        VALUES (v_nueva, v_fila.proyecto_id);
      END IF;

    ELSIF p_tipo = 'recurrente' THEN
      SELECT * INTO v_fila FROM finanzas.proformas WHERE id = p_origen FOR UPDATE;

      IF NOT coalesce(v_fila.recurrente, false) OR v_fila.estado IN ('borrador', 'anulada') THEN
        RAISE EXCEPTION 'La proforma no es una recurrente en curso' USING ERRCODE = 'check_violation';
      END IF;

      INSERT INTO finanzas.proformas
        (numero, empresa_id, presupuesto_id, origen_id, titulo, moneda, iva_pct, notas, creado_por)
      VALUES
        (finanzas.siguiente_numero('PROFORMA'), v_fila.empresa_id, v_fila.presupuesto_id,
         v_fila.id, v_fila.titulo, v_fila.moneda, v_fila.iva_pct, v_fila.notas, app_usuario_id())
      RETURNING id INTO v_nueva;

      INSERT INTO finanzas.documento_items
        (proforma_id, orden, descripcion, cantidad, precio_unitario, exento, subtotal)
      SELECT v_nueva, orden, descripcion, cantidad, precio_unitario, exento, subtotal
      FROM finanzas.documento_items WHERE proforma_id = p_origen;

      INSERT INTO finanzas.proforma_proyectos (proforma_id, proyecto_id)
      SELECT v_nueva, proyecto_id FROM finanzas.proforma_proyectos WHERE proforma_id = p_origen;

      UPDATE finanzas.proformas
      SET proxima_emision = (proxima_emision + interval '1 month')::date
      WHERE id = p_origen;

    ELSE
      RAISE EXCEPTION 'Origen no valido' USING ERRCODE = 'check_violation';
    END IF;

    -- Los importes de la copia salen de sus renglones, como siempre.
    UPDATE finanzas.proformas d SET
      base_imponible = s.base,
      monto_exento   = s.exento,
      iva_monto      = round(s.base * d.iva_pct / 100, 2),
      total          = s.base + s.exento + round(s.base * d.iva_pct / 100, 2)
    FROM (
      SELECT coalesce(sum(subtotal) FILTER (WHERE NOT exento), 0) AS base,
             coalesce(sum(subtotal) FILTER (WHERE exento), 0)     AS exento
      FROM finanzas.documento_items WHERE proforma_id = v_nueva
    ) s
    WHERE d.id = v_nueva;

    RETURN v_nueva;
  END
  $fn$;

REVOKE ALL ON FUNCTION finanzas.proforma_desde(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finanzas.proforma_desde(text, integer) TO conejo_app;

-- ---------------------------------------------------------------------------
-- El cliente aprueba o rechaza un presupuesto enviado y vigente.
--
-- No es un UPDATE del cliente —podria cambiar los montos—: esta funcion solo
-- toca el estado, quien y cuando, y el motivo de un rechazo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION finanzas.cliente_resuelve_presupuesto(
  p_presupuesto integer,
  p_aprobar boolean,
  p_motivo text
)
  RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
  BEGIN
    IF NOT finanzas.cliente_ve_finanzas() THEN
      RAISE EXCEPTION 'No autorizado' USING ERRCODE = 'insufficient_privilege';
    END IF;

    UPDATE finanzas.presupuestos SET
      estado         = CASE WHEN p_aprobar THEN 'aprobado' ELSE 'rechazado' END,
      resuelto_por   = app_usuario_id(),
      resuelto_en    = now(),
      motivo_rechazo = CASE WHEN p_aprobar THEN NULL ELSE btrim(p_motivo) END
    WHERE id = p_presupuesto
      AND empresa_id = app_empresa_id()
      AND estado = 'enviado'
      AND valido_hasta >= finanzas.hoy();

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El presupuesto no esta pendiente de aprobacion'
        USING ERRCODE = 'check_violation';
    END IF;
  END
  $fn$;

REVOKE ALL ON FUNCTION finanzas.cliente_resuelve_presupuesto(integer, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finanzas.cliente_resuelve_presupuesto(integer, boolean, text)
  TO conejo_app;

COMMIT;

-- ---------------------------------------------------------------------------
-- Comprobacion 1. Debe devolver tablas = 5 y con_seguridad_por_fila = 5.
-- ---------------------------------------------------------------------------
SELECT count(*) AS tablas,
       count(*) FILTER (WHERE rowsecurity) AS con_seguridad_por_fila
FROM pg_tables
WHERE schemaname = 'finanzas'
  AND tablename IN ('secuencias', 'presupuestos', 'proformas', 'proforma_proyectos', 'documento_items');

-- Comprobacion 2. Debe devolver politicas = 8, funciones = 10 y
-- politica_proyectos = 1.
SELECT (SELECT count(*) FROM pg_policies
        WHERE schemaname = 'finanzas'
          AND tablename IN ('presupuestos', 'proformas', 'proforma_proyectos', 'documento_items')) AS politicas,
       (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'finanzas'
          AND p.proname IN ('es_operador', 'cliente_ve_finanzas', 'hoy', 'siguiente_numero',
                            'congelar_documento', 'congelar_renglones', 'guardar_renglones',
                            'ligar_proyectos', 'proforma_desde', 'cliente_resuelve_presupuesto')) AS funciones,
       (SELECT count(*) FROM pg_policies
        WHERE schemaname = 'portal' AND policyname = 'proyectos_lee_finanzas') AS politica_proyectos;

-- Comprobacion 3. Nadie ve las finanzas todavia: debe devolver 0.
SELECT count(*) AS clientes_con_finanzas FROM clientes WHERE puede_ver_finanzas;
