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
