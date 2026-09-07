# Conejo App

Plataforma interna de **El Conejo del Sombrero** para centralizar y automatizar
los procesos del dia a dia de la empresa, orientada a sus clientes y trabajadores.

> Cubre la Fase 1 (autenticacion, autorizacion y perfil) y la Fase 2 (modulo
> de Hooks). La bitacora de decisiones tecnicas vive en [agent.md](agent.md).

## Stack

| Capa | Tecnologia |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| Lenguaje | TypeScript 5 |
| Estilos | TailwindCSS 4 (configuracion CSS-first) |
| Iconos | lucide-react |
| Base de datos | PostgreSQL 17 |
| Sesiones | JWT con `jose` sobre cookies `HttpOnly` |
| Hash de contrasenas | `bcryptjs` |
| Entorno de desarrollo | Docker Compose (app + db + pgadmin) |
| Produccion | Vercel, con la base en Neon |

## Requisitos

- Docker y Docker Compose. El desarrollo ocurre dentro del contenedor: no hace
  falta levantar el servidor de Node en el host.
- Node.js 20.9+ solo si se quieren ejecutar herramientas fuera de Docker.

## Puesta en marcha

```bash
cp .env.example .env
docker compose up -d --build
```

| Servicio | URL |
| --- | --- |
| Aplicacion | http://localhost:3100 |
| pgAdmin | http://localhost:5051 |
| PostgreSQL | localhost:5433 |

Los puertos se cambian en el `.env`. Dentro de la red de docker la base de datos
siempre es `db:5432`, asi que `DATABASE_URL` no depende del puerto del host.

pgAdmin ya trae la conexion al servidor configurada; las credenciales de acceso
son `PGADMIN_EMAIL` y `PGADMIN_PASSWORD` del `.env`.

## Ambientes

Son dos, y con bases de datos distintas:

| | Donde corre | Base de datos |
| --- | --- | --- |
| **Desarrollo** | Docker Compose, en tu maquina | PostgreSQL local del contenedor |
| **Produccion** | Vercel | Neon (Ohio, us-east-2) |

Que no compartan base no fue una eleccion de estilo: **ProtonVPN bloquea el
puerto 5432 de salida**, asi que la maquina de desarrollo no puede alcanzar
Neon. El detalle esta en «Despliegue en Vercel». El efecto colateral es bueno:
una prueba local no puede tocar los datos de produccion.

El servicio que levanta docker compose depende de `COMPOSE_PROFILES` en el
`.env`:

- `dev` levanta `app-dev` y `pgadmin`: bind mount del proyecto y recarga en
  caliente.
- `prod` levanta `app-prod`: build optimizado, sin root. **No se usa hoy**;
  existe para el dia que la aplicacion se mude a un VPS.

### Nota sobre la recarga en caliente

En Windows los eventos de archivo no cruzan el bind mount hacia el contenedor
Linux, y Turbopack no tiene modo de sondeo. Por eso el contenedor de desarrollo
arranca con webpack, que si lo soporta. Se controla con `DEV_SCRIPT` en el `.env`:

- `DEV_SCRIPT=dev:webpack` en Windows. Es el valor por defecto.
- `DEV_SCRIPT=dev` si el proyecto vive en WSL2 o Linux nativo, para usar
  Turbopack, que es bastante mas rapido.

## Estructura

```
src/
  app/          pages (SSR) que inyectan props a los componentes
  components/   componentes de UI (patron wrapper -> content)
  actions/      logica de negocio ('use server'), orquesta los modelos
  models/       unica capa que consulta la base de datos
  types/        tipos compartidos
  lib/          infraestructura transversal (pool de BD, jwt, hash, validaciones)
  lib/hooks/    catalogo, listas de deteccion y auditor (funciones puras)
  proxy.ts      barrera de autenticacion de Next 16 (antes middleware.ts)
db/
  schema.sql    definicion de tablas
  seed.mts      crea el esquema y siembra la base LOCAL
  generarSql.mts  vuelca esquema y datos a SQL, para pegarlos en Neon
  datos/        las 42 aperturas y el resto de la semilla
  pruebas/      baterias del auditor y de los modelos
docker/         Dockerfile y configuracion de servicios
```

