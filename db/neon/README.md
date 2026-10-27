# Cambios de esquema para Neon

`db/schema.sql` es **la version final del esquema** y la unica fuente: crea
una base desde cero y, como es idempotente, tambien la pone al dia. La base de
produccion coincide con el objeto a objeto (comparado el 2026-10-27, tras
aplicar los cambios 01 a 22).

Esta carpeta guarda lo que hace falta para llevar a produccion los cambios
que vengan, sin pegar el esquema entero sobre una base con datos.

| Archivo | Para que |
| --- | --- |
| `diagnostico.sql` | Solo lee. Dice que cambios de esquema tiene una base (uno por fila, con `aplicado` true o false) y cuantos usuarios y empresas hay. Un cambio nuevo anade aqui su fila |
| `huella.sql` | Solo lee. Lista cada objeto del esquema (columnas, funciones, politicas, vistas, indices, restricciones, triggers y permisos de `conejo_app`). Ejecutado en la base local y en Neon, las dos listas tienen que ser iguales |

Los archivos 01 a 22 —toda la integracion del portal— ya estan aplicados en
produccion y se retiraron del repositorio: siguen en el historial de git.

## Un cambio nuevo

Cada cambio de esquema hace dos cosas:

1. Lo escribe en `db/schema.sql`, idempotente (`IF NOT EXISTS`, bloques `DO`).
2. Entrega aqui su extracto para produccion, `NN-que-hace.sql`, con el
   siguiente numero: **el proximo es el 23**.

El extracto:

- **Solo anade.** Entre pegarlo y subir `main`, la version publicada sigue
  funcionando. Lo que le quite algo va en un archivo aparte, que se pega
  despues de subir.
- **Es idempotente.** Pegarlo dos veces no rompe nada.
- **No lleva secretos.** Donde haga falta una contrasena va un hueco
  (`PEGA_AQUI_…`) que se sustituye en el editor de Neon, nunca en el archivo.
- **No inserta datos de ejemplo.** Solo esquema y las filas de las que depende
  la logica.
- **Termina con su comprobacion**, y dice que resultado esperar.
- Una tabla nueva con seguridad por fila trae sus politicas, y su comprobacion
  en `prueba:permisos`.

Como se ensaya y se aplica: `docs/operacion/despliegue.md`, seccion 3.

## Por que no se conecta directo

ProtonVPN cierra el puerto 5432 de salida, asi que desde la maquina de
desarrollo no hay `psql` contra Neon. Produccion se migra pegando el SQL en el
editor de su panel. Para el ensayo y la aplicacion del 2026-10-27 se uso el
protocolo de PostgreSQL por WebSocket (puerto 443, como el controlador
serverless de Neon), con permiso expreso del responsable.

Los roles de PostgreSQL son del servidor entero: ensayar en local un archivo
que toque `conejo_app` le cambia la contrasena, y despues hay que volver a
ejecutar el seed.
