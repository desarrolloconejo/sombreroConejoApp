# Despliegue a produccion

Como se publica un cambio y en que estado esta produccion. La aplicacion
corre en **Vercel** (`appconejo`, dominio `app.elconejodelsombrero.com`) con la
base en **Neon** (proyecto `ConejoApp`, rama `production`, Ohio).

La historia de la integracion —que se pego en cada etapa y como se ensayo—
esta en el historial de git de este archivo, hasta el commit `1e2d6f4`.

---

## 1. Estado de produccion

**Publicada el 2026-10-27** la integracion completa del portal (etapas 1 a 8 y
la revision del responsable). Comprobado en produccion: login, verificacion
en dos pasos con Google Authenticator, correo real (tambien el enlace de
«Olvide mi contrasena»), la foto de perfil en Drive y la tarea de la tasa (el
BCV responde a Vercel: registro la tasa del 27/10).

| Pieza | Estado |
| --- | --- |
| Esquema | Identico a `db/schema.sql` (comparado objeto a objeto el 2026-10-27) |
| Datos | Los reales: 4 administradores, 1 empresa, las 42 aperturas de hooks. Sin datos de ejemplo |
| Conexion de la app | Rol `conejo_app` (sin `DELETE` donde no toca, sin saltarse la seguridad por fila) |
| Respaldo previo | Rama de Neon `respaldo-antes-integracion-2026-10-27`. Se puede borrar cuando la version nueva lleve un tiempo bien |
| Emisor de las facturas | **Vacio**: lo llena quien conoce los datos fiscales antes de facturar (Finanzas → Ajustes) |
| Google (Drive y Gmail) | Cuenta personal del responsable, pantalla de consentimiento en «Testing»: **la autorizacion caduca a los 7 dias** (ver seccion 5) |

## 2. Variables de entorno en Vercel

Settings → Environment Variables, solo **Production**. Tipo **Secret** salvo
las dos marcadas como Config.

| Variable | Que es |
| --- | --- |
| `DATABASE_URL` | Cadena **agrupada** de Neon (`-pooler`) con el usuario `conejo_app` y `sslmode=verify-full`. Nunca la del dueno |
| `JWT_SECRET` | Firma de las sesiones. No puede ser el de `.env.example` |
| `TOTP_CLAVE` | Cifra el secreto de los dos pasos. **No se cambia nunca**: cambiarla deja fuera a quien los tiene activados |
| `CRON_SECRET` | Protege `/api/cron/*`. Sin ella la tarea de la tasa responde 503 |
| `APP_URL_PUBLICA` (Config) | `https://app.elconejodelsombrero.com`, sin barra final. Va en los enlaces de los correos |
| `CORREO_MODO` (Config) | `real` |
| `DRIVE_CLIENT_ID`, `SECRET_DRIVE_KEY1`, `DRIVE_REFRESH_TOKEN` | El cliente OAuth y la autorizacion de Google (Drive y Gmail) |
| `DRIVE_CARPETA_PIEZAS_ID`, `DRIVE_CARPETA_COMPROBANTES_ID`, `DRIVE_CARPETA_PERFILES_ID` | Las carpetas de **produccion** (`ConejoApp/`), que imprime `npm run drive:separar`. No son las del `.env` local |

No se definen: `NODE_ENV` (lo pone Vercel), `TASA_MODO` y `ARCHIVOS_MODO`
(valen `real` sin definir), `SESION_*` (solo para pruebas). `BRIEFS_MAILBOX`
es opcional. Un cambio de variable solo afecta a los despliegues nuevos.

Al pegar un valor en el panel no debe colarse ningun espacio: un id de Drive
con un salto de linea dio un 404 el dia del despliegue (la app ya los limpia).

## 3. Publicar un cambio

**`main` publica**: cada push a `main` despliega en Vercel. Antes de subir:
`lint`, `typecheck`, las baterias (`prueba:*`), `test:unitarias` y las pruebas
de integracion que toquen.

### Si el cambio toca el esquema