Regla de dependencias: los componentes nunca importan de `models/`, y `models/`
nunca importa de `next/`.

## Comandos

Se ejecutan dentro del contenedor:

```bash
docker compose exec app-dev npm run lint       # eslint
docker compose exec app-dev npm run typecheck  # tsc --noEmit
docker compose exec app-dev npm run seed       # crea tablas e inserta datos base
docker compose exec app-dev npm run build      # build de produccion
```

Las dos baterias de pruebas del modulo de hooks:

```bash
docker compose exec app-dev npm run prueba:auditor  # 19 casos, sin base de datos
docker compose exec app-dev npm run prueba:modelos  # 52 casos, contra la base real
```

`prueba:modelos` escribe y borra sus propios registros, asi que se puede
ejecutar sobre la base de desarrollo sin dejar rastro.

Otros comandos utiles:

```bash
docker compose logs -f app-dev   # seguir los logs de la app
docker compose down              # detener los servicios
docker compose down -v           # detener y borrar los datos de la base
```

## Base de datos

Para crear las tablas e insertar los datos iniciales:

```bash
docker compose exec app-dev npm run seed
```

El script es idempotente: se puede ejecutar cuantas veces haga falta sin
duplicar ni pisar nada.

### Usuarios que crea el seed

Cuatro cuentas: **un administrador real** y tres de prueba con dominio `.test`,
reservado por norma para pruebas y sin posibilidad de chocar con uno real.

| Correo | Tipo | Rol | Cargo / Empresa | Para que sirve |
| --- | --- | --- | --- | --- |
| El del responsable | trabajador | admin | Direccion | La unica cuenta administradora |
| `diseno@conejo.test` | trabajador | trabajador | Diseno | Comprobar que **no** ve el modulo de Hooks |
| `redes@conejo.test` | trabajador | trabajador | Redes | Comprobar que **si** lo ve |
| `cliente@empresa.test` | cliente | cliente | Distribuidora Ejemplo, C.A. | Comprobar la vista de cliente |

**Las contrasenas no se publican aqui.** Se piden al responsable del proyecto.
Las de las tres cuentas de prueba estan en `db/datos/semilla.mts`, que es codigo
versionado — inevitable si el seed ha de crearlas solo.

> **Antes de que la aplicacion guarde datos reales de la agencia** hay que
> borrar de produccion esas tres cuentas de prueba. Sus contrasenas estan en el
> repositorio, y cualquiera con acceso al codigo puede entrar con ellas.

**Por que hay tres trabajadores y no uno.** El rol y el cargo son dos ejes
independientes, y hacen falta los dos para probar de verdad:

- el **rol** decide lo que puedes hacer (solo el admin da de alta usuarios)
- el **cargo** decide lo que ves (redes, cuentas, diseno, direccion...)
- la **empresa** hace lo mismo para un cliente: cada empresa ve lo suyo

Por eso entrar como `redes@` y como `diseno@` no es lo mismo aunque los dos
sean `trabajador`. Un modulo declarado para el cargo `redes` no aparece ni en
el menu ni en el buscador de quien no lo tiene. El admin se salta el filtro de
cargo: su rol le da acceso a todas las areas.

### Como se consulta la base de datos

El proyecto usa SQL puro con el driver `pg`. No hay ORM ni generador de
consultas. Toda la interaccion pasa por `src/lib/db.ts`:

```ts
import { consultar, consultarUno, ejecutar, transaccion } from "@/lib/db";

const usuario = await consultarUno<Usuario>(
  // Las columnas se listan siempre: con SELECT * un dia se cuela
  // password_hash en una respuesta y nadie se entera.
  "SELECT id, nombre, email FROM usuarios WHERE lower(email) = lower($1)",
  [email],
);
```

**Los valores nunca se escriben dentro del texto de la consulta.** Van siempre
en el arreglo del segundo argumento, como `$1`, `$2`, etc. El driver los envia
al servidor por separado, asi que un valor jamas se interpreta como SQL. Esa
es la defensa contra inyeccion; no hace falta escapar ni limpiar cadenas.

```ts
// MAL: abre la puerta a una inyeccion
consultar(`SELECT * FROM usuarios WHERE email = '${email}'`);

// BIEN
consultar("SELECT * FROM usuarios WHERE email = $1", [email]);
```

