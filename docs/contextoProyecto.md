# Conejo App — Informe de contexto del proyecto

Documento de contexto para un agente que no ha visto el repositorio. Describe
que es la aplicacion, como esta construida, que hace cada modulo y que
convenciones sigue el codigo. Estado a fecha 2026-10-09, rama `main`, 41
commits (2026-08-27 a 2026-09-07), repositorio
`desarrolloconejo/sombreroConejoApp`.

---

## 1. Que es

Plataforma web interna de **El Conejo del Sombrero**, una agencia de marketing.
Va dirigida a sus **trabajadores** y a sus **clientes**, y su objetivo es
centralizar y automatizar procesos del dia a dia de la agencia. Se construye
por **modulos**: cada funcionalidad se identifica, se define y se plasma como
un modulo propio.

Hay dos fases terminadas:

- **Fase 1** — autenticacion, autorizacion, gestion de usuarios, perfil propio
  y el armazon del dashboard (sidebar, cabecera, buscador global, tema).
- **Fase 2** — modulo de **Hooks**: creacion, auditoria y medicion de hooks
  para video corto, para el area de redes. Despues se anadio el modulo de
  **Empresas**.

Todo el proyecto (codigo, comentarios, commits, documentacion, nombres de
variables y de tablas) esta en **español**, sin tildes en el codigo.

---

## 2. Stack

| Capa | Tecnologia | Version |
| --- | --- | --- |
| Framework | Next.js, App Router | 16.3.2 |
| UI | React | 19.2.8 |
| Lenguaje | TypeScript, modo estricto | 5 |
| Estilos | TailwindCSS, configuracion CSS-first (`@theme` en `globals.css`, sin `tailwind.config.js`) | 4 |
| Iconos | lucide-react | 1.34.0 |
| Base de datos | PostgreSQL | 17 |
| Driver | `pg` (SQL puro, sin ORM ni generador de consultas) | 8.23.0 |
| Sesiones | JWT con `jose` sobre cookie `HttpOnly` | 6.2.10 |
| Hash de contrasenas | `bcryptjs` (JavaScript puro), 12 rondas | 3.0.3 |
| Lint | ESLint 9, flat config, `eslint-config-next` | — |
| Runtime | Node 24 (imagen `node:24-alpine`); `engines >= 20.9` | — |
| Desarrollo | Docker Compose: app + db + pgAdmin | — |
| Produccion | Vercel (funciones) + Neon (PostgreSQL gestionado, us-east-2) | — |

El contrato del proyecto limita las dependencias a esta lista. `pg` y
`bcryptjs` son las dos unicas excepciones aprobadas. No hay libreria de
validacion (se valida a mano), ni de estado, ni de componentes, ni de pruebas
(las baterias son scripts propios), ni de fechas.

Particularidades de Next 16 que el proyecto usa:

- `src/proxy.ts` sustituye a `middleware.ts` y corre siempre en runtime Node.
- `searchParams` y `params` son promesas: la page hace `await`.
- Tipos globales `PageProps<"/ruta">` y `LayoutProps<"/ruta">`.
- `next lint` no existe; se usa `eslint` directamente.
- La documentacion de la version vive en `node_modules/next/dist/docs/` y hay
  que consultarla antes de escribir codigo (`AGENTS.md`).

---

## 3. Arquitectura

Monolito cliente-servidor con el patron **MVC adaptado a Next.js**. Principios
declarados: alta cohesion, bajo acoplamiento, responsabilidad unica e
inyeccion de datos en las pages.

```
src/
  app/          pages y layouts (SERVIDOR). Exigen el permiso, resuelven datos e inyectan props
  components/   interfaz. Patron wrapper -> content. Cliente solo donde hace falta
  actions/      logica de negocio ('use server'). Orquestan modelos; conocen la sesion
  models/       UNICA capa que consulta la base de datos
  types/        tipos compartidos, con index.ts como punto unico de importacion
  lib/          infraestructura transversal (no es una capa MVC)
  lib/hooks/    catalogo, listas de deteccion y auditor del modulo de hooks (funciones puras)
  proxy.ts      barrera de rutas
db/
  schema.sql    definicion completa e idempotente del esquema
  seed.mts      aplica el esquema y siembra la base local
  generarSql.mts  vuelca esquema + datos a db/produccion.sql (no versionado) para pegarlo en Neon
  datos/        aperturas.mts (las 42) y semilla.mts (roles, empresa, usuarios, reglas, referencia)
  pruebas/      auditor.mts (19 casos, sin base) y modelos.mts (53 comprobaciones, contra la base)
docker/         Dockerfile multi-stage y pgadmin-servers.json
diseno/         maquetas aprobadas (*.dc.html) y canvas.json
docs/           creacionHooks.md: especificacion de la herramienta antigua de hooks
```

### Reglas de dependencia

- Los componentes **nunca** importan de `models/`.
- `models/` **nunca** importa de `next/`.
- Las actions no consultan la base por su cuenta: piden a los modelos.
- El alias de importacion es `@/` → `src/`.

### Flujo de una peticion

1. `proxy.ts` mira la cookie, verifica la firma del JWT y redirige si la ruta
   no corresponde. No consulta la base.
2. El layout de `dashboard/` llama a `requerirUsuario()` (lee el usuario fresco
   de la base), resuelve los modulos visibles y los baja como props a sidebar,
   cajon movil y buscador.
3. La page empieza con su guardia, lee y sanea los `searchParams`, llama a los
   modelos y **inyecta** el resultado en los componentes.
4. Las mutaciones son Server Actions consumidas con `useActionState`. Devuelven
   un `EstadoFormulario` serializable (`{ ok, mensaje?, errores?, credencial? }`).

