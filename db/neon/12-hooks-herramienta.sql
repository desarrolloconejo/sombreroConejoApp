-- ===========================================================================
-- 12 — Hooks como herramienta
--
-- Etapa 3 del plan del portal. Liga una ficha de hook a la tarea que cumple:
-- una columna opcional en `fichas_hook`.
--
-- Idempotente. Solo anade: la version publicada no la conoce y la ignora.
--
-- ORDEN: antes de subir la aplicacion, despues del 11 (que crea las tareas).
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Hooks como herramienta: la ficha que cumple una tarea.
--
-- Una tarea «Escribir el hook» abre el canvas, y la ficha que se escribe desde
-- ahi queda ligada a ella. Cuando la ficha aprueba la auditoria, la tarea se
-- da por lista.
--
-- Opcional: el modulo de hooks se sigue usando suelto, sin tarea. Si la tarea
-- se quita (solo se puede mientras esta pendiente), la ficha se queda, sin
-- tarea.
-- ---------------------------------------------------------------------------
ALTER TABLE fichas_hook
  ADD COLUMN IF NOT EXISTS tarea_id INTEGER REFERENCES portal.tareas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS fichas_hook_tarea_idx
  ON fichas_hook (tarea_id)
  WHERE tarea_id IS NOT NULL;

COMMIT;

-- Comprobacion. Debe devolver columna = 1 e indice = 1.
SELECT (SELECT count(*) FROM information_schema.columns
        WHERE table_name = 'fichas_hook' AND column_name = 'tarea_id') AS columna,
       (SELECT count(*) FROM pg_indexes
        WHERE indexname = 'fichas_hook_tarea_idx') AS indice;
