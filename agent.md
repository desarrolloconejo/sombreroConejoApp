# Bitacora de desarrollo

Registro de lo construido en cada etapa, con las decisiones tomadas y su
motivo. El contrato del proyecto vive en [CLAUDE.md](CLAUDE.md).

---

## Etapa 0 — Inicializacion del proyecto

Scaffolding generado con `create-next-app` y adaptado al contrato.

**Construido**

- Next.js 16.3.2 con App Router, React 19.2.8 y TypeScript 5 en modo estricto.
- TailwindCSS 4 con configuracion CSS-first (`@theme` dentro de `globals.css`).
  La version 4 ya no usa `tailwind.config.js`.
- ESLint con flat config. El comando `next lint` fue eliminado en Next 16.
- Esqueleto de carpetas del patron MVC: `src/app`, `src/components`,
  `src/actions`, `src/models`, `src/types`, `src/lib`, mas `db/` y `docker/`.

**Decisiones**

- **`turbopack.root` fijado en `next.config.ts`.** Existe un `package-lock.json`
  suelto en `C:\Users\Juanv\repositorios` y Turbopack, al subir por el arbol
  buscando lockfiles, tomaba esa carpeta como raiz del workspace.
- **`.gitattributes` con `eol=lf`.** El proyecto se ejecuta en un contenedor
  Linux por bind mount; con CRLF los scripts y el SQL se rompen.
- **`src/lib/` fuera del patron MVC.** El contrato define `app`, `components`,
  `models`, `actions` y `types`. `lib/` no es una capa nueva: guarda
  infraestructura transversal (pool de BD, JWT, hash, validaciones). Ponerla en
  `models/` romperia la responsabilidad unica.
- **Fotos de perfil fuera del control de versiones.** `public/uploads/avatares`
  se conserva con un `.gitkeep`. La negacion en `.gitignore` tuvo que escribirse
  carpeta por carpeta: git no puede reincluir un archivo si su directorio padre
  esta excluido con `/**`.

**Dependencias fuera del stack original**

El contrato dice "no usaremos mas librerias". Se aprobaron dos excepciones:

| Paquete | Motivo |
| --- | --- |
| `pg` + `@types/pg` | Node no trae cliente de PostgreSQL. Sin un driver que hable el protocolo wire de Postgres es imposible conectar. |
| `bcryptjs` | Hash de contrasenas. Se eligio la version JavaScript pura y no el `bcrypt` nativo: este ultimo compila con node-gyp, exigiria toolchain en la imagen Alpine y genera binarios distintos entre el host Windows y el contenedor Linux. |

No hizo falta un ejecutor de TypeScript (`tsx`, `ts-node`): Node 24 ejecuta
archivos `.ts` de forma nativa por type stripping, y con eso basta para el seed.

**Verificado:** `npm run build`, `npm run lint` y `npm run typecheck` sin errores.

---

## Etapa 1 — Entorno con Docker

Tres servicios en `docker-compose.yml`: `app`, `db` y `pgadmin`.

**Construido**

- `docker/Dockerfile` multi-stage: `base`, `deps`, `dev`, `builder`,
  `prod-deps` y `prod`. La imagen de produccion instala solo dependencias de
  ejecucion (`npm ci --omit=dev`) y corre como el usuario `node`, sin root.
- Ambientes separados por perfiles de compose, elegidos con `COMPOSE_PROFILES`
  en el `.env`: `dev` levanta `app-dev` (bind mount y hot reload), `prod`
  levanta `app-prod` (build optimizado).
- El servicio `db` tiene healthcheck con `pg_isready`; la app espera a que este
  sano antes de arrancar.
- pgAdmin queda con el servidor precargado desde `docker/pgadmin-servers.json`,
  asi no hay que configurar la conexion a mano.

**Problemas encontrados y como se resolvieron**

1. **Puertos ocupados.** En la maquina ya corrian otros proyectos: `ecommerce-db`
   en 5432, `ecommerce-pgadmin` en 5050 y un proceso Node en 3000. Los puertos
   del proyecto se movieron a **3100** (app), **5433** (postgres) y **5051**
   (pgadmin). Solo cambia la publicacion en el host: dentro de la red de docker
   la base de datos sigue siendo `db:5432`, por lo que `DATABASE_URL` no cambia.

2. **El hot reload no funcionaba.** Medido dentro del contenedor sobre el mismo
   archivo del bind mount:

   | mecanismo | eventos recibidos |
   | --- | --- |
   | `fs.watch` (inotify) | **0** |
   | `fs.watchFile` (sondeo) | **4** |

   El bind mount de Windows a Linux propaga el *contenido* pero no los *eventos*
   de archivo. Turbopack depende de inotify y no tiene modo polling: se
   inspecciono el binario nativo y no existe ninguna variable de entorno para
   activarlo.

   **Solucion:** el contenedor de desarrollo arranca con `next dev --webpack`,
   que si respeta `WATCHPACK_POLLING=true`. Queda parametrizado con `DEV_SCRIPT`
   en el `.env`, de modo que si el proyecto se mueve al sistema de archivos de
   WSL2 o a Linux nativo basta poner `DEV_SCRIPT=dev` para recuperar Turbopack,
   que es bastante mas rapido. Verificado: un cambio en el host se refleja en el
   navegador en unos 6 segundos.

3. **pgAdmin no arrancaba.** Rechazaba `admin@conejo.local` porque `.local` es
   un TLD reservado y su validador de correo lo bloquea, dejando el contenedor
   en bucle de reinicio. Se cambio a `admin@conejo.com`.

**Decisiones**

- **Volumenes anonimos sobre `/app/node_modules` y `/app/.next`.** El bind mount
  traeria los binarios nativos de Windows (`swc-win32-x64-msvc`), incompatibles
  con la imagen Alpine, que necesita `swc-linux-x64-musl`.
- **`.dockerignore`** excluye `node_modules` y `.next` del contexto de build por
  la misma razon, y ademas acelera mucho el envio del contexto.
- **Las fotos de perfil no usan volumen de Docker**, por decision explicita:
  viven en `public/uploads/avatares` dentro del proyecto. En desarrollo el bind
  mount hace que los archivos escritos por el contenedor aparezcan en la carpeta
  del proyecto en el host. **Limitacion conocida:** en el perfil `prod` no hay
  bind mount ni volumen, asi que las fotos subidas se pierden si se recrea el
  contenedor. Si mas adelante se despliega de verdad, habra que montar algo ahi.

**Verificado**

| Comprobacion | Resultado |
| --- | --- |
| `docker compose up -d --build` levanta los 3 servicios | OK |
| App en `localhost:3100` | HTTP 200 |
| pgAdmin en `localhost:5051` con servidor precargado | OK |
| PostgreSQL 17.11 sano | OK |
| La app conecta a la BD por la red interna | OK |
| Hot reload al editar desde el host | OK, ~6s |
| Perfil `prod`: imagen compila y arranca | HTTP 200, usuario `node` sin root |

---

## Etapa 2 — Capa de datos

SQL puro contra PostgreSQL. Sin ORM y sin generadores de consultas, por
decision explicita del proyecto.

**Construido**

- `db/schema.sql`: cinco tablas (`roles`, `empresas`, `usuarios`,
  `trabajadores`, `clientes`), la vista `vw_usuarios_completos`, los indices y
  los triggers. Idempotente de principio a fin.
- `db/seed.mts`: aplica el esquema e inserta roles, una empresa de ejemplo y
  tres usuarios, uno por cada rol. Se puede ejecutar cuantas veces se quiera.
- `src/lib/db.ts`: pool de conexiones y las funciones `consultar`,
  `consultarUno`, `ejecutar` y `transaccion`.

**Como se evita la inyeccion SQL**

La defensa no consiste en limpiar cadenas, sino en no construir SQL con ellas.
Todas las funciones de `src/lib/db.ts` reciben el texto de la consulta y los
valores por separado, y el driver los envia asi al servidor con el protocolo
extendido: la consulta se prepara primero y los valores llegan despues, ya
tipados. Un valor nunca puede convertirse en instruccion.

Encima de eso hay tres refuerzos:

1. **`verificarParametros`** avisa en desarrollo si la consulta usa `$3` pero
   solo se pasaron dos valores. Ignora los literales de texto, porque una
   cadena puede contener algo con forma de marcador sin serlo: un hash de
   bcrypt empieza precisamente por `$2b$12$`.
2. **`identificadorSeguro`** cubre lo que no se puede parametrizar. Los nombres
   de columna y la direccion de un `ORDER BY` no aceptan marcadores, asi que
   cuando dependan de la entrada del usuario se validan contra una lista blanca
   en lugar de interpolarse.
3. **Restricciones en la propia base de datos**, como ultima linea. Aunque la
   aplicacion tuviera un fallo, la base rechaza el dato invalido.

**Decisiones**

- **Correos sin distinguir mayusculas mediante `lower(email)`.** Se usa un
  indice unico sobre `lower(email)` en lugar de la extension `citext`: no
  depende de extensiones instaladas y deja el comportamiento a la vista en cada
  consulta.
- **CHECK que exige contrasenas hasheadas.** `password_hash` debe empezar por
  `$2a$`, `$2b$` o `$2y$`. Si algun dia un error deja pasar una contrasena en
  texto plano, la base la rechaza.
- **Exclusividad trabajador/cliente por trigger.** La regla cruza dos tablas,
  asi que no cabe en un CHECK. Un trigger en cada tabla comprueba la otra y
  lanza un error con el codigo de violacion de unicidad.
- **`actualizado_en` por trigger**, para no depender de que cada consulta
  recuerde actualizarlo.
- **El rol del cliente se deriva, no se almacena.** Los trabajadores tienen
  `rol_id` hacia la tabla `roles`; un cliente no tiene fila en `trabajadores` y
  la vista le asigna el rol `cliente` por su presencia en `clientes`.
- **`db/seed.mts` con extension `.mts`.** Node 24 ejecuta TypeScript de forma
  nativa, asi que no hace falta `tsx` ni `ts-node`. La extension `.mts` lo
  marca como modulo ES sin tener que anadir `"type": "module"` al
  `package.json`, que afectaria al resto del proyecto.
- **El seed no usa el pool de `src/lib/db.ts`.** Es un script suelto: abre su
  conexion, hace su trabajo y la cierra.

**Verificado**

Con un script temporal contra la base real. Trece comprobaciones, todas pasaron:

| Comprobacion | Resultado |
| --- | --- |
| `' OR '1'='1` como valor no devuelve filas | OK |
| `x'; DROP TABLE usuarios; --` deja la tabla intacta | OK |
| El valor llega al servidor sin alterarse | OK |
| Detecta un parametro faltante | OK |
| Un literal con forma de `$n` no confunde al verificador | OK |
| Lista blanca acepta columna valida y rechaza el resto | OK |
| Rechaza correo duplicado con otras mayusculas | OK |
| Rechaza contrasena sin hashear | OK |
| Rechaza un tema fuera del conjunto permitido | OK |
| Bloquea que un trabajador sea tambien cliente | OK |
| Una transaccion fallida se deshace por completo | OK |
| La vista resuelve tipo y rol de los tres usuarios | OK |

**Datos que crea el seed**

Cuatro usuarios, no tres. La lista con sus contrasenas vive en el README, que
es donde la busca quien va a entrar; aqui solo importa por que son cuatro.

Al convertirse el cargo en un eje de autorizacion dejo de bastar con un
trabajador: con uno solo no hay forma de comprobar que un modulo declarado
para el area de redes NO le aparece a quien es de diseno. Por eso hay dos
trabajadores del mismo rol y distinto cargo, que es justo el par que hace
fallar la prueba si el filtro se rompe.

---

## Etapa 3 — Tipos y modelos

La capa que consulta la base de datos, y los tipos que viajan de ahi hacia
arriba.

**Construido**

- `src/types/`: `usuario.ts` (Usuario, UsuarioCompleto, roles, temas, filtros y
  paginacion), `organizacion.ts` (Rol, Empresa, Trabajador, Cliente) e
  `index.ts` como punto unico de importacion.
- `src/models/`: `usuarios.ts`, `roles.ts`, `empresas.ts`, `trabajadores.ts` y
  `clientes.ts`.
