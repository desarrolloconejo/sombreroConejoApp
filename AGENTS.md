<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Conejo App — contexto para modelos

Lo que un asistente necesita saber antes de tocar este repositorio. El contrato
del proyecto es `CLAUDE.md`; la guia para personas, `README.md`. Este archivo
resume las reglas que no se deducen leyendo el codigo.

## Que es

Plataforma interna de la agencia El Conejo del Sombrero, para sus trabajadores
y sus clientes. Monolito Next.js 16 (App Router), React 19, TypeScript
estricto, Tailwind 4, PostgreSQL 17 con SQL puro (`pg`), sesiones JWT (`jose`).
Todo —codigo, comentarios, tablas, commits y documentos— va en **espanol, sin
tildes en el codigo**.

Hoy existen: login, inicio, Mi perfil, Usuarios, Empresas, Auditoria y el
modulo de Hooks.
Esta en marcha la integracion de un portal completo (briefs, proyectos con
bateria de fases y tareas, revision del cliente, finanzas). **Antes de
construir nada de eso, lee `docs/planIntegracionPortal.md`**: es el plan
maestro, con las decisiones tomadas y las que siguen abiertas.

## Documentos

| Archivo | Para que |
| --- | --- |
| `CLAUDE.md` | Contrato: stack, principios, alcance por fases |
| `README.md` | Puesta en marcha, comandos, convenciones, despliegue |
| `docs/planIntegracionPortal.md` | Plan maestro de la integracion. Manda sobre los demas |
| `docs/despliegueProduccion.md` | Guia viva del despliegue: SQL, variables y pasos, por etapa |
| `docs/planAuditoriaRepositorio.md` | Plan de revision del repositorio con Context7. Ejecutado |
| `docs/informeAuditoria.md` | Resultado de esa revision: que se corrigio y que quedo para el plan del portal |
| `docs/planMejoraDiseno.md` | Plan de mejora del diseno y navegacion movil nueva |

El paquete de especificacion original del portal vive fuera, en la carpeta
hermana `appFacturas` (reglas de negocio de fases, briefs y finanzas, maquetas).

## Arquitectura

```
src/app/          pages y layouts de SERVIDOR: guardia -> datos -> inyectan props
src/components/   interfaz. Cliente solo donde hace falta
src/actions/      logica de negocio ('use server'). Conocen la sesion
src/models/       UNICA capa que consulta la base
src/types/        tipos, reexportados desde index.ts
src/lib/          infraestructura: db, sesion, jwt, validaciones, navegacion,
                  redireccion
src/lib/hooks/    criterio del modulo de hooks como funciones puras
src/proxy.ts      barrera de rutas (en Next 16 sustituye a middleware.ts)
db/               schema.sql, seed, generador de SQL de produccion, pruebas
db/neon/          SQL numerado para pegar en Neon, un archivo por cambio
tests/            Playwright: unitarias e integracion
```

Reglas de dependencia: los componentes nunca importan de `models/`; `models/`
nunca importa de `next/`; las actions no consultan la base por su cuenta. La
primera la impone el lint: `src/components/**` no puede importar `models/` ni
`lib/db`, `lib/jwt`, `lib/sesion` o `lib/password`.

## Reglas que no se negocian

**Datos**

- Los valores van siempre como parametros `$1, $2…`. Nunca interpolados.
- Nunca `SELECT *`. Columnas explicitas, con alias a camelCase en el SQL.
- Columnas y direccion de un `ORDER BY` pasan por `identificadorSeguro`.
- `db/schema.sql` es la unica fuente del esquema y es **idempotente**: tablas con
  `IF NOT EXISTS`, cambios sobre tablas existentes en bloques `DO`. No hay
  herramienta de migraciones.
- Conjuntos cerrados como `TEXT` + `CHECK`, con su espejo en `src/types`. Si se
  anade un valor hay que tocar los dos sitios.
- Las personas y las empresas **no se borran, se desactivan**. La base lo
  impone: el rol de la aplicacion no tiene `DELETE` sobre esas tablas.
- La aplicacion se conecta como `conejo_app`, no como duena. Una tabla nueva
  nace con `SELECT`, `INSERT` y `UPDATE`; el `DELETE` se concede a mano en el
  bloque de permisos de `db/schema.sql`, y `prueba:permisos` lo vigila.
