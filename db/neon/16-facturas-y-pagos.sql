-- ===========================================================================
-- 16 — Facturas, pagos y cobranza
--
-- Etapa 7 del plan del portal. Anade los ajustes de finanzas (emisor,
-- impuestos, numeracion), los formatos de impresion, los medios de pago, las
-- facturas con sus renglones, los pagos y retenciones, la vista del estado de
-- cobro y las funciones que emiten, anulan y fijan la numeracion. En empresas,
-- tres columnas: agente de retencion, su porcentaje y dias de credito.
--
-- Trae un formato de impresion de ejemplo (carta) y cuatro medios de pago de
-- ejemplo sin datos bancarios. El emisor nace VACIO: no se emite ninguna
-- factura hasta llenarlo en Finanzas -> Ajustes. Lo provisional esta en
-- docs/pendientesIntegracion.md.
--
-- Idempotente. Solo anade: tablas, funciones y columnas nuevas, que la
-- version publicada ignora.
--
-- ORDEN: antes de subir la aplicacion, despues del 15.
-- ===========================================================================

BEGIN;

-- ===========================================================================
-- FACTURAS, PAGOS Y COBRANZA
--
-- Etapa 7 del plan del portal (secciones 7.6 a 7.11). La factura nace de una
-- proforma emitida, en bolivares a la tasa del dia, con su numero y su numero
-- de control; el cliente reporta pagos y retenciones, y quien opera finanzas
-- los confirma o los rechaza.
--
-- Se construye con valores de ejemplo (seccion 7.11): emisor, numeracion,
-- formatos de impresion, medios de pago e impuestos viven en tablas que el
-- operador edita. Lo que hay que sustituir esta en docs/pendientesIntegracion.md.
--
-- Lo que la base impone por si misma:
--
--   - Emitir pasa por `finanzas.emitir_factura`: numero y numero de control
--     sin huecos, tasa del dia, importes calculados aqui y una copia
--     congelada del emisor y del cliente. La aplicacion no inserta facturas.
--   - Una factura emitida no cambia: solo se anula (con motivo) o se marca
--     impresa. Sus renglones no se tocan nunca.
--   - Los proximos numeros solo suben (`finanzas.fijar_numeracion`).
--   - El cliente solo crea pagos por confirmar, a su nombre, sobre una
--     factura emitida de su empresa. Un pago resuelto ya no cambia.
--
-- Los conjuntos cerrados tienen su espejo en src/types/facturas.ts.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- finanzas.ajustes: una sola fila con lo que se configura una vez.
--
-- El emisor nace vacio: no se emite hasta llenarlo. Los impuestos que el
-- contador no ha confirmado (ISLR, IGTF) nacen apagados.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finanzas.ajustes (
  id                  SMALLINT      PRIMARY KEY DEFAULT 1,

  emisor_razon_social TEXT,
  emisor_rif          TEXT,
  emisor_domicilio    TEXT,

  iva_pct             NUMERIC(5,2)  NOT NULL DEFAULT 16,
  islr_activo         BOOLEAN       NOT NULL DEFAULT FALSE,
  islr_pct            NUMERIC(5,2)  NOT NULL DEFAULT 5,
  igtf_activo         BOOLEAN       NOT NULL DEFAULT FALSE,
  igtf_pct            NUMERIC(5,2)  NOT NULL DEFAULT 3,
  dias_credito        SMALLINT      NOT NULL DEFAULT 15,

  factura_serie       TEXT          NOT NULL DEFAULT 'A',
  control_prefijo     TEXT          NOT NULL DEFAULT '00-',
  control_hasta       INTEGER       NOT NULL DEFAULT 500,

  actualizado_por     INTEGER       REFERENCES usuarios(id),
  actualizado_en      TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT ajustes_una_fila CHECK (id = 1),
  CONSTRAINT ajustes_porcentajes_validos CHECK (
    iva_pct BETWEEN 0 AND 100 AND islr_pct BETWEEN 0 AND 100 AND igtf_pct BETWEEN 0 AND 100
  ),
  CONSTRAINT ajustes_dias_credito_validos CHECK (dias_credito BETWEEN 0 AND 365),
  CONSTRAINT ajustes_serie_formato CHECK (factura_serie ~ '^[A-Z]{1,3}$'),
  CONSTRAINT ajustes_prefijo_formato CHECK (control_prefijo ~ '^[0-9A-Z-]{0,6}$'),
  CONSTRAINT ajustes_control_hasta_valido CHECK (control_hasta > 0)
);