- `src/lib/db.ts` gana un tercer parametro opcional en `consultar`,
  `consultarUno` y `ejecutar` para poder ejecutar dentro de una transaccion, y
  la funcion `escaparLike`.

**Decisiones**

- **Nunca `SELECT *`.** Cada consulta lista sus columnas de forma explicita.
  No es estilo: es lo que impide que `password_hash` se cuele por accidente en
  una respuesta el dia que alguien anada una columna.
- **El hash sale por una sola puerta.** `buscarPorEmailConCredenciales` es la
  unica funcion que devuelve `password_hash`, y existe solo para que la action
  de inicio de sesion pueda comparar la contrasena. `buscarPorId` y `listar`
  devuelven el tipo `UsuarioCompleto`, que no tiene ese campo.
- **De snake_case a camelCase con alias en el propio SQL.** Las consultas
  escriben `foto_url AS "fotoUrl"`, asi la fila que devuelve el driver ya
  encaja con el tipo de TypeScript. No hace falta una capa de conversion.
- **Los modelos aceptan un ejecutor opcional.** Por defecto usan el pool; si
  reciben el cliente de una transaccion, se suman a ella. Es lo que permite
  crear el usuario y su fila de trabajador o cliente de forma atomica sin que
  el modelo sepa nada de transacciones.
- **`actualizarFoto` devuelve la ruta anterior**, para que quien llame borre el
  archivo que queda huerfano. Se resuelve con un `FROM usuarios AS anterior`
  dentro del UPDATE: una subconsulta en el RETURNING no garantiza que se lea la
  version previa de la fila.
- **`escaparLike` para las busquedas.** No es defensa contra inyeccion, porque
  el valor ya viaja parametrizado; es correccion. Sin ello, buscar "100%"
  encontraria cualquier cosa que empiece por 100, y un patron lleno de comodines
  puede volver la consulta muy costosa.
- **El ordenamiento pasa por lista blanca.** `ORDER BY` no admite parametros,
  asi que la columna se resuelve con `identificadorSeguro` contra un mapa fijo
  de claves permitidas y sus nombres reales en la base.

**Verificado**

Con un route handler temporal, para ejercitar los modelos en el runtime real de
Next y no en un entorno simulado. 29 comprobaciones, todas pasaron: lectura,
busqueda sin distinguir mayusculas, filtros, orden, paginacion, escritura en
transaccion, reversion completa ante un fallo, exclusividad trabajador/cliente,
correo duplicado y todas las actualizaciones del perfil.

Dos hallazgos durante la verificacion:

- Una carpeta de ruta que empieza por guion bajo es **privada** en el App
  Router y queda fuera del enrutado. La prueba inicial en `api/_prueba`
  devolvia 404 por eso.
- Al borrar una ruta quedan tipos generados obsoletos en `.next/dev/types` que
  hacen fallar `tsc`. Se arregla regenerandolos con `npx next typegen`.

Tras la verificacion se borro el route handler y se comprobo que la base quedo
con los mismos tres usuarios del seed, sin filas huerfanas.

---

## Etapa 4 — Nucleo de autenticacion y autorizacion

Todo lo necesario para entrar, salir y decidir quien puede ver que. Sin
interfaz todavia: se verifico por HTTP antes de existir una sola pantalla.

**Construido**

- `src/lib/password.ts`: hash y verificacion con bcrypt.
- `src/lib/jwt.ts`: emision y verificacion del token con jose.
- `src/lib/sesion.ts`: lectura de la cookie y los guardias `requerirSesion`,
  `requerirRol` y `requerirAdmin`.
- `src/lib/validaciones.ts`: validacion manual de formularios, sin libreria.
- `src/proxy.ts`: barrera de rutas de Next 16.
- `src/actions/auth.ts`: `iniciarSesion` y `cerrarSesion`.
- `src/types/sesion.ts`: el contenido del token y el estado de formulario.
- Pages provisionales de `/login`, `/dashboard` y `/dashboard/usuarios`, sin
  diseno, para poder probar el flujo. Se reemplazan tras aprobar el diseno.

**Decisiones**

- **Doce rondas de bcrypt.** Una comparacion tarda medio segundo. Es lento a
  proposito: encarece la fuerza bruta sin molestar a quien inicia sesion.
- **Hash senuelo.** Cuando el correo no existe se compara igualmente contra un
  hash que nadie usa. Sin eso la respuesta llegaria mucho antes y ese intervalo
  revelaria que el correo no esta registrado, permitiendo enumerar cuentas.
- **Un solo mensaje para correo inexistente y contrasena incorrecta.**
  Distinguirlos seria mas comodo para el usuario, pero convertiria el
  formulario en una via para averiguar que correos estan registrados.
- **Algoritmo fijado de forma explicita al verificar.** Sin `algorithms:
  ["HS256"]` un token podria declarar otro algoritmo en su cabecera y forzar
  una verificacion distinta de la prevista.
- **El contenido del token se valida campo a campo.** La firma garantiza que
  nadie lo altero, pero no que su forma sea la esperada: un token viejo,
  emitido antes de un cambio de estructura, sigue teniendo firma valida. Un rol
  que no existe se rechaza aunque la firma sea correcta.
- **`obtenerSesion` va envuelta en `cache` de React**, para que el layout, la
  page y las actions de una misma peticion no verifiquen la firma varias veces.
- **El destino de la redireccion se valida.** El parametro `volverA` llega en
  la URL, asi que lo controla quien envia el enlace. Se rechaza todo lo que no
  empiece por una sola barra: `//otro-sitio.com` es una URL con protocolo
  relativo y sacaria al usuario del dominio. Es el clasico redirect abierto.
- **Cookie `httpOnly`, `sameSite: lax`, y `secure` solo en produccion.**
  `httpOnly` es lo que limita el dano de un XSS; `secure` queda fuera en
  desarrollo porque ahi se sirve por HTTP.
- **El proxy no consulta la base de datos.** Se ejecuta en cada peticion que
  pase el matcher, y la documentacion desaconseja apoyarse ahi en estado
  compartido. Solo mira la cookie y verifica la firma.

**El proxy no es la unica barrera**

La documentacion de Next 16 advierte que las Server Actions viajan como POST a
la ruta donde se usan, de modo que un cambio en el matcher puede dejarlas fuera
de su alcance sin que nada avise. Por eso cada page y cada action empieza
llamando a `requerirSesion` o `requerirRol`.

Esto se comprobo de verdad: se creo una ruta que **no** figura en la lista de
rutas de admin del proxy, y se accedio con una sesion de cliente. El proxy la
dejo pasar, y `requerirAdmin` la bloqueo igualmente.

**Verificado**

31 comprobaciones automaticas sobre hash, token, validaciones y la action de
inicio de sesion, todas pasaron. Entre ellas:

| Comprobacion | Resultado |
| --- | --- |
| Dos hashes de la misma contrasena son distintos | OK |
| Rechaza token alterado, caducado, de otra clave y de otro emisor | OK |
| Rechaza un rol inexistente aunque la firma sea valida | OK |
| Mismo mensaje para correo inexistente y contrasena mala | OK |
| El tiempo de respuesta no delata si el correo existe (diferencia 43 ms) | OK |
| Bloquea una cuenta desactivada | OK |
| No permite redirigir a un dominio externo | OK |
| Respeta un destino interno | OK |

Y la matriz de acceso por HTTP:

| Ruta | Sin sesion | Admin | Cliente |
| --- | --- | --- | --- |
| `/` | 307 a /login | 307 a /dashboard | 307 a /dashboard |
| `/login` | 200 | 307 a /dashboard | 307 a /dashboard |
| `/dashboard` | 307 a /login | 200 | 200 |
| `/dashboard/usuarios` | 307 a /login | 200 | 307 a /dashboard |

Sin sesion, la redireccion al login conserva el destino en `volverA` para
devolver a la persona donde queria ir.

**Problema encontrado: el build necesitaba una base de datos**

`npm run build` fallaba dentro de la imagen de produccion:

```
Error: Failed to collect configuration for /dashboard
  [cause]: Falta la variable de entorno DATABASE_URL
      at src/lib/db.ts:54
```

La causa era un error de diseno en `src/lib/db.ts`: el pool se creaba en la
linea `export const pool = ... crearPool()`, es decir **al importar el modulo**.
Para recolectar la configuracion de cada page, `next build` las importa, y en
ese momento no hay base de datos ni variables de entorno de ejecucion.

Compilar no debe requerir una conexion. El pool pasa a crearse de forma
perezosa, en la primera consulta, con `obtenerPool()`. Como los parametros por
defecto de una funcion se evaluan en cada llamada y no al definirla, basta con
poner `ejecutor: Ejecutor = obtenerPool()` para que nada se conecte hasta que
haga falta de verdad.

El fallo no se veia en el host porque ahi Next carga el archivo `.env`, que si
tiene `DATABASE_URL`. Dentro de la imagen ese archivo esta excluido por el
`.dockerignore`, que es justo lo correcto: los secretos no viajan en la imagen.

Aparte de esto, ejecutar `npm run build` dentro del contenedor de desarrollo da
un error distinto al prerenderizar `/_global-error`, porque el servidor de
desarrollo mantiene tomado el volumen anonimo `.next` y el build escribe en el
mismo sitio. Para compilar hay que detener antes el servicio de desarrollo, o
construir la imagen de produccion.

---

## Etapas 5 a 11 — Diseno e interfaz

### El diseno, y lo que cambio tras verlo

Se generaron ocho vistas con el comando de diseno y se aprobaron con cambios.
Los que tuvieron consecuencias de fondo:

- **El inicio dejo de repetir los modulos.** Eso ya lo hace la barra lateral, y
  tenerlo dos veces obliga a mantener el mismo menu en dos sitios. En su lugar
  muestra tres cifras del estado de la cuenta.
- **Fuera las entradas de modulos futuros**, tanto del contenido como del menu.
  El menu solo lista lo que existe.
- **Una sola tipografia**, Poppins. Fraunces se retiro.
- **Sin transiciones de estado.** Los cambios al pasar por encima son
  inmediatos. Con ellas se fue tambien el desplazamiento vertical del hover:
  sin transicion no seria un movimiento, seria un salto.

### La regla del acento

Es la decision que mas ordena la interfaz:

| tema | lo que se acentua o esta bajo el cursor |
| --- | --- |
| claro | morado (blackberry) |
| oscuro | vainilla (gold) |

Ningun componente escribe esos colores: usan `--acento` y el tema decide. Eso
hace imposible romper por descuido la regla de marca de que el dorado solo va
sobre azul, porque el dorado solo existe cuando el fondo ya es oscuro.

La barra lateral cambia con el tema como todo lo demas, con sus propios tokens
(`--nav`, `--nav-texto`, `--nav-borde`): no sigue a `--superficie` porque en
oscuro tiene que ser navy, mas profunda que el resto de superficies.

**Una excepcion, deliberada:** el panel de marca del login se queda navy en los
dos temas. En claro, un panel blanco junto a un formulario blanco borraria la
division de la pantalla. Como su fondo no cambia, dentro de el el acento se
fija a dorado; sin eso el kicker salia morado sobre navy.

### La marca, como mascara y no como imagen

El archivo que entrego el cliente es una silueta blanca sobre transparente.
Puesta como `<img>` solo se veria sobre navy, y desaparecia en cuanto la barra
lateral se volvia clara. Se usa como **mascara de CSS**: se aprovecha solo su
canal alfa, que es la forma, y el color lo pone `currentColor`. Asi la marca se
tine con el tema y funciona sobre cualquier fondo.

Los iconos del navegador se generan desde ese mismo archivo compuesto sobre
navy, en 512, 180 y un `.ico` con 16, 32 y 48. El `.ico` se arma a mano porque
sharp no lo escribe, pero el formato admite PNG dentro desde hace anos.

### El patron de listado

Todos los modulos que listen registros usan el mismo componente. El modulo solo
aporta tres cosas: sus columnas, sus filtros y su consulta.

**El estado vive en la URL**, y de ahi sale la propiedad mas util: filtros,
orden y paginacion son enlaces, y el buscador es un formulario GET. Por eso
**todo el listado se renderiza en el servidor**, sin una linea de JavaScript de
cliente. Lo unico de cliente es abrir y cerrar el desplegable de un filtro.

