# Prueba real de Drive y Gmail en local

Como pasar de los modos simulados a los reales en la maquina de desarrollo,
para probar antes de publicar que los archivos llegan a Drive y que los
correos salen (R10 y R11 de `docs/pendientes.md`).

Por ahora se usa la **cuenta personal de Google del responsable**, en
desarrollo y en produccion (decidido el 2026-10-26). El cambio a la cuenta de
la empresa esta mas abajo y es R12.

Las claves y los tokens **los pone el responsable a mano en el `.env`**: no
se escriben en ningun documento ni se pegan en el chat.

---

## 1. En Google Cloud (una vez)

En el proyecto de GCP donde esta el cliente OAuth de la aplicacion:

1. **APIs y servicios → Biblioteca**: habilitar **Google Drive API** y
   **Gmail API**.
2. **Pantalla de consentimiento de OAuth → Permisos (scopes)**: anadir
   `.../auth/drive.file` y `.../auth/gmail.send`. Sin el segundo, Google lo
   quita sin avisar y el correo no sale.
3. Mientras la pantalla siga en **Testing**: anadir en **Usuarios de prueba**
   la cuenta que va a autorizar. En Testing, la autorizacion **caduca a los 7
   dias**: antes de cada prueba larga, repetir el paso 3.
4. **Credenciales → el cliente OAuth** (tipo «App de escritorio», o «Web» con
   `http://127.0.0.1:53682` como URI de redireccion): copiar el id y el
   secreto.

## 2. En el `.env` local

| Variable | Valor |
| --- | --- |
| `DRIVE_CLIENT_ID` | El id del cliente OAuth (ya esta) |
| `SECRET_DRIVE_KEY1` | El secreto del cliente OAuth (ya esta) |
| `APP_URL_PUBLICA` | `http://localhost:3000`, para que los correos lleven enlace |

`DRIVE_REFRESH_TOKEN` y las carpetas no se tocan: las escribe el paso 3.
El que hay hoy **caduco** (comprobado el 2026-10-27: Google responde «Token
has been expired or revoked»), asi que el paso 3 empieza por autorizar de
nuevo.

## 3. Autorizar y probar (en el host, no en Docker)

```bash
npm run google:autorizar
```

Abre el enlace que imprime, entra con la cuenta de Google y **marca las dos
casillas** (Drive y Gmail). Al terminar dice que permisos se concedieron, crea
`ConejoApp-Desarrollo/Piezas`, `ConejoApp-Desarrollo/Comprobantes` y `ConejoApp-Desarrollo/Perfiles` en el Drive, sube un archivo de
prueba, lo lee y lo borra. Las dos lineas de permisos deben decir «si».

```bash
npm run correo:probar -- tu-correo@ejemplo.com
```

Envia un solo correo de prueba a esa direccion. Si llega (mirar tambien el
spam), la aplicacion puede enviar. Hecho el 2026-10-27: llego.

**Antes de correr las pruebas automaticas** (`npm run test:integracion`),
volver a `CORREO_MODO=simulado`: con el correo real intentarian escribir a
las cuentas inventadas de la semilla (`*.test`).

## 4. Encender los modos reales

En el `.env`:

```
ARCHIVOS_MODO=real
CORREO_MODO=real
```

Y que el contenedor los lea:

```bash
docker compose up -d app-dev
```

Para volver a lo simulado basta con quitar esas dos lineas y repetir el
comando. Los archivos simulados de antes no se migran: son de prueba.

## 5. Que comprobar

**Archivos (R10)**

1. En una pieza, subir una imagen o un PDF en la tarjeta Versiones. En
   `ConejoApp-Desarrollo/Piezas` del Drive aparece con el nombre de la nomenclatura
   (`SIGLA_NOMBRE-CORTO_TIPO_AAMM_v01.png`).
2. En la app se ve la miniatura y se abre. El enlace es de la app
   (`/api/archivos/…`), nunca de Drive.
3. Como cliente, con la pieza en la fase 5, se ve; aprobada, se descarga como
   `…_APROBADO-CLIENTE`.
4. Reportar un pago con comprobante desde Facturacion del cliente: el archivo
   cae en `ConejoApp-Desarrollo/Comprobantes` y administracion lo abre desde el pago.
5. Subir una foto en Mi perfil: cae en `ConejoApp-Desarrollo/Perfiles` y se ve en la
   barra lateral.

Hecho el 2026-10-27 con la cuenta del responsable: los tres llegaron y se
leyeron desde la app.

**Correo (R11)**

Las cuentas de la semilla tienen correos inventados (`*.test`) que no
existen. Para recibir, cambiar en Usuarios el correo de una cuenta de prueba
por una direccion propia (o crear una cuenta nueva con ella).

1. Crear un cliente nuevo con un correo propio: llega la bienvenida, **sin
   contrasena** (la contrasena se entrega aparte).
2. Enviar un brief desde esa cuenta: llega la copia.
3. Enviar un presupuesto a esa empresa: llega el aviso.
4. En **Sistema → Bandeja de salida**, cada uno sale como entregado.
5. Login → «¿Olvidaste tu contrasena?» con ese correo: llega el enlace, sirve
   una vez, y despues llega el aviso de que la contrasena cambio. En la
   Bandeja de salida el correo del enlace muestra el marcador, no el enlace.
6. Un fallo (por ejemplo, quitar `SECRET_DRIVE_KEY1` un momento y reiniciar):
   el correo queda como fallido en la bandeja y los administradores reciben
   la notificacion. Volver a ponerlo despues.

## 6. En produccion (Vercel)

Las mismas variables, marcadas como Sensitive: `DRIVE_CLIENT_ID`,
`SECRET_DRIVE_KEY1`, `DRIVE_REFRESH_TOKEN`, `DRIVE_CARPETA_PIEZAS_ID`,
`DRIVE_CARPETA_COMPROBANTES_ID`, `DRIVE_CARPETA_PERFILES_ID`, `ARCHIVOS_MODO=real`, `CORREO_MODO=real` y
`APP_URL_PUBLICA` con la direccion publica. El detalle esta en
`docs/operacion/despliegue.md`.

**Las tres carpetas de produccion no son las del `.env`.** Produccion guarda
en `ConejoApp/` y desarrollo en `ConejoApp-Desarrollo/` (`DRIVE_RAIZ`), en la
misma cuenta. `npm run drive:separar` crea la de produccion si falta e
imprime sus ids para Vercel.

**Limpiar lo de las pruebas:** `npm run drive:limpiar` lista los archivos de
`ConejoApp-Desarrollo/`; con `npm run drive:limpiar -- --confirmar` los manda
a la papelera de Drive (se recuperan desde alli mientras no se vacie). Nunca
toca `ConejoApp/`.

## 7. Cambio a la cuenta de la empresa (R12, despues)

1. Repetir el paso 1 en un proyecto de GCP de la empresa (o anadir la cuenta
   de la empresa como usuaria de prueba del actual).
2. `npm run google:autorizar` entrando con la cuenta de la empresa: deja un
   `DRIVE_REFRESH_TOKEN` nuevo y crea las carpetas en su Drive.
3. Sustituir en Vercel el token y los ids de las dos carpetas.
4. **Lo ya subido no se mueve solo**: queda en el Drive personal. Decidir
   antes de recibir archivos reales de clientes si se pasa a mano o se deja
   alli (y entonces esa cuenta no se puede cerrar ni revocar).
5. Los correos empiezan a salir desde la cuenta de la empresa.