INSERT INTO finanzas.ajustes (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- finanzas.formatos_impresion: donde va cada dato de la factura en una hoja.
--
-- Medidas en milimetros desde la esquina superior izquierda de la hoja.
-- `campos` es un objeto { clave: { x, y, ancho, alinear? } } y `renglones`,
-- { y_inicio, alto_mm, max, columnas: { clave: { x, ancho, alinear? } } }. La
-- forma la valida la aplicacion (src/lib/finanzas/formatos.ts). Uno es el
-- habitual; se desactivan, no se borran.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finanzas.formatos_impresion (
  id             SERIAL        PRIMARY KEY,
  nombre         TEXT          NOT NULL UNIQUE,
  ancho_mm       NUMERIC(6,1)  NOT NULL,
  alto_mm        NUMERIC(6,1)  NOT NULL,
  fuente_pt      NUMERIC(4,1)  NOT NULL DEFAULT 9,
  campos         JSONB         NOT NULL,
  renglones      JSONB         NOT NULL,
  habitual       BOOLEAN       NOT NULL DEFAULT FALSE,
  activo         BOOLEAN       NOT NULL DEFAULT TRUE,
  creado_por     INTEGER       REFERENCES usuarios(id),
  creado_en      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT formatos_nombre_no_vacio CHECK (length(btrim(nombre)) > 0),
  CONSTRAINT formatos_medidas_validas CHECK (
    ancho_mm BETWEEN 50 AND 500 AND alto_mm BETWEEN 50 AND 500 AND fuente_pt BETWEEN 5 AND 20
  ),
  CONSTRAINT formatos_campos_objeto CHECK (jsonb_typeof(campos) = 'object'),
  CONSTRAINT formatos_renglones_max CHECK (
    jsonb_typeof(renglones) = 'object'
    AND (renglones ->> 'max') ~ '^[0-9]+$'
    AND (renglones ->> 'max')::int BETWEEN 1 AND 60
  ),
  CONSTRAINT formatos_habitual_activo CHECK (NOT habitual OR activo)
);

CREATE UNIQUE INDEX IF NOT EXISTS formatos_un_habitual
  ON finanzas.formatos_impresion ((true)) WHERE habitual;

-- El formato de ejemplo, tamano carta. Se sustituye por el del talonario real
-- al calibrar con su hoja (docs/pendientesIntegracion.md, V4).
INSERT INTO finanzas.formatos_impresion (nombre, ancho_mm, alto_mm, fuente_pt, campos, renglones, habitual)
SELECT 'Carta (ejemplo)', 215.9, 279.4, 9,
  '{
    "numero":        {"x": 150, "y": 20,  "ancho": 50},
    "fecha":         {"x": 150, "y": 28,  "ancho": 50},
    "vence":         {"x": 150, "y": 34,  "ancho": 50},
    "razonSocial":   {"x": 30,  "y": 42,  "ancho": 115},
    "rif":           {"x": 160, "y": 42,  "ancho": 40},
    "domicilio":     {"x": 30,  "y": 49,  "ancho": 170},
    "tasa":          {"x": 12,  "y": 166, "ancho": 110},
    "referenciaUsd": {"x": 12,  "y": 172, "ancho": 110},
    "baseImponible": {"x": 165, "y": 160, "ancho": 35, "alinear": "derecha"},
    "exento":        {"x": 165, "y": 166, "ancho": 35, "alinear": "derecha"},
    "ivaPct":        {"x": 140, "y": 172, "ancho": 20, "alinear": "derecha"},
    "ivaMonto":      {"x": 165, "y": 172, "ancho": 35, "alinear": "derecha"},
    "total":         {"x": 165, "y": 179, "ancho": 35, "alinear": "derecha"}
  }'::jsonb,
  '{
    "y_inicio": 70, "alto_mm": 6, "max": 14,
    "columnas": {
      "cantidad":    {"x": 12,  "ancho": 14, "alinear": "derecha"},
      "descripcion": {"x": 30,  "ancho": 100},
      "precio":      {"x": 132, "ancho": 30, "alinear": "derecha"},
      "subtotal":    {"x": 165, "ancho": 35, "alinear": "derecha"}
    }
  }'::jsonb,
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM finanzas.formatos_impresion);

-- ---------------------------------------------------------------------------
-- finanzas.medios_pago: como puede pagar un cliente. Se desactivan, no se
-- borran: un pago viejo puede citar uno retirado. Los de ejemplo no llevan
-- datos bancarios (docs/pendientesIntegracion.md, V5).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finanzas.medios_pago (
  id               SERIAL      PRIMARY KEY,
  nombre           TEXT        NOT NULL UNIQUE,
  monedas          TEXT[]      NOT NULL,
  pide_referencia  BOOLEAN     NOT NULL DEFAULT TRUE,
  datos_para_pagar TEXT,
  orden            SMALLINT    NOT NULL DEFAULT 0,
  activo           BOOLEAN     NOT NULL DEFAULT TRUE,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT medios_nombre_no_vacio CHECK (length(btrim(nombre)) > 0),
  CONSTRAINT medios_monedas_validas CHECK (
    cardinality(monedas) > 0 AND monedas <@ ARRAY['USD', 'VES']::text[]
  )
);

INSERT INTO finanzas.medios_pago (nombre, monedas, pide_referencia, orden)
SELECT v.nombre, v.monedas, v.pide, v.orden
FROM (VALUES
  ('Transferencia bancaria', ARRAY['USD', 'VES']::text[], TRUE,  1),
  ('Pago movil',             ARRAY['VES']::text[],        TRUE,  2),
  ('Zelle',                  ARRAY['USD']::text[],        TRUE,  3),
  ('Efectivo',               ARRAY['USD', 'VES']::text[], FALSE, 4)
) AS v(nombre, monedas, pide, orden)
WHERE NOT EXISTS (SELECT 1 FROM finanzas.medios_pago);