`src/lib/parametros.ts` traduce los `searchParams` y **nunca lanza**. Es
necesario porque `identificadorSeguro` si lanza, y un `?orden=` escrito a mano
tumbaria la pagina con un error 500.

Los filtros empezaron como pastillas y se agruparon en desplegables: cuatro
grupos eran diecisiete pastillas en tres filas, todas con el mismo aspecto y
sin nada que dijera cual pertenecia a que.

### El desplegable propio

El `<select>` del navegador no admite estilos en su lista: la pinta el sistema
operativo. En Windows salia una lista azul ajena al tema.

Se sustituyo por el patron ARIA de combobox. Al dejar de ser un control nativo
hubo que reponer a mano lo que el navegador daba gratis: teclado completo con
flechas, Inicio, Fin, Escape y busqueda escribiendo las primeras letras;
semantica de `combobox`, `listbox` y `option`; y un campo oculto para que el
formulario lo envie. Sin eso seria un desplegable bonito e inutilizable sin
raton.

### Fallos encontrados y corregidos

**Los filtros de rol, area y empresa no filtraban nada.** A sus marcadores de
posicion les faltaba el simbolo del dolar:

    rol = 3      en lugar de    rol = $3

Es SQL valido, asi que no fallaba al construirse. Reventaba en el servidor con
`operator does not exist: text = integer`, un mensaje que no dice donde esta el
problema. La causa fue una herramienta propia: `String.replace` interpreta `$$`
en el texto de reemplazo como un dolar literal, asi que `$${...}` acabo en
`${...}`.

La comprobacion de parametros de `lib/db.ts` se amplio para detectar tambien el
caso contrario al que ya cubria: si sobran valores sin marcador que los
referencie, es que a alguno le falta el dolar. Antes solo avisaba cuando
faltaban valores, y por eso este fallo paso desapercibido.

**Otros:**

- El pie del panel lateral usaba `sticky` dentro del area desplazable y quedaba
  flotando, con contenido asomando por debajo. Cabecera, cuerpo y pie pasan a
  ser hermanos.
- Varios controles tenian el fondo y el icono del mismo color de acento, lo que
  dejaba el icono invisible al pasar por encima.
- Los campos compuestos pintaban dos indicadores de foco a la vez: el del
  contenedor y el contorno global sobre el input de dentro. La regla global se
  movio a la capa `base`, que Tailwind coloca por debajo de las utilidades.
- El `max-width` en unidades `ch` del panel del login estaba en el contenedor,
  que hereda 16 px, y partia el titular de 46 px en lineas de dos palabras. La
  unidad `ch` se resuelve contra el font-size del elemento que la declara.

### Verificado

| Comprobacion | Resultado |
| --- | --- |
| Los seis filtros del listado devuelven lo correcto | OK |
| Los filtros se combinan entre si | OK |
| La paginacion reparte bien | OK |
| `?orden=;DROP&dir=x&pagina=-5` responde 200 y cae a los valores por defecto | OK |
| Alta de trabajador con su rol y su area | OK |
| Alta de cliente vinculado a su empresa | OK |
| Rechaza correo repetido en otras mayusculas | OK |
| Un alta rechazada no deja el usuario a medias | OK |
| La contrasena provisional se guarda hasheada | OK |
| Toda page y toda action que toca datos empieza con un guardia | OK |
| Un cliente no entra en el modulo de usuarios | OK |
| Los esqueletos de carga copian la geometria real | OK |

## Etapa 12 — Cierre de la Fase 1

Lo que quedaba por comprobar de la lista de verificacion, ya sobre la
aplicacion corriendo.

### Buscador global, con los tres roles

Se probo `modulosDe` y `buscarModulos` con un administrador, un trabajador de
redes y un cliente.

| | admin | trabajador (redes) | cliente |
| --- | --- | --- | --- |
| Menu | Inicio, Usuarios, Mi perfil | Inicio, Mi perfil | Inicio, Mi perfil |
| Buscar "personal" | Usuarios | — | — |
| Buscar "CONTRASEÑA" | Mi perfil | Mi perfil | Mi perfil |

Tres cosas quedan demostradas: el alias encuentra el modulo (nadie escribe
"usuarios" cuando busca al personal), quien no puede abrir Usuarios tampoco lo
ve aparecer en el buscador, y `normalizar` hace que las tildes y las mayusculas
den igual.

### Cambio de contrasena

| Caso | Resultado |
| --- | --- |
| Contrasena actual equivocada | "La contrasena actual no es correcta" |
| Cambio correcto | "Tu contrasena quedo actualizada" |
| Entrar con la contrasena vieja | Rechazado |
| Entrar con la nueva | Entra al dashboard |

El mensaje del login no distingue entre correo inexistente y contrasena
equivocada: decir cual de las dos fallo confirmaria que ese correo existe.

Al terminar se devolvio la contrasena del seed a su valor, para que las
credenciales que documenta el README sigan siendo ciertas.

### Foto de perfil

| Archivo | Resultado |
| --- | --- |
| PNG de 5 MB | "La imagen no puede pasar de 2 MB" |
| Texto renombrado a `.png` | "El archivo no es una imagen JPG, PNG o WEBP" |
| PNG valido | Sube; queda como `<uuid>.png` |
| Segunda subida | La anterior se borra del disco |

Lo importante es el segundo caso. El rechazo NO se apoya en la extension ni en
el `Content-Type` que declara el navegador, porque los dos los escribe quien
sube el archivo. Se lee la firma de los primeros bytes, y el nombre con el que
se guarda es un UUID mas la extension que corresponde a esa firma: el nombre
original se descarta entero, asi que no hay forma de colar una barra, un
`..` ni una extension que no case con el contenido.

Y el rechazo por tamano ocurre ANTES de leer el archivo: cargar en memoria algo
enorme solo para despues rechazarlo es justo lo que buscaria quien quisiera
tumbar el servidor.

### Responsive

| Ancho | Scroll horizontal | Desbordes | Navegacion |
| --- | --- | --- | --- |
| 360 | no | ninguno | boton de menu, cajon |
| 768 | no | ninguno | boton de menu, cajon |
| 1440 | no | ninguno | sidebar fijo de 268 px |

**Un objetivo tactil corregido.** El enlace del breadcrumb medida 17 px de
alto. Se estira a 45 px con un pseudoelemento, la misma tecnica que ya usaba el
boton de la camara: el area que responde al dedo crece sin que el texto engorde
ni se descoloque la fila.

**El cajon movil no atrapa el foco.** Cerrado se queda en `left: -286px`, es
decir sigue en el DOM y sigue midiendo. Lo que lo salva es el `inert` del div
que lo envuelve: se comprobo intentando enfocar sus cinco enlaces uno a uno con
el cajon cerrado, y ninguno acepto el foco. Con Enter abre y el foco entra al
boton de cerrar; con Escape cierra, el foco vuelve al boton que lo abrio y el
scroll del cuerpo se restablece.

Conviene medir esto con un intento real de foco y no buscando el atributo: el
`inert` estaba en el envoltorio, no en el `aside`, y una comprobacion que solo
mirara el `aside` daria por trampa lo que no lo es.

### Imagen de produccion

`COMPOSE_PROFILES=prod docker compose build app-prod` compila y genera
`conejo-app-app-prod:latest`.

Se construye con la imagen de produccion a proposito, nunca con `npm run build`
dentro del contenedor de desarrollo: alli el servidor de desarrollo retiene el
volumen `.next` y el resultado son errores de prerenderizado que no
corresponden a ningun fallo del codigo.

`tsc --noEmit` y `eslint` limpios.

> Al borrar una ruta de prueba, `tsc` siguio fallando por los tipos que Next
> ya habia generado para ella en `.next/dev/types`. No es un error del codigo:
> son tipos huerfanos que apuntan a un archivo que ya no esta. Se quitan
> borrando esa carpeta.

### Lo que queda fuera de la Fase 1

No hay forma de **quitar** la foto de perfil, solo de reemplazarla. El contrato
de la Fase 1 pide "subir una foto" y eso esta cubierto, asi que se deja
anotado como hueco en lugar de ampliarlo por cuenta propia.

# Fase 2 — Modulo de Hooks

El punto de partida es `docs/creacionHooks.md`, que documenta como se hacia
esto en la aplicacion anterior: una sola pagina larga con anclas, de un solo
usuario, con todo colgando de un `ownerId`. Se conserva el flujo de trabajo
entero y se rehace todo lo demas.

Dos cambios de fondo respecto del original:

- **Deja de ser una pagina y pasa a ser un recorrido.** Seis submodulos, cada
  uno un paso hacia el final. Y el final NO es la nota del auditor: una pieza
  esta terminada cuando tiene sus metricas registradas. Un 88 sin resultado
  real no le ensena nada a la cuenta.
- **Deja de ser de una persona y pasa a ser del equipo.** Cualquier creadora ve
  y edita todo; se guarda quien creo cada cosa para saber a quien preguntar.

## Etapa 13 — Catalogo y auditor

Lo primero, y a proposito sin base de datos y sin una sola pantalla: el auditor
es una funcion pura, asi que se puede dejar demostrado antes de que exista nada
alrededor.

**Que es dato y que es logica.** Los siete territorios, los ocho mecanismos y
los seis objetivos NO son tablas: son `src/lib/hooks/catalogo.ts`. La tabla
objetivo → territorio → metrica → evidencia es criterio de la agencia, no
contenido que alguien vaya a dar de alta desde la interfaz. Lo que si se guarda
en columnas (`objetivo`, `plataforma`) lleva su `CHECK` contra el conjunto
cerrado, igual que ya hacia `tema` en `usuarios`.

Las 42 aperturas si son tabla, y por una razon concreta: se dan de alta y se
retiran desde la aplicacion, cosa que un array en el codigo no permite.

**El auditor vive en `src/lib/hooks/auditor.ts` y no es ni modelo ni action.**
No toca la base y no orquesta nada. Al ser puro corre en los dos lados sin
duplicar la logica: en el cliente para la nota en vivo mientras se escribe, y
en el servidor al guardar la ficha.

Tres cosas de las listas de deteccion (`src/lib/hooks/listas.ts`) parecen
erratas y no lo son. Se copiaron literales del documento y estan comentadas en
la cabecera del archivo para que nadie las "arregle":

| Parece | Es |
| --- | --- |
| Raices cortadas: `equivoc`, `hundi`, `fall` | La comparacion es por subcadena, no por palabra completa |
| `increible` y `increible` acentuado, las dos | No se quitan tildes: hacen falta las dos formas |
| `"sin "`, `"tu "`, `"te "`, `"pero "` con espacio final | El espacio es significativo: sin el, `tu` casa dentro de `estudio` |

**Los fallos duros tapan la nota, no la restan.** Es la regla que sostiene todo
lo demas:

```ts
if (hayDuro) nota = Math.min(nota, 69);
if (demasiadoCorto) nota = Math.min(nota, 25);
```

Sin esto, un hook que empieza por «Hola chicos» pero suma bien en los otros
ocho controles aprobaria. Con esto sale 69 lo bien que sume.

Un detalle del control cero: «Demasiado corto» **sustituye** al control de
longitud en lugar de sumarse. Los dos a la vez darian un par contradictorio en
pantalla —"demasiado corto" junto a "longitud correcta"— sobre el mismo texto.

## Etapa 14 — Base de datos y modelos

Cinco tablas nuevas en `db/schema.sql`, con las convenciones del archivo. Las
decisiones que no se leen solas quedaron como comentario junto a la columna:

| Tabla | Decision |
| --- | --- |
| `aperturas_hook` | `activa` en lugar de borrado: una apertura retirada puede estar citada en una ficha vieja |
| `reglas_hook` | `CHECK (empresa_id IS NOT NULL OR sector IS NOT NULL)`: una regla que no aplica a nadie no es una regla |
| `resultados_hook` | `ficha_id UNIQUE`: registrar dos veces actualiza, no duplica |
| `resultados_hook` | `CHECK (vistas_3s <= impresiones)`: un hook rate por encima de 100 % no significa nada |
| `referencias_hook` | `lectura NOT NULL`: una referencia sin la lectura de por que funciona es material para copiar, no para aprender |

`empresas` necesitaba **`sector`**, que no existia: la resolucion de regla es
cliente → sector → estandar de la casa. Se anadio con un bloque `DO` idempotente,
como se hizo en su dia con `cargo_id`.