- Los modelos de los modulos del portal reciben su conexion de `conSesion`
  (`src/lib/db.ts`), no de `transaccion`: declara a la base quien pregunta.
  Una vista sobre tablas con seguridad por fila lleva `security_invoker`.
- El hash de la contrasena solo esta en `vw_usuarios_acceso`. No se anade a
  ninguna otra vista ni consulta.
- **Toda action que cambia algo lo anota en `auditoria`, en la misma
  transaccion**: el cambio y `anotar(tx, …)` van dentro del mismo
  `transaccion`. Por eso los modelos que escriben aceptan un `ejecutor`. La
  accion sale de la lista cerrada `AccionAuditoria` (`src/types/auditoria.ts`)
  y nunca lleva contrasenas ni tokens.
- La tabla `auditoria` solo admite `INSERT`. No se escribe codigo que la
  actualice o la limpie, tampoco en pruebas.
- Toda consulta tiene un tope de 15 segundos (`query_timeout` en
  `src/lib/db.ts`). Lo que necesite mas no es una consulta de peticion.

**Seguridad**

- Toda page y toda action que lea o modifique datos **empieza por su guardia**
  (`src/lib/sesion.ts`). El proxy filtra por ruta pero no es la proteccion real.
- El token sirve para enrutar; lo que decide que se muestra **y que se puede
  hacer** es el dato fresco de la base. Todas las guardias (`requerirUsuario`,
  `requerirRol`, `requerirAdmin`, `requerirCargo`) leen de ella.
- Quien tiene un token valido pero ya no puede entrar sale por
  `/login?motivo=…`, nunca por `/login` a secas: el proxy lo devolveria al
  panel y entraria en bucle. Los motivos son una lista cerrada en el login.
- La autoridad de una sesion vive en la tabla `sesiones`, no en el token. Lo
  que cambie que puede ver o hacer alguien **revoca sus sesiones**
  (`src/models/sesiones.ts`); no basta con cambiar el dato.
- `renovarSesion` es la unica action sin guardia, y es a proposito. Ninguna
  otra puede saltarsela.
- Con una contrasena provisional (`debe_cambiar_clave`) las guardias no dejan
  pasar de `/cambiar-clave`. Solo esa page y `cambiarPassword` piden
  `requerirUsuario({ conClaveProvisional: true })`; no se anade a nada mas.
- El login responde igual a correo inexistente, contrasena equivocada y cuenta
  bloqueada. No se anaden mensajes que distingan los tres casos.
- La politica de contenido la pone `src/proxy.ts` con un nonce por peticion.
  No se anaden scripts en linea ni origenes externos sin tocarla.
- Los parametros de la URL nunca llegan crudos a un modelo: pasan por
  `leerEstadoListado`, que nunca lanza.
- Un panel nuevo (`?panel=`) hay que anadirlo a la lista blanca de
  `src/lib/parametros.ts`, o se ignora sin avisar.
- Un destino de redireccion que venga de la URL pasa por `destinoSeguro`
  (`src/lib/redireccion.ts`). Nunca se le da a `redirect` un valor crudo.
- El `matcher` de `src/proxy.ts` solo excluye por extension lo que cuelga de
  la raiz y `/images`. Una ruta publica nueva se declara en el proxy, no se
  cuela por el `matcher`.
- Ningun secreto entra al repositorio. `.env` esta ignorado; en `.env.example`
  y en los documentos van los **nombres** de las variables, no sus valores.

**Interfaz**

- Ningun componente escribe un color literal: tokens semanticos (`bg-superficie`,
  `text-suave`, `bg-acento`…). El tema tiene tres estados y se usa la variante
  `dark-tema:`, **no** `dark:`.
- Una sola tipografia, Poppins. Iconos de `lucide-react`.
- Cada modulo trae su propio `loading.tsx` con la geometria de su page.
- Un limite de error (`error.tsx`) reintenta con `retry`, no con `reset`:
  `reset` repinta sin volver a pedir los datos al servidor.
- Los listados usan el componente `Listado`, con el estado en la URL.
- Un modulo nuevo declara su `seccion` en `src/lib/navegacion.ts`. El menu se
  agrupa con `porSecciones`; ni el sidebar ni el menu movil llevan rotulos
  escritos a mano.
