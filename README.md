# Conejo App

Plataforma interna de **El Conejo del Sombrero** para centralizar y automatizar
los procesos de la agencia, orientada a sus trabajadores y a sus clientes.

Hoy cubre autenticacion, usuarios, empresas, perfil, auditoria, la bandeja de
salida de correos, el modulo de Hooks, el de Proyectos (piezas, bateria de
fases y tareas), presupuestos y proformas, y los briefs (del cliente, de la
bandeja de cuentas y de prospectos por enlace privado). Esta
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
| Codigo QR | `qrcode-generator`, solo en el servidor |
| PDF | `pdf-lib`, solo en el servidor: talonario y hoja de calibracion |
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
empresa de ejemplo y once cuentas: un administrador, cinco de prueba (una por
perfil, entre ellas el ejecutivo `cuentas@conejo.test` y `finanzas@conejo.test`, de
administracion), el administrador de las
pruebas automaticas, `admin@conejo.test` —asi el administrador de verdad puede
activar sus dos pasos sin dejarlas fuera—, y cuatro reservadas a las pruebas automaticas, `pruebas@conejo.test`, `sintareas@conejo.test`,
`bloqueo@conejo.test` y `dospasos@conejo.test`. Sobre esas cuatro las pruebas hacen lo que no se puede
deshacer —restablecer la contrasena, bloquear o desactivar la cuenta—; no se inicia sesion
con ellas. Siembra tambien dos proyectos de ejemplo de la empresa, asignada al
ejecutivo: una parrilla de redes de diez piezas que suma el 60 % y ensena las
cuatro alertas, y un proyecto especial recien empezado (`db/datos/proyectos.mts`).
Y finanzas de ejemplo: un presupuesto por aprobar, uno aprobado con su
proforma emitida, un borrador y una proforma recurrente a la que ya le toca la
siguiente (`db/datos/finanzas.mts`). Briefs de ejemplo: uno enviado y un
borrador (`db/datos/briefs.mts`). Y facturacion de ejemplo: un emisor
**ficticio**, una factura de la proforma aprobada y un pago del cliente por
confirmar (`db/datos/facturas.mts`).
Es idempotente. Las cuentas que crea y sus claves estan en
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
docker compose exec app-dev npm run prueba:sesiones # modelo de sesiones
docker compose exec app-dev npm run prueba:permisos # lo que el rol de la app no puede
docker compose exec app-dev npm run sql:produccion  # SQL para una base NUEVA
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

**Si la maquina va justa de memoria** (Docker Desktop sobre WSL toma por
defecto la mitad de la RAM), el servidor de desarrollo puede quedarse sin ella:
los registros de `app-dev` muestran `ENOMEM` y la app cierra las conexiones,
o Docker deja de responder. Se arregla con `docker compose restart app-dev`; si
Docker entero se cuelga, reiniciando Docker Desktop. Conviene no lanzar a la
vez el `typecheck`, la bateria de integracion y otros proyectos en Docker, y
pasar la integracion con `--workers=1`. Con memoria de sobra (16 GB para
Docker) aguanta `--workers=2`. El servidor de desarrollo crece con cada pantalla que
compila (pasa de 6 GB tras la bateria completa): antes de pasarla entera
conviene `docker compose restart app-dev`, y si una prueba larga falla por
tiempo, repetirla sola tras reiniciarlo antes de buscar un error.

**Si una page que existe responde 404** y los registros muestran
`Unexpected end of JSON input` o `Manifest file is empty`, el servidor de
desarrollo tiene un manifiesto a medio escribir. Pasa si algo regenera `.next`
mientras corre, por ejemplo `next typegen` dentro del contenedor. Se arregla
con `docker compose restart app-dev`.

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
  lib/portal/   catalogo de servicios y reglas de la bateria de fases, puras
  proxy.ts      barrera de rutas (en Next 16 sustituye a middleware.ts)
db/
  schema.sql    definicion completa e idempotente del esquema
  seed.mts      aplica el esquema y siembra la base local
  generarSql.mts  vuelca el SQL que se pega en produccion
  neon/         SQL numerado para pegar en Neon, un archivo por cambio
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

### Dos conexiones a la base

| Variable | Rol | Quien la usa |
| --- | --- | --- |
| `DATABASE_URL` (en el `.env`) | El dueno de la base | El seed y las baterias `prueba:modelos` y `prueba:sesiones` |
| La que arma docker compose | `conejo_app` | La aplicacion, y `prueba:permisos` |