### SSR y CSR

Las pages son de servidor. Los componentes son de cliente solo cuando lo
necesitan (formularios con estado, desplegables, cajon movil, buscador, tema,
avisos). Los listados se renderizan casi enteros en el servidor porque su
estado vive en la URL.

---

## 4. Entornos

### Desarrollo — Docker Compose

`docker-compose.yml` (proyecto `conejo-app`) es el entorno de desarrollo. El
servicio de la app que se levanta depende de `COMPOSE_PROFILES` en el `.env`.

| Servicio | Contenedor | Perfil | Puerto en el host | Notas |
| --- | --- | --- | --- | --- |
| `db` | `conejo_db` | siempre | 5433 | `postgres:17-alpine`, healthcheck con `pg_isready`, volumen `datos_db` |
| `app-dev` | `conejo_app_dev` | `dev` | 3100 | bind mount del proyecto, volumenes anonimos en `/app/node_modules` y `/app/.next` |
| `pgadmin` | `conejo_pgadmin` | `dev` | 5051 | `dpage/pgadmin4:9`, servidor precargado |
| `app-prod` | `conejo_app_prod` | `prod` | 3100 | build optimizado, usuario `node` sin root. Reservado para un futuro VPS |

Dentro de la red de compose la base siempre es `db:5432`.

Variables del `.env` (plantilla en `.env.example`): `COMPOSE_PROFILES`,
`APP_PORT`, `DEV_SCRIPT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`,
`POSTGRES_PORT`, `DATABASE_URL`, `PGADMIN_EMAIL`, `PGADMIN_PASSWORD`,
`PGADMIN_PORT`, `JWT_SECRET` (32+ caracteres), `JWT_EXPIRACION` (`8h`),
`COOKIE_SESION` (`conejo_sesion`).

El contenedor de desarrollo arranca con `next dev --webpack`
(`DEV_SCRIPT=dev:webpack`) y `WATCHPACK_POLLING=true`: el bind mount de Windows
a Linux no propaga eventos de archivo y Turbopack no tiene modo de sondeo.

### Comandos (se ejecutan dentro del contenedor)

```bash
docker compose up -d --build
docker compose exec app-dev npm run seed            # esquema + datos base, idempotente
docker compose exec app-dev npm run lint
docker compose exec app-dev npm run typecheck
docker compose exec app-dev npm run prueba:auditor  # 19 casos
docker compose exec app-dev npm run prueba:modelos  # 53 comprobaciones, limpia lo que crea
docker compose exec app-dev npm run sql:produccion  # genera db/produccion.sql
```

`npm run build` no se ejecuta con `exec` sobre el contenedor de desarrollo en
marcha: se construye la imagen `app-prod`, o se usa
`docker compose run --rm --no-deps -e NODE_ENV=production -e DATABASE_URL= app-dev npm run build`
con `app-dev` detenido. El build no necesita base de datos.

### Produccion — Vercel + Neon

- Vercel detecta Next.js y compila con su propio proceso; **no usa el
  Dockerfile**. Region de funciones `cle1`, Node 24.x, subdominio `app.` del
  dominio de la landing.
- Variables en Vercel: `DATABASE_URL` (cadena agrupada de Neon, host con
  `-pooler`, `sslmode=verify-full`) y `JWT_SECRET`.
- El disco de una funcion es de **solo lectura** salvo `/tmp`, y `public/` se
  hornea en el build. El codigo de servidor no escribe archivos al disco.
- La maquina de desarrollo no alcanza Neon (ProtonVPN bloquea el puerto 5432
  de salida). La base de produccion se siembra y se migra **pegando SQL** en el
  editor del panel de Neon: `npm run sql:produccion` genera el archivo, que es
  idempotente. Un cambio de esquema implica repetir ese pegado.

---

## 5. Base de datos

`db/schema.sql` es la unica fuente del esquema y es **idempotente de principio
a fin**: `CREATE ... IF NOT EXISTS`, `CREATE OR REPLACE`, y las migraciones
sobre tablas existentes van en bloques `DO $nombre$ ... $nombre$` con
`ADD COLUMN IF NOT EXISTS`. La vista se suelta al principio y se recrea al
final para no bloquear los `ALTER`. No hay herramienta de migraciones: se
edita el archivo y se vuelve a ejecutar el seed.

### Tablas

**Identidad y organizacion**

| Tabla | Contenido | Detalles |
| --- | --- | --- |
| `roles` | `admin`, `trabajador`, `cliente` | Se siembran en el seed |
| `cargos` | Areas de la agencia: `direccion`, `cuentas`, `redes`, `diseno`, `tecnologia`, `administracion` | Conjunto cerrado; las filas se insertan en el propio esquema. `slug` unico |
| `empresas` | Clientes de la agencia | `nombre`, `rif` (unico), `telefono`, `direccion`, `logo_url`, `sector`, `sitio_web`, `instagram`, `tiktok`, `facebook`, `youtube`, `linkedin`, `activo` |
| `usuarios` | Credenciales y datos personales | `nombre`, `apellido`, `email` (unico por `lower(email)`), `password_hash` (CHECK de forma bcrypt), `telefono`, `foto_url`, `tema` (`sistema`/`claro`/`oscuro`), `activo`, `ultimo_acceso`. **No guarda el rol** |
| `trabajadores` | Personal de la agencia | `usuario_id` (unico, CASCADE), `rol_id`, `cargo_id`, `fecha_ingreso` |
| `clientes` | Personas de contacto de una empresa | `usuario_id` (unico, CASCADE), `empresa_id` (RESTRICT), `cargo` (texto descriptivo) |