-- ---------------------------------------------------------------------------
-- La retencion de IVA y el credito de cada empresa.
-- ---------------------------------------------------------------------------
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS agente_retencion BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS retencion_iva_pct NUMERIC(5,2);
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS dias_credito SMALLINT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'empresas_retencion_coherente') THEN
    ALTER TABLE empresas ADD CONSTRAINT empresas_retencion_coherente CHECK (
      (agente_retencion AND retencion_iva_pct IN (75, 100))
      OR (NOT agente_retencion AND retencion_iva_pct IS NULL)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'empresas_dias_credito_validos') THEN
    ALTER TABLE empresas ADD CONSTRAINT empresas_dias_credito_validos
      CHECK (dias_credito IS NULL OR dias_credito BETWEEN 0 AND 365);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- finanzas.facturas
--
-- Nace emitida; «pagada» no se guarda, sale de v_estado_cobro_factura. Los
-- importes van en bolivares; `total_usd` y la tasa guardan de donde salieron.
-- `emisor` y `cliente` son copias congeladas: cambiar los ajustes o la ficha
-- de la empresa no altera una factura emitida.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finanzas.facturas (
  id                   SERIAL        PRIMARY KEY,
  serie                TEXT          NOT NULL,
  numero               INTEGER       NOT NULL,
  numero_control       TEXT          NOT NULL UNIQUE,
  empresa_id           INTEGER       NOT NULL REFERENCES empresas(id),
  proforma_id          INTEGER       NOT NULL REFERENCES finanzas.proformas(id),

  estado               TEXT          NOT NULL DEFAULT 'emitida',
  moneda               TEXT          NOT NULL DEFAULT 'VES',
  fecha_emision        DATE          NOT NULL,
  vence_el             DATE          NOT NULL,

  tasa                 NUMERIC(20,8) NOT NULL,
  tasa_fuente          TEXT          NOT NULL,
  tasa_fecha           DATE          NOT NULL,
  total_usd            NUMERIC(14,2) NOT NULL,

  base_imponible       NUMERIC(16,2) NOT NULL,
  monto_exento         NUMERIC(16,2) NOT NULL,
  iva_pct              NUMERIC(5,2)  NOT NULL,
  iva_monto            NUMERIC(16,2) NOT NULL,
  total                NUMERIC(16,2) NOT NULL,
  retencion_iva_pct    NUMERIC(5,2),
  retencion_esperada   NUMERIC(16,2) NOT NULL DEFAULT 0,

  emisor               JSONB         NOT NULL,
  cliente              JSONB         NOT NULL,

  emitida_por          INTEGER       NOT NULL REFERENCES usuarios(id),
  emitida_en           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  impresa_por          INTEGER       REFERENCES usuarios(id),
  impresa_en           TIMESTAMPTZ,
  anulada_por          INTEGER       REFERENCES usuarios(id),
  anulada_en           TIMESTAMPTZ,
  motivo_anulacion     TEXT,

  CONSTRAINT facturas_numero_unico UNIQUE (serie, numero),
  CONSTRAINT facturas_estado_valido CHECK (estado IN ('emitida', 'anulada')),
  CONSTRAINT facturas_moneda_valida CHECK (moneda IN ('VES')),
  CONSTRAINT facturas_totales_cuadran CHECK (total = base_imponible + monto_exento + iva_monto),
  CONSTRAINT facturas_importes_validos CHECK (
    base_imponible >= 0 AND monto_exento >= 0 AND iva_monto >= 0 AND total_usd >= 0
    AND retencion_esperada >= 0 AND retencion_esperada <= iva_monto
  ),
  CONSTRAINT facturas_tasa_valida CHECK (tasa > 0),
  CONSTRAINT facturas_vence_valido CHECK (vence_el >= fecha_emision),
  CONSTRAINT facturas_anulacion_completa CHECK (
    (estado = 'anulada') = (anulada_en IS NOT NULL)
    AND (anulada_en IS NULL) = (anulada_por IS NULL)
    AND (estado <> 'anulada' OR length(btrim(coalesce(motivo_anulacion, ''))) > 0)
  ),
  CONSTRAINT facturas_impresion_completa CHECK ((impresa_en IS NULL) = (impresa_por IS NULL))
);

CREATE INDEX IF NOT EXISTS facturas_empresa_idx ON finanzas.facturas (empresa_id, estado);
CREATE INDEX IF NOT EXISTS facturas_proforma_idx ON finanzas.facturas (proforma_id);
CREATE UNIQUE INDEX IF NOT EXISTS facturas_una_vigente_por_proforma
  ON finanzas.facturas (proforma_id) WHERE estado = 'emitida';

-- Los renglones de una factura, ya en bolivares. Solo los escribe
-- emitir_factura y no cambian nunca.
CREATE TABLE IF NOT EXISTS finanzas.factura_items (
  id              SERIAL        PRIMARY KEY,
  factura_id      INTEGER       NOT NULL REFERENCES finanzas.facturas(id),
  orden           SMALLINT      NOT NULL,
  descripcion     TEXT          NOT NULL,
  cantidad        NUMERIC(12,3) NOT NULL,
  precio_unitario NUMERIC(16,2) NOT NULL,
  exento          BOOLEAN       NOT NULL,
  subtotal        NUMERIC(16,2) NOT NULL,

  CONSTRAINT factura_items_subtotal_cuadra CHECK (subtotal = round(cantidad * precio_unitario, 2))
);

CREATE INDEX IF NOT EXISTS factura_items_factura_idx ON finanzas.factura_items (factura_id, orden);

