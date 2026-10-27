-- ===========================================================================
-- Diagnostico: que archivos de db/neon/ ya estan aplicados en esta base.
--
-- SOLO LEE. No crea, no cambia ni borra nada: se puede pegar en el editor de
-- Neon en cualquier momento, antes y despues de cada archivo.
--
-- Devuelve una fila por archivo con `aplicado` en true o false, y al final
-- unos conteos para saber cuantos datos reales hay. Un archivo a medias sale
-- en false: se vuelve a pegar entero (todos son idempotentes).
--
-- Cada marca es el ultimo objeto que crea su archivo, o el que lo distingue.
-- ===========================================================================

WITH
columna(esquema, tabla, nombre) AS (
  SELECT table_schema, table_name, column_name FROM information_schema.columns
),
funcion(esquema, nombre) AS (
  SELECT n.nspname, p.proname
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
),
marcas(archivo, aplicado) AS (
  VALUES
  ('01-cargo-produccion',
     EXISTS (SELECT 1 FROM cargos WHERE slug = 'produccion')),
  ('02-sesiones',
     to_regclass('public.sesiones') IS NOT NULL),
  ('03-acceso',
     EXISTS (SELECT 1 FROM columna WHERE tabla = 'usuarios' AND nombre = 'bloqueado_hasta')),
  ('04-auditoria',
     to_regclass('public.auditoria') IS NOT NULL),
  ('05-rol-de-la-aplicacion',
     EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'conejo_app')
     AND to_regclass('public.vw_usuarios_acceso') IS NOT NULL),
  ('06-vista-sin-hash (DESPUES de subir)',
     NOT EXISTS (SELECT 1 FROM columna
                 WHERE tabla = 'vw_usuarios_completos' AND nombre = 'password_hash')),
  ('07-esquemas-y-correos',
     to_regclass('portal.correos_salida') IS NOT NULL),
  ('08-notificaciones',
     to_regclass('portal.notificaciones') IS NOT NULL),
  ('09-tasas-de-cambio',
     to_regclass('finanzas.tasas_cambio') IS NOT NULL),
  ('10-dos-pasos',
     to_regclass('public.codigos_respaldo') IS NOT NULL
     AND EXISTS (SELECT 1 FROM columna WHERE tabla = 'usuarios' AND nombre = 'dos_pasos_omitido')),
  ('11-proyectos',
     to_regclass('portal.comentarios_pieza') IS NOT NULL
     AND to_regclass('portal.v_progreso_proyecto') IS NOT NULL),
  ('12-hooks-herramienta',
     EXISTS (SELECT 1 FROM columna WHERE tabla = 'fichas_hook' AND nombre = 'tarea_id')),
  ('13-revision-del-cliente',
     to_regclass('portal.revisiones') IS NOT NULL
     AND EXISTS (SELECT 1 FROM funcion WHERE esquema = 'portal' AND nombre = 'decidir_fase_5')),
  ('14-presupuestos-y-proformas',
     to_regclass('finanzas.presupuestos') IS NOT NULL
     AND to_regclass('finanzas.proformas') IS NOT NULL),
  ('15-briefs',
     to_regclass('portal.brief_aclaraciones') IS NOT NULL
     AND EXISTS (SELECT 1 FROM columna WHERE esquema = 'finanzas'
                 AND tabla = 'presupuestos' AND nombre = 'brief_id')),
  ('16-facturas-y-pagos',
     to_regclass('finanzas.facturas') IS NOT NULL
     AND to_regclass('finanzas.pagos') IS NOT NULL),
  ('17-comentarios-por-fase',
     EXISTS (SELECT 1 FROM columna WHERE tabla = 'comentarios_pieza' AND nombre = 'fase')),
  ('18-proyecto-por-ejecutivo',
     EXISTS (SELECT 1 FROM funcion WHERE esquema = 'portal' AND nombre = 'gestiona_proyecto')),
  ('19-avisos-a-ejecutivos',
     EXISTS (SELECT 1 FROM funcion WHERE esquema = 'portal' AND nombre = 'ejecutivos_de_empresa')),
  ('20-nomenclatura-de-archivos',
     EXISTS (SELECT 1 FROM funcion WHERE esquema = 'portal' AND nombre = 'proyectos_para_nombrar')),
  ('21-foto-y-recuperar-clave',
     to_regclass('public.restablecimientos_clave') IS NOT NULL
     AND EXISTS (SELECT 1 FROM columna WHERE tabla = 'usuarios' AND nombre = 'foto_archivo'))
)
SELECT archivo, aplicado FROM marcas ORDER BY archivo;

-- Cuantos datos reales hay (solo conteos, ningun dato personal).
SELECT
  (SELECT count(*) FROM usuarios)                        AS usuarios,
  (SELECT count(*) FROM usuarios WHERE activo)           AS usuarios_activos,
  (SELECT count(*) FROM empresas)                        AS empresas,
  (SELECT count(*) FROM trabajadores)                    AS trabajadores,
  (SELECT count(*) FROM clientes)                        AS clientes;