**Se persisten los tres campos que el original tiraba.** El documento avisa de
que `truth`, `payoff` y `risk` se muestran pero no se guardan. Aqui se guardan
(`verdad_marca`, `pago_promesa`, `riesgo_claim`): son parte de la decision, y
una ficha que al reabrirla ha perdido la verdad de marca obliga a reescribirla
entera.

**La resolucion de regla es una sola consulta**, no tres viajes:

```sql
WHERE empresa_id = $1
   OR (empresa_id IS NULL AND sector IS NOT NULL
       AND sector = (SELECT sector FROM empresas WHERE id = $1))
ORDER BY (empresa_id IS NULL)
LIMIT 1
```

El `ORDER BY` sobre un booleano es lo que hace ganar a la del cliente: `false`
ordena antes que `true`, asi que la regla con `empresa_id` sale primera y la de
sector solo aparece cuando no hay ninguna de cliente.

El hook rate tambien se calcula en SQL y no en JavaScript
(`round(vistas_3s * 100 / NULLIF(impresiones,0), 1)`): el `NULLIF` evita la
division por cero de una ficha sin impresiones, y ordenar el historial por esa
columna solo es posible si existe en la consulta.

## Etapa 15 — Navegacion anidada

Hasta aqui nada soportaba anidamiento: `Modulo` era plano y los tres
consumidores hacian un `map` de un nivel.

- `Modulo` gana `hijos?: Modulo[]`.
- `ModuloVista` deja de ser `Omit<Modulo, "icono">`. Ese `Omit` arrastraria los
  hijos con su `LucideIcon` dentro, que no cruza al cliente. Pasa a
  `Omit<Modulo, "icono" | "hijos"> & { icono: ReactNode; hijos?: ModuloVista[] }`.
- `modulosDe` filtra tambien los hijos y **poda el padre que se queda sin hijos
  visibles**, o quedaria un desplegable vacio.
- Nueva `aplanar`, que necesitan el resolvedor de activo y el buscador global:
  sin ella los submodulos no salen con Ctrl+K, y el buscador global es el
  indice de la aplicacion.

**El activo se resuelve UNA vez sobre la lista entera y baja como prop.** El
primer intento dejaba que cada item se mirase a si mismo, y encendia Inicio a
la vez que el submodulo: `/dashboard` es prefijo de `/dashboard/hooks/auditor`.
La regla es "gana el prefijo mas largo", y eso solo se puede decidir comparando
a todos los candidatos juntos.

**Los hijos se desmontan al cerrarse, no se ocultan.** El cajon movil tiene una
trampa de foco que enumera los enlaces en vivo: unos hijos plegados con altura
cero seguirian ahi dentro y se tabularia hacia enlaces invisibles.

**El desplegable arranca abierto ajustando el estado durante el render**, no
con un efecto. Con `useEffect`, entrar directo a `/dashboard/hooks/auditor`
pintaria el desplegable cerrado un fotograma y lo abriria despues, con el salto
a la vista.

**El padre es enlace Y interruptor.** Tiene pagina propia —la portada del
modulo—, asi que un padre que solo despliega la esconde detras de un clic en un
hijo; y uno que solo navega obliga a entrar a la portada para abrir la lista.
El chevron es un boton aparte colocado sobre el hueco que le deja el enlace:
anidar un boton dentro de un enlace es HTML invalido y en la practica el
navegador se queda con uno de los dos comportamientos.

**Un submenu tiene que leerse como submenu.** La primera version solo sangraba
los hijos y se leian como seis hermanos mas de la lista. Lo que lo arregla son
tres cosas juntas, no la sangria sola: un rail vertical que arranca bajo el
centro del icono del padre y baja por toda la lista, mas sangria, y la letra
mas chica. El hijo activo engorda su tramo de rail, para que se vea donde estas
aunque el desplegable quede por debajo del pliegue.

## Etapa 16 — Hooks y auditor

Las dos superficies que producen la decision.

**El canvas lleva el auditor dentro; el auditor es ademas una pagina suelta.**
El documento original dice que los campos son los mismos y que editar en uno
edita en el otro, y eso no sobrevive a separarlos en dos paginas. La salida es
que la ficha muestra la nota en vivo, y la pagina suelta sirve para lo que el
propio documento senala como su mayor valor: entra un texto, sale una nota
explicada, sin necesidad de ficha.

**La metrica no se pregunta.** Sale del objetivo. Preguntarla aparte permitiria
elegir "alcance" y medirlo por conversiones, que es exactamente el error que el
modulo existe para evitar.

**Un solo formulario con varios botones, no varios formularios.** Guardar
borrador, auditar y exportar comparten los mismos campos; el despachador
ramifica segun el `value` del boton pulsado. Con formularios separados habria
que sincronizar tres copias del mismo estado.

**El auditor guarda ANTES de auditar.** Si auditara primero y guardase despues,
un fallo al guardar dejaria en pantalla una nota que no corresponde a nada
almacenado.

Los tres avisos de honestidad del documento se conservan palabra por palabra.
Son lo que distingue la herramienta de un generador de promesas: el auditor
mide forma, no verdad; las cifras de referencia son de terceros; y la lectura
organica no es la de pago.

## Etapa 17 — Historial, metricas y documentacion

Los tres listados heredan el patron que ya existia: declaran columnas y filtros
y se llevan busqueda con retardo, orden, paginacion, estado en la URL, tarjetas
por debajo de `lg` y panel lateral.

**`guardarNota` nunca degrada una ficha medida.** Reauditar una pieza que ya
tiene numeros no puede devolverla a "auditada": el estado avanza, no retrocede.

**`borrar` devuelve `{ borrada, estabaMedida }`.** Borrar una ficha con
metricas registradas se lleva por delante el unico dato real que tenia esa
pieza, asi que la confirmacion lo dice de forma distinta segun el caso.

**Documentacion, no repertorio.** Reune las tres cosas que hay que tener
delante antes de escribir: las reglas (como habla esta cuenta), las aperturas
(con que se empieza) y las referencias (que ha funcionado fuera). Cada una con
su rotulo grande, para que quien entra a consultar una sepa de un vistazo donde
esta. El manual dice como funciona un hook en general; esto dice que se puede
usar en ESTA cuenta.

## Etapa 18 — Manual y portada

**El manual va desplegado, no plegado.** El plan lo tenia plegado por defecto,
copiando al original. Se cambio al escribirlo: es la unica pantalla del modulo
que se lee entera una vez y despues solo se consulta, y plegarlo obligaria a
abrir siete cosas para encontrar una.

**La portada no repite el sidebar.** El sidebar dice a donde se puede ir; la
portada dice a donde conviene ir. Arriba, la pieza en curso; debajo, el
recorrido con cuantas piezas hay paradas en cada paso.

La pieza en curso son cuatro estados de la misma tarjeta:

| Estado | Muestra |
| --- | --- |
| Sin ninguna | Invitacion a crear |
| Borrador | 33 %, "seguir donde lo dejaste" |
| Auditada | 66 %, y el aviso de que le faltan los numeros |
| Recien medida | La ultima terminada, su hook rate y lo que dejo escrito |

Al registrar las metricas la pieza se termina y la tarjeta vuelve al primer
estado. Eso es lo que hace que el modulo tenga un ciclo y no una lista que solo
crece.

El contador de borradores **descuenta la pieza que se esta mirando**: decir "y
2 mas" cuando una de las dos es la que se tiene delante confunde.

## Verificado

**El auditor, contra el documento** — `npm run prueba:auditor`, 19/19.

| Caso | Resultado |
| --- | --- |
| Hook de tres palabras | nota 25, tapada |
| Preambulo con suma 72 | nota 69 |
| Insert-Titulo identico al hablado | fallo duro |
| Formula del cementerio | fallo duro |
| Hook limpio con cifra y tension | 100, listo |
| Sin Insert-Titulo | solo aviso, no fallo |
| Regla ampliada admite 14 palabras | pasa, y marca limite ampliado |
| Prueba exigida y ausente | 69 pese a sumar 100 |
| Raiz truncada `hundi`, `increible` con y sin tilde | detectados |
| La nota nunca pasa de 100 | OK |

**Los modelos, contra la base real** — `npm run prueba:modelos`, 23/23.

| Comprobacion | Resultado |
| --- | --- |
| Las 42 aperturas sembradas; filtro por territorio y por mecanismo | OK |
| La regla del cliente gana sobre la del sector | OK |
| Sin regla de cliente cae a la del sector, con sus limites ampliados | OK |
| Se persisten `verdad_marca`, `pago_promesa` y `riesgo_claim` | OK |
| Guardar la nota sube el estado a auditada | OK |
| El hook rate se calcula en SQL | OK |
| Registrar resultados dos veces actualiza, no duplica | OK |
| El resultado cae con la ficha, sin filas huerfanas | OK |

**Acceso**, sobre la aplicacion corriendo:

| Ruta | redes | diseno | admin |
| --- | --- | --- | --- |
| Los siete `/dashboard/hooks/*` | 200 | 307 → `/dashboard` | 200 |
| Hooks en el sidebar | si | no | si |
| Hooks en el buscador global | si | no | si |

**El recorrido completo**, insertando una ficha y avanzandola a mano:

| Paso | La portada muestra |
| --- | --- |
| Ficha nueva en borrador | 33 %, "seguir donde lo dejaste", 1 sin auditar |
| Nota 88, estado auditada | 66 %, "le falta lo unico que la termina: los numeros" |
| Resultados registrados | Ultima terminada, 33,0 % de hook rate, su aprendizaje |
| Dos borradores mas | "y 1 mas en borrador" (se descuenta el que se muestra) |

**Estado en la URL**, en el historial: `busqueda`, `estado`, `porPagina`,
`pagina`, `orden` y `dir` filtran, ordenan y paginan, y pegar la URL en otra
pestana reproduce el estado. `?orden=;DROP&pagina=-5&estado=xx` responde 200 y
cae a los valores por defecto, en los tres listados.

`tsc --noEmit` y `eslint` limpios.

> Un 500 aparecido en mitad de estas pruebas resulto ser un tiempo de espera
> del pool de conexiones, no un fallo de validacion: el servidor de desarrollo
> estaba compilando una ruta por primera vez —dos minutos— mientras las demas
> peticiones hacian cola. Repetido con la ruta ya compilada, 200.

### Lo que queda anotado

El hook de ejemplo que se dibujo en la maqueta —«El detalle de esta etiqueta
que nadie mira»— saca **73**, no el 88 que aparecia dibujado: no lleva termino
de tension, ni cifra, ni segunda persona. El auditor tiene razon y la maqueta
no. Se deja como esta, porque un ejemplo aprobado con avisos ensena mas que uno
perfecto: muestra que un hook puede pasar el umbral y aun asi tener tres cosas
que mejorar.

---

## Refinamiento — Despliegue fluido del submenú en la navegación

**Problema:** Al interactuar con el botón del submenú (Hooks), los subítems aparecían y desaparecían de forma abrupta (desmontándose en un solo fotograma), produciendo un salto visual disruptivo mientras el chevron giraba de forma suave.

**Solución:**
- Se introdujo la utilidad `@utility despliega` en `globals.css`, animando `grid-template-rows` (de `0fr` a `1fr`), `opacity` y `visibility` con la curva `--ease-suave` y duración `--dur-entrada` del sistema de diseño.
- Los subítems se envuelven en un contenedor con `overflow: hidden` y un sutil deslizamiento vertical (`-translate-y-1.5` -> `translate-y-0`), logrando que la línea guía (rail) se deslice armónicamente hacia abajo al compás del giro del chevron.
- Para accesibilidad, se mantiene `inert={!abierto}` y `aria-hidden={!abierto}` para garantizar que el foco del tabulador no ingrese al submenú cuando está colapsado tanto en escritorio como en el cajón móvil.

---

## Estandarización — Paneles de consulta «Ver más» y modales en Documentación

**Problema:** En el módulo de Documentación, no existía vista de solo lectura o "Ver más" para consultar en detalle una regla antes de editarla. Además, en las aperturas el icono de ojo abría directamente el formulario de edición en lugar de la ficha de detalle, rompiendo la consistencia con el patrón establecido en el módulo de usuarios (`ver` -> ficha con botón de editar vs `editar` -> formulario directo vs `borrar`/`retirar` -> modal de confirmación centrado).