- React 19 vacia los campos no controlados al terminar una action: los
  formularios largos controlan sus valores con `useCampos`.
- Los archivos `'use server'` solo exportan funciones asincronas; tipos y
  constantes de estado viven en `src/types`.

**Plataforma**

- Produccion corre en Vercel con la base en Neon. **El disco es de solo
  lectura**: el codigo de servidor no escribe archivos.
- La maquina de desarrollo no alcanza Neon. Produccion se migra **pegando SQL**
  en su editor; lo hace el responsable, no un asistente. Cada cambio de esquema
  entrega su archivo en `db/neon/`, idempotente, sin secretos y con su
  consulta de comprobacion; `db/neon/README.md` lleva la lista. Lo que se
  pega antes de subir **solo anade**: nada que rompa la version publicada.
  Lo que le quita algo va en un archivo aparte, para despues de publicar.
- Los roles de PostgreSQL son del servidor entero, no de una base. Ensayar un
  archivo de `db/neon/` que toque `conejo_app` cambia su contrasena en local:
  despues hay que volver a ejecutar el seed.
- **La base de produccion tiene datos reales.** El SQL que se genera para ella
  lleva esquema y catalogos imprescindibles; no inserta datos de ejemplo.

## Dependencias

No se anaden librerias sin aprobacion expresa. Las de ejecucion son siete:
`next`, `react`, `react-dom`, `pg`, `jose`, `bcryptjs`, `lucide-react`. Esta
aprobada una mas para generar el PDF de la factura, pendiente de instalar
cuando llegue esa etapa. De desarrollo: `@playwright/test`.

No hay libreria de validacion, de estado, de componentes ni de fechas: se
valida a mano en `src/lib/validaciones.ts`.

## Como se trabaja

- **Una rama por funcionalidad**, que se une a `main` cuando esta terminada y
  probada. Subir `main` publica en Vercel.
- **No se publica hasta terminar la integracion del portal.** `main` se
  acumula en local; decidido por el responsable el 2026-10-13. No se sube ni
  se propone subir a mitad.
- **Todo lo que cambie produccion se anota en `docs/despliegueProduccion.md`
  antes de dar la rama por terminada**: el archivo de `db/neon/` en su
  seccion (antes o despues de subir), las variables de entorno, lo que hay
  que comprobar y lo que quedo sin probar. Es lo que se seguira el dia del
  despliegue.
- Commits en espanol, descriptivos, que digan solo lo que cambia ese commit.
- Antes de dar algo por hecho: `lint`, `typecheck` y las pruebas que toquen.
- Lo que cambie como se usa o se construye el proyecto se refleja en `README.md`
  y en este archivo; las decisiones de la integracion, en el plan.

## Comandos

La aplicacion corre en Docker; las pruebas de Playwright, en el host.

```bash
docker compose up -d --build                        # levantar
docker compose exec app-dev npm run seed            # esquema y datos locales
docker compose exec app-dev npm run lint
docker compose exec app-dev npm run typecheck
docker compose exec app-dev npm run prueba:auditor  # casos del auditor
docker compose exec app-dev npm run prueba:modelos  # modelos contra la base
docker compose exec app-dev npm run prueba:sesiones # modelo de sesiones
docker compose exec app-dev npm run prueba:permisos # lo que el rol de la app no puede
npm run test:unitarias                              # Playwright, sin navegador
npm run test:integracion                            # Playwright, app levantada
```

## Herramientas del asistente

| Herramienta | Uso |
| --- | --- |
| Context7 (MCP, `.mcp.json`) | Documentacion actual de librerias. Para Next 16 manda la copia local de `node_modules/next/dist/docs/`. Su version esta fijada y se sube a mano |
| Skills de diseno (`.claude/skills/`) | `impeccable`, `design-taste-frontend` y las de Emil Kowalski para animacion y movil |
| Playwright | Pruebas unitarias y de integracion |

**Las skills de diseno aconsejan; el contrato manda.** Varias proponen instalar
librerias de componentes, usar `dark:` o escribir colores literales. Aqui no:
se toma de ellas el criterio —jerarquia, ritmo, movimiento, estados— y se
ejecuta con los tokens y componentes del proyecto.
