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

Hoy existen: login, inicio, Mi perfil, Usuarios, Empresas (con sus ejecutivos
asignados), Auditoria, Bandeja de salida, Tablero, Proyectos (piezas,
bateria de fases y tareas), Mi trabajo, Briefs (la bandeja de cuentas, con los
enlaces para prospectos), Presupuestos y Proformas (para el admin y
administracion), para los clientes Mis proyectos (revision en la fase 5), Mis
briefs y Facturacion (sus presupuestos, proformas y facturas, el estado de
cuenta y el reporte de pagos), Facturas, Cobranza y Ajustes de finanzas para
el admin y administracion, el brief de un prospecto
por su enlace (`/brief/[token]`, sin cuenta), y el modulo de Hooks.
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
| `docs/verificacionManual.md` | Lo que el responsable prueba a mano, etapa por etapa. Cada etapa anade su seccion al cerrarse |
| `docs/reglasBateria.md` | Reglas de proyectos, piezas, fases y tareas, extraidas del paquete. Para la etapa 3 sustituye a `appFacturas` |
| `docs/despliegueProduccion.md` | Guia viva del despliegue: SQL, variables y pasos, por etapa |
| `docs/informeIntegracion.md` | Que hace la aplicacion hoy, como se probo y la guia para probarla |
| `docs/guiaFinanzas.md` | Como funciona finanzas de punta a punta, para el equipo: estados, quien hace que, tasa, pagos y cobranza |
| `docs/informePendientes.md` | Lo que falta para usarla de verdad, por momento y con quien aporta cada dato |
| `docs/planPiloto.md` | Como se hace la prueba con un cliente real: preparacion, semanas, que observar y como volver atras |
| `docs/pendientesIntegracion.md` | Valores de ejemplo que hay que sustituir, decisiones del negocio que faltan y lo que no se hizo. Cada etapa lo actualiza; de aqui sale el informe final |
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
src/lib/portal/   catalogo de servicios, reglas de la bateria y de los briefs, como
                  funciones puras; llenadoBrief y enlaceBrief, lo comun a cliente
                  y prospecto
src/lib/externos/ adaptadores de servicios externos, con modo simulado y real
src/lib/correos/  lo que dice cada correo, como funciones puras
src/lib/finanzas/ criterio de finanzas como funciones puras, y sus tareas
src/app/api/cron/ tareas programadas: sin sesion, protegidas por CRON_SECRET
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
- Las tablas de `portal` y `finanzas` llevan seguridad por fila. En sus
  modelos el `ejecutor` es **obligatorio**, y quien los llama lo saca de
  `conSesion`. Cada tabla nueva trae sus politicas y su comprobacion en
  `prueba:permisos`.
- Si la politica de una tabla tiene que mirar otra tabla con politicas, lo
  pregunta a una funcion `SECURITY DEFINER` de `portal` (`gestiona_empresa`,
  `gestiona_pieza`, `trabaja_en_pieza`…). Escrito directamente en la politica,
  las tablas se consultarian unas a otras en bucle.
- El avance de una pieza o de un proyecto no se guarda: sale de
  `portal.v_progreso_pieza` y `portal.v_progreso_proyecto`. Las reglas de cuando
  se mueve una fase viven en `src/lib/portal/fases.ts`, y la action bloquea la
  pieza (`piezas.bloquear`) antes de decidir.
- Con seguridad por fila, un `INSERT … RETURNING` exige ademas permiso de
  lectura sobre la fila escrita. Si quien escribe puede no poder leerla, el
  identificador se reserva antes con `nextval`.
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
  Lo vigila `tests/unitarias/guardias.spec.ts`: una action, page o ruta de la
  API sin guardia lo hace fallar. Una excepcion nueva se anade alli con su
  motivo, y las rutas publicas del proxy tambien estan fijadas en esa prueba.
- `prueba:permisos` vigila ademas la estructura: toda tabla de `portal` y
  `finanzas` con seguridad por fila, `DELETE` solo en la lista de
  `probarEstructura` y toda funcion `SECURITY DEFINER` con su `search_path`.
  Una tabla que necesite otra cosa se anade a esa lista, con su motivo.
