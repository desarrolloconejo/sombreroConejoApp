# Conejo App

Plataforma interna de **El Conejo del Sombrero** para centralizar y automatizar
los procesos de la agencia, orientada a sus trabajadores y a sus clientes.

Hoy cubre autenticacion, usuarios, empresas, perfil y el modulo de Hooks. Esta
en marcha la integracion de un portal completo —briefs, proyectos, revision del
cliente y finanzas—, cuyo plan vive en
[docs/planIntegracionPortal.md](docs/planIntegracionPortal.md). La revision
del repositorio ya se hizo y su resultado esta en
[docs/informeAuditoria.md](docs/informeAuditoria.md); queda pendiente el plan de
mejora del diseno.

## Stack

| Capa | Tecnologia |
| --- | --- |
| Framework | Next.js 16 (App Router) y React 19 |
| Lenguaje | TypeScript 5, modo estricto |
| Estilos | TailwindCSS 4, configurado desde `globals.css` |
| Iconos | lucide-react |
| Base de datos | PostgreSQL 17, con SQL puro sobre `pg` |
| Sesiones | JWT con `jose` sobre cookies `HttpOnly` |
| Contrasenas | `bcryptjs` |
| Pruebas | Playwright, mas dos baterias propias en `db/pruebas` |
| Desarrollo | Docker Compose (app, base y pgAdmin) |
| Produccion | Vercel, con la base en Neon |

## Requisitos

- **Docker y Docker Compose.** La aplicacion se desarrolla dentro del
  contenedor; no hace falta levantar Node en el host para usarla.
- **Node.js 22 o superior en el host**, solo para las pruebas de Playwright y
  los scripts de `scripts/`.

## Empezar

```bash
git clone <repositorio>
cd sombreroConejoApp
cp .env.example .env
```

Abre el `.env` y completa lo que venga vacio. Los valores no estan en este
documento ni en ningun otro del repositorio: **se le piden al responsable del
proyecto**. Para trabajar en local bastan los de la base de datos y el secreto
de sesion; los de Google Drive solo hacen falta para subir archivos.

```bash
docker compose up -d --build
docker compose exec app-dev npm run seed
```

El seed crea las tablas y deja la base lista para entrar: roles, cargos, una
empresa de ejemplo y cuatro cuentas (un administrador y tres de prueba, una por
perfil). Es idempotente. Las cuentas que crea y sus claves estan en
`db/datos/semilla.mts`.

| Servicio | Donde |
| --- | --- |
| Aplicacion | `http://localhost:<APP_PORT>` |
| pgAdmin | `http://localhost:<PGADMIN_PORT>` |
| PostgreSQL | `localhost:<POSTGRES_PORT>` |

Los puertos los fija el `.env`. Dentro de la red de Docker la base siempre es
`db:5432`.

PostgreSQL y pgAdmin solo se publican en `127.0.0.1`: no se llega a ellos
desde otro equipo de la red. La aplicacion si queda visible en la red local,
para poder abrirla desde un telefono.

Para las pruebas de navegador, una sola vez en el host:

```bash
npm install
npx playwright install chromium
```

## Comandos

Dentro del contenedor:

```bash
docker compose exec app-dev npm run lint
docker compose exec app-dev npm run typecheck
docker compose exec app-dev npm run seed            # esquema y datos locales
docker compose exec app-dev npm run prueba:auditor  # casos del auditor de hooks
docker compose exec app-dev npm run prueba:modelos  # modelos contra la base
docker compose exec app-dev npm run sql:produccion  # SQL para pegar en Neon
```

En el host:

```bash
npm run test:unitarias     # funciones puras; no necesita la app levantada
npm run test:integracion   # navegador contra la app levantada y sembrada
npm test                   # las dos
npm run drive:probar       # autoriza y comprueba Google Drive
```

Utiles de Docker:

```bash
docker compose logs -f app-dev   # seguir los logs
docker compose down              # detener
docker compose down -v           # detener y borrar los datos locales
docker compose up -d --build -V  # reconstruir tras cambiar dependencias
```

Tras anadir o quitar una dependencia hay que reconstruir con `-V`: los
`node_modules` del contenedor viven en un volumen propio y no se enteran solos.

## Estructura

