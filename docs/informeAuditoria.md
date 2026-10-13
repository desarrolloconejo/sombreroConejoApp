# Informe de auditoria del repositorio

Fecha: 2026-10-13. Rama: `chore/auditoria-informe`. Estado: **analisis hecho,
arreglos pendientes de aprobar**.

Es el entregable de la pasada de analisis de `docs/planAuditoriaRepositorio.md`
(fases 1, 2 y 4). No se toco codigo. La fase 3 —actualizar dependencias— y los
arreglos esperan a que se apruebe la lista de abajo.

## Resumen

El repositorio esta en buen estado: las reglas del contrato se cumplen, el
bundle de cliente no lleva nada de servidor y el historial de git esta limpio.
Hay **tres cosas que no deberian esperar** y un grupo de mejoras menores.

| # | Severidad | Hallazgo | Cubierto por el plan del portal |
| --- | --- | --- | --- |
| A1 | Critica | `next` 16.3.2 tiene avisos de seguridad criticos; se corrigen en 16.4.0 | No |
| A2 | Alta | Redireccion abierta en el login por `volverA`. **Reproducida** | No |
| A3 | Alta | Las cuentas del seed pueden estar en produccion con su clave del repositorio | Solo hacia adelante (hueco 11) |
| A4 | Media | Los limites de error usan `reset`, que no recupera un fallo de servidor | No |
| A5 | Media | `.mcp.json` ejecuta Context7 con `npx -y` sin fijar version | No |
| A6 | Baja | `pg` sin tiempos limite de consulta; cliente roto vuelve al pool | No |
| A7 | Baja | El limite de 72 de la contrasena se mide en caracteres, no en bytes | No |
| A8 | Baja | `jose`: no se exige `exp`; la cookie dura 8 h fijas aunque cambie `JWT_EXPIRACION` | Parcial (seccion 5.1) |
| A9 | Baja | `sesionActual` es un punto de entrada publico sin uso; cinco funciones mas sin uso | No |
| A10 | Baja | La imagen `prod` lleva dentro las claves del seed y las baterias de prueba | No |
| A11 | Baja | El compose publica PostgreSQL y pgAdmin en todas las interfaces | No |
| A12 | Baja | El `matcher` del proxy excluye por extension en cualquier ruta | No |
| A13 | Baja | Sin frontera activa servidor/cliente; hay dos formas de ponerla sin dependencias | No |
| A14 | Info | `next build` falla dentro del contenedor de desarrollo si no se fuerza `NODE_ENV` | No |

Lo que el plan del portal ya tiene previsto en su seccion 5 (guardias con el
token, sesiones no revocables, login sin limite de intentos, vista con
`password_hash`, cabeceras, secreto de ejemplo valido) **se confirmo y no se
repite aqui**.

## Linea base

Ejecutado el 2026-10-13 sobre `main` (`f34d134`).

| Comprobacion | Resultado |
| --- | --- |
| `npm run lint` | Sin avisos |
| `npm run typecheck` | Sin errores |
| `npm run prueba:auditor` | 19 de 19 |
| `npm run prueba:modelos` | 53 de 53 |
| `npm run test:unitarias` | 3 de 3 |
| `next build` (con `NODE_ENV=production`) | Correcto, 16 rutas |
| Imagen `prod` del Dockerfile | Construye y arranca como usuario `node` |
| `npm run test:integracion` | No ejecutada en esta pasada |

## Hallazgos

### A1 — `next` 16.3.2 con avisos criticos

- **Evidencia:** `npm audit` marca `next` en el rango 16.0.0–16.3.7 como
  critico, con nueve avisos; el arreglo es 16.4.0, que no es un cambio mayor.
  `package.json:26`.
- **Riesgo:** entre los avisos hay ejecucion remota en la optimizacion de
  imagenes y en servidores alojados en Windows, y peticiones falsificadas desde
  el servidor. Varios no aplican en Vercel (la optimizacion de imagenes la hace
  la plataforma, no hay `use cache` ni paginas estaticas con datos), pero si
  aplicarian el dia del VPS, y no hay motivo para quedarse en una version
  marcada.
- **Arreglo:** adelantar el paso 1 de la fase 3: `next` y `eslint-config-next`
  a 16.4.0, y despues `npm audit fix` para `sharp` y `source-map-js`, que
  llegan a traves de `next`.