- El token sirve para enrutar; lo que decide que se muestra **y que se puede
  hacer** es el dato fresco de la base. Todas las guardias (`requerirUsuario`,
  `requerirRol`, `requerirAdmin`, `requerirCargo`) leen de ella.
- Quien tiene un token valido pero ya no puede entrar sale por
  `/login?motivo=…`, nunca por `/login` a secas: el proxy lo devolveria al
  panel y entraria en bucle. Los motivos son una lista cerrada en el login.
- La autoridad de una sesion vive en la tabla `sesiones`, no en el token. Lo
  que cambie que puede ver o hacer alguien **revoca sus sesiones**
  (`src/models/sesiones.ts`); no basta con cambiar el dato.
- `renovarSesion` y `verificarSegundoPaso` son las unicas actions sin guardia
  de sesion, junto con las de `src/actions/enlaceBrief.ts`, y es a proposito:
  atienden a quien aun no tiene sesion. Las del enlace tienen por guardia el
  token, que cada una comprueba antes de nada con `enlaceValido`
  (`src/lib/portal/enlaceBrief.ts`). Ninguna otra puede saltarsela.
- Un prospecto no tiene usuario: ante la base actua con `conEnlace`, que
  declara el rol `prospecto` y su enlace (`app_enlace_id()`). Una tabla que
  deba aceptarlo lo nombra en su politica, como la campana y la bandeja de
  salida; las demas no lo dejan pasar. Sus correos llevan su `enlace_id` y se
  entregan con `entregarCorreos({ enlaceId }, …)`.
- El token de un enlace de brief **se muestra una vez** y no sale por correo:
  la base guarda su hash. Un enlace vencido, revocado o inexistente responde
  lo mismo.
- La verificacion en dos pasos **se pide por defecto**: las guardias mandan a
  `/dos-pasos` a quien no la activo ni la omitio. Solo esa page y sus actions
  piden `requerirUsuario({ sinResolverDosPasos: true })`.
- El secreto de los dos pasos se guarda cifrado (`src/lib/cifrado.ts`) y los
  codigos de respaldo como hash. Ninguno de los dos se anota, se registra ni
  se devuelve fuera de la action que los genera.
- Una action que devuelve algo que solo se muestra una vez (codigos de
  respaldo) **no revalida** la pantalla: al repintarse se perderia.
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
- Una herramienta se abre desde su tarea con `?tarea=`: el proxy deja pasar
  esas rutas aunque el cargo no toque (`RUTAS_POR_TAREA`), y la page decide
  con su guardia (`requerirHooks`). Sin el parametro, la regla del cargo es
  la de siempre.
- Un archivo de una pieza solo se entrega por `/api/archivos/[versionId]`,
  que decide con la sesion y las politicas de `versiones`. Lo que no se puede
  ver responde **404, nunca 403**, y el id de Drive no sale del servidor.
- El `matcher` de `src/proxy.ts` solo excluye por extension lo que cuelga de
  la raiz y `/images`. Una ruta publica nueva se declara en el proxy, no se
  cuela por el `matcher`.
- **Ningun correo lleva contrasenas, tokens ni codigos.** La bandeja de salida
  guarda el texto completo de cada uno.
- Una **notificacion** es lo que se lee en la campana y vive en la base
  (`portal.notificaciones`, `src/lib/notificaciones.ts`). Un **aviso** es el
  mensaje flotante que confirma una accion (`ProveedorAvisos`). No se mezclan
  los nombres. Las notificaciones se escriben dentro de `conSesion`, en la
  transaccion del cambio, y su tipo sale de `TipoNotificacion`.
- **Nadie se avisa a si mismo**: `notificaciones.crear` descarta a
  `app_usuario_id()`, asi que una action pasa a todos los destinatarios y la
  base quita a quien la provoca. Lo que cambia algo de otro le avisa: la tabla
  «Quien se entera de que» (abajo) es la referencia, y un evento nuevo se
  anade alli. Para los ejecutivos de una empresa se usa
  `notificarAEjecutivosDe` (funcion `portal.ejecutivos_de_empresa`):
  administracion y el cliente no leen las asignaciones.