```
src/
  app/          pages (servidor) que inyectan props a los componentes
  components/   interfaz, con el patron wrapper -> content
  actions/      logica de negocio ('use server'); orquestan los modelos
  models/       unica capa que consulta la base de datos
  types/        tipos compartidos
  lib/          infraestructura: base, sesion, jwt, validaciones, navegacion,
                redireccion
  lib/hooks/    criterio del modulo de hooks, como funciones puras
  proxy.ts      barrera de rutas (en Next 16 sustituye a middleware.ts)
db/
  schema.sql    definicion completa e idempotente del esquema
  seed.mts      aplica el esquema y siembra la base local
  generarSql.mts  vuelca el SQL que se pega en produccion
  datos/        datos de la semilla
  pruebas/      baterias del auditor y de los modelos
tests/
  unitarias/    Playwright sin navegador
  integracion/  Playwright con navegador
scripts/        utilidades que corren en el host
docker/         Dockerfile y configuracion de servicios
docs/           plan de integracion y documentos de referencia
diseno/         maquetas aprobadas
```

Regla de dependencias: los componentes nunca importan de `models/`, y `models/`
nunca importa de `next/`. La primera la comprueba el lint: `src/components/**`
no puede importar `models/` ni `lib/db`, `lib/jwt`, `lib/sesion` o
`lib/password`.

## Como se trabaja

- **Una rama por funcionalidad.** Se une a `main` cuando esta terminada y
  probada. Subir `main` publica en produccion.
- **Commits en espanol**, descriptivos, que cuenten solo lo que cambia ese
  commit.
- **Antes de unir:** `lint`, `typecheck` y las pruebas que toquen, en verde.
- **Sin dependencias nuevas** salvo aprobacion expresa. El proyecto valida,
  maneja estado y pinta su interfaz sin librerias adicionales.
- **Todo en espanol**, sin tildes en el codigo.
- Al usar Next 16, consulta su documentacion local en
  `node_modules/next/dist/docs/`: tiene cambios incompatibles con versiones
  anteriores.

El contexto para asistentes de codigo esta en [AGENTS.md](AGENTS.md).

## Convenciones

### Base de datos

SQL puro, sin ORM. Toda la interaccion pasa por `src/lib/db.ts`:

```ts
import { consultar, consultarUno, ejecutar, transaccion } from "@/lib/db";

const usuario = await consultarUno<Usuario>(
  "SELECT id, nombre, email FROM usuarios WHERE lower(email) = lower($1)",
  [email],
);
```

- **Los valores van siempre en el arreglo**, nunca dentro del texto de la
  consulta. Esa es la defensa contra inyeccion.
- **Nunca `SELECT *`**: las columnas se listan, con alias a camelCase.
- Columnas y direccion de un `ORDER BY` no admiten parametros: se validan con
  `identificadorSeguro`, que obliga a elegir de una lista cerrada.
- `db/schema.sql` es idempotente y es la unica fuente del esquema. Un cambio
  sobre una tabla existente va en un bloque `DO` con `ADD COLUMN IF NOT EXISTS`.

### Autenticacion y permisos

El acceso se protege en dos niveles, y hacen falta los dos.

`src/proxy.ts` filtra por ruta antes de que la peticion llegue a la aplicacion.
Las guardias de `src/lib/sesion.ts` son la proteccion real: **toda page y toda
action que lea o modifique datos empieza llamando a una**.

```ts
export default async function Pagina() {
  const usuario = await requerirCargo("redes"); // el guardia SIEMPRE primero
  // ...
}
```

Hay dos ejes independientes: el **rol** (admin, trabajador, cliente) decide lo
que se puede hacer, y el **cargo** decide lo que se ve. Para un cliente, el
equivalente al cargo es su empresa. El admin se salta el filtro de cargo.

Un destino de redireccion que llegue en la URL —hoy, `volverA` en el login—
pasa siempre por `destinoSeguro` (`src/lib/redireccion.ts`), que solo deja
volver a rutas del panel.

### Anadir un modulo

1. Tablas en `db/schema.sql` y tipos en `src/types/`.
2. Modelo en `src/models/` y actions en `src/actions/`, cada una con su guardia.
3. Una entrada en `src/lib/navegacion.ts`: alimenta a la vez el menu y el
   buscador global. Si la ruta se restringe, tambien en `src/proxy.ts`.
4. Componentes en `src/components/<modulo>/`.
5. La page y **su propio `loading.tsx`**. Bajo `dashboard/` no hay una frontera
   de carga compartida, a proposito.

Un modulo con listado no escribe su tabla: declara columnas y filtros y usa el
componente `Listado`, que trae buscador, filtros, orden, paginacion, tarjetas
en movil y paneles, con el estado en la URL.

```tsx
const estado = leerEstadoListado(await props.searchParams, {
  ordenPermitido: ["nombre", "creadoEn"],
  ordenPorDefecto: "creadoEn",
  filtrosPermitidos: ["estado"],
});
```

Los parametros de la URL nunca llegan crudos a un modelo. Los paneles se abren
con `?panel=`, y cada nombre nuevo hay que anadirlo a la lista blanca de
`src/lib/parametros.ts`: uno que no este ahi no falla, se ignora.

