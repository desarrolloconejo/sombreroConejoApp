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

Hoy existen: login, inicio, Mi perfil, Usuarios, Empresas y el modulo de Hooks.
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
- Las personas y las empresas **no se borran, se desactivan**.
- Toda consulta tiene un tope de 15 segundos (`query_timeout` en
  `src/lib/db.ts`). Lo que necesite mas no es una consulta de peticion.

**Seguridad**

- Toda page y toda action que lea o modifique datos **empieza por su guardia**
  (`src/lib/sesion.ts`). El proxy filtra por ruta pero no es la proteccion real.
- El token sirve para enrutar; lo que decide que se muestra es el dato fresco
  de la base.
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
- React 19 vacia los campos no controlados al terminar una action: los
  formularios largos controlan sus valores con `useCampos`.
- Los archivos `'use server'` solo exportan funciones asincronas; tipos y
  constantes de estado viven en `src/types`.

**Plataforma**

- Produccion corre en Vercel con la base en Neon. **El disco es de solo
  lectura**: el codigo de servidor no escribe archivos.
- La maquina de desarrollo no alcanza Neon. Produccion se migra **pegando SQL**
  en su editor; lo hace el responsable, no un asistente.
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
