-- ===========================================================================
-- 20 — Nomenclatura de archivos: sigla de la empresa y nombre corto del proyecto
--
-- Columnas nuevas empresas.sigla (unica) y portal.proyectos.nombre_corto, con
-- las que la aplicacion nombra los archivos que se suben:
-- CLIENTE_PROYECTO_TIPO_AAMM_vNN. A las empresas y proyectos que ya existen
-- se les propone un valor a partir de su nombre; el administrador los revisa
-- despues en Empresas y en Proyectos. Y portal.proyectos_para_nombrar: el
-- nombre y el nombre corto de los proyectos en marcha, para que todo el
-- equipo los vea en el armador de nombres de archivo.
--
-- Idempotente. Solo anade: las columnas admiten NULL y la version publicada
-- no las usa: si inserta sin ellas, la base propone su valor.
--
-- ORDEN: antes de subir la aplicacion, despues del 19.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- La nomenclatura de los archivos: CLIENTE_PROYECTO_TIPO_AAMM_vNN.
--
-- empresas.sigla es el bloque CLIENTE (unica; la revisa el administrador) y
-- portal.proyectos.nombre_corto el bloque PROYECTO (lo pone quien crea el
-- proyecto). Los dos en mayusculas, sin acentos, con guiones entre palabras.
--
-- Si una fila llega sin ellos (la empresa que nace de un prospecto, un
-- proyecto que abre un brief, la version publicada antes de este cambio), la
-- base propone uno a partir del nombre con el mismo criterio que la
-- aplicacion (src/lib/nomenclatura.ts). Asi ninguna queda sin nombre.
-- ---------------------------------------------------------------------------
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS sigla TEXT;
ALTER TABLE portal.proyectos ADD COLUMN IF NOT EXISTS nombre_corto TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'empresas_sigla_formato') THEN
    ALTER TABLE empresas ADD CONSTRAINT empresas_sigla_formato
      CHECK (sigla ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' AND length(sigla) <= 20);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proyectos_nombre_corto_formato') THEN
    ALTER TABLE portal.proyectos ADD CONSTRAINT proyectos_nombre_corto_formato
      CHECK (nombre_corto ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' AND length(nombre_corto) <= 30);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS empresas_sigla_unica ON empresas (sigla);

-- Un texto en bloque: mayusculas, sin acentos ni enie, guiones entre palabras.
CREATE OR REPLACE FUNCTION public.bloque_de_nombre(p_texto text) RETURNS text
  LANGUAGE sql IMMUTABLE
  AS $fn$
    SELECT btrim(regexp_replace(
             upper(translate(coalesce(p_texto, ''),
                   'áéíóúüñàèìòùÁÉÍÓÚÜÑÀÈÌÒÙ', 'aeiouunaeiouAEIOUUNAEIOU')),
             '[^A-Z0-9]+', '-', 'g'), '-')
  $fn$;

-- Recorta un bloque a un largo sin partir una palabra, si se puede.
CREATE OR REPLACE FUNCTION public.recortar_bloque(p_bloque text, p_largo integer) RETURNS text
  LANGUAGE sql IMMUTABLE
  AS $fn$
    SELECT CASE
      WHEN length(p_bloque) <= p_largo THEN p_bloque
      WHEN position('-' IN left(p_bloque, p_largo + 1)) > 1
        THEN rtrim(regexp_replace(left(p_bloque, p_largo + 1), '-[^-]*$', ''), '-')
      ELSE left(p_bloque, p_largo)
    END
  $fn$;

-- La sigla de una empresa nueva, si no la trae: su nombre sin la forma
-- juridica, y con -2, -3… si ya la tiene otra.
CREATE OR REPLACE FUNCTION public.empresas_propone_sigla() RETURNS trigger
  LANGUAGE plpgsql
  AS $fn$
  DECLARE
    v_base      text;
    v_propuesta text;
    v_n         integer := 1;
  BEGIN
    IF NEW.sigla IS NOT NULL THEN
      RETURN NEW;
    END IF;

    v_base := regexp_replace(public.bloque_de_nombre(NEW.nombre),
                             '(.)(-(C|A|CA|S|SA|SRL|RL|LLC|INC|CORP))+$', '\1');
    v_base := coalesce(nullif(public.recortar_bloque(v_base, 20), ''), 'CLIENTE');
    v_propuesta := v_base;

    WHILE EXISTS (SELECT 1 FROM public.empresas WHERE sigla = v_propuesta AND id IS DISTINCT FROM NEW.id) LOOP
      v_n := v_n + 1;
      v_propuesta := rtrim(left(v_base, 20 - length('-' || v_n)), '-') || '-' || v_n;
    END LOOP;

    NEW.sigla := v_propuesta;
    RETURN NEW;
  END
  $fn$;

CREATE OR REPLACE TRIGGER empresas_propone_sigla
  BEFORE INSERT OR UPDATE OF sigla ON empresas
  FOR EACH ROW EXECUTE FUNCTION public.empresas_propone_sigla();

-- El nombre corto de un proyecto nuevo, si no lo trae: sus tres primeras
-- palabras con sentido.
CREATE OR REPLACE FUNCTION portal.proyectos_propone_nombre_corto() RETURNS trigger
  LANGUAGE plpgsql
  AS $fn$
  BEGIN
    IF NEW.nombre_corto IS NOT NULL THEN
      RETURN NEW;
    END IF;

    SELECT string_agg(palabra, '-' ORDER BY orden) INTO NEW.nombre_corto
    FROM (
      SELECT palabra, orden
      FROM regexp_split_to_table(public.bloque_de_nombre(NEW.nombre), '-') WITH ORDINALITY AS t(palabra, orden)
      WHERE palabra <> ''
        AND palabra <> ALL (ARRAY['DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'Y', 'PARA', 'EN', 'A', 'UN', 'UNA'])
      ORDER BY orden
      LIMIT 3
    ) s;

    NEW.nombre_corto := coalesce(nullif(public.recortar_bloque(NEW.nombre_corto, 30), ''), 'PROYECTO');
    RETURN NEW;
  END
  $fn$;

CREATE OR REPLACE TRIGGER proyectos_propone_nombre_corto
  BEFORE INSERT OR UPDATE OF nombre_corto ON portal.proyectos
  FOR EACH ROW EXECUTE FUNCTION portal.proyectos_propone_nombre_corto();

-- El lugar de una pieza entre las de su tipo en su proyecto (POST-01,
-- POST-02…), para el nombre de sus archivos. Mira todas las piezas del
-- proyecto aunque quien pregunta solo vea la suya: si no, dos personas
-- nombrarian distinto la misma pieza. Solo responde a quien ve esa pieza.
CREATE OR REPLACE FUNCTION portal.orden_de_pieza(p_pieza integer)
  RETURNS TABLE (numero integer, total integer)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT o.numero, o.total
    FROM (
      SELECT p.id,
             (row_number() OVER (ORDER BY p.id))::int AS numero,
             (count(*) OVER ())::int                 AS total
      FROM portal.piezas p
      JOIN portal.piezas esta ON esta.proyecto_id = p.proyecto_id AND esta.tipo = p.tipo
      WHERE esta.id = p_pieza
    ) o
    WHERE o.id = p_pieza
      AND (portal.gestiona_pieza(p_pieza) OR portal.trabaja_en_pieza(p_pieza))
  $fn$;

REVOKE ALL ON FUNCTION portal.orden_de_pieza(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION portal.orden_de_pieza(integer) TO conejo_app;

-- Los proyectos en marcha con su nombre corto, para el armador de nombres de
-- archivo: todo el equipo los ve todos, para que nadie escriba a mano uno que
-- ya existe. Solo el nombre y el nombre corto; lo demas del proyecto sigue
-- con sus politicas. A un cliente, a un prospecto o sin sesion no les
-- devuelve nada.
CREATE OR REPLACE FUNCTION portal.proyectos_para_nombrar()
  RETURNS TABLE (id integer, empresa_id integer, nombre text, nombre_corto text)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT p.id, p.empresa_id, p.nombre, p.nombre_corto
    FROM portal.proyectos p
    WHERE p.estado IN ('activo', 'pausado')
      AND app_usuario_id() IS NOT NULL
      AND app_rol() IN ('admin', 'trabajador')
    ORDER BY lower(p.nombre)
  $fn$;

REVOKE ALL ON FUNCTION portal.proyectos_para_nombrar() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION portal.proyectos_para_nombrar() TO conejo_app;

-- Lo que ya existia recibe su propuesta: tocar la columna dispara el trigger.
-- Las empresas, de una en una y por antiguedad, para que la mas vieja se
-- quede la sigla sin numero.
DO $$
DECLARE
  v_id integer;
BEGIN
  FOR v_id IN SELECT id FROM empresas WHERE sigla IS NULL ORDER BY id LOOP
    UPDATE empresas SET sigla = NULL WHERE id = v_id;
  END LOOP;
END $$;

UPDATE portal.proyectos SET nombre_corto = NULL WHERE nombre_corto IS NULL;

COMMIT;

-- ---------------------------------------------------------------------------
-- Comprobacion. Debe devolver sin_sigla = 0, sin_nombre_corto = 0 y
-- siglas_repetidas = 0. Despues, revisar a ojo la lista de siglas.
-- ---------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM empresas WHERE sigla IS NULL)                  AS sin_sigla,
  (SELECT count(*) FROM portal.proyectos WHERE nombre_corto IS NULL)   AS sin_nombre_corto,
  (SELECT count(*) - count(DISTINCT sigla) FROM empresas)              AS siglas_repetidas;

SELECT id, nombre, sigla FROM empresas ORDER BY lower(nombre);