Los nombres de columna y la direccion de un `ORDER BY` no se pueden pasar como
parametros. Cuando dependan de la entrada del usuario, hay que validarlos con
`identificadorSeguro`, que obliga a elegir de una lista cerrada:

```ts
const columna = identificadorSeguro(orden, ["nombre", "email", "creado_en"]);
await consultar(`SELECT * FROM usuarios ORDER BY ${columna}`);
```

## Autenticacion

El acceso se protege en dos niveles, y hacen falta los dos.

**`src/proxy.ts`** filtra por ruta antes de que la peticion llegue a la
aplicacion. En Next 16 este archivo sustituye a `middleware.ts` y siempre se
ejecuta en el runtime de Node.

**Los guardias de `src/lib/sesion.ts`** son la proteccion real de los datos.
Toda page protegida y toda action que lea o modifique algo empieza llamando a
uno de ellos:

```ts
import { requerirSesion, requerirRol, requerirAdmin } from "@/lib/sesion";

export default async function Pagina() {
  const sesion = await requerirSesion();   // manda al login si no hay sesion
  // ...
}
```

No basta con el proxy. La documentacion de Next advierte que las Server Actions
viajan como POST a la ruta donde se usan, asi que un cambio en el `matcher`
puede dejarlas fuera de su alcance sin que nada avise.

### Reglas de acceso

| Ruta | Sin sesion | Trabajador o cliente | Admin |
| --- | --- | --- | --- |
| `/` | va a `/login` | va a `/dashboard` | va a `/dashboard` |
| `/login` | accesible | va a `/dashboard` | va a `/dashboard` |
| `/dashboard` | va a `/login` | accesible | accesible |
| `/dashboard/usuarios` | va a `/login` | va a `/dashboard` | accesible |
| `/dashboard/hooks/**` | va a `/login` | solo cargo `redes` | accesible |

Al mandar a alguien al login se conserva su destino en `volverA`, para
devolverlo ahi despues de entrar. A quien ya entro pero no le corresponde el
modulo se le manda a `/dashboard` sin `volverA`: devolverlo despues a una ruta
que sigue sin poder ver seria un bucle.

## Compilar

Se construye la imagen de produccion, y **con el servicio de desarrollo
detenido**:

```bash
docker compose stop app-dev
COMPOSE_PROFILES=prod docker compose build app-prod
docker compose start app-dev
```

Son dos motivos distintos y los dos hacen falta:

**El volumen `.next`.** El servidor de desarrollo lo mantiene tomado y el build
escribe en el mismo sitio, lo que produce errores de prerenderizado que no
corresponden a ningun fallo del codigo.

**La memoria.** La VM de Docker Desktop trae poco mas de 2,7 GiB por defecto.
El servidor de desarrollo ya gasta cerca de 1 GiB, y `next build` necesita otro
tanto: juntos agotan la VM. Lo que se ve entonces no parece un problema de
memoria —el contenedor sigue "Up"— sino que la aplicacion deja de responder y
los logs se llenan de `Watchpack Error (initial scan): ENOMEM`. Se arregla con
`docker compose restart app-dev`, y se evita no solapando las dos cosas.

```bash
docker info --format "{{.MemTotal}}"                    # cuanta hay
docker stats --no-stream --format "{{.Name}} {{.MemUsage}}"  # quien la gasta
```

Ojo con `docker compose exec app-dev npm run build`: `exec` necesita el
contenedor **corriendo**, asi que detener el servicio y despues llamar a `exec`
no funciona. O se construye la imagen, o se usa `docker compose run --rm`.

La compilacion no necesita base de datos. El pool de conexiones se crea de
forma perezosa, en la primera consulta, precisamente para que `next build`
pueda importar las pages sin que nada intente conectarse.

### Reproducir el build de Vercel en local

Es la comprobacion mas barata antes de desplegar: si compila sin
`DATABASE_URL`, ningun modulo toca la base al construir y el build de Vercel
tampoco abrira conexiones.

```bash
docker compose stop app-dev
docker compose run --rm --no-deps -e NODE_ENV=production -e DATABASE_URL= app-dev npm run build
docker compose start app-dev
```

**`NODE_ENV=production` no es opcional, y omitirlo cuesta una tarde.** La etapa
`dev` del Dockerfile fija `NODE_ENV=development`; compilar asi hace que Next
resuelva mal React y el build muere con esto:

```
Error occurred prerendering page "/_global-error"
TypeError: Cannot read properties of null (reading 'useContext')
```

No es un fallo del codigo ni de esa pagina: es el entorno equivocado. Con
`NODE_ENV=production` compila sin tocar nada. Vercel siempre construye asi.

> Tras un build dentro del contenedor, el servidor de desarrollo puede
> regenerar `.next/dev/types` a medias y `tsc` fallara con errores de sintaxis
> **dentro de archivos generados**, no del proyecto. Se arregla parando el
> servicio, vaciando `.next` y volviendo a arrancar.

## Como anadir un modulo con listado

Es el camino que hace rentable el patron: un modulo nuevo no escribe su propia
tabla, su buscador ni su paginacion. Aporta tres cosas y hereda el resto.

### 1. Registrarlo en la navegacion

Una sola entrada en `src/lib/navegacion.ts` alimenta a la vez la barra lateral
y el buscador global. Si el registro estuviera repartido, uno de los dos se
quedaria atras.

```ts
{
  titulo: "Proyectos",
  subtitulo: "Campanas de cada cliente",
  href: "/dashboard/proyectos",
  icono: Briefcase,
  alias: ["campanas", "trabajos"],   // como lo busca la gente de verdad
  roles: ["admin"],                  // omitido = lo ven todos
  cargos: ["cuentas", "redes"],      // omitido = sin filtro de area
}
```

### 2. Declarar columnas y filtros

```tsx
// src/components/proyectos/ColumnasProyectos.tsx
export function columnasProyectos(
  ruta: string,
  estado: EstadoListado,
): Columna<Proyecto>[] {
  return [
    { clave: "nombre", titulo: "Proyecto", ordenable: true, ancho: "2fr",
      tarjeta: "titulo",
      render: (p) => <b>{p.nombre}</b> },

    { clave: "estado", titulo: "Estado", ancho: "1fr",
      render: (p) => <Etiqueta>{p.estado}</Etiqueta> },

    { clave: "acciones", titulo: "Acciones", ancho: "128px",
      alineacion: "derecha", tarjeta: "acciones",
      render: (p) => <AccionesProyecto proyecto={p} ruta={ruta} estado={estado} /> },
  ];
}
```

`clave` tiene que coincidir con la clave de orden que acepte el modelo.

`ruta` y `estado` entran como argumentos porque los botones de cada registro
son ENLACES que abren un panel (`?panel=ver&id=12`), y para construirlos hay
que conservar los filtros y la pagina en los que se estaba.

**`tarjeta` es lo que hace que el listado funcione en un movil.** Por debajo de
`lg` no hay tabla: cinco columnas en 360 px o desbordan o encogen el texto
hasta lo ilegible. Cada fila pasa a ser una tarjeta, y ese campo dice que papel
juega la columna dentro de ella:

| valor | donde va |
| --- | --- |
| `"titulo"` | encabeza la tarjeta, sin rotulo |
| `"dato"` | rotulo + valor en el cuerpo. **Es el valor por defecto** |
| `"acciones"` | al pie, separada del resto |
| `"oculta"` | solo en la tabla, no en la tarjeta |

Si no se declara ninguna `"titulo"`, encabeza la primera columna. Un modulo que
no se plantee nada de esto sigue saliendo razonable.

**Los filtros no declaran su opcion de "Todos".** La antepone `ListadoFiltros`
para que se llame igual en toda la aplicacion: cuando la declaraba cada modulo
salieron cuatro nombres distintos para la misma cosa, y quien filtra no lee
cuatro etiquetas, busca la de siempre en el primer sitio.

### 2b. Panel o modal, segun lo que se pida

Los dos se abren por la URL, con el mismo parametro `?panel=`, y por eso los
dos son de servidor. Lo que cambia es la forma, y no por gusto:

| | `PanelLateral` | `ModalConfirmacion` |
| --- | --- | --- |
| para | una TAREA: crear, editar, consultar una ficha | una PREGUNTA de si o no |
| ejemplo | `?panel=nuevo`, `?panel=editar&id=12` | `?panel=estado&id=12` |