-- ---------------------------------------------------------------------------
-- finanzas.pagos: pagos y retenciones reportados contra una factura.
--
-- El cliente reporta (por confirmar); el operador confirma fijando el monto
-- aplicado en bolivares, con la tasa que uso si pagaron en dolares, o rechaza
-- con motivo. El operador tambien puede registrar uno a nombre del cliente.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finanzas.pagos (
  id                    SERIAL        PRIMARY KEY,
  factura_id            INTEGER       NOT NULL REFERENCES finanzas.facturas(id),
  tipo                  TEXT          NOT NULL,
  medio_id              INTEGER       REFERENCES finanzas.medios_pago(id),
  referencia            TEXT,
  fecha_pago            DATE          NOT NULL,
  monto                 NUMERIC(16,2) NOT NULL,
  moneda                TEXT          NOT NULL,
  comprobante_archivo   TEXT,
  comprobante_mime      TEXT,

  estado                TEXT          NOT NULL DEFAULT 'por_confirmar',
  monto_aplicado        NUMERIC(16,2),
  tasa_aplicada         NUMERIC(20,8),
  motivo_rechazo        TEXT,

  reportado_por         INTEGER       NOT NULL REFERENCES usuarios(id),
  reportado_en          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  a_nombre_del_cliente  BOOLEAN       NOT NULL DEFAULT FALSE,
  resuelto_por          INTEGER       REFERENCES usuarios(id),
  resuelto_en           TIMESTAMPTZ,

  CONSTRAINT pagos_tipo_valido CHECK (tipo IN ('pago', 'retencion_iva', 'retencion_islr')),
  CONSTRAINT pagos_moneda_valida CHECK (moneda IN ('USD', 'VES')),
  CONSTRAINT pagos_estado_valido CHECK (estado IN ('por_confirmar', 'confirmado', 'rechazado')),
  CONSTRAINT pagos_monto_positivo CHECK (monto > 0),
  CONSTRAINT pagos_medio_si_es_pago CHECK ((tipo = 'pago') = (medio_id IS NOT NULL)),
  CONSTRAINT pagos_retencion_en_bolivares CHECK (tipo = 'pago' OR moneda = 'VES'),
  CONSTRAINT pagos_confirmado_con_monto CHECK (
    (estado = 'confirmado') = (monto_aplicado IS NOT NULL)
    AND (monto_aplicado IS NULL OR monto_aplicado > 0)
    AND (moneda = 'VES' OR estado <> 'confirmado' OR coalesce(tasa_aplicada, 0) > 0)
  ),
  CONSTRAINT pagos_rechazo_con_motivo CHECK (
    estado <> 'rechazado' OR length(btrim(coalesce(motivo_rechazo, ''))) > 0
  ),
  CONSTRAINT pagos_resolucion_completa CHECK (
    (estado <> 'por_confirmar') = (resuelto_en IS NOT NULL)
    AND (resuelto_en IS NULL) = (resuelto_por IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS pagos_factura_idx ON finanzas.pagos (factura_id, estado);
CREATE INDEX IF NOT EXISTS pagos_por_confirmar_idx
  ON finanzas.pagos (reportado_en) WHERE estado = 'por_confirmar';

-- ---------------------------------------------------------------------------
-- Lo que no cambia.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION finanzas.facturas_inmutables()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $fn$
  BEGIN
    IF OLD.estado = 'anulada' THEN
      RAISE EXCEPTION 'Una factura anulada no cambia' USING ERRCODE = 'check_violation';
    END IF;

    -- Solo cambian la anulacion y la marca de impresa.
    IF (to_jsonb(NEW) - ARRAY['estado', 'anulada_por', 'anulada_en', 'motivo_anulacion',
                              'impresa_por', 'impresa_en'])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['estado', 'anulada_por', 'anulada_en', 'motivo_anulacion',
                              'impresa_por', 'impresa_en']) THEN
      RAISE EXCEPTION 'Una factura emitida no se modifica' USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
  END
  $fn$;

DROP TRIGGER IF EXISTS facturas_inmutables ON finanzas.facturas;
CREATE TRIGGER facturas_inmutables
  BEFORE UPDATE ON finanzas.facturas
  FOR EACH ROW EXECUTE FUNCTION finanzas.facturas_inmutables();

CREATE OR REPLACE FUNCTION finanzas.renglones_de_factura_inmutables()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $fn$
  BEGIN
    RAISE EXCEPTION 'Los renglones de una factura no cambian' USING ERRCODE = 'check_violation';
  END
  $fn$;

DROP TRIGGER IF EXISTS factura_items_inmutables ON finanzas.factura_items;
CREATE TRIGGER factura_items_inmutables
  BEFORE UPDATE OR DELETE ON finanzas.factura_items
  FOR EACH ROW EXECUTE FUNCTION finanzas.renglones_de_factura_inmutables();

-- Un pago resuelto ya no cambia, y lo reportado (monto, moneda, fecha,
-- factura, comprobante) no se toca nunca: se rechaza y se reporta otro.
CREATE OR REPLACE FUNCTION finanzas.pagos_coherentes()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $fn$
  BEGIN
    IF OLD.estado <> 'por_confirmar' THEN
      RAISE EXCEPTION 'Un pago resuelto no cambia' USING ERRCODE = 'check_violation';
    END IF;

    IF (to_jsonb(NEW) - ARRAY['estado', 'monto_aplicado', 'tasa_aplicada', 'motivo_rechazo',
                              'resuelto_por', 'resuelto_en'])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['estado', 'monto_aplicado', 'tasa_aplicada', 'motivo_rechazo',
                              'resuelto_por', 'resuelto_en']) THEN
      RAISE EXCEPTION 'Lo reportado de un pago no se modifica' USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
  END
  $fn$;

DROP TRIGGER IF EXISTS pagos_coherentes ON finanzas.pagos;
CREATE TRIGGER pagos_coherentes
  BEFORE UPDATE ON finanzas.pagos
  FOR EACH ROW EXECUTE FUNCTION finanzas.pagos_coherentes();

-- Solo se reporta contra una factura emitida, y el medio tiene que estar
-- activo y aceptar la moneda.
CREATE OR REPLACE FUNCTION finanzas.pago_valido()
  RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM finanzas.facturas WHERE id = NEW.factura_id AND estado = 'emitida') THEN
      RAISE EXCEPTION 'Solo se reportan pagos de una factura emitida' USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.medio_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM finanzas.medios_pago
      WHERE id = NEW.medio_id AND activo AND NEW.moneda = ANY (monedas)
    ) THEN
      RAISE EXCEPTION 'Ese medio de pago no esta activo o no acepta esa moneda'
        USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
  END
  $fn$;