**Solución:**
- Se crearon componentes de detalle de solo lectura:
  - `DetalleRegla.tsx`: Muestra tipo de regla (cliente/sector), límites de voz e insert, exigencia de prueba, preámbulos vetados, fórmulas gastadas y términos de tensión. Incluye pie con botón de «Cerrar» y «Editar regla».
  - `DetalleApertura.tsx`: Muestra el territorio, mecanismos, plantilla estructurada con corchetes destacados, ejemplo hablado, insert-título, dirección para edición y pautas de uso. Incluye botón «Editar apertura».
  - `DetalleReferencia.tsx`: Muestra territorio, plataforma de origen, enlace a publicación original, lectura analítica de por qué funciona y etiquetas temáticas. Incluye botón «Editar referencia».
- Se actualizaron las tres secciones en `SeccionesDocumentacion.tsx` (`SeccionReglas`, `SeccionAperturas`, `SeccionReferencias`) para contar con los tres botones estándar de acción: `Eye` (Ver detalles), `Pencil` (Editar) y `Trash2` (Borrar/Retirar).
- En `page.tsx` se estandarizó la gestión de paneles (`ver-regla`, `editar-regla`, `nueva-regla`, `borrar-regla`, `ver-apertura`, `editar-apertura`, `nueva-apertura`, `retirar-apertura`, `ver-referencia`, `editar-referencia`, `nueva-referencia`, `borrar-referencia`).




## Etapa 19 — Despliegue en Vercel y base de datos gestionada

La aplicacion sale de la maquina de desarrollo. Produccion pasa a Vercel con la
base en Neon; el Docker Compose se queda, pero cambia de papel: deja de ser
"como corre el proyecto" para ser "como se desarrolla el proyecto".

### Tres supuestos que resultaron falsos

**Vercel no despliega Dockerfiles.** El plan de partida era "con el Dockerfile
lo subo a Vercel sin problema". No hay runtime de contenedores para servicios
web: Vercel detecta Next.js y lo compila con su propio proceso, y el Dockerfile
se ignora por completo. No impide desplegar —Next.js es su caso nativo— pero
cambia lo que hay que preparar.

**`sslmode=require` no significa "cifra sin verificar".** En `pg` 8.23,
`prefer`, `require` y `verify-ca` son **alias de `verify-full`**: verifican la
CA y el nombre del host, y ademas emiten un `SECURITY WARNING` en cada
arranque. Esta en
`node_modules/pg-connection-string/index.js:139-157, 219-227`, y en `pg` 9
cambiara de significado. Se escribe `verify-full` de forma explicita.

**Un `TcpTestSucceeded: True` no dice nada sobre PostgreSQL.** Solo prueba que
alguien acepta un socket en ese puerto. Toda la investigacion de abajo empezo
porque esa comprobacion daba verde mientras nada funcionaba.

### El diagnostico que costo la tarde

La base iba a estar en SiteGround. No conectaba, y el sintoma era enganoso: el
TCP se establecia, se mandaba el paquete `SSLRequest` del protocolo PostgreSQL
—ocho bytes, `0000000804d2162f`— y no llegaba respuesta. A los 19,7 segundos, un
`RST`.

Eso descarta las explicaciones faciles. Un rechazo de `pg_hba.conf` devuelve un
mensaje de error del protocolo; una contrasena mala, otro. Un reset mudo despues
del `connect` solo lo hace algo que esta **delante** del servidor.

La primera conclusion fue que el cortafuegos perimetral de SiteGround filtraba
por tipo de IP, y que por tanto Vercel —que sale por rangos de AWS— tampoco
conectaria. **Esa conclusion era falsa.** Se cayo al probar contra Neon, que no
filtra por IP y fallaba exactamente igual. La comparacion que lo resolvio:

| Destino | Puerto | Resultado |
| --- | --- | --- |
| Neon | 5432 | TCP abre, sin respuesta |
| SiteGround | 5432 | TCP abre, sin respuesta |
| Neon | 443 | responde |
| GitHub | 22 | responde |

El **mismo host** contesta en 443 y no en 5432. No es la IP, ni el nodo de
salida, ni el protocolo de la VPN: **ProtonVPN bloquea el puerto 5432**, que es
politica habitual contra puertos de base de datos.

Lo que si quedo probado de SiteGround, con la VPN apagada, es que **responde `N`
al `SSLRequest`: no ofrece TLS**. Con el acceso remoto abierto y sin cifrado,
credenciales y datos de personas viajarian en claro. Eso, y no el cortafuegos,
es lo que lo descarta.

**La leccion de metodo:** cuando dos proveedores independientes fallan
identicamente, el factor comun no son ellos. Y una hipotesis que solo se ha
probado contra un destino no esta probada.

### Las decisiones que salieron de ahi

Como el *split tunneling* de ProtonVPN es de pago y la VPN hace falta para
trabajar, la maquina de desarrollo no va a poder hablar con Neon. De ahi la
arquitectura:

| | Base de datos | Como conecta |
| --- | --- | --- |
| Desarrollo | PostgreSQL de Docker | `localhost`, la VPN no interviene |
| Produccion | Neon | Desde los servidores de Vercel, ajenos a la VPN |

Y para sembrar: si no se puede llevar la base al script, se lleva el script a la
base. `npm run sql:produccion` genera un archivo que se pega en el editor SQL del
panel de Neon, que va por HTTPS.

Efecto colateral bueno, y no buscado: una prueba local ya no puede tocar los
datos de produccion.

### La foto de perfil, apagada y no borrada

El disco de una funcion de Vercel es de solo lectura salvo `/tmp`, y `public/` se
hornea en el build. `writeFile` sobre `public/uploads/avatares` daria `EROFS`; y
aun logrando escribirlo, el archivo no se serviria ni sobreviviria al siguiente
despliegue. No es una decision de producto: **ese codigo es incompatible con una
plataforma sin disco**.

Se comenta en lugar de borrarse, en un solo bloque marcado por archivo, con
cabecera que explica el motivo y enumera los pasos para revivirlo. En el VPS
vuelve a funcionar sin tocarle una linea.

**El efecto secundario que casi se escapa:** `EstadoCuenta` contaba la foto como
uno de los cuatro campos del medidor de perfil completo. Tal cual, todo el mundo
se habria quedado clavado en 75 % con el cartel "Falta tu foto" y ninguna forma
de cumplirlo, porque la interfaz ya no ofrece subirla. Se retira ese campo y el
porcentaje se recalcula solo. Habia otros dos sitios mintiendo: el subtitulo del
modulo en el buscador global y la descripcion de la pagina.

### El pool, preparado para funciones sin estado

Los valores de siempre —`max: 10`, sin reintento— son correctos para un
contenedor con un proceso de larga vida y hostiles para lambdas: cada instancia
tiene su propio pool, asi que el limite real contra la base es `max` por el
numero de instancias que levante la plataforma.

Dos cosas que no son obvias:

- **`maxLifetimeSeconds` hace falta aparte de `idleTimeoutMillis`**, porque
  durante el congelado de una instancia los temporizadores no corren: el timeout
  de ocio puede no dispararse nunca y la conexion estar muerta igualmente.
- **El reintento es seguro por una razon concreta**, no por optimismo: todo
  error del servidor trae su SQLSTATE en `code`. Un error *sin* `code`, o con un
  codigo de socket, demuestra que la consulta nunca llego, asi que repetirla no
  puede duplicar una escritura. Por eso quedan fuera `57P01` y `57P03`, que si
  llegaron al servidor. Y por eso no se reintenta dentro de `transaccion()`: hay
  un `BEGIN` abierto y repetir lo partiria en dos.

Se corrige tambien un fallo latente: el `ROLLBACK` no estaba protegido. Si lo que
rompia la transaccion era la propia conexion, deshacerla tambien lanzaba, y ese
segundo error **tapaba al primero**: en los registros quedaba el fallo de socket
en lugar de la causa real.

### Verificado

| Comprobacion | Resultado |
| --- | --- |
| `tsc --noEmit` y `eslint` | limpios |
| `prueba:auditor` (19 casos) y `prueba:modelos` (23) | OK |
| El SQL generado sobre una base vacia | 4 usuarios, 42 aperturas, 3 roles, 6 cargos, 2 reglas, 1 referencia |
| El mismo SQL pegado dos veces | los mismos recuentos: no duplica |
| El hash del administrador del SQL generado | valida contra su contrasena |
| Las reglas de ejemplo | la de sector sin empresa, la de cliente con empresa |
| Medidor de perfil sin foto | 100 % con nombre, apellido y telefono |
| *Mi perfil* | sin camara ni selector de archivos |
| `COMPOSE_PROFILES=prod` | ya no levanta pgadmin |

### Lo que queda anotado

- **El plan Hobby de Vercel es solo para uso no comercial.** Sirve mientras esto
  sea desarrollo y demostracion; en cuanto la agencia trabaje a diario con ello
  hay que pasar a Pro o haber saltado al VPS. No es un limite que avise: es un
  termino de servicio.
- **Las tres cuentas de prueba** tienen sus contrasenas en codigo versionado.
  Hay que borrarlas de produccion antes de que entren datos reales.
- **Cada cambio de esquema exige repetir el pegado** del SQL en Neon. Deja de
  hacer falta el dia que se pueda conectar al 5432.
- **No hay copias de seguridad propias.** Neon gratuito conserva un dia de
  historia, y un `pg_dump` desde la maquina de desarrollo choca con el mismo
  bloqueo del 5432.
- **Zona horaria.** El contenedor era UTC; Windows es America/Caracas y Vercel
  sigue en UTC. Los `Intl.DateTimeFormat` de los Server Components se renderizan
  distinto en local y en produccion.
- **El dia del VPS**: el Dockerfile ya esta, el compose podado tambien, haria
  falta `output: "standalone"` para adelgazar la imagen, y se descomentan las
  fotos de perfil.

### Nota de metodo: reproducir el build de Vercel en local

Al verificar que el build no necesita base de datos, el primer intento fallo
con esto:

```
Error occurred prerendering page "/_global-error"
TypeError: Cannot read properties of null (reading 'useContext')
```

Falla tambien sobre `main`, asi que no lo introdujo esta etapa. Y no es un
fallo del codigo: la etapa `dev` del Dockerfile fija `NODE_ENV=development`, y
compilar con ese valor hace que Next resuelva mal React. El propio `next build`
lo avisa —`non-standard NODE_ENV value`— pero el aviso queda enterrado entre
cientos de lineas y el error que se lee apunta a otro sitio.

Con `NODE_ENV=production` compila limpio, sin `DATABASE_URL` y con las quince
rutas generadas. Vercel siempre construye asi, de modo que nunca lo habria
sufrido; lo que estaba mal era el metodo de comprobacion.

Se aprovecho para escribir un `src/app/global-error.tsx` propio, que la
aplicacion no tenia. No arregla nada —el problema era el entorno— pero cubre
un hueco real: cuando falla el layout raiz, `error.tsx` no llega a pintarse, y
lo que se veia era la pagina interna de Next, en ingles y sin relacion con la
marca. Va con estilos en linea a proposito: es la pantalla que aparece cuando
ya ha fallado todo lo demas, y no debe depender de la hoja de estilos ni de
ningun componente compartido.

## Etapa 20 — Correcciones tras las pruebas en produccion

La primera pasada real por la aplicacion desplegada saco nueve problemas. Tres
no eran detalles: habia funcionalidad que sencillamente no funcionaba, y un
campo de metricas que escribia en la columna equivocada.

### Tres sintomas, una causa: los paneles del historial

Ver y borrar no hacian nada. El motivo estaba encadenado:

- La page **nunca leia `estado.panel`** y **no pasaba la prop `panel`** al
  listado, asi que no habia nada que renderizar.
- `"borrar"` **no estaba en la lista blanca** `PANELES`. Al caer fuera, `panel`
  se anula, y eso arrastra `panelId` a `null`: ni siquiera llegaba el id.
- `editar` funcionaba **de casualidad**, porque apunta a otra page que ignora el
  nombre del panel y solo usa el id.

`borrarFicha` llevaba escrita desde el principio sin que nadie la llamara, y no
existian ni `DetalleFicha` ni `ConfirmarBorradoFicha`. La leccion: un enlace a
un panel que la lista blanca no reconoce **no falla, desaparece**.