Un panel para confirmar invita a leerlo por encima y darle a guardar, que es
justo lo que no debe pasar cuando algo se desactiva.

Los valores de `?panel=` van en una lista blanca en `src/lib/parametros.ts`.
Un panel nuevo hay que anadirlo ahi, o el parametro se ignora.

### 2c. Desactivar, no borrar

En este proyecto los registros de personas no se borran: se desactivan. Borrar
se llevaria por delante lo que esa persona hizo y las llaves foraneas de todo
lo que cuelgue de ella. Desactivar cierra el acceso y conserva el rastro, que
es lo que se necesita de verdad cuando alguien deja la agencia.

Dos guardias que conviene copiar en cualquier modulo que apague algo:

- nadie se desactiva a si mismo, o quedaria fuera sin forma de volver a entrar
- no se desactiva al ultimo administrador activo, o la aplicacion se queda sin
  nadie que pueda crear cuentas ni reactivar a nadie. De ese estado no se sale
  desde la interfaz

### 3. Escribir la page

```tsx
export default async function PaginaProyectos(props: PageProps<"/dashboard/proyectos">) {
  await requerirCargo("cuentas", "redes");   // el guardia SIEMPRE primero

  const estado = leerEstadoListado(await props.searchParams, {
    ordenPermitido: ["nombre", "creadoEn"],
    ordenPorDefecto: "creadoEn",
    filtrosPermitidos: ["estado", "empresa"],
  });

  const pagina = await proyectos.listar(/* traducir estado a los filtros del modelo */);

  return (
    <Wrapper migas={MIGAS} kicker="..." titulo="Proyectos">
      <Listado
        ruta="/dashboard/proyectos"
        estado={estado}
        columnas={columnasProyectos()}
        filtros={filtrosProyectos()}
        filas={pagina.filas}
        total={pagina.total}
        totalPaginas={pagina.totalPaginas}
      />
    </Wrapper>
  );
}
```

### Lo que se hereda sin escribir nada

Buscador, filtros, columnas ordenables, paginacion, estado vacio, las tarjetas
de movil y los paneles. Todo con el estado en la URL, de modo que se puede
compartir el enlace y el boton atras del navegador funciona solo.

**El buscador busca mientras se escribe**, con 350 ms de espera desde la ultima
tecla. Sigue siendo un `<form method="get">`: sin JavaScript se busca igual
pulsando Enter, y lo que anade el cliente es adelantarse a ese Enter.

Dos detalles de ese buscador que conviene no deshacer:

- navega con `replace`, no con `push`. Con push cada letra dejaria una entrada
  en el historial y volver atras costaria una pulsacion por caracter tecleado
- el campo se queda **sin controlar**. Si su valor viniera del servidor, cada
  respuesta lo reescribiria, y al escribir rapido el cursor saltaria al final

### 4. Traer su propio loading.tsx

**Obligatorio.** Debajo de `dashboard/` no hay ninguna frontera de Suspense
compartida, asi que un modulo sin `loading.tsx` no tiene con que esperar: al
navegar hacia el la aplicacion se queda quieta hasta que el servidor responda,
sin ningun aviso.

No la hay a proposito. Cuando existia `dashboard/loading.tsx`, ese archivo
hacia dos trabajos incompatibles: era el esqueleto del inicio y a la vez la
frontera de todos los modulos. Al ir de Usuarios a Mi perfil aparecia primero
el esqueleto del inicio y despues el de la pagina de destino: dos cargas
seguidas, y la primera no correspondia a donde se iba.

El inicio vive ahora en el grupo `dashboard/(inicio)/`, que no anade segmento
a la URL pero acota su frontera a si mismo.

El esqueleto tiene que copiar la geometria de la page real hueco por hueco
(mismos altos, radios, margenes y rejilla). Si no, al llegar los datos el
contenido salta de sitio, que se nota mas que la propia espera. La barra
lateral y la cabecera NO se esqueletizan: viven en el layout y ya estan
pintadas cuando el esqueleto aparece.

### Dos reglas que no se pueden saltar

**El guardia va primero, siempre.** El `proxy.ts` filtra por ruta, pero la
documentacion de Next advierte que las Server Actions viajan como POST a la
ruta donde se usan: un cambio en el `matcher` puede dejarlas descubiertas sin
que nada avise. Lo que de verdad protege los datos es el guardia de la page y
de la action.