**La aplicacion no se conecta como duena de la base.** Usa el rol
`conejo_app`, que no puede cambiar el esquema, no se salta la seguridad por
fila y solo tiene los permisos que le da `db/schema.sql`: no borra personas,
empresas ni sesiones, y sobre la auditoria solo inserta y lee.

En desarrollo no hay que configurar nada: el seed crea el rol y le pone su
contrasena local, y docker compose le pasa esa conexion a la aplicacion. Tras
un `up` sobre una base vacia, la aplicacion no arranca hasta ejecutar el seed.

Una tabla nueva nace con `SELECT`, `INSERT` y `UPDATE` para la aplicacion. Si
tiene que poder borrar, se le concede de forma explicita en el bloque de
permisos de `db/schema.sql`.

Los modelos del portal no usan `transaccion` sino `conSesion`
(`src/lib/db.ts`), que ademas declara a la base quien hace la peticion. Es lo
que leen las politicas de seguridad por fila.

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

Las guardias deciden con el usuario **leido de la base**, no con el token: si
un administrador desactiva a alguien o le cambia el rol, deja de poder actuar
en su siguiente peticion. Un cliente pierde ademas el acceso si su empresa se
desactiva.

Hay dos ejes independientes: el **rol** (admin, trabajador, cliente) decide lo
que se puede hacer, y el **cargo** decide lo que se ve. Para un cliente, el
equivalente al cargo es su empresa. El admin se salta el filtro de cargo.

#### Sesiones

Una sesion son dos cookies `HttpOnly` y una fila de la tabla `sesiones`:

| Pieza | Que es | Cuanto dura |
| --- | --- | --- |
| Token de acceso | Un JWT. Con el enruta el proxy | 30 minutos |
| Token de renovacion | Un valor al azar; en la base solo esta su hash | Lo que la sesion |
| Fila de `sesiones` | Donde vive la autoridad | 12 horas, tope absoluto |

Las guardias comprueban la fila en cada peticion, asi que **revocarla cierra
la sesion al momento**, no cuando caduque el acceso. La revocan: cerrar sesion,
cambiar o restablecer la contrasena, desactivar a la persona o a su empresa,
cambiarle rol, cargo o empresa, y presentar un token de renovacion ya usado.

Mientras hay actividad, `GuardianSesion` (en el layout del panel) renueva el
acceso sin avisar dos minutos antes de que caduque. Tras 15 minutos sin
actividad pregunta antes de hacerlo. Una page que llega con el acceso vencido
pasa por `/renovar` y vuelve a la misma URL.

#### Verificacion en dos pasos

Tras la contrasena, quien la tenga activada escribe un codigo de seis digitos
de su app de codigos (Google Authenticator, Microsoft Authenticator, Authy). Es
el estandar TOTP: no se llama a Google ni a ningun servicio, y no usa libreria
(`src/lib/totp.ts`, con los valores de referencia del RFC 6238 en sus pruebas).

- **Se pide por defecto a todas las cuentas.** Quien no la tiene activada ni
  ha dicho que no la quiere pasa por `/dos-pasos` al entrar; ahi la configura
  o elige «Ahora no». En los dos casos no se le vuelve a preguntar.
- **Nadie pasa de `/dos-pasos` sin resolverlo.** Mientras no la configure ni
  diga que no, cualquier pantalla del panel lo devuelve ahi: lo hacen las
  guardias, no solo el login.
- **Se registra escaneando un codigo QR.** Lo dibuja el servidor
  (`src/lib/qr.ts`, con `qrcode-generator`) y al navegador solo llega el
  trazo de un SVG. Siempre negro sobre blanco, tambien en tema oscuro. Debajo
  quedan la clave para teclearla y el enlace para abrirla desde el telefono.
- **Acertar la contrasena no abre la sesion** si estan activados: se deja una
  cookie de cinco minutos que solo sirve para llegar a `/verificar`.
- **Un codigo vale una vez**, y los fallos cuentan para el bloqueo de la cuenta.
- **Diez codigos de respaldo**, que se muestran solo al activar; en la base
  queda su hash.
- **El secreto va cifrado** con `TOTP_CLAVE`, que no esta en la base. Cambiar
  esa clave deja fuera a quien tenga los dos pasos activados.
- **Sin telefono ni respaldos**, un administrador se los retira desde la ficha
  de la persona en Usuarios.

En desarrollo, las cuentas de la semilla nacen con «prefiero no usarla» para
que entrar siga siendo correo y contrasena. La excepcion es
`dospasos@conejo.test`, que es con la que se prueba.