- Una tarea programada vive en `src/app/api/cron/`, comprueba `CRON_SECRET`
  antes de nada y escribe con `conSistema`, nunca con una identidad
  inventada. Si una tabla debe aceptarla, su politica nombra el rol
  `sistema`.
- El dinero y las tasas viajan como **texto decimal** y se guardan en
  `NUMERIC`. No pasan por `number`.
- Los importes de presupuestos y proformas **los calcula la base** al guardar
  los renglones (`finanzas.guardar_renglones`). La aplicacion no escribe
  totales ni renglones por su cuenta: no tiene permiso. La vista previa del
  editor (`src/lib/finanzas/calculo.ts`) sigue las mismas reglas con enteros
  escalados, y `prueba:permisos` compara las dos.
- Una factura **solo nace con `finanzas.emitir_factura`**: numero, control,
  tasa, importes en bolivares y copias congeladas del emisor y del cliente.
  La aplicacion no inserta facturas ni sus renglones, y una emitida solo se
  anula (`finanzas.anular_factura`) o se marca impresa. Los proximos numeros
  se cambian con `finanzas.fijar_numeracion`, que solo deja subir.
- Lo que ve quien imprime y quien paga sale por rutas del servidor que deciden
  con la sesion: `/api/facturas/[id]/pdf`, `/api/formatos/[id]/calibracion` y
  `/api/pagos/[id]/comprobante`. Lo que no se ve responde 404.
- Un comprobante de pago se sube con `subirArchivo({ carpeta: "comprobantes" })`
  antes de la transaccion, como las versiones de las piezas.
- Lo que nace con valores de ejemplo se anota en `docs/pendientesIntegracion.md`.
- Un proyecto lo lleva **solo un ejecutivo de cuentas**; los
  administradores no. Si lo abre un ejecutivo, lo lleva el. **Solo un
  administrador elige o cambia quien lo lleva**, y puede darselo a un
  ejecutivo de otra cuenta (`proyectos.ejecutivosPosibles` los marca
  `deOtraCuenta`). Ese ejecutivo gestiona ese proyecto y nada mas de la
  empresa: `portal.gestiona_proyecto` (empresa asignada o `ejecutivo_id`) lo
  aplican las politicas de proyectos y, por `gestiona_pieza`, todo lo que
  cuelga de las piezas; los briefs siguen por `gestiona_empresa`. Un trigger
  impide a quien no es admin cambiar `ejecutivo_id`. Quitarle la empresa a un
  ejecutivo no le quita los proyectos que lleva. Quien lo lleva hoy puede
  seguir aunque ya no se pudiera elegir.
- Las decisiones del brief (aceptar, convertir en presupuesto, descartar) se
  confirman en una ventana (`?decision=`, `ConfirmarDecisionBrief`) que dice
  antes que pasara y muestra despues el resultado, con los datos de acceso si
  nacio una cuenta. Las dos que hacen cliente a un prospecto le crean la
  cuenta (`convertirSiEsProspecto`, que decide por la cuenta y no por la
  empresa), y esa cuenta nace pudiendo aprobar piezas y ver las finanzas; las
  que crea el administrador en Usuarios nacen sin permisos.
- La version que vera el cliente se elige en la fase 4
  (`VersionParaCliente`, dentro de su tarjeta); la tarjeta Versiones sirve
  para subir en cualquier fase.
- Los comentarios internos de una pieza van por fase (y, si se quiere,
  sobre una tarea de esa fase); los que no tienen fase son los generales.
- Finanzas lo opera `requerirFinanzas` (admin o cargo `administracion`). El
  cliente entra con `requerirFinanzasDeEmpresa`, que exige su casilla
  `puede_ver_finanzas`. Un modulo del menu que dependa de esa casilla declara
  `permiso: "finanzas"`.
