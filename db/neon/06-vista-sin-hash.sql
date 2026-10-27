-- ===========================================================================
-- 06 — La vista general deja de traer el hash de la contrasena
--
-- Etapa 1 del plan del portal, hueco 7. Cierra lo que el 05 dejo a medias a
-- proposito.
--
-- SE PEGA DESPUES DE PUBLICAR, no antes. La version anterior de la aplicacion
-- lee el hash de esta vista para iniciar sesion: quitarlo con ella todavia en
-- produccion dejaria a todo el mundo fuera. La version nueva lo lee de
-- `vw_usuarios_acceso`, asi que con ella ya publicada esto no afecta a nadie.
--
-- Antes de pegarlo: comprueba en la aplicacion publicada que puedes cerrar
-- sesion y volver a entrar.
--
-- EXCEPCION, la del despliegue de la integracion: el 13 y el 14 necesitan
-- la vista sin hash, y la version publicada (1e57306) nunca funciono contra
-- esta base. Ese dia se pega justo despues del 05.
--
-- Idempotente. Va en una transaccion: si algo falla, la vista anterior sigue
-- en su sitio.
-- ===========================================================================

BEGIN;

DROP VIEW IF EXISTS vw_usuarios_completos;

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
  e.activo                                   AS empresa_activa
FROM usuarios u
LEFT JOIN trabajadores t ON t.usuario_id = u.id
LEFT JOIN roles        r ON r.id         = t.rol_id
LEFT JOIN cargos       g ON g.id         = t.cargo_id
LEFT JOIN clientes     c ON c.usuario_id = u.id
LEFT JOIN empresas     e ON e.id         = c.empresa_id;

-- Una vista recien creada no hereda los permisos de la anterior.
GRANT SELECT ON vw_usuarios_completos TO conejo_app;

COMMIT;

-- Comprobacion 1. Debe devolver 0: la vista general ya no trae el hash.
SELECT count(*) AS columnas_con_hash
FROM information_schema.columns
WHERE table_name = 'vw_usuarios_completos'
  AND column_name IN ('password_hash', 'bloqueado_hasta');

-- Comprobacion 2. Debe devolver el numero de usuarios, no un error: la
-- aplicacion puede seguir leyendo la vista.
SELECT count(*) AS usuarios FROM vw_usuarios_completos;