Un usuario es trabajador **o** cliente, nunca ambos: lo impone el trigger
`verificar_usuario_exclusivo` en las dos tablas. El rol de un cliente no se
almacena, se deriva de tener fila en `clientes`.

**Vista `vw_usuarios_completos`**: une todo lo anterior y devuelve, por
usuario, `tipo`, `rol`, `cargo` (texto a mostrar), `cargo_slug` (lo que decide
el acceso), `cargo_id`, `fecha_ingreso`, `empresa_id`, `empresa_nombre`,
`empresa_activa`. La consumen el login, el perfil y los listados.

**Modulo de hooks**

| Tabla | Contenido | Detalles |
| --- | --- | --- |
| `aperturas_hook` | Las 42 formas de empezar un hook | `numero` (unico), `territorio` (a–g), `mecanismos TEXT[]`, `plantilla`, `ejemplo`, `insert_titulo`, `direccion_edicion`, `usala_cuando`, `activa`. Se retiran, no se borran |
| `reglas_hook` | Como habla cada cuenta | `etiqueta`, `empresa_id` o `sector` (CHECK: al menos uno), `max_palabras_voz` (3–30, def. 12), `max_palabras_insert` (2–16, def. 6), `exigir_prueba`, `preambulos`, `formulas_gastadas`, `terminos_tension` (texto con terminos propios), `creado_por` |
| `fichas_hook` | La decision completa de una pieza | `empresa_id` (RESTRICT), `objetivo`, `plataforma`, `audiencia`, `tension`, `verdad_marca`, `prueba`, `hablado`, `insert_titulo`, `primer_fotograma`, `pago_promesa`, `cta`, `riesgo_claim`, `nota_auditor` (0–100), `metrica_principal`, `estado`, `creado_por` |
| `resultados_hook` | Lo que paso al publicar; uno a uno con la ficha | `ficha_id` (UNIQUE, CASCADE), `impresiones`, `vistas_3s`, `me_gusta`, `compartidos`, `clics`, `guardados`, `aprendizaje`, `observado_en`. CHECK `vistas_3s <= impresiones` |
| `referencias_hook` | Banco de hooks de referencia del equipo | `hablado`, `insert_titulo`, `plataforma`, `territorio`, `url_fuente`, `lectura` (NOT NULL: por que funciona), `etiquetas`, `ficha_id` (SET NULL), `creado_por` |
| `ediciones_ficha` | Registro de solo anadir de quien toco cada ficha | `ficha_id` (CASCADE), `usuario_id`, `accion` (`creada`/`editada`/`auditada`/`medida`), `creado_en` |

Conjuntos cerrados como CHECK, con espejo en `src/types/hooks.ts`:

- `objetivo`: `alcance`, `guardados`, `compartidos`, `comunidad`, `consideracion`, `accion`
- `plataforma`: `reels`, `tiktok`, `shorts`, `anuncio`
- `estado` de ficha: `borrador`, `auditada`, `medida`
- `territorio`: `a` a `g`

Todas las tablas con `actualizado_en` lo mantienen con el trigger
`tocar_actualizado_en`. Fechas en `TIMESTAMPTZ`.

### Datos que deja el seed

- 3 roles, 6 cargos.
- 1 empresa: «Distribuidora Ejemplo, C.A.», sector Hosteleria.
- 4 usuarios: un administrador (cargo `direccion`), `diseno@conejo.test`
  (trabajador, cargo `diseno`), `redes@conejo.test` (trabajador, cargo
  `redes`), `cliente@empresa.test` (cliente de la empresa de ejemplo). Las
  contrasenas estan en `db/datos/semilla.mts`.
- 42 aperturas, 2 reglas (una de sector «Estandar hosteleria» 16/8, una de
  cliente «Distribuidora Ejemplo» 12/6) y 1 referencia de ejemplo.

### Acceso a datos — `src/lib/db.ts`

Unica pieza que abre conexiones. Pool perezoso (se crea en la primera
consulta) guardado en `globalThis.__conejoPool`; en produccion `max: 3`,
ocio 10 s y vida maxima 60 s; en desarrollo `max: 10`.

| Funcion | Uso |
| --- | --- |
| `consultar<T>(sql, valores, ejecutor?)` | Devuelve todas las filas |
| `consultarUno<T>(sql, valores, ejecutor?)` | Primera fila o `null` |
| `ejecutar(sql, valores, ejecutor?)` | Numero de filas afectadas |
| `transaccion(async (cliente) => ...)` | BEGIN/COMMIT/ROLLBACK; dentro se pasa `cliente` como ejecutor |
| `identificadorSeguro(valor, permitidos)` | Lista blanca para columnas y direccion de `ORDER BY`; **lanza** si no esta |
| `escaparLike(texto)` | Escapa `%`, `_`, `\`; la consulta termina con `ESCAPE '\'` |
| `esErrorPostgres(error, CODIGO_ERROR.X)` | Distingue `23505`, `23503`, `23514` |

Convenciones de los modelos:

- Los valores van **siempre** como parametros `$1, $2…`, nunca interpolados.
  En desarrollo `verificarParametros` lanza si faltan o sobran valores.
- Nunca `SELECT *`: columnas explicitas, con alias a camelCase en el propio SQL
  (`foto_url AS "fotoUrl"`), de modo que la fila ya encaja con el tipo.
- Cada modelo es un archivo por entidad con funciones nombradas (`listar`,
  `buscarPorId`, `crear`, `actualizar`, `cambiarEstado`, `borrar`…) y se
  importa como espacio de nombres: `import * as usuarios from "@/models/usuarios"`.