`db/schema.sql` es la fuente y ya coincide con produccion. Un cambio nuevo
**ademas** entrega su archivo en `db/neon/`, con el siguiente numero (el
proximo es el **23**). Las reglas estan en `db/neon/README.md`; en resumen:

1. El archivo solo anade, es idempotente, no lleva secretos ni datos de
   ejemplo, y termina con su consulta de comprobacion. Lo que le quite algo a
   la version publicada va en otro archivo, para despues de subir.
2. **Respaldo**: crear en Neon una rama desde `production` antes de tocarla.
3. **Ensayo**: aplicarlo primero en una rama desechable de `production`, dos
   veces, y comprobar que el esquema queda igual que el local.
4. **Aplicarlo** en `production` (lo hace el responsable, pegandolo en el
   editor SQL de Neon) y pasar `db/neon/diagnostico.sql`.
5. Subir `main` y anotar el despliegue en la seccion 6.

### Comprobar despues de subir

- Entrar con una cuenta de administrador y recorrer lo que cambio.
- Vercel → Logs: sin errores en las rutas tocadas.
- Si cambio la tarea de la tasa: Settings → Cron Jobs → `/api/cron/tasa` →
  Run, y mirar Finanzas → Ajustes de finanzas → Tasa del dolar.

## 4. Vuelta atras

| Que falla | Que hacer |
| --- | --- |
| El build de Vercel | Nada: sigue publicada la version anterior. Se corrige y se vuelve a subir |
| La version nueva arranca pero algo esta roto | Vercel → Deployments → la anterior → Promote to Production. Vale si el SQL pegado solo anadio |
| Se rompieron datos | Restaurar desde la rama de respaldo de Neon. Ojo: Neon solo guarda **6 horas** de historial en el plan gratuito; pasado eso, solo queda la rama de respaldo |

## 5. Pendientes y cosas a vigilar

| Tema | Estado |
| --- | --- |
| Google en «Testing» | **Decidido el 2026-10-27: se queda asi** hasta que el responsable traiga credenciales nuevas. La autorizacion caduca a los 7 dias (hacia el 3 de noviembre): entonces fallan las subidas a Drive y los correos (quedan como fallidos en la bandeja, con aviso a los administradores). Pasos en `docs/operacion/google.md` |
| Copias de seguridad | No hay copia diaria fuera de Neon. Plan en `docs/operacion/mudanzaVps.md`, seccion 4 |
| Certificado del BCV | Vence el **20 de noviembre de 2026**. Si cambian de autoridad, la lectura falla y se avisa: sustituir el intermedio de `src/lib/externos/certificados/bcvIntermedio.ts`. No se apaga la verificacion |
| Tarea de la tasa | Una vez al dia, a las 18:30 de Caracas (lo que permite el plan gratuito de Vercel). Ajustes de finanzas dice si ya corrio y si toca registrarla a mano |
| Correos «pendientes» | Si la funcion se corta entre guardar y enviar, el correo queda pendiente y no lo recoge ninguna tarea: se reintenta a mano desde la bandeja de salida |
| Archivos de mas de 4 MB | No caben por el limite de peticion de Vercel. Los videos van por enlace |
| Valores de ejemplo | Un formato de impresion y cuatro medios de pago de ejemplo, el emisor vacio: `docs/pendientes.md` |
| Lo que espera al VPS | `docs/operacion/mudanzaVps.md` |

## 6. Registro de despliegues

| Fecha | Commit | Que | SQL | Variables |
| --- | --- | --- | --- | --- |
| 2026-10-13 | `1e57306` | Etapas 1, 2 y dos pasos. Se publico sabiendo que no funcionaba: faltaba el SQL | — | — |
| 2026-10-27 | `eefff89` | Integracion completa del portal | `db/neon/01` a `22` (retirados del repositorio despues: estan en el historial de git) | Todas las de la seccion 2 |
| 2026-10-27 | `08448b2` | Limpieza del id de la carpeta de Drive | — | `DRIVE_CARPETA_PERFILES_ID` pegada de nuevo |
