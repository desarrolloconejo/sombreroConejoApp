# Mudanza a un VPS

Lo que hay que cambiar el dia que la aplicacion deje Vercel por un servidor
propio (la etapa 9 del plan). Hoy no tiene fecha. Reune en un sitio lo que
estaba repartido por el plan, los pendientes y la guia de despliegue.

Se ordena por momento: **antes** (preparar sin tocar produccion), **el dia**
y **despues** (lo que la mudanza permite encender). Cada fila dice donde se
cambia.

---

## 1. Antes de mudarse

| # | Que | Donde | Nota |
| --- | --- | --- | --- |
| M1 | Elegir el VPS y **donde esta** | — | El BCV puede filtrar por pais: comprobar desde el VPS, antes de contratarlo en firme, que `https://www.bcv.org.ve` responde (con `curl`). Si no, la tasa seguira a mano |
| M2 | Decidir si la base se queda en Neon o pasa al VPS | — | Quedarse en Neon es lo mas simple (solo cambia de donde se llama). Pasarla al VPS exige montar copias de seguridad propias (seccion 4) desde el primer dia |
| M3 | Servidor web delante de la app, con TLS | VPS | Caddy o nginx, con certificado automatico, que reenvie a la app y ponga `X-Forwarded-For` (la auditoria guarda la IP de ahi: `src/lib/auditoria.ts`) |
| M4 | Probar el perfil `prod` del compose y el `docker/Dockerfile` | `docker-compose.yml`, `docker/Dockerfile` | Hoy existen pero nadie los usa en produccion. Construirlos en local con `COMPOSE_PROFILES=prod` y recorrer la verificacion manual |
| M5 | Variables de entorno de produccion | `.env` del VPS, fuera del repositorio | Las mismas que hoy tiene Vercel (`docs/despliegueProduccion.md`, seccion 3). Sin `NODE_ENV` a mano: lo fija la imagen. Permisos `600` en el archivo |
| M6 | Acceso al servidor | VPS | Solo por llave SSH, sin contrasena ni root; cortafuegos con 22, 80 y 443 y nada mas. El 5432 **cerrado** hacia fuera si la base vive ahi |
| M7 | Actualizaciones del sistema y reinicio de los contenedores | VPS | Actualizaciones de seguridad automaticas y `restart: unless-stopped` en el compose |

## 2. El dia de la mudanza

| # | Que | Donde | Nota |
| --- | --- | --- | --- |
| D1 | Copia de la base justo antes | Neon / VPS | Aunque la base no se mueva. Si se mueve: `pg_dump` desde Neon y `pg_restore` en el VPS, y despues `db/neon/diagnostico.sql` debe dar todo `true` |
| D2 | Rol `conejo_app` y su contrasena en la base de destino | Base | Si la base se mueve, el esquema lo crea sin contrasena (`db/schema.sql`): ponersela como en `db/neon/05-rol-de-la-aplicacion.sql` |
| D3 | Tarea de la tasa con `cron` del sistema | VPS (`crontab`) | Llamar a `/api/cron/tasa` con `Authorization: Bearer $CRON_SECRET`. Se puede pasar a **cada hora** |
| D4 | Si la tarea cambia de horario, cambiar su espejo | `src/lib/finanzas/programacionTasa.ts` y su prueba | `situacionTasa` supone un turno diario a las 18:30; con varias corridas al dia hay que reescribir «cuando vuelve». La prueba que compara con `vercel.json` se cambia por la del `crontab` |
| D5 | Cambiar el DNS de `app.` al VPS | Proveedor del dominio | Bajar antes el TTL. Mientras propaga, Vercel sigue sirviendo con la misma base: no hay corte |
| D6 | Recorrer la verificacion | `docs/despliegueProduccion.md`, seccion 5 | En especial: login, dos pasos, subir un archivo, la tasa y un correo |
| D7 | Retirar Vercel | Panel de Vercel | Solo cuando el VPS lleve unos dias bien. Quitar antes el dominio del proyecto, despues pausarlo |