- Aceptan un `ejecutor` opcional para sumarse a una transaccion.
- Los listados devuelven `Pagina<T>` = `{ filas, total, pagina, porPagina, totalPaginas }`.
- Filtros multivalor con `= ANY($n)` (la lista viaja como un solo parametro).
- Los recuentos asociados se piden por lote para la pagina visible
  (`contarPorEmpresas(ids)`), no con JOIN en la consulta principal.
- `password_hash` solo sale por `usuarios.buscarPorEmailConCredenciales`.
- Reintento unico automatico cuando la conexion estaba muerta y la consulta no
  llego al servidor; nunca dentro de una transaccion.

Modelos existentes: `usuarios`, `roles`, `cargos`, `trabajadores`, `clientes`,
`empresas`, `aperturas`, `reglasHook`, `fichas`, `resultados`, `referencias`,
`ediciones`.

---

## 6. Autenticacion y autorizacion

### Sesion

- Login por correo y contrasena (`src/actions/auth.ts` → `iniciarSesion`,
  `cerrarSesion`).
- JWT HS256 firmado con `JWT_SECRET`, emisor y audiencia `conejo-app`,
  duracion `JWT_EXPIRACION` (8 h). `src/lib/jwt.ts` fija el algoritmo al
  verificar y valida el contenido campo a campo.
- Cookie `conejo_sesion`: `httpOnly`, `sameSite: lax`, `secure` en produccion,
  `path: /`, sin `domain`, 8 h.
- Contenido del token (`Sesion`): `usuarioId`, `email`, `nombre`, `tipo`,
  `rol`, `cargo` (slug o null), `empresaId` (o null). Es una foto del momento
  del login.
- Mensaje unico para correo inexistente y contrasena incorrecta, con hash
  senuelo para igualar tiempos. `volverA` se valida como ruta interna.

### Dos ejes

| Eje | Valores | Decide |
| --- | --- | --- |
| **Rol** | `admin`, `trabajador`, `cliente` | Que se **puede hacer** |
| **Cargo** (solo trabajadores) | los seis slugs de `cargos` | Que se **ve** |
| **Empresa** (solo clientes) | `empresa_id` | Que se ve, equivalente al cargo |

El admin se salta el filtro de cargo: accede a todas las areas.

### Dos barreras

**1. `src/proxy.ts`** — por ruta, solo con el token:

| Ruta | Sin sesion | Con sesion |
| --- | --- | --- |
| `/` | → `/login` | → `/dashboard` |
| `/login` | accesible | → `/dashboard` |
| `/dashboard/**` | → `/login?volverA=…` | accesible |
| `/dashboard/usuarios`, `/dashboard/empresas` (`RUTAS_SOLO_ADMIN`) | → `/login` | solo `admin`; el resto → `/dashboard` |
| `/dashboard/hooks/**` (`RUTAS_POR_CARGO`) | → `/login` | cargo `redes` o admin; el resto → `/dashboard` |

**2. Guardias de `src/lib/sesion.ts`** — al inicio de **toda** page y **toda**
action que lea o modifique datos:

| Guardia | Devuelve | Fuente |
| --- | --- | --- |
| `obtenerSesion()` | `Sesion \| null` | token (cacheada por peticion) |
| `requerirSesion()` | `Sesion` | token |
| `requerirRol(...roles)` / `requerirAdmin()` | `Sesion` | token |
| `usuarioActual()` | `UsuarioCompleto \| null` | base (cacheada por peticion) |
| `requerirUsuario()` | `UsuarioCompleto` | base; expulsa a cuentas desactivadas |
| `requerirCargo(...cargos)` | `UsuarioCompleto` | base; el admin pasa siempre |
| `requerirEmpresa()` | `{ usuario, empresaId }` | base; solo clientes |

Regla: el token sirve para enrutar; el valor fresco de la base sirve para
decidir que contenido se muestra.

---

## 7. Navegacion y armazon

### Registro unico de modulos — `src/lib/navegacion.ts`

El arreglo `MODULOS` (no exportado) alimenta a la vez el sidebar, el cajon
movil y el buscador global (Ctrl+K). Cada entrada:

```ts
{
  titulo, subtitulo, href, icono,        // icono: LucideIcon
  alias?: string[],                       // terminos para el buscador
  roles?: NombreRol[],                    // omitido = todos
  cargos?: SlugCargo[],                   // omitido = sin filtro de area
  hijos?: Modulo[],                       // submodulos (un nivel)
}
```

Funciones: `modulosDe(quien)` (filtra por rol y cargo, poda padres sin hijos
visibles), `vistaDeModulos` (convierte iconos a elementos para cruzar al
cliente), `aplanar`, `buscarModulos`, `filtrarPorTermino`, `activoEntre` (gana
el prefijo mas largo), `moduloActivo`.

Menu actual, en orden:

| Modulo | Ruta | Visible para |
| --- | --- | --- |
| Inicio | `/dashboard` | todos |
| Usuarios | `/dashboard/usuarios` | admin |
| Empresas | `/dashboard/empresas` | admin |
| Hooks (desplegable con 6 hijos) | `/dashboard/hooks` | cargo `redes` y admin |
| Mi perfil | `/dashboard/perfil` | todos (siempre el ultimo) |

### Estructura de `src/app`

