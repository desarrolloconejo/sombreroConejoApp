# SQL para pegar en Neon

La maquina de desarrollo no alcanza Neon, asi que produccion se migra pegando
SQL en el editor de su panel. Aqui va **un archivo por cambio de esquema**,
numerado en el orden en que hay que pegarlo.

## Reglas

- **Primero se pega, despues se sube `main`.** Al reves, la aplicacion nueva
  arranca contra un esquema viejo.
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

## Estado

| Archivo | Que hace | Pegado en produccion |
| --- | --- | --- |
| `01-cargo-produccion.sql` | Anade el cargo `produccion` | Pendiente |
| `02-sesiones.sql` | Crea la tabla `sesiones`. **Antes** de subir la aplicacion | Pendiente |
| `03-acceso.sql` | Tres columnas en `usuarios` y la vista que las expone. **Antes** de subir la aplicacion | Pendiente |
| `04-auditoria.sql` | Crea la tabla `auditoria`, que solo admite lineas nuevas. **Antes** de subir la aplicacion | Pendiente |