- No se desactiva la verificacion TLS para ningun servicio. Si a un servidor
  le falta un certificado intermedio, se le entrega con la opcion `ca`.
- Un servicio externo se llama solo a traves de su adaptador de
  `src/lib/externos/`, y nunca dentro de una transaccion de la base. Para el
  correo: `encolarCorreo` dentro de `conSesion`, `entregarCorreos` despues.
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
- **Ningun `<select>` nativo**: su lista la pinta el sistema operativo y no
  sigue el tema. Los desplegables son `Selector` (`src/components/ui`),
  controlado con `valor` + `onCambio` o no con `valorInicial`; `etiquetaOculta`
  y `compacto` para celdas y filtros. El lint lo impone. En las pruebas se
  elige con `elegirOpcion` (`tests/integracion/ayudas/formularios.ts`), no con
  `selectOption`.
- **Ningun `<input type="date">`**, por lo mismo: las fechas son `CampoFecha`
  (`src/components/ui`). Se puede escribir (`dd/mm/aaaa` o `aaaa-mm-dd`) o
  elegir en su calendario; envia `aaaa-mm-dd` en un input oculto, asi que las
  actions no cambian. Con `useCampos`, se conecta con `{...fecha("clave")}`.
  Sus cuentas viven en `src/lib/calendario.ts`, en UTC. El lint lo impone.
- **Todos los controles de una linea miden lo mismo**: 44 px (`normal`) o
  40 px (`compacto`), fijos. Salen de `claseLinea()` y `ALTO_CONTROL`
  (`src/components/ui/Campo.tsx`), que comparten `Campo`, `Selector` y
  `CampoFecha`. Un input suelto usa `claseLinea()`; nunca se le suman
  `min-h-*` ni `py-*` a otra clase de control, porque dos alturas en la misma
  clase dan un resultado distinto segun el orden de la hoja de estilos.
  `CLASE_CONTROL` queda para areas de texto, con su `min-h-[…]`.
- Lo que flota pegado a un control (la lista de `Selector`, el calendario) usa
  `useFlotante`: se pinta en el `<body>` para que una tabla no lo recorte.
- **Ningun `<input type="file">`** fuera de `CampoArchivo`
  (`src/components/ui`): zona propia en espanol, con arrastrar y soltar, que
  envuelve el input real. La unica excepcion es la foto de perfil, apagada
  hasta el VPS. El lint lo impone.
- Una seccion con titulo es `Tarjeta` (`src/components/ui`): el titulo va
  dentro, asi dos columnas de tarjetas arrancan a la misma altura. Su pie de
  botones usa `PIE_TARJETA`.
- Si un control cambia entre dos formularios (Archivo o Enlace), los dos se
  pintan en la misma celda de una rejilla y el que no toca queda `invisible`,
  `inert` y deshabilitado: la tarjeta no cambia de alto.
- Un listado puede pintarse en tarjetas con la prop `rejilla` de `Listado`
  (Proyectos lo hace); el orden pasa a `ListadoOrden`.
- Lo que se desplaza dentro de un panel usa la barra fina: `barra-fina` en
  columnas y paneles, `barra-fina-flotante` en lo que flota (listas,
  calendario, buscador, campana).
- Cada page del panel trae «Volver» (en `Wrapper`) y el indice flotante
  (`IndicePagina`, en el layout), sin hacer nada: el indice lee los `h2` del
  `<main>`, asi que una seccion nueva debe tener su titulo en un `h2`.
  «Volver» usa el rastro de `RastroNavegacion` y, si no hay, sube a la miga
  anterior.
- Completar algo que cuenta se celebra: una action devuelve `logro: true` y
  el aviso sale con el tono de logro; la tarea recien marcada usa
  `MarcaTarea` con `useCelebrar`; `anunciarLogro()` enciende
  `ResplandorLogro`. Las clases `logro-*` viven en `globals.css` y se apagan
  con el movimiento reducido.