```
app/
  layout.tsx            raiz: fuente Poppins, tema leido de cookie en el servidor, ProveedorTema
  page.tsx              raiz (el proxy la redirige)
  globals.css           tokens, tema, utilidades
  error.tsx, global-error.tsx, not-found.tsx
  login/                page.tsx + loading.tsx
  dashboard/
    layout.tsx          requerirUsuario, Sidebar, HeaderMovil, BuscadorGlobal, ProveedorAvisos
    error.tsx
    (inicio)/           page.tsx + loading.tsx   -> /dashboard
    usuarios/           page.tsx + loading.tsx
    empresas/           page.tsx + loading.tsx
    perfil/             page.tsx + loading.tsx
    hooks/              page.tsx + loading.tsx   (portada)
      manual/ documentacion/ nuevo/ auditor/ metricas/ historial/   cada uno con page + loading
```

No hay rutas API (`route.ts`): todo son pages y Server Actions.

Debajo de `dashboard/` no existe una frontera de Suspense compartida: **cada
modulo trae su propio `loading.tsx`**, un esqueleto que copia la geometria de
su page. El inicio vive en el grupo `(inicio)` para acotar su frontera.

### Componentes de armazon — `src/components/layout`

`Sidebar` (fijo de 268 px desde `lg`), `HeaderMovil` (cabecera + cajon con
trampa de foco e `inert`), `ItemNavegacion` (padre enlace + chevron
interruptor), `BuscadorGlobal`, `Breadcrumb`, `Marca` (logo como mascara CSS
tenida con `currentColor`), `ProveedorTema`, `ProveedorAvisos` +
`useAvisoDeAccion` (avisos flotantes tras una action, esquina superior
izquierda), y **`Wrapper`**.

`Wrapper` es el envoltorio de toda page del dashboard:

```tsx
<Wrapper migas={MIGAS} kicker="..." titulo="..." descripcion="..." accion={<BotonEnlace/>}>
  {contenido}
</Wrapper>
```

---

## 8. Patrones de interfaz reutilizables

### Kit base — `src/components/ui`

`Boton`, `BotonEnlace`, `BotonIcono` (variantes y tamanos; `BotonEnlace` no
sube el scroll por defecto, se pide con la prop `scroll`), `Campo`,
`CampoSelect`, `CampoFijo`, `Selector` (combobox ARIA propio que sustituye al
`<select>` nativo, con teclado completo y campo oculto para el formulario),
`Avatar`, `Etiqueta`, `Estado`, `Alerta`, y el hook `useCampos`.

`useCampos` mantiene el valor de los campos en estado de React: React 19 vacia
los campos no controlados cuando termina una action, asi que los formularios
largos controlan sus valores para no perderlos al fallar la validacion.

### Listado estandar — `src/components/listado`

Un solo componente `Listado` sirve a todos los modulos con registros. El
modulo aporta **columnas, filtros y consulta**; hereda buscador con retardo de
350 ms, filtros multiseleccion en desplegables, columnas ordenables,
paginacion, selector de tamano de pagina, estado vacio, tarjetas por debajo de
`lg` y paneles.

- El estado vive en la **URL**: `busqueda`, `orden`, `dir`, `pagina`,
  `porPagina`, los filtros declarados, `panel` e `id`.
- `leerEstadoListado(await searchParams, config)` (`src/lib/parametros.ts`)
  sanea todo y **nunca lanza**; solo deja pasar el orden, los filtros y los
  paneles declarados. Devuelve `EstadoListado`.
- `src/lib/urlListado.ts` construye los enlaces: `conBusqueda`,
  `alternarFiltro`, `conOrden`, `conPagina`, `conPorPagina`, `sinFiltros`,
  `conPanel`, `camposOcultos`.
- `Columna<T>` = `{ clave, titulo, ordenable?, ancho?, alineacion?, tarjeta?, render }`;
  `tarjeta` es `"titulo" | "dato" | "acciones" | "oculta"`.
- `DefinicionFiltro` = `{ clave, titulo, opciones }`; la opcion «Todos» la
  antepone `ListadoFiltros`.

### Paneles y modales por URL

Se abren con `?panel=<nombre>&id=<n>` y se renderizan en el servidor.

| Componente | Para |
| --- | --- |
| `PanelLateral` (+ `PanelCuerpo`, `PanelPie`, `SeparadorPanel`) | Una tarea: crear, editar, ver una ficha |
| `ModalConfirmacion` | Una pregunta de si o no: desactivar, borrar |

Lista blanca de paneles (`PANELES` en `src/lib/parametros.ts`): `nuevo`,
`ver`, `editar`, `estado`, `clave`, `borrar`, `plantilla`, `cambios`,
`referencia`. La pagina de documentacion de hooks usa ademas sus propios
nombres compuestos (`ver-regla`, `editar-apertura`, `borrar-referencia`…).

Patron de acciones por fila: ojo (ver detalle de solo lectura), lapiz
(editar), y desactivar/borrar con modal.

### Validacion — `src/lib/validaciones.ts`

Manual, sin libreria. Helpers `limpiarTexto`, `limpiarOpcional`, `esEmail`,
`validarPassword`, `comoTema`, `comoIdentificador`, la constante `LIMITES`, y
validadores por formulario que devuelven `Validacion<T>` =
`{ valores, errores, valido }`: `validarCredenciales`, `validarPerfil`,
`validarEmpresa`, `validarCambioPassword`. `ENLACES_EMPRESA` es la lista unica
de redes que recorren tanto la validacion como el formulario.

### Forma de una action

```ts
"use server";
export async function crearAlgo(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const sesion = await requerirAdmin();            // 1. guardia
  const { valores, errores, valido } = validar(datos);  // 2. validar
  if (!valido) return { ok: false, errores };
  try { await modelo.crear(valores); }             // 3. modelo
  catch (e) { if (esErrorPostgres(e, CODIGO_ERROR.VIOLACION_UNICIDAD)) return { ok: false, errores: { rif: "..." } }; throw e; }
  revalidatePath("/dashboard/...");                // 4. revalidar
  return { ok: true, mensaje: "..." };
}
```