**Los parametros de la URL nunca llegan crudos al modelo.** Pasan por
`leerEstadoListado`, que nunca lanza y cae a los valores por defecto ante
cualquier basura. `identificadorSeguro` del modelo si lanza, y un `?orden=`
escrito a mano tumbaria la pagina con un error 500.

## El modulo de Hooks

Es el primer modulo con submodulos y el primero restringido por cargo. Lo ven
el cargo `redes` y los administradores.

```
Hooks                /dashboard/hooks               portada: pieza en curso + recorrido
  01 Manual          /dashboard/hooks/manual        criterio de la casa (solo lectura)
  02 Documentacion   /dashboard/hooks/documentacion reglas, aperturas y referencias
  03 Hooks           /dashboard/hooks/nuevo         escribir la ficha
  04 Auditor         /dashboard/hooks/auditor       nueve controles, umbral 70
  05 Metricas        /dashboard/hooks/metricas      lo que paso al publicar
  06 Historial       /dashboard/hooks/historial     todas las fichas y su estado
```

El orden no es decorativo: **son pasos hacia un final, y el final es registrar
las metricas**, no sacar buena nota en el auditor. Una ficha recorre tres
estados —`borrador` → `auditada` → `medida`— y solo el ultimo la termina.

### Que es catalogo y que es tabla

La linea divisoria es si alguien lo va a dar de alta desde la interfaz.

| Vive en `src/lib/hooks/catalogo.ts` | Vive en la base |
| --- | --- |
| Territorios, mecanismos, objetivos | Aperturas (`aperturas_hook`) |
| Metrica y evidencia de cada objetivo | Reglas (`reglas_hook`) |
| Plataformas y su ajuste | Referencias (`referencias_hook`) |
| Los tres hitos del recorrido | Fichas y resultados |

Los catalogos son criterio de la agencia: cambian cuando cambia el criterio, no
cuando alguien rellena un formulario. Lo que si se guarda en columnas
(`objetivo`, `plataforma`, `estado`) lleva su `CHECK` contra el mismo conjunto
cerrado que declaran las uniones de literales en `src/types/hooks.ts`. Si se
anade un objetivo hay que tocar los dos sitios.

### El auditor

`src/lib/hooks/auditor.ts` es una **funcion pura**: entra un texto y una regla
opcional, sale una nota, un veredicto y nueve controles explicados. No toca la
base ni orquesta nada, asi que no es modelo ni action, y corre en los dos lados
sin duplicar la logica: en el cliente para la nota en vivo, en el servidor al
guardar.

```ts
import { auditar, limitesPorDefecto } from "@/lib/hooks/auditor";

const resultado = auditar({
  hablado: "Tres de cada cuatro cocinas fallan en esto",
  insertTitulo: "El fallo del 75%",
  prueba: "Comparativa de dos cocinas en el mismo plano",
  limites: regla ?? limitesPorDefecto(),
});
```

Dos reglas que no se pueden tocar sin romper la deteccion:

**Los fallos duros tapan la nota, no la restan.** `nota = min(nota, 69)` si hay
un fallo duro, y `min(nota, 25)` si el hook tiene menos de cuatro palabras. Sin
eso, un hook que empieza por «Hola chicos» aprobaria si suma bien en el resto.

**Las listas de `src/lib/hooks/listas.ts` se comparan por subcadena y en
minusculas, sin quitar tildes.** Por eso llevan raices cortadas (`equivoc`,
`hundi`), las dos formas de `increible` y espacios finales significativos en
`"sin "`, `"tu "`, `"te "` y `"pero "`. Sin ese espacio, `tu` casaria dentro de
`estudio`. La cabecera del archivo lo explica; no son erratas.

### Como se resuelve la regla de una cuenta

Cliente → sector → estandar de la casa (12 palabras de voz, 6 de
Insert-Titulo), en **una sola consulta**:

```sql
WHERE empresa_id = $1
   OR (empresa_id IS NULL AND sector IS NOT NULL
       AND sector = (SELECT sector FROM empresas WHERE id = $1))
ORDER BY (empresa_id IS NULL)
LIMIT 1
```