## 3. Lo que la mudanza permite encender

Hoy no existe porque Vercel no lo deja. Ninguno es obligatorio el dia de la
mudanza.

| # | Que | Por que hoy no | Donde |
| --- | --- | --- | --- |
| E1 | Tarea de la tasa cada hora | El plan gratuito de Vercel solo deja una al dia | `crontab` (D3, D4) |
| E2 | Reintentar los correos que quedan «pendientes» | No hay tarea que los recoja: se reintentan a mano desde la bandeja | Una ruta nueva en `src/app/api/cron/` y su linea en el `crontab` |
| E3 | Archivos de mas de 4 MB y video por el servidor | Limite de peticion de Vercel | `next.config.ts` (`serverActions.bodySizeLimit`, hoy `5mb`), el limite del servidor web (M3) y los mensajes de `CampoArchivo` |
| E4 | Tiempo real: la bateria y la campana se actualizan solas | Las funciones de Vercel no mantienen conexiones abiertas | Por definir |
| E5 | Limite de intentos por IP en `/brief/[token]` y en el login | Detras de Vercel la IP es la de su red | Con M3 la IP es fiable |
| E6 | La foto de perfil, de nuevo con su propio `<input type="file">` | Hoy va a Drive como todo; la excepcion de `AGENTS.md` sigue «apagada hasta el VPS» | Decidir si se queda en Drive (recomendado: un solo sitio para los archivos) o va al disco con un volumen |
| E7 | Guardar archivos en el disco | El disco de Vercel es de solo lectura | Solo si se decide asi en E6 o E3; el volumen tiene que entrar en las copias |

## 4. Copias de seguridad de la base

**Hoy no hay copias propias.** Neon guarda historial para volver atras, pero
en el plan gratuito solo **6 horas** (`history_retention_seconds = 21600`,
leido el 2026-10-27): un error descubierto al dia siguiente no se puede
deshacer desde ahi. Y desde la maquina de desarrollo no se puede hacer un
`pg_dump`, porque ProtonVPN cierra el 5432.

| # | Que | Cuando | Como |
| --- | --- | --- | --- |
| C1 | Copia manual antes de cada cambio de esquema | Ya, en cada despliegue | Crear una rama de Neon desde `production` (es instantaneo y no copia datos hasta que cambian). Esta en la seccion 1 de la guia de despliegue |
| C2 | Copia diaria fuera de Neon | Antes de tener datos de clientes reales | Una tarea de GitHub Actions (sus servidores si llegan al 5432) que haga `pg_dump` cada noche y guarde el archivo cifrado fuera de Neon (Drive de la empresa, o un almacenamiento de objetos). La cadena de conexion, como secreto del repositorio |
| C3 | Conservar | Con C2 | Las 7 diarias y las 4 semanales, por ejemplo. Borrar lo viejo lo hace la misma tarea |
| C4 | Probar una restauracion | Una vez al montar C2, y despues cada pocos meses | Restaurar la ultima copia en una rama nueva de Neon (o en el Postgres de Docker) y pasar `db/neon/diagnostico.sql` y un conteo de filas. Una copia que nunca se restauro no es una copia |
| C5 | En el VPS, si la base se muda alli | Desde el primer dia en el VPS | `pg_dump` desde el `crontab` del propio VPS y copia fuera del servidor (C2). Un disco que se rompe se lleva la base y la copia si estan en el mismo sitio |
| C6 | Los archivos de Drive | Con R12 (cuenta de la empresa) | Drive no es una copia: si se borra la cuenta, se van. Decidir si se respalda la carpeta `ConejoApp/` |

## 5. Documentos que cambian

Al mudarse, `CLAUDE.md` (seccion Despliegue), `AGENTS.md` (Plataforma),
`README.md` (Despliegue), `docs/despliegueProduccion.md` y este archivo dejan
de hablar de Vercel. Las reglas de «el disco es de solo lectura» y «produccion
se migra pegando SQL» se revisan: en el VPS la base se puede migrar por
conexion directa.