Los archivos `"use server"` solo exportan funciones asincronas; los tipos y
constantes de estado viven en `src/types`.

---

## 9. Diseno y tema

### Marca

Seis colores base en `@theme`: `navy #051a2a`, `white #ffffff`,
`gold #fae890`, `blackberry #602249`, `violet #321327`, `black #040404`.

Una sola tipografia en uso: **Poppins** (400/500/600/700/800), cargada con
`next/font` en la variable `--fuente-sans`.

### Tokens semanticos

Ningun componente escribe un color literal. Clases disponibles: `bg-fondo`,
`bg-superficie`, `bg-campo`, `text-texto`, `text-suave`, `border-borde`,
`bg-acento`, `text-acento`, `text-acento-contraste`, `bg-acento-tenue`,
`bg-acento-hover`, y para la navegacion `bg-nav`, `text-nav-texto`,
`border-nav-borde`. Sombras `--sombra`, `--sombra-alta`, `--foco`.

| | Claro | Oscuro |
| --- | --- | --- |
| `--fondo` | `#f2f4f6` | `#041521` |
| `--superficie` | `#ffffff` | `#0a2436` |
| `--texto` | `#040404` | `#ffffff` |
| `--acento` | blackberry `#602249` | gold `#fae890` |
| `--nav` | `#ffffff` | navy `#051a2a` |

Regla del acento: lo acentuado o bajo el cursor es morado en claro y dorado en
oscuro; el dorado solo aparece sobre fondo oscuro. Excepcion: el panel de
marca del login es navy en ambos temas.

### Tres estados de tema

`sistema`, `claro`, `oscuro`. Se guarda en la columna `usuarios.tema` y en una
cookie; el layout raiz lo lee en el servidor y lo pinta como `data-tema` en
`<html>`, sin parpadeo. Los tokens se definen tres veces (`:root`,
`@media (prefers-color-scheme: dark)` con `:not([data-tema="claro"])`, y
`[data-tema="oscuro"]`). Para diferencias que el token no cubre existe la
variante **`dark-tema:`**; la variante `dark:` de Tailwind no se usa.

### Utilidades propias (`globals.css`)

`surge` (animacion de entrada, con `--retraso`), `suave` (transicion de hover
con `--dur-entrada` 320 ms y `--dur-salida` 500 ms), `desliza`, `despliega`
(apertura por `grid-template-rows`), `hueso` (esqueleto de carga con barrido),
`barra-fina` (scrollbar).

### Responsive

Punto de corte principal `lg`: por debajo, cabecera movil con cajon y
listados en tarjetas; por encima, sidebar fijo y tablas. Verificado en 360,
768 y 1440 px. Contenido centrado con `max-w-[1240px]`.

Las maquetas aprobadas estan en `diseno/` (`Login`, `LoginMovil`, `Main`,
`PanelMovil`, `MiPerfil`, `CrearUsuario`, `PatronListado`, `Cargando`).

---

## 10. Modulos funcionales

### 10.1 Login — `/login`

Pantalla partida: panel de marca navy + formulario. Componentes en
`components/auth` (`LoginWrapper`, `LoginContent`, `PanelMarca`).

### 10.2 Inicio — `/dashboard`

`components/inicio` (`InicioWrapper`, `EstadoCuenta`). Muestra el estado de la
cuenta de quien entra, incluido un medidor de perfil completo (nombre,
apellido, telefono). No repite el menu de modulos.

### 10.3 Mi perfil — `/dashboard/perfil`

Para todos los roles. `components/perfil`: `FormularioDatos`,
`FormularioPassword`, `SelectorTema`, `TarjetaSesion`, `TarjetaFoto`.
Actions en `actions/perfil.ts` (`actualizarPerfil`, `cambiarPassword`,
`subirFoto`) y `actions/tema.ts` (`cambiarTema`).

La subida de foto de perfil esta **desactivada**: su codigo esta comentado en
bloque, no borrado, porque la plataforma de produccion no tiene disco
escribible. La columna `foto_url` y el componente `Avatar` (que cae a
iniciales) siguen existiendo.

### 10.4 Usuarios — `/dashboard/usuarios` (solo admin)

Listado estandar con busqueda y filtros por tipo, rol, area (cargo), empresa y
estado. `components/usuarios`: `ColumnasUsuarios`, `FiltrosUsuarios`,
`FormularioNuevoUsuario`, `FormularioEditarUsuario`, `DetalleUsuario`,
`ConfirmarEstadoUsuario`, `ConfirmarRestablecer`, `CredencialProvisional`.

Actions (`actions/usuarios.ts`): `crearUsuario`, `editarUsuario`,
`restablecerPassword`, `cambiarEstadoUsuario`.

- El alta crea en una transaccion el usuario y su fila de trabajador (rol +
  cargo) o de cliente (empresa + puesto). El tipo se elige al crear y no se
  cambia.
- La contrasena la genera el sistema como **provisional**, se muestra una sola
  vez (`EstadoFormulario.credencial`) y se entrega en mano; en la base solo
  queda el hash.
- Los usuarios **no se borran, se desactivan**. Nadie se desactiva a si mismo
  ni se desactiva al ultimo administrador activo.

### 10.5 Empresas — `/dashboard/empresas` (solo admin)