### El fallo de metricas escribia en la columna equivocada

El campo con `name="guardados"` tomaba su etiqueta de la metrica del objetivo de
la ficha:

```tsx
etiqueta={ficha ? metricaDe(ficha.objetivo).split(" ")[0] : "Guardados"}
```

Con objetivo `compartidos` rotulaba «Compartidos» —duplicando el campo
siguiente— y escribia en `guardados`. Con `consideracion` rotulaba «Clics» y
pasaba lo mismo. No era cosmetico: **hay datos guardados en la columna
equivocada** en cualquier ficha registrada con esos dos objetivos.

Los rotulos pasan a ser fijos. Se anade `me_gusta` y se retira `conversiones`.
La bateria de modelos gana una comprobacion que cruza los tres valores de
interaccion con cifras distintas entre si, para que un cruce se vea.

### Filtros de seleccion multiple

Eran de un solo valor por decision explicita, documentada en el propio codigo:

```
// Se toma el primero: el listado no tiene filtros de seleccion multiple.
```

Cambiarlo toco cuatro capas: el lector de parametros, el constructor de URLs, el
desplegable y las consultas. Dos decisiones que merecen quedar escritas:

- **`ANY` y no `IN`.** La lista entera viaja como UN parametro, asi que el texto
  de la consulta no cambia con el numero de valores. Con `IN` habria que
  fabricar tantos marcadores como valores, que es justo donde se cuela una
  concatenacion.
- **El desplegable deja de cerrarse al elegir.** Se cerraba porque solo cabia
  una opcion; con varias, cerrarse tras la primera obliga a reabrirlo cada vez.

Se cuentan hasta doce valores por filtro y se descarta lo que no este en la
lista blanca, de modo que una URL con basura mezclada consulta por lo valido en
vez de fallar entera.

### El salto al principio de la pagina

Cada chip, cabecera de orden y boton de fila es un enlace, y Next sube al
principio en cada navegacion. **No habia un solo `scroll={false}` en el
proyecto** salvo en `ListadoBuscador`, cuya cabecera ya explicaba por que hace
falta — y que el resto del listado ignoraba.

La paginacion se queda como estaba, y es deliberado: cambiar de pagina sustituye
la lista entera, asi que quedarse a media altura dejaria a la vista el medio de
unos registros que nadie ha leido.

### Empresas: codigo muerto que dejaba dos callejones sin salida

`empresas.crear` existia en el modelo y no la llamaba nadie: la unica forma de
que existiera una empresa era el seed. El alta de usuarios avisaba de que «hay
que registrar la empresa antes de dar de alta a su persona de contacto» y no
existia el sitio donde registrarla; la ficha de un hook pedia un cliente
obligatorio con el desplegable vacio.

El RIF es unico, asi que el choque se deja en manos de PostgreSQL y se captura
el `23505`. Comprobarlo antes con una consulta daria una falsa sensacion de
seguridad: entre la consulta y la insercion cabe otra alta con el mismo RIF.

### Hooks por usuario, pero solo en la portada

`enCurso`, `ultimaMedida` y `contarPorEstado` consultaban las fichas de toda la
agencia, asi que a alguien le aparecia como pieza en curso el borrador de otro.
Las tres pasan a filtrar por `creado_por`. **El historial NO cambia**: sigue
mostrando lo de todos y permitiendo ver, editar y borrar cualquier ficha.

Queda escrito que filtrar la lectura no protege nada por si solo: `actualizar`,
`borrar` y `guardarNota` siguen yendo por id.

### Usar como plantilla

Lo unico que decidia crear o actualizar era **un input oculto con el id**. En
modo plantilla no se emite, asi que el primer guardado crea y la original queda
intacta. Se copia todo menos el cliente: es el cliente quien decide que regla
aplica el auditor, asi que elegirlo es una decision y no un tramite.

Se corrige de paso un fallo que ya existia: `guardarBorrador` no devolvia el id
de lo que acababa de crear, asi que pulsar Guardar dos veces creaba dos fichas.

### Notificaciones flotantes

Mismo fallo que tenia la contrasena provisional: la alerta se pintaba arriba de
un formulario largo y quien acababa de pulsar el boton estaba abajo.

El detalle que costaria depurar: `useActionState` devuelve un objeto nuevo por
envio, pero dos envios con el mismo resultado tienen el mismo texto. El hook
compara la **identidad** del estado, no su contenido; comparando contenido, el
segundo guardado identico no avisaria.

Los errores de campo no se mueven: siguen pegados a su campo.

### Verificado

| Comprobacion | Resultado |
| --- | --- |
| `tsc --noEmit` y `eslint` | limpios |
| `prueba:auditor` / `prueba:modelos` | 19/19 y 25/25 |
| Paneles del historial: ver, borrar, id inexistente | abre, abre, no abre |
| Dos roles a la vez en el filtro | los dos, y el resumen dice «2 seleccionados» |
| Basura mezclada en un filtro (`?rol=;DROP&rol=admin`) | 200, consulta por el valido |
| Dos territorios en documentacion | 6 + 6 = 12, suma y no intersecta |
| RIF duplicado | la base devuelve 23505, que la action convierte en error de campo |
| Portada de otro usuario | no ve el borrador ajeno; el historial si |
| Plantilla | copia el texto, sin id y sin cliente; editar si lleva los dos |
| Region de avisos | presente en el dashboard, ausente en el login |

---

## Etapa 21 — El banco de referencias se conecta al recorrido

La segunda pasada por la aplicacion desplegada saco seis cosas. Dos eran
funcionalidad que faltaba, dos eran fallos y dos eran ruido en la interfaz.

### El auditor deja de mandarte al modulo de metricas

Al aprobar una pieza, el boton llevaba a `/dashboard/hooks/metricas`, donde
habia que buscar en un desplegable **la misma pieza que se acababa de auditar**.
Ahora se abre un panel lateral con esa ficha fijada, y con el boton de corregir
al lado: al escribir las cifras es cuando se ve que la pieza no funciono.

Los seis campos y el diagnostico de hook rate se sacan a `CamposMetricas`,
compartido por el modulo y el panel. No es factorizar por gusto: el fallo mas
caro de este modulo fue una etiqueta que no correspondia a su columna, y con la
lista duplicada en dos formularios ese error puede volver por un solo lado y
pasar desapercibido. Una lista, un sitio.

El panel se cierra tras `resultado.aprobado`, y el veredicto se recalcula en el
servidor: escribir `?panel=metricas` a mano sobre una pieza suspendida no lo
abre.

### React vaciaba los formularios al fallar la validacion

Es el fallo mas caro de esta tanda y el menos visible. Con `<form action={...}>`,
**React 19 vacia los campos no controlados en cuanto la action termina** — tanto
si guardo como si no. Rellenar ocho campos, olvidar uno y pulsar guardar borraba
los ocho: el mensaje decia cual faltaba, y para entonces no quedaba nada que
completar.

No hay forma de desactivar ese vaciado: la salida sancionada es que el valor
viva en React y no en el DOM. Se anade `useCampos`, que es el patron que el
canvas de hooks ya hacia a mano, y se aplica al alta y edicion de usuarios, a
reglas, aperturas, referencias y a los seis campos de metricas. **Las casillas
tampoco sobrevivian**, asi que los mecanismos de una apertura y el «exigir
prueba» de una regla pasan a estado tambien.

Lo que NO hizo falta tocar: los `Selector` del proyecto ya guardan su valor en
estado propio.

### El banco de referencias estaba desconectado por los dos extremos

Se podian guardar referencias de fuera y no se podia hacer nada mas con ellas.
Faltaban las dos conexiones con el recorrido:

- **Entrada.** Una pieza propia que funciono no se podia guardar. Ahora se hace
  desde el historial, con un panel que llega relleno —el hook, el Insert-Titulo
  y la plataforma ya estaban escritos—, y tambien con una casilla al registrar
  metricas, que es el momento en que se sabe si merece repetirse.
- **Salida.** Para partir de una referencia habia que copiar el texto a mano.
  Ahora abre el canvas con sus tres campos.

Dos decisiones que conviene tener escritas:

`referencias_hook` gana **`ficha_id` con `ON DELETE SET NULL`**, no `CASCADE`.
La lectura de por que funciono un hook vale por si sola, y borrar la pieza no
debe llevarse el aprendizaje del equipo: la referencia se queda y solo pierde de
donde vino. Hay una prueba que lo fija.

Al partir de una referencia **se copian tres campos y ni uno mas**. Una
referencia no tiene objetivo ni audiencia porque es material observado, no una
decision tomada; rellenarlos a ojo seria inventarle a la pieza una intencion que
nadie eligio. El territorio si se **sugiere** al guardar, porque cada objetivo
del catalogo declara con cuales se escribe.

Y la lectura que pide el banco es el **aprendizaje** que el registro de metricas
ya pide: por que funciono. Marcando la casilla, ese campo pasa a obligatorio en
lugar de pedirse dos veces con dos nombres.

### Los avisos tapaban los botones que acababas de pulsar

Abajo a la derecha es exactamente donde los paneles laterales ponen su pie de
acciones. Suben a la esquina superior izquierda, por debajo de las dos
cabeceras y a la derecha del sidebar.

### Titulos que eran enlaces y no se leian

Las tarjetas de reglas y las filas de referencias tenian el titulo enlazado al
mismo panel que ya abre el boton del ojo. Al ser un `<Link>` heredaban del
estilo global `a { color: var(--acento) }`, y en tema claro el acento es
blackberry: **el titulo de una regla salia blackberry sobre navy**, donde no se
lee. Pasan a ser titulos con su color escrito.

### Verificado

| Comprobacion | Resultado |
| --- | --- |
| `tsc --noEmit` y `eslint` | limpios |
| `prueba:auditor` / `prueba:modelos` | 19/19 y 31/31 |
| Panel de metricas sobre ficha aprobada (73/100) | abre con los seis campos |
| `?panel=metricas` sobre ficha suspendida (25/100) | no abre |
| Cada campo de metricas, en los dos formularios | una vez y con su `name` |
| Panel de referencia desde el historial | trae plataforma `tiktok` y territorio `d` sugerido por el objetivo `compartidos` |
| Casilla de referencia en metricas | aparece con ficha elegida, ausente sin ella |
| Canvas desde referencia | plataforma copiada, cliente y objetivo vacios, **sin input `id`** |
| Ficha ya guardada | el historial dice «ya guardada» en vez de ofrecerlo |
| Borrar una ficha con referencia | la referencia sobrevive con `ficha_id` a null |
| Titulos de reglas y referencias | ya no son enlaces |

### Lo que hay que ejecutar en Neon

```sql
DO $referencias$
BEGIN
  ALTER TABLE referencias_hook
    ADD COLUMN IF NOT EXISTS ficha_id INTEGER REFERENCES fichas_hook(id) ON DELETE SET NULL;
END
$referencias$;

CREATE INDEX IF NOT EXISTS referencias_ficha_idx
  ON referencias_hook (ficha_id) WHERE ficha_id IS NOT NULL;
```

Es idempotente y ya esta dentro de `db/schema.sql`, asi que un `sql:produccion`
nuevo lo incluye.

---

## Etapa 22 — Segunda pasada sobre la app desplegada

Cinco cosas, tres de ellas fallos. Uno tenia riesgo de datos y no lo habia
reportado nadie.

### El scroll: se arregla en la raiz, no sitio por sitio

La pasada anterior puso `scroll={false}` en los enlaces del listado y **no toco
ni un solo `BotonEnlace`** — que es donde viven los «Cerrar», «Cancelar» y
«Listo» de paneles y modales. De sus 33 usos, 29 se dejaban el scroll.

Marcar veintiocho sitios a mano ya se habia intentado y fallado, asi que el
arreglo va en el componente: **`BotonEnlace` deja de subir la pagina por
defecto**, al reves que `<Link>`. En esta app un boton-enlace es casi siempre
una accion *dentro de* la misma pantalla; los nueve que si cambian de pantalla
lo piden a mano con `scroll`. El `<Link>` pelado no se toca, asi que sidebar,
migas y tarjetas de navegacion siguen igual.

### React vaciaba los formularios, segunda parte

