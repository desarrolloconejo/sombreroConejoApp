# SQL para pegar en Neon

La maquina de desarrollo no alcanza Neon, asi que produccion se migra pegando
SQL en el editor de su panel. Aqui va **un archivo por cambio de esquema**,
numerado en el orden en que hay que pegarlo.

## Reglas

- **Primero se pega, despues se sube `main`.** Al reves, la aplicacion nueva
  arranca contra un esquema viejo. La excepcion va marcada en la tabla: lo
  que le QUITA algo a la version publicada se pega despues de sustituirla.
- **Ningun archivo que se pega antes de subir rompe la version publicada.**
  Solo anaden. Entre pegar y subir, la aplicacion sigue funcionando.
- **Son idempotentes.** Pegar uno dos veces no rompe nada.
- **No llevan secretos.** Donde hace falta una contrasena hay un hueco
  (`PEGA_AQUI_…`) que se sustituye en el editor de Neon, nunca en el archivo.
- **No insertan datos de ejemplo.** Solo esquema y las filas de las que depende
  la logica.
- Cada archivo termina con una consulta de **comprobacion** y dice que
  resultado esperar.

La fuente del esquema sigue siendo `db/schema.sql`. Estos archivos son el
extracto de lo que cambia en cada entrega, para no tener que pegar el esquema
entero sobre una base con datos.

El orden completo del despliegue —con las variables de Vercel, las
comprobaciones y la vuelta atras— esta en `docs/despliegueProduccion.md`.

## Saber que falta

`diagnostico.sql` solo lee: pegado en el editor de Neon devuelve una fila por
archivo con `aplicado` en true o false, y cuantos usuarios y empresas hay. Se
pega antes de empezar y despues de cada archivo.

## Estado

| Archivo | Que hace | Pegado en produccion |
| --- | --- | --- |
| `01-cargo-produccion.sql` | Anade el cargo `produccion` | Pendiente |
| `02-sesiones.sql` | Crea la tabla `sesiones`. **Antes** de subir la aplicacion | Pendiente |
| `03-acceso.sql` | Tres columnas en `usuarios` y la vista que las expone. **Antes** de subir la aplicacion | Pendiente |
| `04-auditoria.sql` | Crea la tabla `auditoria`, que solo admite lineas nuevas. **Antes** de subir la aplicacion | Pendiente |
| `05-rol-de-la-aplicacion.sql` | Crea el rol `conejo_app` con sus permisos y la vista `vw_usuarios_acceso`. **Lleva un hueco para la contrasena.** Antes de cambiar `DATABASE_URL` en Vercel y de subir | Pendiente |
| `06-vista-sin-hash.sql` | Quita el hash de `vw_usuarios_completos`. **Despues** de publicar: la version anterior lo necesita para iniciar sesion | Pendiente |
| `07-esquemas-y-correos.sql` | Crea los esquemas `portal` y `finanzas`, las funciones de sesion y `portal.correos_salida` con su politica. **Antes** de subir, despues del 05 | Pendiente |
| `08-notificaciones.sql` | Crea `portal.notificaciones`, los avisos de la campana, con sus politicas. **Antes** de subir, despues del 07 | Pendiente |
| `09-tasas-de-cambio.sql` | Crea `finanzas.tasas_cambio` y deja que la tarea programada escriba y notifique. **Antes** de subir, despues del 08 | Pendiente |
| `10-dos-pasos.sql` | Verificacion en dos pasos: tres columnas en `usuarios`, la tabla `codigos_respaldo` y tres columnas mas en `vw_usuarios_acceso`. **Antes** de subir, despues del 05 | Pendiente |
| `11-proyectos.sql` | Etapa 3: asignaciones, proyectos, piezas, copy, fases, tareas y comentarios, con sus politicas y las vistas del avance. **Antes** de subir, despues del 07 | Pendiente |
| `12-hooks-herramienta.sql` | Etapa 3: `fichas_hook.tarea_id`, la ficha que cumple una tarea. **Antes** de subir, despues del 11 | Pendiente |
| `13-revision-del-cliente.sql` | Etapa 4: permiso de aprobar de cada cliente (y su columna en `vw_usuarios_completos`), versiones, decisiones del cliente, almacen del modo simulado de archivos y `portal.decidir_fase_5`. **Antes** de subir, despues del 12 | Pendiente |
| `14-presupuestos-y-proformas.sql` | Etapa 5: permiso de finanzas de cada cliente (y su columna en `vw_usuarios_completos`), presupuestos, proformas, renglones, contadores y sus funciones; deja a quien opera finanzas leer los proyectos. **Antes** de subir, despues del 13 | Pendiente |
| `15-briefs.sql` | Etapa 6: prospectos y sus enlaces privados, briefs, versiones congeladas, aclaraciones, `brief_id` en proyectos y presupuestos, las funciones que guardan, envian y convierten, y la campana y la bandeja de salida abiertas al prospecto. **Antes** de subir, despues del 14 | Pendiente |
| `16-facturas-y-pagos.sql` | Etapa 7: ajustes de finanzas (emisor, impuestos, numeracion), formatos de impresion, medios de pago, facturas, pagos y retenciones, la vista del estado de cobro y la retencion de cada empresa. Trae un formato y cuatro medios de ejemplo; el emisor nace vacio. **Antes** de subir, despues del 15 | Pendiente |
| `17-comentarios-por-fase.sql` | Comentarios por fase: `fase` y `tarea_id` en `portal.comentarios_pieza`, con sus comprobaciones y un indice. Los comentarios de antes quedan como generales. **Antes** de subir, despues del 16 | Pendiente |
| `18-proyecto-por-ejecutivo.sql` | Un proyecto lo puede llevar un ejecutivo de otra cuenta, que gestiona solo ese proyecto (`portal.gestiona_proyecto`); solo un administrador cambia quien lo lleva (trigger). **Antes** de subir, despues del 17 | Pendiente |
| `19-avisos-a-ejecutivos.sql` | Funcion `portal.ejecutivos_de_empresa`, para avisar a los ejecutivos de una empresa de sus presupuestos. **Antes** de subir, despues del 18 | Pendiente |
| `20-nomenclatura-de-archivos.sql` | Sigla de cada empresa (unica) y nombre corto de cada proyecto, con los triggers que los proponen si llegan vacios y la propuesta para lo que ya existe; `portal.orden_de_pieza`, el POST-01, POST-02 de los nombres, y `portal.proyectos_para_nombrar`, los proyectos que ofrece el armador. **Antes** de subir, despues del 19 | Pendiente |
| `21-foto-y-recuperar-clave.sql` | `usuarios.foto_archivo` (donde esta la foto de perfil), la tabla `restablecimientos_clave` (el hash de cada enlace de «Olvide mi contrasena») y la bandeja de salida abierta al rol sistema. **Antes** de subir, despues del 20 | Pendiente |