La cartera de clientes de la agencia. Listado con busqueda por nombre y RIF,
filtro por estado y sector, recuento de contactos y de piezas por empresa.
`components/empresas`: `ColumnasEmpresas`, `FormularioEmpresa` (uno solo para
alta y edicion), `DetalleEmpresa`, `ConfirmarEstadoEmpresa`,
`AvisoAltaEmpresa`.

Actions (`actions/empresas.ts`): `crearEmpresa`, `editarEmpresa`,
`cambiarEstadoEmpresa`.

- Once campos: nombre, RIF, telefono, direccion, sector y seis enlaces como
  URL completa (sitio web, Instagram, TikTok, Facebook, YouTube, LinkedIn).
- Se desactivan, no se borran. Editar no toca `activo`.
- La ficha de una empresa enlaza a sus contactos en Usuarios con `?empresa=N`.
- Una empresa no da acceso a nada por si misma: el acceso lo da vincularle un
  usuario cliente desde Usuarios.
- `empresas.listarActivas()` alimenta los desplegables de alta;
  `empresas.nombres()` (todas, tambien desactivadas) alimenta los filtros.

### 10.6 Hooks — `/dashboard/hooks/**` (cargo `redes` y admin)

Un **hook** es la apertura de un video corto: lo que se dice (`hablado`) y lo
que se lee en pantalla (`insert_titulo`) en los primeros segundos. El modulo
reproduce el flujo de trabajo de la herramienta anterior de la agencia
(especificada en `docs/creacionHooks.md`, 1 613 lineas, con las 42 aperturas en
su anexo) rediseñado como un **recorrido de seis pasos**. Todo el contenido es
**del equipo**: cualquier creadora ve y edita lo de las demas; `creado_por`
solo atribuye.

| # | Submodulo | Ruta | Que hace |
| --- | --- | --- | --- |
| — | Portada | `/dashboard/hooks` | Piezas en curso de quien mira (por orden de creacion, con avance y nota) y el recorrido con cuantas piezas hay paradas en cada paso |
| 01 | Manual | `…/manual` | El criterio de la casa. Solo lectura, desplegado |
| 02 | Documentacion | `…/documentacion` | Tres secciones gestionables: **Reglas**, **Aperturas** (las 42, filtrables por territorio y mecanismo) y **Referencias** (banco del equipo) |
| 03 | Hooks | `…/nuevo` | El «canvas»: formulario de la ficha con la nota del auditor en vivo |
| 04 | Auditor | `…/auditor` | Audita un texto suelto o una ficha de la cola «Esperan auditoria» |
| 05 | Metricas | `…/metricas` | Registrar lo que paso al publicar una pieza auditada |
| 06 | Historial | `…/historial` | Listado de todas las fichas del equipo con su estado, nota y hook rate |

**Ciclo de vida de una ficha**

```
borrador (33 %)  ->  auditada (66 %)  ->  medida (100 %)
```

- El final del recorrido es registrar las metricas, no aprobar la auditoria.
- El estado solo avanza: reauditar una ficha medida no la degrada.
- Una ficha **medida queda cerrada**: no se edita, no se reaudita y sus
  numeros no se corrigen. Lo impone el servidor en cada action. La salida es
  **usarla como plantilla** (`?panel=plantilla&id=N`), que copia todo menos el
  cliente y crea una ficha nueva.
- Tambien se puede partir de una referencia del banco
  (`?panel=plantilla&ref=N`): copia solo hablado, Insert-Titulo y plataforma.
- Una pieza propia se puede guardar en el banco de referencias desde el
  historial o marcando una casilla al registrar metricas (el `aprendizaje`
  pasa a ser su `lectura`).
- `ediciones_ficha` registra quien creo, edito, audito y midio; lo escriben
  las actions. Las horas se muestran en `America/Caracas`.
- La portada filtra por `creado_por`; el historial muestra lo de todos.

**Catalogo en codigo — `src/lib/hooks/catalogo.ts`** (criterio de la agencia,
no tablas)

- 7 **territorios** (la intencion): A Curiosidad util, B Demostracion,
  C Historia y oficio, D Identidad, E Guia guardable, F Objeciones,
  G Contradiccion.
- 8 **mecanismos** (como se demuestra): comparacion, numero, pregunta, dato,
  prueba visual, antes/despues, coste, persona.
- 6 **objetivos**, cada uno con sus dos territorios, su metrica y su evidencia:
  alcance → retencion a 3 s; guardados → guardados por alcance; compartidos →
  compartidos por alcance; comunidad → comentarios por alcance; consideracion
  → clics por alcance; accion → coste por resultado. La metrica no se
  pregunta: sale del objetivo.
- 4 **plataformas** con su ajuste: Instagram Reels, TikTok, YouTube Shorts,
  anuncio vertical.
- `HITOS` con los tres porcentajes.

**El auditor — `src/lib/hooks/auditor.ts`**

Funcion **pura** `auditar({ hablado, insertTitulo?, prueba?, regla? })` →
`{ nota, suma, aprobado, veredicto, limiteAmpliado, controles[] }`. Sin base,
sin sesion y sin modelo de lenguaje: comprobaciones deterministas sobre las
listas de `src/lib/hooks/listas.ts`. Corre en el cliente (nota en vivo) y en
el servidor (al guardar).

| Control | Puntos maximos | Duro |
| --- | --- | --- |
| Longitud del hablado (hasta el limite de voz) | 16 | — |
| Insert-Titulo (distinto del hablado y dentro de su limite) | 12 | si es identico |
| Preambulo (no empieza con saludo o relleno) | 14 | si |
| Formula del cementerio (sin formulas gastadas) | 12 | si |
| Especificidad (cifra, sin palabras vagas) | 14 | — |
| Tension (conflicto, negacion o hueco) | 13 | — |
| Direccion (segunda persona) | 9 | — |
| Promesa (sin sobrepromesa) | 10 | si |
| Prueba declarada (solo si la regla la exige) | 0 | si |