Ya estaba resuelto en la etapa 21, pero conviene dejar escrito el corolario que
aparecio aqui: **`useState(prop)` solo lee la prop al montar**. Es el mismo
malentendido con otra cara, y es lo que hacia que en Metricas pulsar una fila
de la lista no rellenara nada si ya estabas en la pantalla. Solo funcionaba
recargando, asi que parecia que funcionaba.

### Tres estados, dos ramas

`EstadoFicha` tiene tres valores y **dos sitios distintos** ramificaban sobre
dos, asi que una ficha auditada se despedia como si fuera un borrador: el modal
decia «es un borrador sin publicar» —falso por partida doble, porque ya estaba
auditada y porque el modulo de metricas llama publicadas a esas— y el aviso
decia «Borrador borrado.»

Lo interesante estaba en el modelo: el `DELETE ... RETURNING estado` **ya traia
el estado** y lo aplastaba a `estabaMedida: boolean`. La informacion se leia y
se tiraba, y por eso la action no podia distinguir aunque quisiera. Ahora
devuelve el estado y cada capa compone sus tres textos.

### El auditor montaba el resultado dos veces

Al llegar desde el canvas, la pagina pintaba la nota real arriba y, debajo, un
formulario vacio con un `ResultadoNeutro` que decia «el score aparece solo
despues de pulsar Auditar» — justo debajo de un score que ya existia. De ahi la
sensacion de que habia dos auditores y el de abajo no habia evaluado nada.

Ahora la pieza **aterriza en el propio auditor**: el formulario llega relleno y
el veredicto al lado, sembrando `useActionState` con el resultado que el
servidor ya calculo. Funciona porque `useAvisoDeAccion` compara la identidad
del estado y sale en el primer render, asi que sembrarlo no dispara un aviso
fantasma.

Dos detalles que costaria depurar:

- **La prueba viaja oculta.** El formulario no la muestra —no es texto del
  hook— pero el auditor la mira si la regla del cliente exige prueba visible.
  Sin ese input, volver a pulsar «Auditar» ahi daria una nota distinta de la
  guardada.
- **`key` en la page.** El auditor es de cliente y sus `useState` solo leen las
  props al montar; sin `key`, ir de `?ficha=1` a `?ficha=2` no re-sembraria
  nada. Es el mismo `useState(prop)` de siempre.

Y nada de resultado se pinta hasta que hay auditoria: la segunda columna solo
existe cuando hay algo que poner en ella.

### Las dos listas de nueve no dicen lo mismo

Parecia que el Filtro de calidad duplicaba los nueve controles del algoritmo.
Puestas una al lado de otra, **solo se repite una** de las dieciocho, el
Insert-Titulo de seis palabras: el auditor mira **el texto del hook** y el
filtro mira **la pieza entera antes de rodar** —si el contenido puede demostrar
lo que promete, si el primer fotograma aporta algo en silencio, si el tono es
de este cliente—. Seis de las nueve **no se pueden automatizar**: la app no
tiene el video, y lo unico comprobable seria que el campo de la ficha este
escrito, que no es lo mismo que este bien.

Asi que las dos se quedan como estan. Lo que cambia es que el filtro **baja
dentro del auditor** y solo aparece con resultado, tambien tras auditar un
texto suelto — antes se pintaba siempre, incluso con la pantalla en blanco.

### El riesgo de datos que nadie habia visto

En Metricas, cambiar de pieza **no limpiaba nada**. El estado vivia en tres
nidos —los dos campos del formulario, los cinco de `useCampos` y el checkbox
del banco dentro de `CamposMetricas`, y el territorio dentro de su `Selector`—
y ninguno se enteraba. Con el desplegable costaba provocarlo; con las filas
clicables era facil **registrar las cifras de una pieza sobre otra**.

Se limpia por dos caminos, y hacen falta los dos: los del padre se ajustan
**durante el render** (no en un efecto, para que no haya un fotograma con las
cifras viejas bajo la cabecera nueva), y el resto por remontaje con `key`.

> **La `key` NO puede ir en la page.** Al guardar, la ficha pasa a `medida` y
> sale de las pendientes, asi que la ficha elegida vuelve a ser nula: si la
> `key` estuviera sobre `FormularioMetricas`, el componente se destruiria con
> `useActionState` dentro y **el aviso de exito se perderia**. Va sobre
> `CamposMetricas`, un nivel mas abajo.

### Verificado

| Comprobacion | Resultado |
| --- | --- |
| `tsc --noEmit` y `eslint` | limpios |
| `prueba:auditor` / `prueba:modelos` | 19/19 y 32/32 |
| Modal de borrado en los tres estados | tres textos y tres rotulos de boton distintos |
| Auditor sin auditar | sin nota, sin controles, sin filtro, a una columna |
| Auditor con ficha aprobada (73) | una sola tarjeta de resultado, textarea relleno, «Registrar sus metricas» |
| Auditor con ficha suspendida (25) | igual, pero sin «Registrar sus metricas» |
| Prueba oculta con ficha | presente en el formulario |
| Metricas sin pieza | estado vacio, sin campos que no se puedan guardar |
| Metricas con `?ficha=22` | cabecera de la pieza, campos, fila marcada «Rellenando» |
| Metricas con `?ficha=9999` | se rechaza y cae al estado vacio |
| Desplegable de fichas | ya no existe en ninguna de las tres |

### Dos pruebas que dependian de una base intacta

`prueba:modelos` empezo a fallar sin que nada estuviera roto, por datos creados
desde la interfaz. Se arreglan las dos causas: la del sector retira **todas**
las reglas de cliente y no solo la primera, y la referencia del seed se busca
por ser **la que no viene de ninguna ficha** —guardar una ficha en el banco
copia su hablado, asi que el texto ya no basta para identificarla—.

---

## Etapa 23 — Trazabilidad, cierre de piezas y el tema

Cinco cosas pedidas sobre la marcha, y una de ellas cambia una regla de
negocio.

### Auditar desde la cola, como en metricas

Las tarjetas de «Esperan auditoria» llevaban al canvas para pulsar alli un boton
que solo necesitaba el texto: para auditar habia que **salir del auditor**. Ahora
la fila carga la pieza en el propio auditor, rellena los dos campos y muestra su
veredicto.

**El clic no escribe en la base.** Carga y evalua. Un enlace de una lista que
guardara se disparia con el boton de atras, con la precarga del navegador y con
un clic sin querer. Para que el borrador salga de la cola hay un boton explicito
de auditar y guardar, con «probar sin guardar» al lado.

Guarda tambien el hablado y el Insert-Titulo, no solo la nota: una nota
calculada sobre un texto que no se guarda no corresponde a lo que la ficha dice.

### Quien ha tocado cada ficha

En el historial cualquiera edita la ficha de cualquiera, y la ficha solo sabia
quien la creo y la fecha del ultimo cambio. Se anade `ediciones_ficha`, un
registro de **solo anadir** con quien, cuando y que hizo.

Lo escriben las **actions**, que son las que conocen la sesion; los modelos no,
igual que pasa con `creado_por`. Cae con la ficha por CASCADE, al reves que el
banco de referencias: un registro de cambios no significa nada sin la pieza de
la que habla.

No guarda que campos cambiaron. Eso serviria para deshacer, que es otra
funcionalidad; la pregunta aqui es quien ha metido mano.

Un detalle que costaria depurar: la hora se **fija** a `America/Caracas`. Esto
se pinta en el servidor, que corre en UTC en Docker y en Ohio en produccion, asi
que sin fijarla un cambio hecho a las dos de la tarde se leia a las seis. Una
hora equivocada en un registro de cambios es peor que no tenerlo.

Se confirma de paso, y queda fijado con una prueba, que **editar no cambia de
autor**: `creado_por` no esta entre las columnas que escribe `actualizar`.

### Una pieza medida queda cerrada

Lo pide redes. Cuando una pieza tiene sus metricas ha llegado a su ultimo
estado, y lo que se guarda es el **par completo** —lo que se dijo y lo que
paso—. Cambiar el hook despues dejaria unas cifras describiendo un texto que ya
no existe, y el aprendizaje de la cuenta se construye sobre ese par.

Se bloquea en el **servidor**: guardar el borrador, auditar desde el canvas,
auditar desde el auditor y registrar numeros comprueban el estado contra la base
antes de escribir. Esconder botones no basta — una action es un POST y quien
conozca el id puede llamarla igual.

La interfaz deja de ofrecerlo **y dice por que**, que no es lo mismo que dejar
un hueco: candado en la fila, aviso en el detalle, la pantalla del canvas
sustituida por una explicacion, y el auditor sin boton de guardar. En los cuatro
sitios se ofrece usarla como plantilla, que es la salida cuando hace falta otra
version.

Efecto colateral asumido: **un numero mal tecleado ya no se corrige**. Deja de
ser cierto que «registrar dos veces actualiza», y ese texto se corrige.

### La portada lista, y por orden

`enCurso` ordenaba `(estado = 'auditada') DESC` y devolvia **una sola**: la
portada podia destacar una pieza sin relacion con lo que se estaba escribiendo,
y las demas no aparecian. Ahora llegan por orden de creacion, la ultima primero,
con su avance y su nota.

### El navy fijo no era tema, era un color

Las tarjetas de inicio, documentacion y manual iban en `bg-navy`. El numero lo
dice todo: en tema oscuro eso es **#051a2a sobre un fondo #041521**, o sea la
tarjeta desaparece, mientras el resto de la app usa una superficie que si
contrasta. Pasan a los tokens del tema.

El dorado se queda solo donde el contrato lo permite —sobre navy, en las
pildoras de Insert-Titulo—. Y se corrige el mismo fallo de siempre en el detalle
de una regla, que pintaba dorado sobre fondo claro.

### Verificado

| Comprobacion | Resultado |
| --- | --- |
| `tsc --noEmit` y `eslint` | limpios |
| `prueba:auditor` / `prueba:modelos` | 19/19 y 40/40 |
| Cola del auditor | la fila carga la pieza, rellena los campos y marca la fila |
| Panel de cambios | tres lineas, con nombre y hora de Caracas |
| Canvas sobre una medida | sin formulario; explicacion y salida por plantilla |
| Historial sobre una medida | candado en vez de editar |
| Auditor sobre una medida | sin guardar, sin corregir y sin metricas |
| Plantilla desde una medida | si abre el formulario, que es la salida |
| Las tres pantallas del tema | sin `bg-navy` salvo las pildoras de Insert-Titulo |

### Lo que hay que ejecutar en Neon

Se suma una tabla a las dos migraciones que ya estaban pendientes. Todo esta en
`db/schema.sql`, asi que un `sql:produccion` nuevo lo incluye.

```sql
CREATE TABLE IF NOT EXISTS ediciones_ficha (
  id         SERIAL      PRIMARY KEY,
  ficha_id   INTEGER     NOT NULL REFERENCES fichas_hook(id) ON DELETE CASCADE,
  usuario_id INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  accion     TEXT        NOT NULL,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ediciones_accion_valida CHECK (
    accion IN ('creada', 'editada', 'auditada', 'medida')
  )
);

CREATE INDEX IF NOT EXISTS ediciones_ficha_idx
  ON ediciones_ficha (ficha_id, creado_en DESC);
```

Las fichas anteriores no tienen lineas, y el panel lo dice en lugar de fingir
que no paso nada.

---

## Etapa 24 — Modulo de empresas

Las empresas se podian crear desde un panel escondido en el canvas de hooks, y
una vez creadas **no habia forma de verlas, editarlas ni retirarlas**. El
modelo tenia `listarActivas` y `crear`, lo justo para alimentar un desplegable.

### La division con Usuarios

Aqui estan las **cuentas** que atiende la agencia; en Usuarios, las **personas**
que las representan. Una empresa no da acceso a nada por si misma: lo que da
permisos es vincularle un usuario, y eso sigue siendo cosa del otro modulo.

La ficha de una empresa enlaza a sus contactos con `?empresa=N`. Ese filtro ya
lo admitia el modelo de usuarios y no se ofrecia por ningun sitio.

Se probo primero **sin chip**, con el razonamiento de que era un filtro que
solo se alcanza por enlace y no hacia falta ofrecerlo. Salio mal: al pulsar
«contactos» la tabla llegaba recortada y **nada en la pantalla decia por que**.
El parametro estaba en la URL y en ningun otro sitio; para volver a ver la
lista entera habia que editar la barra de direcciones a mano.