- Un dato que se pasa a otro sitio (RIF, telefono, direccion, numero de
  factura) lleva al lado `BotonCopiar`. La logica de copiar es `useCopiar`;
  no se vuelve a escribir `navigator.clipboard` en un componente.
- Un modulo nuevo declara su `seccion` en `src/lib/navegacion.ts`. El menu se
  agrupa con `porSecciones`; ni el sidebar ni el menu movil llevan rotulos
  escritos a mano.
- Si el resultado de una action hace desaparecer el componente que la lanzo
  (completar una fase, quitar una tarea), su `useActionState` vive en un
  componente que sigue en pantalla. Si no, el aviso se pierde al revalidar.
- Todo `Intl.DateTimeFormat` fija `timeZone: ZONA_HORARIA` (`src/lib/fechas.ts`).
  Sin ella el servidor escribe la hora en UTC, cuatro horas por delante, y
  servidor y navegador pueden no coincidir y romper la hidratacion.
- React 19 vacia los campos no controlados al terminar una action: los
  formularios largos controlan sus valores con `useCampos`.
- Los archivos `'use server'` solo exportan funciones asincronas; tipos y
  constantes de estado viven en `src/types`.
- `src/lib/password.ts` llega al bundle de cliente a traves de
  `validaciones`: no se le anade nada que use `node:crypto`. Por eso la
  contrasena provisional se genera en `src/lib/claveProvisional.ts`.

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

## Quien se entera de que

La campana (`TipoNotificacion`). Quien provoca el evento nunca se avisa a si
mismo. Un evento nuevo que cambie algo de otra persona se anade aqui.

| Evento | Se enteran |
| --- | --- |
| Cuenta bloqueada por intentos, correo que no salio, lectura rara de la tasa | Administradores |
| Contrasena restablecida, dos pasos retirados | La persona |
| Empresa asignada o retirada | Ese ejecutivo |
| Proyecto asignado (al crear o al reasignar) | El ejecutivo que lo lleva |
| Proyecto creado a mano | Clientes de la empresa |
| Proyecto pausado, cerrado o reactivado | Ejecutivo, quienes trabajan en el y clientes (cancelado: sin clientes) |
| Tarea asignada; la fase de una tarea empieza | Su responsable |
| Responsable de una fase | Ese responsable |
| Todas las tareas de la fase listas | Ejecutivo |
| Comentario en una pieza | Ejecutivo, quien lleva la fase y quien tiene la tarea mencionada |
| Pieza en revision (fase 5) | Clientes que pueden aprobar (y correo) |
| Pieza aprobada o con correccion | Ejecutivo y responsables |
| Brief enviado | Quienes lo atienden (y copia por correo) |
| Brief aceptado, a presupuesto, descartado, fecha propuesta, validado | Clientes de la empresa |
| Aclaracion en un brief | La otra parte |
| Presupuesto creado | Ejecutivos de la empresa |
| Presupuesto enviado | Clientes con finanzas (y correo) y ejecutivos |
| Presupuesto aprobado o rechazado | Administracion y ejecutivos (si viene de un brief aprobado: «ya puedes aceptarlo»); si lo registra administracion, tambien los clientes con finanzas |
| Proforma emitida; proforma emitida que se anula | Clientes con finanzas |
| Factura emitida o anulada | Clientes con finanzas |
| Pago o retencion reportado | Administracion |
| Pago registrado por administracion a nombre del cliente | Clientes con finanzas |
| Pago confirmado o rechazado | Quien lo reporto |

## Dependencias

No se anaden librerias sin aprobacion expresa. Las de ejecucion son nueve:
`next`, `react`, `react-dom`, `pg`, `jose`, `bcryptjs`, `lucide-react`,
`qrcode-generator` (solo para el QR de los dos pasos, en `src/lib/qr.ts`; se
usa en el servidor y no entra en el bundle de cliente) y `pdf-lib` (el PDF del
talonario y la hoja de calibracion, en `src/lib/finanzas/pdfFactura.ts`, solo
en el servidor). De desarrollo: `@playwright/test`.

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