DROP TRIGGER IF EXISTS pagos_validos ON finanzas.pagos;
CREATE TRIGGER pagos_validos
  BEFORE INSERT ON finanzas.pagos
  FOR EACH ROW EXECUTE FUNCTION finanzas.pago_valido();

-- ---------------------------------------------------------------------------
-- Si el cliente con sesion ve una factura: de su empresa, con el permiso de
-- finanzas. Lo preguntan las politicas de pagos y renglones.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION finanzas.cliente_ve_factura(p_factura integer)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT finanzas.cliente_ve_finanzas() AND EXISTS (
      SELECT 1 FROM finanzas.facturas f
      WHERE f.id = p_factura AND f.empresa_id = app_empresa_id()
    )
  $fn$;

REVOKE ALL ON FUNCTION finanzas.cliente_ve_factura(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finanzas.cliente_ve_factura(integer) TO conejo_app;

-- ---------------------------------------------------------------------------
-- Permisos. La aplicacion no inserta facturas ni sus renglones (emitir_factura
-- lo hace), no borra en finanzas y no toca los contadores.
-- ---------------------------------------------------------------------------
GRANT SELECT, UPDATE ON finanzas.ajustes TO conejo_app;
GRANT SELECT, INSERT, UPDATE ON finanzas.formatos_impresion, finanzas.medios_pago, finanzas.pagos TO conejo_app;
GRANT SELECT, UPDATE ON finanzas.facturas TO conejo_app;
GRANT SELECT ON finanzas.factura_items TO conejo_app;
REVOKE INSERT, DELETE ON finanzas.ajustes, finanzas.facturas, finanzas.factura_items FROM conejo_app;
REVOKE UPDATE ON finanzas.factura_items FROM conejo_app;
GRANT USAGE, SELECT ON SEQUENCE
  finanzas.formatos_impresion_id_seq, finanzas.medios_pago_id_seq, finanzas.pagos_id_seq
  TO conejo_app;

ALTER TABLE finanzas.ajustes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE finanzas.formatos_impresion ENABLE ROW LEVEL SECURITY;
ALTER TABLE finanzas.medios_pago        ENABLE ROW LEVEL SECURITY;
ALTER TABLE finanzas.facturas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE finanzas.factura_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE finanzas.pagos              ENABLE ROW LEVEL SECURITY;

-- Ajustes y formatos: solo quien opera finanzas.
DROP POLICY IF EXISTS ajustes_opera ON finanzas.ajustes;
CREATE POLICY ajustes_opera ON finanzas.ajustes
  FOR ALL TO conejo_app
  USING (finanzas.es_operador())
  WITH CHECK (finanzas.es_operador());

DROP POLICY IF EXISTS formatos_opera ON finanzas.formatos_impresion;
CREATE POLICY formatos_opera ON finanzas.formatos_impresion
  FOR ALL TO conejo_app
  USING (finanzas.es_operador())
  WITH CHECK (finanzas.es_operador());

-- Medios de pago: el operador los gestiona; el cliente con permiso lee los
-- activos, con sus datos para pagar.
DROP POLICY IF EXISTS medios_opera ON finanzas.medios_pago;
CREATE POLICY medios_opera ON finanzas.medios_pago
  FOR ALL TO conejo_app
  USING (finanzas.es_operador())
  WITH CHECK (finanzas.es_operador());

DROP POLICY IF EXISTS medios_lee_cliente ON finanzas.medios_pago;
CREATE POLICY medios_lee_cliente ON finanzas.medios_pago
  FOR SELECT TO conejo_app
  USING (activo AND finanzas.cliente_ve_finanzas());

-- Facturas: el operador lee y anula o marca; el cliente lee las de su empresa.
DROP POLICY IF EXISTS facturas_lee ON finanzas.facturas;
CREATE POLICY facturas_lee ON finanzas.facturas
  FOR SELECT TO conejo_app
  USING (
    finanzas.es_operador()
    OR (empresa_id = app_empresa_id() AND finanzas.cliente_ve_finanzas())
  );

DROP POLICY IF EXISTS facturas_edita ON finanzas.facturas;
CREATE POLICY facturas_edita ON finanzas.facturas
  FOR UPDATE TO conejo_app
  USING (finanzas.es_operador())
  WITH CHECK (finanzas.es_operador());

DROP POLICY IF EXISTS factura_items_lee ON finanzas.factura_items;
CREATE POLICY factura_items_lee ON finanzas.factura_items
  FOR SELECT TO conejo_app
  USING (finanzas.es_operador() OR finanzas.cliente_ve_factura(factura_id));

-- Pagos: el operador todo; el cliente lee los de sus facturas y reporta, a
-- su nombre y por confirmar, sobre una factura que ve.
DROP POLICY IF EXISTS pagos_lee ON finanzas.pagos;
CREATE POLICY pagos_lee ON finanzas.pagos
  FOR SELECT TO conejo_app
  USING (finanzas.es_operador() OR finanzas.cliente_ve_factura(factura_id));

DROP POLICY IF EXISTS pagos_reporta ON finanzas.pagos;
CREATE POLICY pagos_reporta ON finanzas.pagos
  FOR INSERT TO conejo_app
  WITH CHECK (
    estado = 'por_confirmar'
    AND reportado_por = app_usuario_id()
    AND (
      finanzas.es_operador()
      OR (finanzas.cliente_ve_factura(factura_id) AND NOT a_nombre_del_cliente)
    )
  );

DROP POLICY IF EXISTS pagos_resuelve ON finanzas.pagos;
CREATE POLICY pagos_resuelve ON finanzas.pagos
  FOR UPDATE TO conejo_app
  USING (finanzas.es_operador())
  WITH CHECK (finanzas.es_operador());

-- ---------------------------------------------------------------------------
-- La numeracion: los proximos numeros de factura y de control. Solo suben:
-- un numero ya usado no se vuelve a dar.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION finanzas.numeracion()
  RETURNS TABLE (serie text, proxima_factura integer, proximo_control integer,
                 control_prefijo text, control_hasta integer)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT a.factura_serie,
           coalesce((SELECT s.ultimo FROM finanzas.secuencias s
                     WHERE s.clave = 'FACTURA-' || a.factura_serie), 0) + 1,
           coalesce((SELECT s.ultimo FROM finanzas.secuencias s WHERE s.clave = 'CONTROL'), 0) + 1,
           a.control_prefijo,
           a.control_hasta
    FROM finanzas.ajustes a
    WHERE a.id = 1 AND finanzas.es_operador()
  $fn$;

CREATE OR REPLACE FUNCTION finanzas.fijar_numeracion(
  p_serie text,
  p_proxima_factura integer,
  p_proximo_control integer,
  p_control_prefijo text,
  p_control_hasta integer
)
  RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
  DECLARE
    v_ultima_factura integer;
    v_ultimo_control integer;
  BEGIN
    IF NOT finanzas.es_operador() THEN
      RAISE EXCEPTION 'No autorizado' USING ERRCODE = 'insufficient_privilege';
    END IF;

    INSERT INTO finanzas.secuencias (clave) VALUES ('FACTURA-' || p_serie), ('CONTROL')
    ON CONFLICT (clave) DO NOTHING;

    SELECT ultimo INTO v_ultima_factura FROM finanzas.secuencias
    WHERE clave = 'FACTURA-' || p_serie FOR UPDATE;
    SELECT ultimo INTO v_ultimo_control FROM finanzas.secuencias
    WHERE clave = 'CONTROL' FOR UPDATE;

    IF p_proxima_factura <= v_ultima_factura OR p_proximo_control <= v_ultimo_control THEN
      RAISE EXCEPTION 'Los proximos numeros solo pueden subir' USING ERRCODE = 'check_violation';
    END IF;

    IF p_control_hasta < p_proximo_control THEN
      RAISE EXCEPTION 'El rango de control termina antes del proximo numero'
        USING ERRCODE = 'check_violation';
    END IF;

    UPDATE finanzas.secuencias SET ultimo = p_proxima_factura - 1 WHERE clave = 'FACTURA-' || p_serie;
    UPDATE finanzas.secuencias SET ultimo = p_proximo_control - 1 WHERE clave = 'CONTROL';

    UPDATE finanzas.ajustes
    SET factura_serie = p_serie,
        control_prefijo = p_control_prefijo,
        control_hasta = p_control_hasta,
        actualizado_por = app_usuario_id(),
        actualizado_en = now()
    WHERE id = 1;
  END
  $fn$;

REVOKE ALL ON FUNCTION finanzas.numeracion(), finanzas.fijar_numeracion(text, integer, integer, text, integer)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finanzas.numeracion(), finanzas.fijar_numeracion(text, integer, integer, text, integer)
  TO conejo_app;

-- ---------------------------------------------------------------------------
-- Emitir la factura de una proforma emitida. En una transaccion: numero,
-- numero de control, tasa del dia (la ultima publicada si hoy no hay, F2),
-- importes en bolivares, copias del emisor y del cliente, renglones. La
-- proforma pasa a facturada. Devuelve el id de la factura.
--
-- Los renglones no pueden pasar de los que caben en el formato habitual
-- (F8): una proforma mas larga se factura en dos.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION finanzas.emitir_factura(p_proforma integer)
  RETURNS integer
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
  DECLARE
    v_proforma finanzas.proformas;
    v_ajustes finanzas.ajustes;
    v_empresa empresas;
    v_tasa finanzas.tasas_cambio;
    v_max integer;
    v_renglones integer;
    v_numero integer;
    v_control integer;
    v_factura integer;
    v_hoy date := finanzas.hoy();
    v_base numeric;
    v_exento numeric;
    v_iva numeric;
  BEGIN
    IF NOT finanzas.es_operador() THEN
      RAISE EXCEPTION 'No autorizado' USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT * INTO v_proforma FROM finanzas.proformas WHERE id = p_proforma FOR UPDATE;
    IF v_proforma.estado IS DISTINCT FROM 'emitida' THEN
      RAISE EXCEPTION 'Solo se factura una proforma emitida' USING ERRCODE = 'check_violation';
    END IF;

    SELECT * INTO v_ajustes FROM finanzas.ajustes WHERE id = 1 FOR UPDATE;
    IF length(btrim(coalesce(v_ajustes.emisor_razon_social, ''))) = 0
       OR length(btrim(coalesce(v_ajustes.emisor_rif, ''))) = 0
       OR length(btrim(coalesce(v_ajustes.emisor_domicilio, ''))) = 0 THEN
      RAISE EXCEPTION 'Faltan los datos del emisor en los ajustes' USING ERRCODE = 'check_violation';
    END IF;

    SELECT * INTO v_tasa FROM finanzas.tasas_cambio
    WHERE fuente = 'bcv' AND moneda = 'USD' AND fecha_valor <= v_hoy
    ORDER BY fecha_valor DESC LIMIT 1;
    IF v_tasa.id IS NULL THEN
      RAISE EXCEPTION 'No hay tasa del dolar registrada' USING ERRCODE = 'check_violation';
    END IF;

    SELECT (renglones ->> 'max')::int INTO v_max FROM finanzas.formatos_impresion WHERE habitual;
    SELECT count(*) INTO v_renglones FROM finanzas.documento_items WHERE proforma_id = p_proforma;
    IF v_renglones = 0 THEN
      RAISE EXCEPTION 'La proforma no tiene renglones' USING ERRCODE = 'check_violation';
    END IF;
    IF v_max IS NOT NULL AND v_renglones > v_max THEN
      RAISE EXCEPTION 'La proforma tiene mas renglones de los que caben en la hoja'
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT * INTO v_empresa FROM empresas WHERE id = v_proforma.empresa_id;

    v_numero := finanzas.siguiente_numero('FACTURA-' || v_ajustes.factura_serie);
    v_control := finanzas.siguiente_numero('CONTROL');
    IF v_control > v_ajustes.control_hasta THEN
      RAISE EXCEPTION 'Se acabo el rango de numeros de control del talonario'
        USING ERRCODE = 'check_violation';
    END IF;

    -- Los importes en bolivares: cada precio se convierte y se redondea, y el
    -- subtotal sale de el, como en cualquier renglon. El IVA, una vez, sobre
    -- la base.
    SELECT
      coalesce(sum(round(cantidad * round(precio_unitario * v_tasa.valor, 2), 2)) FILTER (WHERE NOT exento), 0),
      coalesce(sum(round(cantidad * round(precio_unitario * v_tasa.valor, 2), 2)) FILTER (WHERE exento), 0)
    INTO v_base, v_exento
    FROM finanzas.documento_items WHERE proforma_id = p_proforma;
    v_iva := round(v_base * v_proforma.iva_pct / 100, 2);

    INSERT INTO finanzas.facturas (
      serie, numero, numero_control, empresa_id, proforma_id, fecha_emision, vence_el,
      tasa, tasa_fuente, tasa_fecha, total_usd,
      base_imponible, monto_exento, iva_pct, iva_monto, total,
      retencion_iva_pct, retencion_esperada, emisor, cliente, emitida_por
    ) VALUES (
      v_ajustes.factura_serie, v_numero,
      v_ajustes.control_prefijo || lpad(v_control::text, 6, '0'),
      v_proforma.empresa_id, p_proforma, v_hoy,
      v_hoy + coalesce(v_empresa.dias_credito, v_ajustes.dias_credito),
      v_tasa.valor, v_tasa.fuente, v_tasa.fecha_valor, v_proforma.total,
      v_base, v_exento, v_proforma.iva_pct, v_iva, v_base + v_exento + v_iva,
      CASE WHEN v_empresa.agente_retencion THEN v_empresa.retencion_iva_pct END,
      CASE WHEN v_empresa.agente_retencion
           THEN round(v_iva * v_empresa.retencion_iva_pct / 100, 2) ELSE 0 END,
      jsonb_build_object(
        'razonSocial', v_ajustes.emisor_razon_social,
        'rif', v_ajustes.emisor_rif,
        'domicilio', v_ajustes.emisor_domicilio
      ),
      jsonb_build_object(
        'razonSocial', v_empresa.nombre,
        'rif', coalesce(v_empresa.rif, ''),
        'domicilio', coalesce(v_empresa.direccion, '')
      ),
      app_usuario_id()
    )
    RETURNING id INTO v_factura;

    INSERT INTO finanzas.factura_items
      (factura_id, orden, descripcion, cantidad, precio_unitario, exento, subtotal)
    SELECT v_factura, orden, descripcion, cantidad,
           round(precio_unitario * v_tasa.valor, 2), exento,
           round(cantidad * round(precio_unitario * v_tasa.valor, 2), 2)
    FROM finanzas.documento_items WHERE proforma_id = p_proforma;

    UPDATE finanzas.proformas SET estado = 'facturada' WHERE id = p_proforma;

    RETURN v_factura;
  END
  $fn$;

-- Anular: con motivo. La proforma vuelve a emitida para facturarla de nuevo
-- (corregir una factura es anularla y emitir otra, F9). Una factura con pagos
-- sin rechazar no se anula: primero se resuelven.
CREATE OR REPLACE FUNCTION finanzas.anular_factura(p_factura integer, p_motivo text)
  RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
  DECLARE
    v_proforma integer;
  BEGIN
    IF NOT finanzas.es_operador() THEN
      RAISE EXCEPTION 'No autorizado' USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF EXISTS (SELECT 1 FROM finanzas.pagos WHERE factura_id = p_factura AND estado <> 'rechazado') THEN
      RAISE EXCEPTION 'La factura tiene pagos: rechazalos antes de anularla'
        USING ERRCODE = 'check_violation';
    END IF;

    UPDATE finanzas.facturas SET
      estado = 'anulada',
      anulada_por = app_usuario_id(),
      anulada_en = now(),
      motivo_anulacion = btrim(p_motivo)
    WHERE id = p_factura AND estado = 'emitida'
    RETURNING proforma_id INTO v_proforma;

    IF v_proforma IS NULL THEN
      RAISE EXCEPTION 'La factura no esta emitida' USING ERRCODE = 'check_violation';
    END IF;

    UPDATE finanzas.proformas SET estado = 'emitida' WHERE id = v_proforma AND estado = 'facturada';
  END
  $fn$;

REVOKE ALL ON FUNCTION finanzas.emitir_factura(integer), finanzas.anular_factura(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finanzas.emitir_factura(integer), finanzas.anular_factura(integer, text) TO conejo_app;

-- ---------------------------------------------------------------------------
-- El estado de cobro de cada factura. Un pago por confirmar no reduce el
-- saldo; una anulada tiene saldo cero. La retencion esperada se cubre con la
-- retencion de IVA confirmada: mientras no llegue, queda «abierta».
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW finanzas.v_estado_cobro_factura
  WITH (security_invoker = true)
  AS
  SELECT
    f.id AS factura_id,
    coalesce(sum(p.monto_aplicado) FILTER (WHERE p.estado = 'confirmado' AND p.tipo = 'pago'), 0) AS pagado,
    coalesce(sum(p.monto_aplicado) FILTER (WHERE p.estado = 'confirmado' AND p.tipo <> 'pago'), 0) AS retenido,
    count(p.id) FILTER (WHERE p.estado = 'por_confirmar') AS por_confirmar,
    CASE WHEN f.estado = 'anulada' THEN 0
         ELSE greatest(f.total - coalesce(sum(p.monto_aplicado) FILTER (WHERE p.estado = 'confirmado'), 0), 0)
    END AS saldo,
    CASE
      WHEN f.estado = 'anulada' THEN 'anulada'
      WHEN f.total - coalesce(sum(p.monto_aplicado) FILTER (WHERE p.estado = 'confirmado'), 0) <= 0 THEN 'pagada'
      WHEN coalesce(sum(p.monto_aplicado) FILTER (WHERE p.estado = 'confirmado'), 0) > 0 THEN 'parcial'
      ELSE 'pendiente'
    END AS estado,
    (f.estado = 'emitida' AND f.retencion_esperada > 0
     AND coalesce(sum(p.monto_aplicado) FILTER (WHERE p.estado = 'confirmado' AND p.tipo = 'retencion_iva'), 0)
         < f.retencion_esperada) AS retencion_abierta
  FROM finanzas.facturas f
  LEFT JOIN finanzas.pagos p ON p.factura_id = f.id
  GROUP BY f.id;

GRANT SELECT ON finanzas.v_estado_cobro_factura TO conejo_app;

COMMIT;

-- ---------------------------------------------------------------------------
-- Comprobacion 1. Debe devolver tablas = 6 y con_seguridad_por_fila = 6.
-- ---------------------------------------------------------------------------
SELECT count(*) AS tablas,
       count(*) FILTER (WHERE rowsecurity) AS con_seguridad_por_fila
FROM pg_tables
WHERE schemaname = 'finanzas'
  AND tablename IN ('ajustes', 'formatos_impresion', 'medios_pago', 'facturas', 'factura_items', 'pagos');

-- Comprobacion 2. Debe devolver funciones = 9, columnas_empresa = 3 y vista = 1.
SELECT (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'finanzas'
          AND p.proname IN ('facturas_inmutables', 'renglones_de_factura_inmutables', 'pagos_coherentes',
                            'pago_valido', 'cliente_ve_factura', 'numeracion', 'fijar_numeracion',
                            'emitir_factura', 'anular_factura')) AS funciones,
       (SELECT count(*) FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'empresas'
          AND column_name IN ('agente_retencion', 'retencion_iva_pct', 'dias_credito')) AS columnas_empresa,
       (SELECT count(*) FROM pg_views
        WHERE schemaname = 'finanzas' AND viewname = 'v_estado_cobro_factura') AS vista;

-- Comprobacion 3. Debe devolver formatos = 1, medios = 4, facturas = 0 y
-- emisor_vacio = true.
SELECT (SELECT count(*) FROM finanzas.formatos_impresion) AS formatos,
       (SELECT count(*) FROM finanzas.medios_pago) AS medios,
       (SELECT count(*) FROM finanzas.facturas) AS facturas,
       (SELECT emisor_razon_social IS NULL FROM finanzas.ajustes WHERE id = 1) AS emisor_vacio;