Asi que la empresa tiene chip, y va detras del area de la agencia porque es lo
mismo para un cliente que el area para un trabajador. Sus opciones salen de
`empresas.nombres()`, que devuelve **todas, tambien las desactivadas** —al
reves que `listarActivas`, que alimenta las altas. Un desplegable de alta
ofrece lo que se puede elegir; uno de filtro tiene que poder ponerle nombre a
lo que ya viene en la URL, y a los contactos de una empresa cerrada se sigue
llegando desde su ficha.

De paso, `ListadoFiltros` dejo de creerse la URL a pies juntillas. Antes leia
el parametro en crudo, asi que un `?empresa=999` escrito a mano pintaba un chip
que anunciaba «999» sobre una tabla sin filtrar —las pages ya descartaban el
valor antes de consultar—. Ahora el chip descarta lo que su propio grupo no
sabe pintar, y las dos mitades cuentan la misma historia.

### El alta pasa a ser de administradores

Nacio abierta al cargo `redes` por una razon buena: no existia otro sitio donde
registrar una empresa, y quien escribe hooks era quien se topaba con que faltaba
el cliente. Con el modulo ya hecho, la cartera vuelve a donde corresponde.

El boton de «Nueva empresa» del canvas **no desaparece**. Quitarlo dejaria el
mismo callejon sin salida de antes —un desplegable al que le falta un cliente y
ninguna pista— y mandar a redes al modulo seria peor, porque el proxy le corta
la ruta. Asi que el boton se queda y, segun quien lo pulse, lleva al modulo o
abre un modal que dice a quien pedirselo.

### Dos decisiones de datos

**Los enlaces son columnas fijas, no una tabla puente.** Sitio, Instagram,
TikTok, Facebook, YouTube y LinkedIn: la lista es corta y estable, y lo que se
guarda es un enlace POR plataforma, no una coleccion de enlaces sueltos. Con una
tabla aparte habria que hacer un JOIN y decidir un orden para pintar cinco
campos que siempre son los mismos cinco.

La lista vive en `validaciones` y la recorren **tanto la validacion como el
formulario**. Con dos copias, anadir una red en un sitio y no en el otro deja un
campo que se escribe y no se guarda. Se piden como URL completa: un handle
suelto no se puede abrir, y adivinar el dominio para completarlo es inventarse
un dato.

**Los recuentos van por lote.** Contactos y piezas se piden para la pagina
visible, como los demas del proyecto. Con un JOIN en la consulta principal
habria que agrupar por todas las columnas de la empresa para pintar dos numeros
y, peor, los dos agregados se multiplicarian entre si: una cuenta con 3
contactos y 4 piezas daria 12 filas.

### No se borra, se desactiva

`clientes` y `fichas_hook` referencian a `empresas` con ON DELETE RESTRICT, asi
que una cuenta con personas o con piezas no se puede borrar sin perder su
historia. La confirmacion dice justo lo que NO se pierde —sus piezas siguen en
el historial, sus contactos conservan la cuenta—, que es lo que de verdad quita
el miedo a pulsar.

Editar **no toca `activo`**: si viajara en el mismo UPDATE, guardar el telefono
podria reactivar una cuenta que alguien cerro a proposito.

### Un solo formulario para alta y edicion

Al contrario que en usuarios, aqui no hacen falta dos. Alli el alta y la edicion
piden cosas distintas —el tipo se elige al crear y no se cambia, la contrasena
solo existe en el alta—; una empresa se describe con los mismos campos el primer
dia y el ultimo. Con dos formularios habria dos copias de la lista de enlaces
esperando a desincronizarse.

### Verificado

| Comprobacion | Resultado |
| --- | --- |
| `tsc --noEmit` y `eslint` | limpios |
| `prueba:auditor` / `prueba:modelos` | 19/19 y 52/52 |
| `/dashboard/empresas` como admin | 200, con listado, filtros y buscador |
| `/dashboard/empresas` como redes | 307: el proxy lo corta |
| Panel de alta | los once campos, incluidos los seis enlaces |
| Paneles de ver, editar y estado | los tres abren con su contenido |
| «Nueva empresa» en hooks siendo redes | modal explicando que lo hace un admin |
| Enlaces sin rellenar | quedan NULL, no cadena vacia |
| Busqueda | encuentra por nombre y por RIF |
| Desactivar | la saca de las activas y la deja en el filtro |

### Lo que hay que ejecutar en Neon

Se suma a las tres migraciones que ya estaban pendientes. **Ningun cambio pisa
datos existentes**: las seis columnas son TEXT anulables sin valor por defecto,
asi que las empresas que ya hay quedan con NULL en todas.

```sql
DO $redes$
BEGIN
  ALTER TABLE empresas ADD COLUMN IF NOT EXISTS sitio_web TEXT;
  ALTER TABLE empresas ADD COLUMN IF NOT EXISTS instagram TEXT;
  ALTER TABLE empresas ADD COLUMN IF NOT EXISTS tiktok    TEXT;
  ALTER TABLE empresas ADD COLUMN IF NOT EXISTS facebook  TEXT;
  ALTER TABLE empresas ADD COLUMN IF NOT EXISTS youtube   TEXT;
  ALTER TABLE empresas ADD COLUMN IF NOT EXISTS linkedin  TEXT;
END
$redes$;

CREATE INDEX IF NOT EXISTS empresas_activo_idx ON empresas (activo);
CREATE INDEX IF NOT EXISTS empresas_nombre_idx ON empresas (lower(nombre));
```

Los dos indices son nuevos porque el listado filtra por estado y ordena por
nombre, y hasta ahora ninguna de las dos columnas tenia uno: la tabla se leia
entera.

---

## Etapa 25 — Preparacion del modulo de finanzas: Google Drive

Primer paso hacia el modulo de finanzas. El plan completo vive fuera de este
repositorio, en `appFacturas/docs/integracionFinanzasConejo.md`. De sus
decisiones tecnicas quedaron cerradas tres:

| Decision | Resultado |
| --- | --- |
| Seguridad por fila | La app pasara a conectarse con un rol sin privilegios, `conejo_app` |
| Quien opera finanzas | El rol `admin` y el cargo `administracion` |
| Comprobantes de pago y de retencion | Google Drive, carpeta `ConejoApp/Comprobantes` |

### Por que un cliente OAuth y no una cuenta de servicio

Una cuenta de servicio no tiene cuota de almacenamiento propia: solo puede
guardar dentro de una unidad compartida de Google Workspace. Con un cliente
OAuth los archivos pertenecen a la cuenta que autoriza y ocupan su espacio.

El alcance es `drive.file`: la aplicacion solo ve lo que ella crea. De ahi sale
una regla que no es obvia: **la carpeta la crea el script, no una persona**. Una
carpeta hecha a mano desde la web de Drive seria invisible para la aplicacion.

No entra ninguna libreria. La API de Drive es HTTP y Node trae `fetch`.

### Construido

- `scripts/driveProbar.mjs` y `npm run drive:probar`. Se ejecuta en el host,
  porque abre un puerto local para recibir la respuesta de Google. La primera
  vez pide la autorizacion en el navegador y guarda el refresh token en el
  `.env`; despues crea la carpeta, guarda su id, sube un archivo de prueba, lo
  lee de vuelta y lo borra.
- Cuatro variables nuevas en `.env.example`: `DRIVE_CLIENT_ID`,
  `SECRET_DRIVE_KEY1`, `DRIVE_REFRESH_TOKEN` y `DRIVE_CARPETA_COMPROBANTES_ID`.

Va como `.mjs` y no como `.mts`: el Node del host es 22.17, que todavia no
ejecuta TypeScript sin una bandera.

### Verificado

| Comprobacion | Resultado |
| --- | --- |
| El script arranca y se detiene si faltan variables | OK |
| Autorizacion en el navegador con el cliente OAuth | OK, guarda el refresh token |
| Creacion de `ConejoApp/Comprobantes` | OK |
| Subir, leer de vuelta y borrar un archivo | OK, el contenido coincide |
| Segunda ejecucion, sin navegador, renovando con el refresh token | OK, reutiliza la carpeta |

### Lo que queda anotado

- Mientras la pantalla de consentimiento de GCP este en «Testing», Google
  caduca los refresh tokens a los 7 dias. Hay que publicarla.
- De momento se autorizo con el Drive personal del responsable. Pasara a una
  cuenta compartida del estudio, y el cambio hay que hacerlo antes de recibir
  comprobantes reales: los archivos ya subidos no se mueven solos.
- Las cuatro variables de Drive faltan en Vercel.
- El plan de integracion se copio a `docs/integracionFinanzas.md`, que pasa a
  ser la copia que se mantiene.

---

## Etapa 26 — El alcance pasa a ser el portal completo

Lo que iba a ser un modulo de finanzas pasa a ser el flujo entero del paquete
`appFacturas`: brief, presupuesto, proyecto con piezas y bateria de cinco
fases, revision del cliente, y despues proforma, factura y pagos. El plan
maestro es `docs/planIntegracionPortal.md`; `docs/integracionFinanzas.md`
queda como su capitulo de finanzas.

Tres decisiones nuevas, ademas de las de la etapa 25:

- **Servicios externos simulados con JSON** mientras la aplicacion viva en
  Vercel, que es temporal. Cada servicio va detras de un adaptador con dos
  implementaciones; lo que cambia en cada llamada va a la base, porque el disco
  de Vercel es de solo lectura y un JSON ahi solo se puede leer.
- **Aprovechar la integracion para cerrar huecos de seguridad.** El plan lista
  once, comprobados en el codigo. El mas serio: las actions de Usuarios y
  Empresas deciden con el token, asi que un administrador desactivado conserva
  sus poderes hasta ocho horas.
- **RLS tambien fuera de finanzas**, para aislar a un cliente de otro en
  proyectos y briefs. De ahi sale `pieza_contenido` como tabla aparte: RLS
  decide por fila y no por columna, y es la forma de que la propia base le
  niegue el texto de una pieza al cliente antes de la fase 5.

No se construyo nada en esta etapa: es solo el plan. Las preguntas que hay que
responder antes de empezar estan en su seccion 11.

### Segunda revision del plan, el mismo dia

Se cerraron decisiones que cambian la etapa 1:

- **Sesiones.** El token unico de 8 horas pasa a ser un acceso de 30 minutos
  mas un token de renovacion guardado (su hash) en una tabla `sesiones`. Un
  modal permite continuar sin perder la pantalla. Queda escrito que la
  renovacion sola no cierra el hueco, solo lo acorta: lo que lo cierra es que
  las guardias lean de la base, y con el usuario su sesion.
- **Auditoria.** Tabla `auditoria` de solo anadir, para toda la aplicacion.
- **Cargos.** Se anade `produccion`; `cuentas` ve solo sus empresas asignadas.
- **Tasa del BCV.** Se comprobo que la pagina trae la tasa en el HTML, asi que
  no hace falta un navegador: basta una peticion. Desde Node falla la
  verificacion TLS porque el BCV no envia su certificado intermedio; se resuelve
  entregandoselo a la peticion, no apagando la verificacion.
- **Correo.** Por la API de Gmail con el mismo cliente OAuth.
- **Neon.** `neondb_owner` tiene `BYPASSRLS`: el rol sin privilegios es
  obligatorio.

### Tercera revision del plan

Se fija el modelo de trabajo, que es lo que mas cambia respecto al paquete:

- **Tareas dentro de las fases.** Las cinco fases se quedan fijas, porque son
  lo que ve el cliente y lo que hace calculable el avance; el trabajo interno
  se desglosa en tareas que cuelgan de ellas y se asignan a personas. Quien
  hace cada cosa deja de depender del cargo.
- **Catalogo de servicios.** Lo que el cliente puede pedir es una lista
  cerrada, y cada servicio trae su brief, sus piezas y sus tareas sugeridas.
- **Herramientas.** Hooks deja de ser un modulo suelto: es la primera
  herramienta, y se conecta al flujo a traves de las tareas.
- **Menu por secciones**: General, Trabajo, Herramientas, Finanzas, Sistema y
  Mi espacio.

Quedan aceptados los seis ajustes al modelo de finanzas y la verificacion en
dos pasos, que no usa ningun servicio de Google: es un estandar abierto que se
calcula con `node:crypto`.