### A2 — Redireccion abierta en el login

- **Evidencia:** `destinoSeguro` (`src/actions/auth.ts:34-43`) acepta cualquier
  valor que empiece por una sola barra. `/<tabulador>/sitio.com` pasa el filtro,
  y el navegador descarta tabuladores y saltos de linea al interpretar una URL,
  asi que la lee como `//sitio.com`: otro dominio.
- **Reproducido** en local: `/login?volverA=/%09/example.com`, se inicia sesion
  con una cuenta de prueba y el navegador termina en `http://example.com/`.
- **Riesgo:** un enlace al login **autentico** que, tras entrar bien, deja a la
  persona en una pagina ajena. Es la base tipica de un «tu sesion caduco,
  vuelve a escribir la clave».
- **Arreglo:** validar interpretando, no mirando el texto: construir
  `new URL(valor, origenFijo)` y aceptar solo si el origen resultante es el
  mismo y la ruta empieza por `/dashboard`. Con prueba unitaria de los casos
  (`//`, `\`, tabulador, salto de linea, `/@sitio`).

### A3 — Cuentas del seed en produccion

- **Evidencia:** `db/generarSql.mts:125-130` inserta en el SQL de produccion los
  usuarios de `db/datos/semilla.mts`, con sus contrasenas del repositorio. Son
  cuatro, y una es de administrador. El plan del portal (hueco 11) deja de
  incluirlas, pero no dice nada de las que ya se hayan pegado en Neon.
- **Riesgo:** si esas cuentas existen en produccion con su clave original,
  cualquiera con acceso al repositorio entra, una de ellas como administrador.
- **No verificable desde aqui:** la maquina de desarrollo no alcanza Neon.
- **Arreglo, lo hace el responsable:** comprobar en Neon si existen; cambiar la
  contrasena de la de administrador y desactivar las de prueba. Despues,
  adelantar el cambio de `sql:produccion` previsto en la etapa 1.

### A4 — Los limites de error usan `reset`

- **Evidencia:** `src/app/error.tsx:57`, `src/app/dashboard/error.tsx:57` y
  `src/app/global-error.tsx:100` llaman a `reset`.
- **Documentacion:** la copia local de Next 16.3.2 (`error.md`) dice que en la
  mayoria de los casos hay que usar `retry()`, que vuelve a pedir los datos;
  `reset()` solo limpia el estado y repinta sin volver a pedirlos. La prop
  existe en la version instalada (`error-boundary.d.ts`).
- **Riesgo:** casi todos los fallos de esta aplicacion son de servidor (la
  base). Con `reset`, el boton «Reintentar» repinta el mismo error.
- **Arreglo:** cambiar a `retry` en los tres archivos.
- **Nota:** Context7 devuelve para 16.2.9 el nombre `unstable_retry`; la
  instalada ya lo llama `retry`. Es el caso que justifica la regla de que para
  Next manda la copia local.

### A5 — Context7 sin version fijada

- **Evidencia:** `.mcp.json:5` ejecuta `npx -y @upstash/context7-mcp`.
- **Riesgo:** cada sesion del asistente descarga y ejecuta la ultima version
  publicada, sin confirmacion, con los permisos de quien abre el proyecto. Si
  el paquete se viera comprometido, se ejecutaria en la maquina de desarrollo.
- **Arreglo:** fijar la version (`@upstash/context7-mcp@x.y.z`) y subirla a
  mano. Las skills ya estan fijadas por hash en `skills-lock.json`.

### A6 — `pg`: tiempos limite y liberacion del cliente

- **Evidencia:** `src/lib/db.ts:62-77` no define `statement_timeout`,
  `query_timeout` ni `idle_in_transaction_session_timeout`. En
  `transaccion` (`src/lib/db.ts:317-319`) el cliente se libera siempre con
  `release()`, tambien cuando el `ROLLBACK` fallo.
- **Documentacion (Context7, node-postgres):** los tres tiempos limite son
  opciones del cliente y por defecto no hay ninguno; `client.release(true)`
  destruye el cliente en vez de devolverlo al pool.
- **Riesgo:** una consulta colgada ocupa una de las tres conexiones de
  produccion hasta que la plataforma mata la funcion.
- **Arreglo:** `query_timeout` (lado cliente, funciona siempre) y
  `release(true)` cuando el `ROLLBACK` falla. `statement_timeout` viaja como
  parametro de arranque y hay que probarlo contra la cadena agrupada de Neon
  antes de darlo por bueno.
- **Correcto:** el resto de opciones del pool existen y estan bien usadas; las
  transacciones siguen el patron documentado.

### A7 — Limite de la contrasena en caracteres

- **Evidencia:** `src/lib/validaciones.ts:93` compara `valor.length` con 72.
- **Documentacion (Context7, bcrypt.js):** el limite es de 72 **bytes** en
  UTF-8, la libreria no lo impone y ofrece `truncates()` para comprobarlo.
- **Riesgo:** una contrasena con letras acentuadas o emojis puede pasar de 72 bytes
  con menos de 72 caracteres; lo que sobra se ignora en silencio.
- **Arreglo:** usar `bcrypt.truncates(valor)` en lugar de la longitud.
- **Correcto:** coste 12, comparacion en tiempo constante y el senuelo para
  igualar tiempos cuando el correo no existe.

### A8 — `jose`: reclamaciones obligatorias y duracion de la cookie

- **Evidencia:** `src/lib/jwt.ts:135-139` fija algoritmo, emisor y audiencia,
  pero no `requiredClaims`. `src/lib/sesion.ts:28` fija la cookie en 8 horas,
  mientras el token toma su duracion de `JWT_EXPIRACION`.
- **Documentacion:** `requiredClaims` existe en la version instalada
  (`types.d.ts:630`). Sin el, un token sin `exp` se da por valido.
- **Riesgo:** bajo; solo la aplicacion firma. Si se cambia `JWT_EXPIRACION`,
  cookie y token caducan en momentos distintos.
- **Arreglo:** `requiredClaims: ["exp", "sub"]`, y una sola fuente para la
  duracion. La seccion 5.1 del plan del portal reescribe esta parte: hacerlo
  alli.
- **Correcto:** algoritmo fijado al verificar, emisor, audiencia, clave como
  `Uint8Array`, validacion campo a campo del contenido.

### A9 — Codigo sin uso

| Que | Donde | Nota |
| --- | --- | --- |
| `sesionActual` | `src/actions/auth.ts:122` | Sin llamadas, **y aun asi registrada** como Server Action en el build: es un punto de entrada publico. Solo devuelve la sesion de quien llama, pero sobra |
| `buscarPorSlug` | `src/models/cargos.ts:19` | Sin llamadas |
| `buscarPorUsuarioId` | `src/models/clientes.ts`, `src/models/trabajadores.ts` | Sin llamadas |
| `buscarPorNombre` | `src/models/roles.ts` | Sin llamadas |
| `buscarModulos`, `moduloActivo` | `src/lib/navegacion.ts:392`, `:429` | Sin llamadas. El plan de diseno puede necesitar `moduloActivo` para el titulo de la cabecera movil |
| `requerirEmpresa` | `src/lib/sesion.ts:110` | Sin uso a proposito. No se toca |
| Subida de foto | `src/actions/perfil.ts`, `TarjetaFoto.tsx` | Comentada a proposito. No se toca |

### A10 — Contenido de la imagen `prod`

- **Evidencia:** `docker/Dockerfile:56` copia `db/` entero. Dentro de la imagen
  quedan `db/datos/semilla.mts` (con las claves del seed) y `db/pruebas/`.
- **Correcto:** no hay ningun `.env` en la imagen, `.dockerignore` lo excluye, y
  corre como usuario sin privilegios.
- **Arreglo:** copiar solo `db/schema.sql` y lo que el arranque necesite. Va
  junto con A3.

### A11 — Puertos del compose

- **Evidencia:** `docker-compose.yml:29` y `:54` publican PostgreSQL y pgAdmin
  en todas las interfaces, con la clave de desarrollo y pgAdmin sin contrasena
  maestra.
- **Riesgo:** en una red compartida, cualquier equipo llega a la base local.
- **Arreglo:** anteponer `127.0.0.1:` a los dos puertos.

### A12 — `matcher` del proxy

- **Evidencia:** `src/proxy.ts:128` excluye cualquier ruta que termine en
  `.svg`, `.png`, `.css`, `.js` y otras. `/dashboard/usuarios.js` no pasa por el
  proxy (responde 404 directo, sin redirigir al login).
- **Riesgo:** hoy ninguno. Una ruta futura que termine en una de esas
  extensiones quedaria fuera del proxy; la protegeria solo su guardia, que es
  lo previsto.
- **Arreglo:** limitar la exclusion por extension a lo que cuelga de la raiz, o
  dejarlo anotado. `.pdf` no esta en la lista, asi que la factura no se ve
  afectada.
- **Correcto:** el resto coincide con la documentacion local: exclusiones de
  `_next/static` y `_next/image`, runtime de Node sin configurar, y la
  advertencia de que las Server Functions no quedan cubiertas por el proxy esta
  recogida en el codigo y respetada en todas las actions.

### A13 — Frontera servidor/cliente

- **Evidencia:** ningun componente de cliente importa `lib/db`, `lib/jwt`,
  `lib/sesion`, `lib/password` ni `models/`, y el bundle de produccion no
  contiene nada de eso (ver la comprobacion 1). Pero nada lo impide.
- **Documentacion local (`data-security.md`):** Next resuelve `import
  "server-only"` por su cuenta; el paquete de npm no se usa. **No hace falta
  instalar nada.**
- **Pega:** `db/pruebas/*.mts` y el seed importan modelos fuera de Next, y ahi
  `server-only` no se resuelve.
- **Arreglo propuesto:** regla `no-restricted-imports` en `eslint.config.mjs`
  para `src/components/**`. Cubre lo mismo, no afecta a los scripts y tampoco
  es una dependencia.

### A14 — `next build` en el contenedor de desarrollo

- **Evidencia:** `docker compose run app-dev npm run build` falla al
  prerrenderizar `/_global-error`, porque la etapa `dev` fija
  `NODE_ENV=development`. Con `-e NODE_ENV=production` compila bien.
- **Arreglo:** documentar el comando en el `README.md`; la fase 3 lo necesita
  tras cada actualizacion.

## Fase 1 — Veredicto por libreria

| Libreria | Fuente consultada | Veredicto |
| --- | --- | --- |
| `next` 16.3.2 | Copia local; Context7 como contraste | **Corregir**: A1, A4. Lo demas correcto: `proxy.ts`, `cookies()` y `searchParams` asincronos, `PageProps` y `LayoutProps`, `redirect` fuera de `try`, `revalidatePath`, `next/font`, `loading.tsx` |
| `react` 19.2.8 | Context7 | Correcto: `useActionState` con el estado previo como primer argumento, `cache`, ajuste de estado durante el render, `inert`. El vaciado de campos no controlados tras una action esta documentado y `useCampos` lo resuelve |
| `jose` 6.2.10 | Context7 y tipos instalados | Correcto, con la mejora A8 |
| `pg` 8.23.0 | Context7 | Correcto, con la mejora A6 |
| `bcryptjs` 3.0.3 | Context7 | Correcto, con la mejora A7 |
| `lucide-react` 1.34.0 | Paquete instalado | Correcto: 65 iconos, todos importados por nombre y todos exportados. Tras subir a 1.56 el `typecheck` dira si alguno se renombro |
| `tailwindcss` 4 | Context7 | Correcto: `@theme`, `@utility` con anidado, `@custom-variant` con `@slot` y consulta de medios anidada |
| `@playwright/test` 1.64 | Configuracion | Correcto. Mejoras: los selectores van por `placeholder` y conviene `getByLabel`; solo hay proyecto de escritorio, y el plan de diseno necesita uno movil |
| `eslint` 9, `eslint-config-next` | Context7 (guia de la 10) | Configuracion plana correcta. La 10 exige Node 20.19 o superior y no retira reglas; falta confirmar que `eslint-config-next` 16.4 la admite. **Aplazado a la fase 3** |
| `typescript` 5.9.3 | — | **Aplazado**: la 7 es una mayor nueva, solo se evalua |

## Fase 2 — Los quince puntos

| # | Punto | Resultado |
| --- | --- | --- |
| 1 | Componentes de cliente sin imports de servidor | **Correcto, verificado sobre el bundle.** En `.next/static` de produccion no aparecen `password_hash`, `JWT_SECRET`, `DATABASE_URL`, `jwtVerify`, `bcrypt`, nombres de tabla ni SQL. Control positivo: textos de componentes de cliente si aparecen. Sin `process.env` ni mapas de codigo publicados |
| 2 | Frontera protegida de forma activa | No existe. Ver A13 |
| 3 | Props que cruzan al cliente | Correcto. `passwordHash` solo lo devuelve `buscarPorEmailConCredenciales` y solo se lee en `actions/auth.ts:70` y `actions/perfil.ts:73`. Ningun `SELECT *`. La vista sigue exponiendo el hash: hueco 7 del plan del portal |
| 4 | Lo que devuelven las Server Actions | Correcto. `credencial` viaja una vez en la respuesta de un POST, no se registra ni se guarda en el navegador. No hay `localStorage` ni `sessionStorage` en todo `src` |
| 5 | Mensajes de error | Correcto. Los limites pintan solo el `digest`; segun la documentacion local, en produccion el mensaje de un error de servidor llega generico. Las actions convierten los errores conocidos de la base en mensajes propios |
| 6 | Registros del servidor | Correcto. `src/lib/db.ts` registra solo `error.message`; ningun dato personal, token ni cadena de conexion |
| 7 | `.env.example` | El secreto de ejemplo es valido: hueco 10 del plan del portal. Los valores de la base y pgAdmin son de desarrollo y pueden quedarse |
| 8 | El seed | Imprime las claves (`db/seed.mts:241`). Aceptable en desarrollo; el problema es produccion: A3 |
| 9 | Historial de git | **Limpio.** 63 commits revisados: ningun `.env`, clave privada, token, cadena de Neon real ni credencial de Google. Lo unico es el secreto de ejemplo y la cadena local |
| 10 | Archivos servidos | Correcto. `public/` solo tiene el logotipo y la carpeta vacia de avatares. Ver A12 |
| 11 | Cabeceras | Ninguna, y `X-Powered-By: Next.js` presente: hueco 8 del plan del portal. Anadir `poweredByHeader: false`, que el plan no menciona |
| 12 | Cookies | Correcto. Sesion: `HttpOnly`, `SameSite=Lax`, `Secure` en produccion, `Path=/`. Una cookie invalida se limpia, comprobado. Tema: sin `HttpOnly` a proposito |
| 13 | Imagen de Docker | Sin `.env` y sin privilegios. Ver A10 |
| 14 | Dependencias con avisos | Ejecucion: `next` critico (A1), `sharp` y `source-map-js` altos, transitivos de `next`. Desarrollo: la cadena de `eslint-config-next` (`brace-expansion`, `micromatch`, `fast-glob`) y `js-yaml`; el «arreglo» que ofrece npm es bajar a la 14, asi que se espera a la version nueva |
| 15 | Skills y MCP | Skills fijadas por hash en `skills-lock.json`; ninguna configura hooks. `impeccable` trae scripts propios que sus comandos ejecutan en local. Context7 sin fijar: A5 |

## Lo que se propone hacer, en orden

| Paso | Contenido | Rama |
| --- | --- | --- |
| 1 | A1: `next` y `eslint-config-next` a 16.4.0, `npm audit fix` | `chore/auditoria-next` |
| 2 | A2 y A4: `destinoSeguro` con su prueba, `retry` en los limites de error | `fix/auditoria-login-y-errores` |
| 3 | A3: lo comprueba el responsable en Neon. En codigo, adelantar el cambio de `sql:produccion` y A10 | `chore/auditoria-seed-produccion` |
| 4 | A5 a A9 y A11 a A14 | `chore/auditoria-menores` |
| 5 | Resto de la fase 3: `react`, `jose`, `pg`, `lucide-react`, tipos; evaluar `eslint` 10 y `typescript` 7 | `chore/auditoria-dependencias` |

Los huecos 1 a 11 de la seccion 5 del plan del portal siguen en su etapa 1. El
hueco 1 —un administrador desactivado conserva sus permisos hasta ocho horas—
es un cambio pequeno en `requerirAdmin`; si la etapa 1 se retrasa, conviene
sacarlo de ella y hacerlo antes.