| | `PanelLateral` | `ModalConfirmacion` |
| --- | --- | --- |
| Para | Una tarea: crear, editar, consultar | Una pregunta de si o no |

Las personas y las empresas no se borran: se desactivan.

### Interfaz

Ningun componente escribe un color. Se usan los tokens del tema —`bg-fondo`,
`bg-superficie`, `text-texto`, `text-suave`, `border-borde`, `bg-acento`,
`text-acento-contraste`— y el tema decide: el acento es morado en claro y
dorado en oscuro.

El tema tiene tres estados (sistema, claro, oscuro). Para lo que un token no
cubre existe la variante **`dark-tema:`**; la variante `dark:` de Tailwind no
funciona aqui.

### El modulo de Hooks

Seis pasos hacia un final, que es registrar las metricas de la pieza:

```
Manual -> Documentacion -> Hooks -> Auditor -> Metricas -> Historial
```

Una ficha recorre `borrador` → `auditada` → `medida`, y una medida queda
cerrada. El auditor (`src/lib/hooks/auditor.ts`) es una funcion pura: la misma
frase da siempre la misma nota. Los fallos duros tapan la nota en vez de
restarla, y las listas de `src/lib/hooks/listas.ts` se comparan por subcadena:
sus raices cortadas y sus espacios finales no son erratas.

Para cambiar un objetivo hay que tocar tres sitios a la vez: el catalogo, el
tipo y el `CHECK` de la tabla.

## Pruebas

| Bateria | Donde corre | Que cubre |
| --- | --- | --- |
| `test:unitarias` | Host | Funciones puras, con Playwright sin navegador: auditor de hooks, destino tras el login y limite de la contrasena |
| `test:integracion` | Host, con la app levantada | Recorridos reales en un navegador |
| `prueba:auditor` | Contenedor | La tabla completa de casos del auditor |
| `prueba:modelos` | Contenedor | Los modelos contra la base; limpia lo que crea |

Las pruebas de integracion entran con las cuentas de prueba de la semilla, que
leen de `db/datos/semilla.mts`. Necesitan la base sembrada.

Playwright corre en el host porque la imagen de desarrollo es Alpine, donde sus
navegadores no funcionan.

## Compilar

El build no necesita base de datos. Para reproducir en local el de produccion:

```bash
docker compose stop app-dev
docker compose run --rm --no-deps -e NODE_ENV=production -e DATABASE_URL= app-dev npm run build
docker compose start app-dev
```

Dos cosas que ahorran una tarde:

- **Con el servicio de desarrollo detenido.** Los dos escriben en `.next` y
  juntos pueden agotar la memoria de Docker.
- **`NODE_ENV=production` no es opcional.** Sin el, el build muere al
  prerenderizar `/_global-error` con un error de `useContext` que no tiene nada
  que ver con el codigo.

## Despliegue

Produccion corre en **Vercel**, que detecta Next.js y lo compila con su propio
proceso: no usa el `Dockerfile`, que se conserva para una futura mudanza a un
servidor propio. La base esta en **Neon**.

- **Variables de entorno.** Se configuran en el panel de Vercel. Sus nombres son
  los de `.env.example`; sus valores, los que entregue el responsable. No se
  define `NODE_ENV`: lo fija la plataforma.
- **El disco es de solo lectura.** El codigo de servidor no escribe archivos.
  Por eso la subida de foto de perfil esta apagada.
- **La base se migra pegando SQL.** La maquina de desarrollo no alcanza Neon,
  asi que `npm run sql:produccion` genera el SQL y se pega en el editor de su
  panel. Es idempotente.
- **Primero la base, despues el codigo.** Si un cambio toca el esquema, se pega
  el SQL antes de subir `main`. Al reves, la aplicacion arranca contra tablas
  que no existen.
- **La base de produccion tiene datos reales.** No se le insertan datos de
  ejemplo.

## Documentos

| Archivo | Contenido |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | Contrato del proyecto |
| [AGENTS.md](AGENTS.md) | Contexto y reglas para asistentes de codigo |
| [docs/planIntegracionPortal.md](docs/planIntegracionPortal.md) | Plan de la integracion del portal |
| [docs/planAuditoriaRepositorio.md](docs/planAuditoriaRepositorio.md) | Plan de revision y actualizacion del repositorio. Ejecutado |
| [docs/informeAuditoria.md](docs/informeAuditoria.md) | Resultado de esa revision, hallazgo a hallazgo |
| [docs/planMejoraDiseno.md](docs/planMejoraDiseno.md) | Plan de mejora del diseno |
