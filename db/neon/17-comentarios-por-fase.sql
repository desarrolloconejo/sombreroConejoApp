-- ===========================================================================
-- 17 — Comentarios por fase
--
-- Los comentarios internos de una pieza pasan a poder ir en una fase y, si se
-- quiere, sobre una tarea de esa fase. Dos columnas nuevas en
-- portal.comentarios_pieza (fase y tarea_id), dos comprobaciones y un indice.
-- Los comentarios que ya existen quedan con fase NULL: son los «generales».
--
-- Las politicas no cambian: siguen colgando de la pieza.
--
-- Idempotente. Solo anade columnas que la version publicada ignora.
--
-- ORDEN: antes de subir la aplicacion, despues del 16.
-- ===========================================================================

BEGIN;

ALTER TABLE portal.comentarios_pieza ADD COLUMN IF NOT EXISTS fase SMALLINT;
ALTER TABLE portal.comentarios_pieza ADD COLUMN IF NOT EXISTS tarea_id INTEGER
  REFERENCES portal.tareas(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comentarios_pieza_fase_valida') THEN
    ALTER TABLE portal.comentarios_pieza
      ADD CONSTRAINT comentarios_pieza_fase_valida CHECK (fase IS NULL OR fase BETWEEN 1 AND 5);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comentarios_pieza_tarea_con_fase') THEN
    ALTER TABLE portal.comentarios_pieza
      ADD CONSTRAINT comentarios_pieza_tarea_con_fase CHECK (tarea_id IS NULL OR fase IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS comentarios_pieza_fase_idx
  ON portal.comentarios_pieza (pieza_id, fase, creado_en);

COMMIT;

-- ---------------------------------------------------------------------------
-- Comprobacion. Debe devolver columnas = 2, restricciones = 2 e indice = 1.
-- ---------------------------------------------------------------------------
SELECT (SELECT count(*) FROM information_schema.columns
        WHERE table_schema = 'portal' AND table_name = 'comentarios_pieza'
          AND column_name IN ('fase', 'tarea_id')) AS columnas,
       (SELECT count(*) FROM pg_constraint
        WHERE conname IN ('comentarios_pieza_fase_valida', 'comentarios_pieza_tarea_con_fase')) AS restricciones,
       (SELECT count(*) FROM pg_indexes
        WHERE schemaname = 'portal' AND indexname = 'comentarios_pieza_fase_idx') AS indice;
