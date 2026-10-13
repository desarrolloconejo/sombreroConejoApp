-- ===========================================================================
-- 01 — Cargo `produccion`
--
-- Etapa 1 del plan del portal. Anade el area de produccion a la lista de
-- cargos. No toca a ninguna persona: nadie pasa a ese cargo hasta que un
-- administrador lo asigne desde Usuarios.
--
-- Idempotente. Se puede pegar antes o despues de subir la aplicacion: la
-- version anterior ignora un cargo que no conoce.
-- ===========================================================================

INSERT INTO cargos (slug, nombre, descripcion) VALUES
  ('produccion', 'Produccion', 'Produccion audiovisual y de piezas')
ON CONFLICT (slug) DO NOTHING;

-- Comprobacion. Debe devolver una fila con slug = produccion.
SELECT id, slug, nombre FROM cargos WHERE slug = 'produccion';