El `ORDER BY` sobre un booleano es lo que hace ganar a la del cliente: `false`
ordena antes que `true`. Una regla que amplia los limites se respeta y ademas
sale marcada como limite ampliado en el resultado, para que nadie confunda un
hook largo permitido con un hook largo aprobado.

### Las cinco tablas

| Tabla | Guarda | Detalle que conviene saber |
| --- | --- | --- |
| `fichas_hook` | La decision completa | Persiste `verdad_marca`, `pago_promesa` y `riesgo_claim`, que la version anterior mostraba pero tiraba |
| `resultados_hook` | Lo que paso al publicar | `ficha_id` es UNIQUE: registrar dos veces actualiza, no duplica |
| `reglas_hook` | Como habla cada cuenta | `CHECK (empresa_id IS NOT NULL OR sector IS NOT NULL)` |
| `aperturas_hook` | Las 42 formas de empezar | Se retiran con `activa`, no se borran: una vieja puede estar citada en una ficha |
| `referencias_hook` | El banco del equipo | `lectura NOT NULL`: sin el porque, es material para copiar |

`empresas` gano `sector` con un bloque `DO` idempotente, porque la resolucion
de regla lo necesita.

### Modificar el modulo

- **Anadir un objetivo**: `OBJETIVOS` en `catalogo.ts`, `SlugObjetivo` en
  `src/types/hooks.ts` y el `CHECK` de `fichas_hook`. Los tres o ninguno.
- **Anadir una apertura**: se da de alta desde Documentacion. El seed solo pone
  las 42 del documento.
- **Cambiar un control del auditor**: `auditor.ts` y su caso en
  `db/pruebas/auditor.mts`. La bateria fija los tramos: si un cambio los mueve,
  la prueba lo dice.
- **Anadir un submodulo**: cuelga de `hijos` en la entrada de Hooks en
  `src/lib/navegacion.ts`, y necesita su propio `loading.tsx`. Por debajo de
  `dashboard/` no queda ninguna frontera de Suspense compartida.

## Despliegue en Vercel

Produccion corre en **Vercel** con la base de datos en **Neon**. Vercel **no
usa el Dockerfile**: detecta Next.js y lo compila con su propio proceso. El
`docker/Dockerfile` se conserva para el dia de un VPS, no para esto.

### El bloqueo del puerto 5432, y por que condiciona todo

**ProtonVPN bloquea el puerto 5432 de salida.** Esta comprobado que es por
puerto y no por destino:

| Prueba | Resultado |
| --- | --- |
| Host de Neon, puerto 443 | responde |
| Host de Neon, puerto 5432 | el TCP abre y no llega respuesta |
| GitHub, puerto 22 | responde |

El mismo host contesta en un puerto y no en el otro, asi que no es la IP, ni el
nodo de salida, ni el protocolo: es politica de red contra puertos de base de
datos. El reenvio selectivo que lo resolveria es de pago.

De ahi salen dos consecuencias que se notan a diario:

1. **Desarrollo va contra el PostgreSQL de Docker**, por `localhost`, donde la
   VPN no interviene.
2. **La base de produccion se siembra pegando SQL** en el editor del panel de
   Neon, que va por HTTPS.

A Vercel no le afecta: conecta desde sus propios servidores.

### Sembrar la base de Neon

```bash
docker compose exec app-dev npm run sql:produccion
```

Genera `db/produccion.sql` (unos 47 kB). Se abre el panel de Neon, **SQL
Editor**, se pega entero y se ejecuta. Es idempotente: se puede pegar mas de
una vez sin duplicar nada.

Para comprobar que quedo bien, en el mismo editor:

```sql
SELECT count(*) FROM usuarios;        -- 4
SELECT count(*) FROM aperturas_hook;  -- 42
SELECT email, rol FROM vw_usuarios_completos ORDER BY id;
```

> El archivo no se versiona: lleva dentro los hashes de las cuentas del seed y
> se regenera con una orden.

**Cada vez que cambie el esquema** hay que repetir esto. En local basta
`npm run seed`; en produccion, generar y pegar. Deja de hacer falta el dia que
se pueda conectar al 5432 —VPN de pago o VPS—, porque entonces `npm run seed`
con la cadena de Neon en el entorno hace lo mismo en un comando.

### Configurar el proyecto en Vercel