#### Bloqueo y contrasena provisional

Cinco contrasenas equivocadas seguidas bloquean la cuenta 15 minutos. Durante
el bloqueo no se comprueba nada, tampoco la contrasena correcta, y el mensaje
es el mismo que con un fallo normal: uno propio revelaria que ese correo
existe. Entrar bien, o que un administrador restablezca la contrasena, pone el
contador a cero.

La contrasena que genera el alta o el restablecimiento es **provisional**: la
conoce el administrador. Al entrar con ella, las guardias mandan a
`/cambiar-clave` desde cualquier ruta hasta que la persona elija una propia.

Los tres plazos se pueden acortar para probar: `SESION_ACCESO_SEGUNDOS`,
`SESION_HORAS` y `SESION_INACTIVIDAD_MINUTOS` (ver `.env.example`).

Las cabeceras de seguridad fijas estan en `next.config.ts`. La politica de
contenido lleva un nonce por peticion y la pone `src/proxy.ts`: los scripts en
linea y los origenes externos estan bloqueados salvo que se declaren ahi.

Un destino de redireccion que llegue en la URL —hoy, `volverA` en el login—
pasa siempre por `destinoSeguro` (`src/lib/redireccion.ts`), que solo deja
volver a rutas del panel.

### Servicios externos y correo

Todo servicio externo se llama a traves de un adaptador de `src/lib/externos/`,
que trabaja en modo `simulado` o `real` segun una variable de entorno. La
aplicacion no sabe cual esta activo.

| Servicio | Variable | Por defecto |
| --- | --- | --- |
| Correo | `CORREO_MODO` | `simulado`: no hay cuenta de la empresa todavia |
| Tasa de cambio | `TASA_MODO` | `real`: lee la pagina del BCV, que no pide cuenta |

**Enviar un correo son dos pasos.** `encolarCorreo` escribe el mensaje en
`portal.correos_salida` dentro de la transaccion del cambio que lo provoca, y
`entregarCorreos` lo manda despues de confirmarla:

```ts
const correoId = await conSesion(admin, async (tx) => {
  await usuarios.actualizarPasswordHash(id, hash, true, tx);
  return encolarCorreo(tx, admin, correoDeClaveRestablecida(usuario));
});

await entregarCorreos(admin, [correoId]); // nunca lanza
```

Asi no existe un correo que anuncie algo que no ocurrio, ni se espera a un
servicio ajeno con una conexion a la base tomada. En modo simulado el segundo
paso no hace nada: el mensaje queda en **Bandeja de salida**
(`/dashboard/salida`, solo administradores), donde se lee, se copia y se anota
como entregado a mano.

**Ningun correo lleva contrasenas, tokens ni codigos.** La bandeja guarda el
texto completo de todo lo que se envia. Los textos estan en
`src/lib/correos/plantillas.ts`.

### Notificaciones

La campana del encabezado lee `portal.notificaciones`: una fila por
notificacion y por persona. Se escriben, como la auditoria y los correos, en la
misma transaccion que el cambio que las provoca:

```ts
await notificarAAdministradores(tx, {
  tipo: "cuenta.bloqueada",
  titulo: "La cuenta de Carla Mendez se bloqueo",
  href: "/dashboard/usuarios?busqueda=carla",
});
```

Cada quien ve solo las suyas —ni un administrador lee las de otro—, y `href`
solo admite rutas del panel. El layout las pide una vez por carga y las inyecta
en la campana; abrirla las marca como leidas. No hay tiempo real: se actualiza
al cargar una pagina.

En el codigo, «notificacion» es esto y «aviso» es el mensaje flotante que
confirma una accion (`ProveedorAvisos`). No son lo mismo.

### Tasa de cambio y tareas programadas

`/api/cron/tasa` lee la pagina del BCV y guarda en `finanzas.tasas_cambio`
todas las monedas que publica, con su fecha valor. La llama el programador de
la plataforma (`vercel.json`, una vez al dia) y nadie mas: exige la cabecera
`Authorization: Bearer <CRON_SECRET>`, y sin `CRON_SECRET` en el entorno
responde 503.