- Tope 100, umbral de aprobado **70**. Veredictos: `listo` (≥ 85),
  `aprobado_con_avisos` (≥ 70), `reescribir` (≥ 50), `descartar`.
- Los fallos duros **tapan** la nota en 69; menos de 4 palabras la tapan en 25.
- Las listas se comparan por subcadena, en minusculas y sin quitar tildes.
- Estandar de la casa: 12 palabras de voz, 6 de Insert-Titulo.

**Resolucion de la regla de una cuenta** (`reglasHook.resolverParaEmpresa`,
`limitesDeEmpresa`): regla del cliente → regla de su sector → estandar de la
casa, en una sola consulta. Los terminos propios de una regla se suman a las
listas de la casa.

**Metricas**: impresiones, vistas a 3 s, me gusta, compartidos, clics,
guardados y un `aprendizaje` en texto. El **hook rate** (`vistas_3s /
impresiones`) se calcula en SQL. `CamposMetricas` es la lista unica de campos
que comparten el modulo de metricas y el panel que se abre desde el auditor.

**Actions**

- `actions/hooks.ts`: `guardarBorrador`, `auditarHook`, `enviarCanvas`
  (despachador segun el boton pulsado), `auditarTexto`, `auditarFicha`,
  `enviarAuditor`, `borrarFicha`.
- `actions/hooksDocumentacion.ts`: `guardarRegla`, `borrarRegla`,
  `guardarApertura`, `cambiarEstadoApertura`, `guardarReferencia`,
  `borrarReferencia`, `guardarResultados`.

**Componentes** (`components/hooks`): `FormularioHook`, `FichaProduccion`,
`Auditor`, `ResultadoAuditoria`, `FiltroCalidad`, `PendientesPaso`,
`PiezaEnCurso`, `PiezasManual`, `SeccionesDocumentacion` (`SeccionReglas`,
`SeccionAperturas`, `SeccionReferencias`, `RotuloSeccion`), `FormularioRegla`,
`FormularioApertura`, `FormularioReferencia`, `DetalleRegla`,
`DetalleApertura`, `DetalleReferencia`, `DetalleFicha`, `ColumnasFichas`,
`ConfirmarBorradoFicha`, `ConfirmarDocumentacion`, `FormularioMetricas`,
`PanelMetricasFicha`, `CamposMetricas`, `CambiosFicha`.

El alta de empresas es solo de administradores: en el canvas, el boton «Nueva
empresa» lleva al modulo de Empresas si quien lo pulsa es admin, y muestra un
modal explicativo si no lo es.

---

## 11. Como se anade un modulo

El camino establecido en el proyecto:

1. **Esquema**: tablas y migraciones idempotentes en `db/schema.sql`; datos
   base en `db/datos/` y `db/seed.mts` si hacen falta.
2. **Tipos** en `src/types/` y reexportados desde `src/types/index.ts`.
3. **Modelo** en `src/models/<entidad>.ts`.
4. **Validacion** en `src/lib/validaciones.ts` y **actions** en
   `src/actions/<modulo>.ts`, cada una empezando por su guardia.
5. **Navegacion**: una entrada en `MODULOS` (`src/lib/navegacion.ts`), con
   `roles`, `cargos` y `hijos` segun corresponda. Si la ruta se restringe, se
   declara tambien en `RUTAS_SOLO_ADMIN` o `RUTAS_POR_CARGO` de `src/proxy.ts`.
6. **Componentes** en `src/components/<modulo>/` con su `index.ts`: columnas,
   filtros, formularios, detalles y confirmaciones.
7. **Page** en `src/app/dashboard/<modulo>/page.tsx`: guardia →
   `leerEstadoListado` → modelos → `<Wrapper>` + `<Listado>` + panel o modal
   segun `estado.panel`. Mas su **`loading.tsx`** propio.
8. Paneles nuevos: su nombre se anade a `PANELES` en `src/lib/parametros.ts`.
9. **Pruebas**: comprobaciones en `db/pruebas/modelos.mts`; `typecheck` y
   `lint` limpios.
10. **Documentacion**: lo que cambie se refleja en `AGENTS.md` (contexto para
    modelos) y lo relevante para el desarrollador en
    `README.md`. Commits en español, descriptivos, uno por cambio.
11. **Produccion**: regenerar el SQL y pegarlo en Neon si cambio el esquema.

---

## 12. Documentos del repositorio

| Archivo | Contenido |
| --- | --- |
| `CLAUDE.md` | Contrato del proyecto: objetivo, stack, principios, MVC, base de datos, Docker, despliegue, autenticacion, interfaz, colores, tipografia, estructura y el alcance de las fases 1 y 2 |
| `AGENTS.md` | Aviso de que Next 16 tiene cambios incompatibles y hay que leer su documentacion local |
| `README.md` | Guia del desarrollador: puesta en marcha, ambientes, comandos, acceso a datos, autenticacion, compilacion, como anadir un modulo con listado, modulo de hooks, despliegue y tema |
| `AGENTS.md` | Contexto y reglas para asistentes. La bitacora `agent.md` se elimino el 2026-10-13; su contenido sigue en el historial de git |
| `docs/creacionHooks.md` | Especificacion funcional de la herramienta antigua de hooks |
| `diseno/*.dc.html` | Maquetas aprobadas de la interfaz |