1. Importar el repositorio. El preset **Next.js** se detecta solo; build,
   install y output se dejan por defecto. **No** hace falta `vercel.json`.
2. **Node.js Version: 24.x**.
3. **Region de las funciones: `cle1`** (Cleveland, us-east-2), la misma que la
   base en Ohio. Cada pagina hace varias consultas seguidas, y un cruce de
   region las multiplica todas.
4. **Variables de entorno** (Settings → Environment Variables):

   | Variable | Valor |
   | --- | --- |
   | `DATABASE_URL` | La cadena **agrupada** de Neon, la que lleva `-pooler` en el host, con `?sslmode=verify-full` |
   | `JWT_SECRET` | Uno distinto al de desarrollo, 32+ caracteres, marcado *Sensitive* |

   `JWT_EXPIRACION` y `COOKIE_SESION` son opcionales: tienen valor por defecto.
   **No** poner `NODE_ENV`: lo fija Vercel y lo rechaza a mano.

   Se escribe **`verify-full` y no `require`**. En `pg` 8.23 los dos hacen lo
   mismo —verifican la CA y el nombre del host— pero `require` ademas emite un
   `SECURITY WARNING` en cada arranque, y en `pg` 9 cambiara de significado.
   Neon anade tambien `&channel_binding=require`; si diera guerra se quita, que
   la conexion sigue cifrada y verificada.

5. **El subdominio**: Settings → Domains → `app.<dominio>`. Un dominio se
   registra una vez por cuenta, pero cada subdominio puede apuntar a un
   proyecto distinto, asi que la landing se queda donde esta. Requiere que
   ambos proyectos vivan en la misma cuenta o equipo de Vercel. Con el DNS
   fuera de Vercel, un **CNAME** `app` al valor que muestre su interfaz.

   La cookie de sesion se fija sin atributo `domain`, asi que queda pegada al
   subdominio exacto y no se filtra a la landing. No hay nada que configurar.

### Lo que hay que saber antes de meter datos reales

- **El plan Hobby de Vercel es solo para uso no comercial.** Sirve mientras
  esto sea desarrollo y demostracion; en cuanto la agencia trabaje a diario con
  ello hay que pasar a Pro o haber saltado al VPS. No es un limite que avise:
  es un termino de servicio.
- **Las tres cuentas de prueba** (`diseno@`, `redes@`, `cliente@`) tienen sus
  contrasenas en `db/datos/semilla.mts`, que es codigo versionado. Hay que
  borrarlas de produccion.
- **Copias de seguridad.** Neon gratuito conserva un dia de historia y no hay
  ninguna copia propia. Un `pg_dump` desde la maquina de desarrollo choca con
  el mismo bloqueo del 5432, asi que habria que hacerlo desde otro sitio.
- **La suspension de Neon.** En el plan gratuito la base se duerme tras unos
  minutos sin uso y la primera consulta paga el despertar. El reintento de
  `src/lib/db.ts` lo absorbe.
- **La foto de perfil esta apagada** porque el disco de una funcion de Vercel
  es de solo lectura. El codigo esta comentado, no borrado: en un VPS vuelve a
  funcionar sin tocarle una linea.

## El tema

La regla que gobierna toda la interfaz:

| tema | lo que se acentua o esta bajo el cursor |
| --- | --- |
| claro | morado (blackberry `#602249`) |
| oscuro | vainilla (gold `#fae890`) |

Ningun componente escribe esos colores. Se usa `--acento` y el tema decide, lo
que ademas hace imposible romper la regla de marca de que el dorado solo va
sobre azul: el dorado solo existe cuando el fondo ya es oscuro.

Tokens disponibles como clases de Tailwind: `bg-fondo`, `bg-superficie`,
`bg-campo`, `text-texto`, `text-suave`, `border-borde`, `bg-acento`,
`text-acento-contraste`, `bg-acento-tenue`, `bg-acento-hover`, y `bg-nav`,
`text-nav-texto`, `border-nav-borde` para la navegacion.

Para las diferencias que el token no cubre existe la variante `dark-tema:`. La
variante `dark:` de serie NO funciona aqui: el tema tiene tres estados
(sistema, claro, oscuro) y hay que contemplar el dispositivo en oscuro sin
eleccion explicita de claro.