Para lanzarla en local hay que definir `CRON_SECRET` en el `.env`, recrear el
contenedor y llamarla:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3100/api/cron/tasa
```

Tres cosas que no son obvias:

- **Una lectura rara no se guarda.** Si la pagina no tiene exactamente la
  forma esperada, o una moneda cambia mas de un 25 % respecto a la anterior,
  se rechaza, se anota y se notifica a los administradores. El lector esta en
  `src/lib/finanzas/tasaBcv.ts`, como funciones puras.
- **El valor viaja como texto**, no como numero: son ocho decimales y con
  ellos se calcula dinero. La base lo guarda en `NUMERIC`.
- **El servidor del BCV no envia su certificado intermedio**, y Node rechaza la
  conexion. No se apaga la verificacion: se le entrega ese intermedio, que
  esta en `src/lib/externos/certificados/bcvIntermedio.ts` con su procedencia.

Una tarea programada no tiene persona detras: escribe con `conSistema`, que
declara el rol `sistema`. Las politicas de cada tabla dicen que puede hacer.

### Seguridad por fila

Las tablas de los esquemas `portal` y `finanzas` llevan seguridad por fila. Sus
modelos reciben siempre el ejecutor de `conSesion` —es obligatorio, no tiene
valor por defecto—, porque sin la sesion declarada la base no devuelve ni
acepta ninguna fila:

```ts
const pagina = await conSesion(admin, (tx) => correos.listar(filtros, tx));
```

Las politicas leen quien pregunta con `app_usuario_id()`, `app_rol()`,
`app_cargo()` y `app_empresa_id()`. `prueba:permisos` las comprueba con la
conexion de la aplicacion.

Cuando una politica tiene que mirar otra tabla con politicas (ver una pieza
depende de su proyecto y de sus tareas), lo pregunta a una funcion
`SECURITY DEFINER` del esquema `portal` (`portal.gestiona_empresa`,
`portal.trabaja_en_pieza`…), que lee como duena y solo responde si o no.
Escrito directamente, las politicas se llamarian unas a otras en bucle.

### Auditoria

La tabla `auditoria` guarda una linea por cada cosa que alguien hace: quien
(con el rol y el cargo que tenia entonces), que, sobre que, desde donde y los
valores de antes y de despues. Solo admite lineas nuevas: un trigger rechaza
`UPDATE`, `DELETE` y `TRUNCATE`.

**La linea se escribe en la misma transaccion que el cambio.** Una action que
modifica algo hace las dos cosas dentro de `transaccion`:

```ts
await transaccion(async (tx) => {
  await empresas.cambiarEstado(id, activar, tx);
  await anotar(tx, admin, "empresa.desactivada", { entidadId: id, empresaId: id });
});
```

Si el cambio se deshace, su linea tambien; si la linea no se puede escribir,
el cambio no ocurre. Las acciones posibles son una lista cerrada en
`src/types/auditoria.ts`; un modulo nuevo anade las suyas alli. Nunca se anotan
contrasenas, tokens ni el correo de un intento de acceso fallido.

Se consulta en `/dashboard/auditoria`, solo para administradores.

### Anadir un modulo

Cada modulo declara su `seccion` en `src/lib/navegacion.ts`: General, Trabajo,
Herramientas, Finanzas, Sistema o Mi espacio. El sidebar y el menu movil
pintan un rotulo por seccion, y una seccion sin modulos visibles para quien
mira no aparece. Sin seccion, el modulo va al final y sin rotulo; hoy solo es
Mi perfil.

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

Hooks es ademas una **herramienta** (`src/lib/herramientas.ts`): la tarea
«Escribir el hook» lleva al canvas con `?tarea=`, la ficha queda ligada a ella
(`fichas_hook.tarea_id`) y, cuando aprueba la auditoria, la tarea se da por
lista. Quien no es de redes entra asi, y solo a su ficha.

### El modulo de Proyectos

```
/dashboard/tablero                           las cuatro alertas y lo que esta en curso
/dashboard/proyectos                         listado y alta
/dashboard/proyectos/[id]                    resumen y matriz de piezas por fases
/dashboard/proyectos/[id]/piezas/[piezaId]   fases, tareas, copy y comentarios
/dashboard/mi-trabajo                        las tareas de quien mira
/dashboard/mis-proyectos                     el cliente: avance, revision y aprobacion
/api/archivos/[versionId]                    la unica entrega de un archivo de una pieza
```

Lo gestionan el admin y el ejecutivo de cuentas asignado a la empresa. Quien
tiene una tarea abre la ficha de esa pieza, marca su tarea y escribe el copy,
pero no mueve fases. Las reglas estan en
[docs/reglasBateria.md](docs/reglasBateria.md); el criterio de la agencia
(plantillas, servicios y tareas sugeridas), en `src/lib/portal/catalogo.ts`; y
lo que decide si una fase se mueve, en `src/lib/portal/fases.ts`.

Un componente que lanza una action cuyo resultado lo hace desaparecer
—completar una fase, quitar una tarea, cancelar una pieza— no guarda el estado
de esa action: lo guarda un componente que sigue en pantalla
(`MovimientosDeFase`, `TareasFase`). Si no, la revalidacion lo desmonta y el
aviso no llega a verse.

### Facturas, pagos y cobranza

```
/dashboard/facturas                      proformas por facturar, pagos por confirmar y el listado
/dashboard/facturas/[id]                 lo facturado, el cobro, imprimir, pagos y anular
/dashboard/cobranza                      lo que debe cada empresa, por antiguedad
/dashboard/ajustes-finanzas              emisor, impuestos, numeracion, medios de pago, empresas
/dashboard/ajustes-finanzas/formatos/[id] editor de un formato de impresion
/dashboard/facturacion/facturas/[id]     el cliente: su factura y reportar un pago
/api/facturas/[id]/pdf                   PDF para el talonario (?formato=)
/api/formatos/[id]/calibracion           hoja de calibracion de un formato
/api/pagos/[id]/comprobante              el comprobante de un pago
```

Se construyo con **valores de ejemplo** (emisor, numeracion, talonario,
medios de pago, impuestos) que se cambian en Ajustes de finanzas; la lista
esta en [docs/pendientesIntegracion.md](docs/pendientesIntegracion.md).

- **La factura la emite la base** (`finanzas.emitir_factura`), en bolivares a
  la ultima tasa del BCV, con copia congelada del emisor y del cliente.
  Corregirla es anularla y emitir otra.
- **El talonario se calibra**: cada formato de impresion guarda el tamano de
  la hoja y la posicion de cada dato en milimetros. Se imprime la hoja de
  calibracion sobre el papel real, se mide y se ajusta.
- **Un pago reportado no baja el saldo** hasta que lo confirma administracion
  con el monto aplicado. Lo reportado no se edita: se rechaza y se reporta otro.
- En desarrollo, la semilla llena el emisor con datos ficticios y deja una
  factura con un pago por confirmar.

### Presupuestos y proformas

Los operan el administrador y el cargo `administracion`
(`finanzas@conejo.test` en la semilla); el cliente con la casilla «Puede ver
las finanzas» los ve en Facturacion (`/dashboard/facturacion`). El ciclo y sus reglas estan en la
seccion 7 del plan.

- **Los importes los calcula la base.** El editor manda los renglones como
  texto y `finanzas.guardar_renglones` los sustituye y recalcula base, exento,
  IVA y total. La vista previa del navegador usa las mismas reglas
  (`src/lib/finanzas/calculo.ts`), sin `number`.
- **Fuera de borrador nada cambia de importe.** Lo impiden disparadores en la
  base, igual que volver a borrador o reactivar algo anulado o resuelto.
- **El cliente no escribe**: aprueba o rechaza con
  `finanzas.cliente_resuelve_presupuesto`, que no toca montos.
- **La numeracion no tiene huecos**: `finanzas.siguiente_numero`, en la misma
  transaccion que el documento.
- **Nada se emite solo.** Una proforma recurrente aparece en la portada de
  Proformas cuando le toca, y «Preparar la siguiente» deja la copia en
  borrador.
- Las fichas guardan el estado de las actions que las cambian en un proveedor
  por encima del formulario (`ProveedorGuardado`, `ProveedorProforma`,
  `ProveedorDecision`), por la misma razon que en la bateria.

### Briefs

```
/dashboard/mis-briefs          el cliente: empezar, llenar por pasos, enviar, versiones
/dashboard/briefs              la bandeja de cuentas y los enlaces para prospectos
/dashboard/briefs/[id]         el brief completo y las decisiones
/brief/[token]                 el prospecto, sin cuenta, por su enlace privado
```

Las reglas son las de `appFacturas/docs/05-briefs.md` con los supuestos S-04 a
S-09; el formato vive en `src/lib/portal/formatos/` y lo que decide que se
muestra y que falta, en `src/lib/portal/briefs.ts`. Llenar y enviar es igual
para el cliente y el prospecto (`src/lib/portal/llenadoBrief.ts`).

- **La base pone fecha, codigo y version al enviar** (`portal.enviar_brief`):
  `ECS-AAAAMMDD-XXXXXX` con la fecha de Caracas. Lo enviado se congela con su
  hash y no cambia.
- **El prospecto no tiene cuenta.** El ejecutivo genera su enlace en Briefs y
  lo ve una sola vez: la base guarda el hash del token y ningun correo lo
  lleva. Las actions de `/brief/[token]` comprueban el token
  (`src/lib/portal/enlaceBrief.ts`) y actuan con `conEnlace`, el rol
  `prospecto` ante la base.
- Aceptar el brief de un prospecto lo convierte: nace su empresa, su cuenta
  con contrasena provisional (se ve una vez) y el proyecto.
- `BRIEFS_MAILBOX`, opcional, recibe copia de cada brief enviado.

## Pruebas

| Bateria | Donde corre | Que cubre |
| --- | --- | --- |
| `test:unitarias` | Host | Funciones puras, con Playwright sin navegador: auditor de hooks, destino tras el login, limite de la contrasena, reparto del menu por secciones, lectura de la pagina del BCV y reglas de la bateria de fases |
| `test:integracion` | Host, con la app levantada | Recorridos reales en un navegador. Recien recreado el contenedor, la primera pasada compila cada pantalla al vuelo y puede necesitar un reintento; la segunda ya va limpia |
| `prueba:auditor` | Contenedor | La tabla completa de casos del auditor |
| `prueba:modelos` | Contenedor | Los modelos contra la base; limpia lo que crea |
| `prueba:sesiones` | Contenedor | Rotacion, reutilizacion y revocacion de sesiones; bloqueo por intentos |
| `prueba:permisos` | Contenedor | Lo que el rol `conejo_app` tiene prohibido, `conSesion` y las politicas de seguridad por fila |

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
- **Tras instalar una dependencia, reconstruir la imagen.** El servicio guarda
  sus `node_modules` en un volumen propio y el build usa los de la imagen:
  `docker compose build app-dev` y despues `docker compose up -d -V app-dev`.
  Sin eso, el build no encuentra la libreria nueva (paso con `pdf-lib`).
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
  asi que cada cambio de esquema entrega un archivo numerado en `db/neon/`, que
  se pega en el editor de su panel. Son idempotentes y no llevan secretos.
  `npm run sql:produccion` es otra cosa: genera el SQL de una base **nueva**.
- **Primero la base, despues el codigo.** Si un cambio toca el esquema, se pega
  el SQL antes de subir `main`. Al reves, la aplicacion arranca contra tablas
  que no existen. La excepcion es lo que le quita algo a la version publicada,
  que se pega despues.
- **El orden completo esta en
  [docs/despliegueProduccion.md](docs/despliegueProduccion.md):** SQL,
  variables de Vercel, comprobaciones y vuelta atras, etapa a etapa. No se
  publica hasta terminar la integracion del portal.
- **La aplicacion se conecta como `conejo_app`**, no como duena de la base.
- **La base de produccion tiene datos reales.** No se le insertan datos de
  ejemplo.

## Documentos

| Archivo | Contenido |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | Contrato del proyecto |
| [AGENTS.md](AGENTS.md) | Contexto y reglas para asistentes de codigo |
| [docs/planIntegracionPortal.md](docs/planIntegracionPortal.md) | Plan de la integracion del portal |
| [docs/reglasBateria.md](docs/reglasBateria.md) | Reglas de proyectos, piezas, fases y tareas: avance, correcciones, alertas y quien ve que |
| [docs/despliegueProduccion.md](docs/despliegueProduccion.md) | Guia del despliegue: SQL, variables y pasos, etapa a etapa |
| [docs/informeIntegracion.md](docs/informeIntegracion.md) | Que hace hoy la aplicacion y como probarla |
| [docs/informePendientes.md](docs/informePendientes.md) | Lo que falta para usarla de verdad, por momento |
| [docs/planPiloto.md](docs/planPiloto.md) | La prueba con un cliente real, semana a semana |
| [docs/pendientesIntegracion.md](docs/pendientesIntegracion.md) | Valores de ejemplo por sustituir, decisiones del negocio que faltan y lo que queda sin hacer |
| [docs/verificacionManual.md](docs/verificacionManual.md) | Lo que hay que probar a mano antes de publicar, etapa por etapa |
| [docs/planAuditoriaRepositorio.md](docs/planAuditoriaRepositorio.md) | Plan de revision y actualizacion del repositorio. Ejecutado |
| [docs/informeAuditoria.md](docs/informeAuditoria.md) | Resultado de esa revision, hallazgo a hallazgo |
| [docs/planMejoraDiseno.md](docs/planMejoraDiseno.md) | Plan de mejora del diseno |
