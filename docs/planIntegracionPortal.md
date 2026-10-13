# Plan de integracion del portal completo en Conejo App

Fecha: 2026-10-13. Revisado tres veces ese dia; la ultima fija el modelo de
tareas, las herramientas y el menu. Es el unico plan de la integracion: el
documento anterior de finanzas se retiro y su contenido vigente esta en la
seccion 7.

**Fuentes.** El paquete de especificacion `appFacturas` (documentos 01 a 10,
esquema, reglas SQL, configuracion y maquetas), su diagnostico, y el codigo de
Conejo App en `main` (commit `b559385`). Los huecos de seguridad de la seccion 5
estan comprobados contra el codigo, con el archivo donde se ven, y la auditoria
del repositorio los volvio a confirmar el 2026-10-13 (`docs/informeAuditoria.md`).

## Decisiones tomadas

| Tema | Decision |
| --- | --- |
| Alcance | **Todo el flujo**: brief → presupuesto → proyecto y piezas con bateria de 5 fases → revision del cliente → proforma → factura → pagos y retenciones |
| Dependencias | Solo las imprescindibles. Aprobadas dos: una libreria para el PDF de la factura (ejecucion) y Playwright (desarrollo) |
| Seguridad por fila | Opcion A: la app se conecta con el rol sin privilegios `conejo_app` |
| Quien opera finanzas | Rol `admin` y cargo `administracion` |
| Comprobantes | Google Drive, `ConejoApp/Comprobantes`. Probado el 2026-10-13 |
| Servicios externos | Detras de un adaptador con modo simulado (JSON) y modo real (seccion 6) |
| Tasa de cambio | Se lee de la pagina del BCV, sin navegador (seccion 6.1) |
| Correo | Gmail, con el mismo cliente OAuth que Drive (seccion 6.2) |
| Sesiones | Token de acceso de 30 minutos y token de renovacion guardado en la base (seccion 5.1) |
| Auditoria | Tabla `auditoria` que registra quien hace que, en toda la app (seccion 5.2) |
| Cargos | Se anade `produccion`. `cuentas` son los ejecutivos y **solo ven las empresas que tienen asignadas** |
| Cuenta de Google | De momento la personal del responsable: crear un proyecto de GCP en la empresa exige una tarjeta que no hay. El correo sigue en modo simulado hasta entonces |
| Cargo `administracion` | Ve solo finanzas |
| Modal de sesion | Renovacion silenciosa mientras hay actividad; el modal solo aparece tras inactividad. Tope de 12 horas |
| Video en revision | Enlaces externos |
| Tarea de la tasa | Una vez al dia (plan gratuito de Vercel), mas refresco al usar |
| Modelo de trabajo | Proyecto → piezas → 5 fases fijas → **tareas** asignadas a personas (seccion 8.1) |
| Catalogo de servicios | Lo que el cliente puede pedir es una lista cerrada; cada servicio trae su brief, sus piezas y sus tareas sugeridas (seccion 8.1) |
| Herramientas | Seccion propia del menu. **Hooks es la primera** y se conecta al flujo a traves de las tareas (seccion 8.1) |
| Menu | Agrupado por secciones (seccion 9). En movil, barra inferior con hoja en lugar de hamburguesa |
| Planes hermanos | `docs/planAuditoriaRepositorio.md` (revision con Context7, **ya ejecutada**: ver «Punto de partida tras la auditoria») y `docs/planMejoraDiseno.md` (skills de diseno y navegacion movil) |
| Tasas del BCV | Se guardan todas las que publica la pagina, no solo el dolar |
| Asignacion de empresas | La hace el admin. El admin puede ademas actuar como ejecutivo |
| Hooks | Lo ve solo `redes`, y el admin |
| Briefs de prospectos | Los ve quien genero el enlace, y el admin |
| Servicios del catalogo | Se arranca con los dos definidos: redes sociales y desarrollo de producto |
| Rutas API | Aceptadas |
| Cierre de sesiones al publicar | Aceptado: el dia que salgan las sesiones nuevas, quien este dentro vuelve a entrar una vez |
| Impresion de la factura | **PDF generado con libreria**, para que salga siempre igual (seccion 7.8) |
| Moneda de facturacion | Los montos se arman en **dolares** y la factura se emite en **bolivares a la tasa del dia** |
| Medios de pago | Los carga un operador de finanzas desde la app, en Ajustes |
| Ramas | Una rama por funcionalidad, que se une a `main` cuando esta terminada |
| Produccion | Tiene datos reales: el SQL que se le pega no inserta datos que no sean imprescindibles (seccion 10.1) |
| Pruebas | Playwright, unitarias y de integracion (seccion 10.2) |
| Bitacora `agent.md` | Eliminada. El contexto para modelos va en `AGENTS.md`; las decisiones, en este plan |
| Quien aprobo o rechazo | Se muestra junto a cada cosa que tenga aprobacion, y en detalle en Auditoria (seccion 5.2) |
| Ajustes al modelo de finanzas | Aceptados los seis |
| Verificacion en dos pasos | Si, disponible para todos (seccion 5.3) |
| Neon | El rol de produccion, `neondb_owner`, tiene `BYPASSRLS` (comprobado el 2026-10-13): el rol `conejo_app` es obligatorio, no opcional |
| Plataforma | Vercel es temporal: la app se mudara, previsiblemente a un VPS. El plan separa lo que se construye ya de lo que se enciende tras la mudanza (seccion 10) |
| Aprovechar la integracion | Cerrar huecos de seguridad y mejorar flujos actuales (secciones 5 y 8) |

---

## Punto de partida tras la auditoria

La auditoria del repositorio termino el 2026-10-13. Lo que la etapa 1
encuentra distinto de como se escribio este plan:

| Tema | Como queda | Que implica aqui |
| --- | --- | --- |
| Versiones | `next` 16.4.0, `react` 19.3.0, `jose` 6.2.12, `pg` 8.23.1, `lucide-react` 1.56.0 | Ninguna dependencia de ejecucion tiene avisos |
| Destino tras el login | `destinoSeguro` vive en `src/lib/redireccion.ts` y solo admite rutas del panel | La renovacion de sesion (5.1) y cualquier redireccion nueva lo reutilizan |
| `matcher` del proxy | Solo excluye por extension la raiz y `/images` | La ruta publica `/brief/[token]` (9.2) se declara en el proxy |
| Frontera servidor/cliente | Regla de lint sobre `src/components/**` | Los modulos nuevos nacen con ella |
| Base | `query_timeout` de 15 segundos; una conexion rota no vuelve al pool | `conSesion` (etapa 1) se monta sobre `transaccion`, que ya lo hace |
| Limites de error | Usan `retry` | Los `error.tsx` nuevos, igual |
| Pruebas unitarias | Existen para el auditor, el destino del login y la contrasena | 10.2 parte de ahi |
| Compose | PostgreSQL y pgAdmin solo en `127.0.0.1` | — |

Lo que la auditoria encontro y **se resuelve en este plan**, no en ella:

| Hallazgo | Donde |
| --- | --- |
| La sesion de 8 horas, `requiredClaims` de `jose` y la duracion fija de la cookie | Seccion 5.1 |
| Cuentas del seed en produccion, y la imagen `prod` que lleva la semilla dentro | Hueco 11, secciones 10.1 y 11. El `Dockerfile` copia hoy `db/` entero: al separar la semilla, copiar solo lo que el arranque necesite |
| Sin cabeceras de seguridad | Hueco 8. Anadir tambien `poweredByHeader: false` |
| `statement_timeout` en el servidor | Etapa 1, al crear el rol `conejo_app`: se puede fijar en el propio rol y probarlo contra Neon |

La cuenta de administrador del seed no existe en produccion (confirmado por
el responsable el 2026-10-13).

## Avance

No se publica nada hasta terminar la integracion (decidido el 2026-10-13).
Lo que cada etapa exige en produccion se va anotando en
`docs/despliegueProduccion.md`.

| Etapa | Rama | Que entrega | SQL para Neon | Estado |
| --- | --- | --- | --- | --- |
| 1 | `feat/etapa1-guardias-y-cabeceras` | Huecos 1, 8 y 10 cerrados; del 5, el acceso negado en el login y en cada peticion. Cargo `produccion` | `db/neon/01-cargo-produccion.sql` | Hecha |
| 1 | `feat/etapa1-sesiones` | Seccion 5.1 entera: acceso de 30 minutos, renovacion con rotacion, tabla `sesiones`, revocaciones, aviso por inactividad, «Sesiones abiertas» en Mi perfil. Cierra el hueco 2 y lo que faltaba del 5 | `db/neon/02-sesiones.sql`, **antes** de subir | Hecha |
| 1 | `feat/etapa1-login-seguro` | Huecos 3 y 4: bloqueo de 15 minutos tras cinco fallos, y cambio obligatorio de la contrasena provisional en `/cambiar-clave` | `db/neon/03-acceso.sql`, **antes** de subir | Hecha |
| 1 | `feat/etapa1-auditoria` | Seccion 5.2 y hueco 9: tabla `auditoria` inmutable, anotada en la misma transaccion desde acceso, usuarios, empresas y perfil, y el modulo Auditoria para el admin | `db/neon/04-auditoria.sql`, **antes** de subir | Hecha |
| 1 | `feat/etapa1-rol-app` | Huecos 6, 7 y 11: la app se conecta como `conejo_app`, con los permisos justos; `conSesion`; el hash sale de la vista general; `sql:produccion` ya no lleva la semilla, y la imagen `prod` tampoco | `db/neon/05-rol-de-la-aplicacion.sql` **antes** de subir (lleva el hueco de la contrasena) y `06-vista-sin-hash.sql` **despues** | Hecha |
| 1 | `feat/etapa1-menu-secciones` | Seccion 9.1: cada modulo declara su `seccion`; el sidebar y el menu movil pintan un rotulo por seccion y omiten las vacias | Ninguno | Hecha |
| 2 | `feat/etapa2-correos` | Esquemas `portal` y `finanzas` con las funciones de sesion; adaptador de correo con modo simulado y real; `portal.correos_salida` con seguridad por fila; bandeja de salida para el admin; avisos de bienvenida y de contrasena restablecida | `db/neon/07-esquemas-y-correos.sql` | Hecha |
| 2 | `feat/etapa2-avisos` | `portal.notificaciones` con seguridad por fila y la campana del encabezado, en escritorio y movil. Notifica el bloqueo de una cuenta y el correo fallido a los administradores, y la contrasena restablecida a su dueno | `db/neon/08-notificaciones.sql` | Hecha |

**La etapa 1 esta completa.** Quedan fuera de ella, para la etapa en que
existan sus modulos, los tres criterios nuevos de visibilidad de la seccion
9.3 (solo clientes, un permiso del cliente, «tiene tareas asignadas») y la
lista de rutas por tipo de usuario del proxy.

De la seccion 5.2 quedan para cuando existan sus entidades la pestana
«Historial» de cada cosa y lo que ve el cliente; hoy la auditoria solo la
consulta el admin. El filtro del modulo es por modulo y por periodo, mas el
buscador; filtrar por persona o por empresa se hace buscando su nombre.

Sobre el correo, decidido al construir la etapa 2:

- **Enviar son dos pasos**: el mensaje se escribe en la bandeja dentro de la
  transaccion del cambio, y se entrega despues de confirmarla. Sustituye a la
  respuesta fija en JSON que proponia la seccion 6: con la bandeja de salida
  ese archivo no hacia falta.
- **Ningun correo lleva la contrasena provisional.** La bienvenida avisa de
  que la cuenta existe; la contrasena se sigue entregando en mano. La seccion
  6 daba por hecho que la bienvenida la llevaria.
- La bandeja la lee el administrador, y cada quien los correos que el mismo
  provoco: sin eso no podria anotar el resultado de su propio envio.
- El modo real (Gmail) esta escrito y sin probar: falta la cuenta.

Sobre la campana:

- La matriz de avisos del paquete (`appFacturas/docs/08`) es entera de modulos
  que aun no existen. Lo construido es la pieza —tabla, politicas, campana—
  y las tres notificaciones que hoy tienen sentido. Cada modulo anadira las
  suyas al llegar.
- En el codigo se llaman **notificaciones**, no avisos: `ProveedorAvisos` ya
  usaba esa palabra para los mensajes flotantes.
- No hay pagina de «todas las notificaciones»: la campana muestra las doce
  ultimas. Se anade cuando haya volumen que lo pida.

Sobre el rol de la aplicacion:

- Todavia no hay ninguna politica de seguridad por fila: llegan con las
  tablas del portal, que son las que tienen algo que aislar. Lo que queda
  hecho es lo que necesitan: el rol sin `BYPASSRLS`, `conSesion` y las vistas
  con `security_invoker`.
- `statement_timeout` no se fijo en el rol. Sigue pendiente de probar contra
  la cadena agrupada de Neon; el tope de 15 segundos del lado de la aplicacion
  ya cubre el caso.
- Los seis archivos de `db/neon/` se ensayaron en orden sobre una copia del
  esquema publicado, comprobando que tras el 05 la version anterior sigue
  pudiendo leer el hash.

Diferencias con lo escrito en la seccion 5.1, decididas al construir:

- El aviso de inactividad no espera a un clic para renovar cuando hay
  actividad: se renueva solo. Es lo decidido en «el modal solo aparece tras
  inactividad».
- Reutilizar un token de renovacion ya rotado revoca la sesion, salvo dentro
  de un margen de 20 segundos: dos pestanas pueden pedir la renovacion a la
  vez con el mismo token, y eso no es un robo.
- `JWT_EXPIRACION` desaparece. Los plazos son `SESION_ACCESO_SEGUNDOS`,
  `SESION_HORAS` y `SESION_INACTIVIDAD_MINUTOS`, los tres opcionales.

---

## 1. El flujo completo

```
 CLIENTE              EJECUTIVO (cuentas)        ADMINISTRACION            PRODUCCION
 ───────              ───────────────────        ──────────────            ──────────
 llena el brief ───▶  bandeja (fase 0)
                      ├─ aceptar ──────────────────────────────┐
                      ├─ a presupuesto ───▶ arma presupuesto   │
 aprueba presupuesto ◀──────────────────── lo envia            │
        │                                                      ▼
        └───────────────────────────────────────────▶  nace el PROYECTO
                      ajusta piezas y tareas,                  │ piezas × 5 fases
                      fija fechas, asigna                      │ tareas por fase
                      completa fases  ◀── «lista» ──────────── cumple sus tareas
                      fase 4: envia al cliente
 fase 5: aprueba
 o pide correccion ─▶ la pieza vuelve a la fase que toque
                                            proforma → factura
 reporta pagos y retenciones ─────────────▶ confirma · cobranza
```

Tres bloques que hoy no existen en Conejo App, mas finanzas:

| Bloque | Que cubre |
| --- | --- |
| **Proyectos y bateria** | Proyectos por empresa, piezas, 5 fases por pieza, tareas asignadas, avance calculado, tablero interno con alertas, «Mi trabajo» |
| **Revision del cliente** | Vista del cliente con sus proyectos, archivos y versiones, aprobar o pedir correccion en la fase 5, historial |
| **Briefs** | Formularios por pasos, envio con codigo y copia congelada, bandeja del ejecutivo, enlace privado para prospectos |
| **Finanzas** | Presupuesto, proforma, factura en talonario, pagos, retenciones, cobranza |

---

## 2. Que se reutiliza

### De Conejo App

| Pieza existente | Para que sirve aqui |
| --- | --- |
| `empresas`, `usuarios`, `clientes`, `trabajadores`, `cargos` | Son los «clientes», usuarios y roles del paquete. No se crea nada paralelo |
| `requerirEmpresa()` (`src/lib/sesion.ts`), escrita y sin un solo uso | Es la guardia de toda la vista del cliente |
| Cargo `cuentas`, que ningun modulo usa | Son los ejecutivos de cuentas |
| Cargo `administracion` | Opera finanzas |
| Boton de notificaciones del layout, hoy deshabilitado («proximamente») | Se enciende con la tabla de avisos |
| `Listado`, `PanelLateral`, `ModalConfirmacion`, estado en la URL | Bandeja de briefs, proyectos, documentos financieros, cobranza |
| `Wrapper`, `Breadcrumb`, `loading.tsx` por modulo | Todas las pantallas nuevas |
| `useCampos` | El formulario de brief (44 campos) y los renglones de un presupuesto |
| El canvas de hooks (page propia con formulario largo y resultado en vivo) | Precedente para el editor de presupuesto y para llenar un brief |
| `src/lib/hooks/` (criterio como funciones puras, con bateria de pruebas) | Mismo molde para `lib/portal/` (fases, correccion, nombres de archivo, hash del brief) y `lib/finanzas/` |
| `ediciones_ficha` (registro de solo anadir) | Precedente de la bitacora general |
| `transaccion()` de `src/lib/db.ts` | Base de `conSesion` |
| Validacion de archivos por firma de bytes y nombre generado, comentada en `actions/perfil.ts` | Se rescata para versiones y comprobantes |
| `scripts/driveProbar.mjs` y las variables `DRIVE_*` | Conexion con Drive ya probada |
| Regla «desactivar, no borrar» y sus dos guardias | Proyectos, piezas y documentos se archivan o anulan |
| Tokens del tema y `dark-tema:` | Las maquetas del paquete solo existen en claro |
| `db/pruebas/*.mts` | Las pruebas nuevas siguen el mismo formato |

### Del paquete

| Pieza | Que pasa con ella |
| --- | --- |
| Modelo de datos (28 modelos) | Se porta a `db/schema.sql`: enteros en vez de UUID, `TEXT` + `CHECK` en vez de enums, sin Prisma |
| Vistas de avance y de cobro | Se portan casi literales |
| Triggers de inmutabilidad (facturas, bitacora, versiones de brief) | Se portan |
| Politicas RLS de finanzas y funcion de aprobacion de presupuesto | Se portan adaptadas |
| `config/fases.json` (plantillas, rutas de correccion) | Pasa a `src/lib/portal/catalogo.ts`: es criterio de la agencia, como el catalogo de hooks |
| `config/briefs/desarrollo-producto.v1.json` y su esquema | Se usa tal cual, como dato versionado |
| `fixtures/` (brief congelado con su hash) | Caso de prueba de referencia |
| Algoritmos escritos: `registrarRevision`, `enviarBrief`, hash canonico, `nombreEstandar` | Se implementan como estan descritos |
| Plantillas del talonario y de la copia del brief | Punto de partida: el talonario para el generador de PDF, la copia del brief para su correo y su pagina |
| Maquetas (8 pantallas) | Referencia visual; se reconstruyen con los componentes de Conejo |
| `pruebas_db.sql` (65 aserciones) | Se traduce a `db/pruebas/` |
| Prisma, Zod, Auth.js, pg-boss, Playwright, SSE, Nginx, Docker de produccion | No entran |

---

## 3. Correspondencia de roles y entidades

| En el paquete | En Conejo App | Nota |
| --- | --- | --- |
| Cliente (empresa) | `empresas` | Gana datos fiscales y carpeta de Drive |
| Usuario cliente | `usuarios` + `clientes` | Sigue perteneciendo a **una** empresa |
| Permisos Aprobar y Finanzas | Dos columnas nuevas en `clientes`: `puede_aprobar`, `puede_ver_finanzas` | Las marca el admin en el modulo de Usuarios |
| ADMIN | rol `admin` | |
| EJECUTIVO | rol `trabajador`, cargo `cuentas` | Decidido. Ve solo sus empresas asignadas |
| PRODUCCION | Cualquier trabajador con tareas asignadas. El cargo **`produccion`** es nuevo | Decidido. Quien hace cada tarea no depende del cargo sino de la asignacion (seccion 8.1) |
| — | cargo `administracion` | Opera finanzas; no ve produccion salvo decision contraria |
| Asignacion ejecutivo ↔ cliente | Tabla nueva `portal.asignaciones` | Decidido: se aplica desde el primer dia |
| Prospecto | Tabla nueva `portal.prospectos` | Empresa que aun no es cliente |

El nombre `clientes` significa la empresa en el paquete y la persona en Conejo.
En todo lo portado, `cliente_id` pasa a `empresa_id`.

---

## 4. Modelo de datos

Todo en `db/schema.sql`, idempotente. Tres zonas:

| Esquema | Contenido | Por que aparte |
| --- | --- | --- |
| `public` | Lo que ya existe, mas las columnas nuevas | — |
| `portal` | Proyectos, piezas, briefs, bitacora, avisos | Permisos y RLS por esquema; sin choques de nombres |
| `finanzas` | Documentos, pagos, retenciones | La app nunca tiene `DELETE` aqui |

### 4.1 Tablas existentes que se amplian

| Tabla | Columnas nuevas |
| --- | --- |
| `empresas` | `razon_social`, `domicilio_fiscal`, `correo_facturacion`, `es_agente_retencion`, `retencion_iva_pct`, `carpeta_drive_id` |
| `clientes` | `puede_aprobar`, `puede_ver_finanzas` |
| `usuarios` | `debe_cambiar_clave`, `intentos_fallidos`, `bloqueado_hasta` (seccion 5) |
| `fichas_hook` | `tarea_id` opcional (seccion 8.1) |
| `cargos` | Fila nueva `produccion`. Tambien en `SlugCargo` y en la lista de `src/lib/jwt.ts` |
| (nuevas en `public`) | `sesiones` (seccion 5.1) y `auditoria` (seccion 5.2): sirven a toda la app, no solo al portal |

### 4.2 Esquema `portal`

| Tabla | Que guarda |
| --- | --- |
| `asignaciones` | Que ejecutivo atiende a que empresa |
| `proyectos` | Empresa, nombre, tipo (`redes_sociales` o `especial`), estado, fecha estimada de cierre, brief de origen |
| `piezas` | Proyecto, titulo, tipo, orden, ronda, responsable |
| `pieza_contenido` | El `copy` de la pieza, **en tabla aparte** (ver abajo) |
| `pieza_fases` | Cinco filas por pieza: estado, fecha estimada, responsable, completada en, marcada lista en |
| `versiones` | Archivos o enlaces externos de una pieza: numero, ronda, fase, autor, enviada al cliente en |
| `tareas` | Trabajo interno dentro de una fase: titulo, responsable, herramienta, estado, lista en |
| `revisiones` | Decision del cliente en la fase 5: aprobada o correccion, tipo, comentario, fases reabiertas |
| `comentarios_pieza` | Comentarios internos; nunca salen al cliente |
| `recursos_marca` | Boveda de marca por empresa |
| `prospectos` | Empresa y contacto de quien aun no es cliente |
| `briefs` | Formato y version, empresa o prospecto, estado, codigo, fechas, borrador en curso |
| `brief_versiones` | Contenido congelado al enviar, con su hash. Inmutable por trigger |
| `brief_aclaraciones` | Hilo entre ejecutivo y solicitante |
| `enlaces_brief` | Enlace privado del prospecto: solo el hash del token, vencimiento, revocacion |
| `notificaciones` | Avisos del portal, una fila por usuario |
| `correos_salida` | Cada correo que la app «envia» (seccion 6) |

Vistas: `portal.v_progreso_pieza` y `portal.v_progreso_proyecto`. **El avance
no se guarda**: no existen columnas de porcentaje ni de fase actual.

Las plantillas de fase y el catalogo de servicios no son tabla: van en
`src/lib/portal/catalogo.ts`. El registro de herramientas, en
`src/lib/herramientas.ts`. Los
formatos de brief tampoco: son JSON versionados dentro del repositorio, y cada
version enviada guarda el texto exacto de sus preguntas.

**Por que `pieza_contenido` es una tabla y no una columna.** El paquete
protegia el `copy` solo en la capa de servicios; su propio diagnostico lo marca
como hueco (nada en la base impedia leerlo antes de la fase 5). RLS decide por
fila, no por columna: separando el contenido en su tabla, la base misma puede
negarselo al cliente hasta que la pieza llegue a la fase 5.

### 4.3 Esquema `finanzas`

| Tabla | Que guarda |
| --- | --- |
| `secuencias` | Contadores consecutivos sin saltos |
| `presupuestos` | Numero, empresa, brief y proyecto de origen (opcionales), estado, moneda, base imponible, exento, IVA, total, valido hasta, quien lo creo y quien lo aprobo |
| `proformas` | Igual estructura de montos, presupuesto de origen, recurrente y proxima emision |
| `proforma_proyectos` | A que proyectos corresponde una proforma |
| `facturas` | Serie, numero, numero de control, empresa, proyecto, proforma, fechas de emision y de vencimiento, montos, moneda y tasa, retencion esperada, datos congelados del emisor y de la empresa, impresion y anulacion |
| `documento_items` | Renglones de los tres documentos, con exactamente un padre |
| `pagos` | Factura, monto y moneda pagados, tasa usada, monto aplicado, medio, referencia, comprobante, estado, quien reporto y quien confirmo |
| `retenciones` | Factura, tipo, monto, comprobante, estado |
| `tasas_cambio` | Fuente, fecha valor, valor, cuando se obtuvo y si fue automatica o a mano |
| `ajustes` | Emisor, talonario y medios de pago |

El detalle de reglas, permisos y operaciones esta en la seccion 7.

Seis ajustes sobre el modelo del paquete, **aceptados**. Corrigen huecos que
despues, con facturas inmutables emitidas, serian caros de arreglar:

| # | Ajuste | Por que |
| --- | --- | --- |
| 1 | Fecha de vencimiento en la factura | Sin ella no se sabe cuando una factura esta atrasada |
| 2 | Presupuestos y proformas guardan base imponible y monto exento | Sus renglones pueden ser exentos y solo guardaban el subtotal |
| 3 | El pago guarda la tasa usada y su fuente | Un pago en otra moneda no dejaba rastro de la conversion |
| 4 | Claves foraneas a `usuarios` en quien creo, aprobo, anulo o confirmo | Eran identificadores sueltos |
| 5 | «Vencido» del presupuesto se deriva de la fecha, no se guarda | No hay tareas programadas que lo marquen |
| 6 | Una factura anulada tiene saldo cero en la vista de cobro | Evita que la cobranza tenga que acordarse de filtrarlas |


---

## 5. Seguridad: lo que se cierra aprovechando la integracion

Cada hueco esta comprobado en el codigo actual.

| # | Hueco | Donde se ve | Efecto hoy | Arreglo |
| --- | --- | --- | --- | --- |
| 1 | Las actions de Usuarios y Empresas deciden con el **token**, no con la base | `requerirAdmin` en `src/actions/usuarios.ts` y `src/actions/empresas.ts`; `src/lib/sesion.ts:144-159` | Un administrador degradado o **desactivado** sigue pudiendo crear usuarios y restablecer contrasenas hasta 8 horas | Todas las guardias leen el usuario fresco, y con el su sesion (seccion 5.1) |
| 2 | No hay forma de cerrar una sesion desde el servidor | Cambiar la contrasena (`src/actions/perfil.ts`) no toca ninguna sesion | Una sesion robada sobrevive al cambio de contrasena | Tabla `sesiones`: cambiar o restablecer la contrasena revoca todas las demas (seccion 5.1) |
| 3 | El login no limita intentos | `src/actions/auth.ts` no cuenta fallos | Fuerza bruta sin freno, solo ralentizada por bcrypt | `intentos_fallidos` y `bloqueado_hasta`: 5 fallos, 15 minutos. El mensaje no revela si la cuenta existe |
| 4 | La contrasena provisional no caduca ni obliga a cambiarse | `src/actions/usuarios.ts:184-207`: se genera y se entrega; no hay `debe_cambiar_clave` | La clave que conoce el administrador puede seguir en uso para siempre | `debe_cambiar_clave`: el dashboard redirige a cambiarla antes de dejar hacer nada |
| 5 | Un cliente de una empresa **desactivada** sigue entrando | `empresaActiva` solo se usa para pintar un aviso en `DetalleUsuario.tsx` | Hoy no ve nada sensible; con proyectos y finanzas, si | Se le niega el acceso en el login y en cada peticion, y sus sesiones abiertas se revocan al desactivar la empresa. La empresa y sus personas dejan de aparecer en los desplegables y listados de trabajo; en Usuarios y Empresas siguen visibles para el admin, marcadas |
| 6 | La app se conecta como superusuario de la base | `docker-compose.yml:25`, `.env.example` | Cualquier politica RLS seria decorativa | Rol `conejo_app` (decidido) |
| 7 | `vw_usuarios_completos` expone `password_hash` | `db/schema.sql:597` | Depende de que ningun modelo lo pida por error | Vista aparte solo para el login; la general deja de traerlo |
| 8 | Sin cabeceras de seguridad | `next.config.ts` no define `headers` | La app se puede incrustar en un marco ajeno; sin politica de contenido | `Content-Security-Policy`, `frame-ancestors 'none'`, `X-Content-Type-Options`, `Referrer-Policy`, HSTS |
| 9 | No hay bitacora general | Solo existe `ediciones_ficha` | No queda rastro de quien creo un usuario, desactivo una empresa o restablecio una clave | Tabla `auditoria` (seccion 5.2) |
| 10 | El secreto de ejemplo del `.env.example` es valido | Mide mas de 32 caracteres, asi que `src/lib/jwt.ts` lo acepta | Un despliegue que olvide cambiarlo arranca firmando con un secreto publico | `jwt.ts` rechaza ese valor concreto en produccion |
| 11 | Tres cuentas de prueba con contrasena en el repositorio | `db/datos/semilla.mts` | Entran a produccion si se siembran alli | `sql:produccion` deja de incluirlas |

### Aislamiento entre clientes, en la base

El paquete solo ponia RLS en finanzas; el aislamiento de proyectos y briefs
dependia de que ningun servicio se equivocara. Ya que la app pasa a un rol sin
privilegios, se extiende:

| Sobre | Regla en la base |
| --- | --- |
| `portal.proyectos`, `piezas`, `pieza_fases`, `revisiones` | Un cliente solo ve filas de su empresa. Un ejecutivo, solo las de sus empresas asignadas |
| `portal.pieza_contenido`, `versiones` | Un cliente solo las ve con la pieza en fase 5 o aprobada, y de las versiones solo la marcada como enviada |
| `portal.comentarios_pieza`, `correos_salida`, `asignaciones` | Un cliente no ve ninguna |
| `portal.briefs` y sus tablas | Un cliente solo ve los de su empresa |
| `auditoria` | Un cliente solo ve los tipos de la lista blanca, de su empresa. Es su «historial» |
| `finanzas.*` | Lo ya planificado |

Para produccion la base deja pasar segun el cargo, y el filtro fino (que pieza
tiene asignada) lo aplica la capa de servidor.

Todo acceso de los modulos nuevos pasa por **`conSesion`**, una funcion nueva de
`src/lib/db.ts` sobre `transaccion()` que declara usuario, rol,
cargo y empresa, y por ella pasan todos los modelos nuevos. Sin sesion
declarada, cero filas.

### 5.1 Sesiones: acceso de 30 minutos y renovacion

Sustituye al token unico de 8 horas.

| Pieza | Como queda |
| --- | --- |
| Token de acceso | El JWT de hoy, pero de **30 minutos**. Lleva ademas el id de su sesion |
| Token de renovacion | 32 bytes al azar, en su propia cookie `httpOnly`. En la base solo se guarda su **hash** |
| Tabla `sesiones` | Usuario, hash del token, creada, ultimo uso, caduca, revocada, navegador |
| Vida de la sesion | Tope absoluto (propongo 12 horas) aunque se renueve: se entra una vez al dia |

**Renovar.** Dos minutos antes de que caduque el acceso aparece un modal con
cuenta atras: «Tu sesion esta por vencer · Continuar». Al aceptar, una Server
Action comprueba el token de renovacion contra la base —que no este revocado ni
caducado, que el usuario siga activo y su empresa tambien—, lo **rota** (el viejo
deja de valer) y emite otro acceso. No hay navegacion: la pantalla, el scroll y
lo escrito en un formulario se quedan como estaban. Si el modal se ignora y el
acceso caduca, sigue ahi: se renueva igual mientras la sesion no haya muerto.

**Tres cosas que hay que tocar para que eso funcione de verdad:**

1. **El proxy.** Hoy manda al login en cuanto el acceso no verifica, y eso
   incluye el POST de la propia renovacion. Pasa a dejar pasar las peticiones
   que traen cookie de renovacion; quien decide es la guardia.
2. **Las guardias.** Una page que llega con el acceso vencido y renovacion
   valida no va al login: va a una pantalla minima de renovar que devuelve a la
   misma URL.
3. **El reloj.** El modal no se fia de un temporizador: al volver a la pestana
   o despertar el equipo, recalcula contra la hora de caducidad.

**El token de renovacion no arregla por si solo el problema de las 8 horas**,
solo lo acorta a 30 minutos. Lo que lo cierra es que las guardias leen de la
base en cada peticion, y la consulta que ya trae al usuario trae tambien su
sesion: una sesion revocada deja de valer **en la siguiente peticion**, no al
caducar el acceso. No cuesta una consulta mas.

| Que revoca sesiones | Cuales |
| --- | --- |
| Cerrar sesion | La propia |
| Cambiar la contrasena | Todas las demas del usuario |
| Restablecer la contrasena (lo hace un admin) | Todas las del usuario |
| Desactivar un usuario | Todas las suyas |
| Desactivar una empresa | Todas las de sus personas |
| Cambiar rol, cargo o empresa de alguien | Todas las suyas |
| Usar un token de renovacion ya rotado | Toda la sesion: es la senal de que alguien lo copio |

De regalo sale una lista de «sesiones abiertas» en Mi perfil, con un boton para
cerrar las demas.

**Decidido: el modal solo aparece tras inactividad.** Mientras la persona
trabaja —teclea, hace clic, navega— el acceso se renueva solo, sin avisar. Si
pasa un rato sin actividad, al acercarse la caducidad sale el modal. Y haga lo
que haga, a las 12 horas de haber entrado la sesion termina.

### 5.2 Auditoria

Tabla `auditoria`, en `public` porque registra toda la app y no solo el portal.

| Columna | Contenido |
| --- | --- |
| `actor_id`, `actor_rol`, `actor_cargo` | Quien. El rol y el cargo se copian: dentro de un ano importa lo que era entonces |
| `accion` | Que, como texto cerrado: `usuario.creado`, `sesion.inicio`, `factura.anulada` |
| `entidad`, `entidad_id`, `empresa_id` | Sobre que, y de que empresa |
| `antes`, `despues` | Valores anterior y nuevo, en `JSONB`. Nunca contrasenas ni tokens |
| `ip`, `creado_en` | Desde donde y cuando, con la hora del servidor |

- **Solo se anade.** Un trigger rechaza `UPDATE`, `DELETE` y `TRUNCATE`; el rol
  de la app ni siquiera tiene esos permisos.
- **Se escribe en la misma transaccion** que el cambio. Si el cambio se deshace,
  su linea tambien; si la linea no se puede escribir, el cambio no ocurre.
- La escriben las **actions**, que son las que conocen la sesion, igual que hoy
  con `ediciones_ficha`.
**Se consulta en tres sitios**, de lo mas general a lo mas concreto:

| Donde | Que muestra |
| --- | --- |
| Modulo **Auditoria**, en Sistema, solo admin | Todo lo ocurrido en la app, con el listado estandar: buscador y filtros por persona, accion, modulo, empresa y fecha. Cada linea tiene un boton de detalle que abre un panel con quien, cuando, desde donde, y el **antes y el despues** campo por campo |
| Pestana «Historial» de cada cosa | Las lineas de esa empresa, proyecto, pieza, brief o documento. Es el mismo dato filtrado, como hoy el panel de cambios de una ficha de hook |
| Junto a cada aprobacion o rechazo | **Quien lo hizo y cuando**, a la vista y sin abrir nada: «Aprobado por Maria Perez · 12 oct, 14:30» |

Lo tercero no sale de la auditoria sino de la propia fila: cada tabla con una
decision guarda quien la tomo y cuando. La auditoria cuenta la historia; estas
columnas responden la pregunta del momento sin tener que buscarla.

| Decision | Donde queda quien la tomo |
| --- | --- |
| Presupuesto aprobado o rechazado por el cliente | `presupuestos.aprobado_por`, `aprobado_en` |
| Pieza aprobada o devuelta a correccion | `revisiones.usuario_id`, con la ronda y el comentario |
| Fase completada | `pieza_fases.completada_por`, `completada_en` |
| Tarea marcada como lista | `tareas.lista_por`, `lista_en` |
| Brief aceptado, descartado o pasado a presupuesto | `briefs.resuelto_por`, `resuelto_en`, con el motivo si se descarto |
| Pago o retencion confirmados o rechazados | `confirmado_por`, `confirmado_en`, y el motivo del rechazo |
| Factura emitida o anulada | `creado_por`; `anulada_por`, `anulada_en` y el motivo |

Todas esas columnas son claves foraneas a `usuarios`: un «aprobado por» no
puede apuntar a nadie que no exista.

**Lo que ve el cliente** de todo esto es una lista blanca: quien de su empresa
aprobo que, y cuando. Nunca quien del equipo hizo cada tarea.

Se registra desde la etapa 1 lo que ya existe —inicios de sesion y fallos,
bloqueos, altas y cambios de usuarios y empresas, contrasenas restablecidas—, y
cada modulo nuevo anade lo suyo. `ediciones_ficha` se queda como esta: es el
historial que se muestra dentro de una ficha de hook.

### 5.3 Verificacion en dos pasos

**No usa el cliente de Google ni ningun servicio.** Las apps de codigos (Google
Authenticator, Microsoft Authenticator, Authy) implementan un estandar abierto,
TOTP: el servidor y el telefono comparten un secreto y los dos calculan el
mismo codigo de seis digitos a partir de la hora. No hay llamada a nadie.

| Pieza | Como |
| --- | --- |
| Calculo y comprobacion | `node:crypto` (HMAC). Sin libreria |
| Secreto | Columna en `usuarios`, **cifrada** con una clave que vive en una variable de entorno |
| Activacion | En Mi perfil: se muestra el secreto, la persona lo registra en su app y confirma con un codigo |
| Login | Segundo paso tras la contrasena. Los fallos cuentan para el bloqueo de intentos |
| Codigos de respaldo | Diez, de un solo uso, guardados como hash |
| Telefono perdido | Un admin desactiva los dos pasos de esa persona; queda en la auditoria |
| Para quien | Obligatoria para `admin` y `administracion`; disponible para todos los demas, clientes incluidos |

**El codigo QR es lo unico que no sale gratis.** Generar un QR no viene con
Node. Sin libreria, la activacion se hace tecleando el secreto en la app, o
con un enlace que la abre sola desde el telefono. Mostrar el QR pide una
dependencia pequena o escribir el codificador; se decide al llegar a esa etapa.

### Lo que no se puede cerrar todavia

| Tema | Por que | Cuando |
| --- | --- | --- |
| Bloqueo por IP | Detras de Vercel la IP es la de su red | Tras la mudanza |
| Copias de seguridad propias | El 5432 esta bloqueado desde desarrollo | Tras la mudanza |

---

## 6. Servicios externos simulados

Mientras la app viva en Vercel, todo servicio externo se llama a traves de un
adaptador con dos implementaciones. La aplicacion no sabe cual esta activa.

```
src/lib/externos/
  correo.ts          enviar(mensaje)                 -> { id, estado }
  tasaCambio.ts      consultar(fuente, fecha)        -> { fuente, fecha, valor }
  archivos.ts        subir / leer / carpetaDe        -> { id, nombre, tamano }
  simulados/
    correo.enviar.json
    tasaCambio.bcv.json
    archivos.subir.json
```

| Servicio | Modo simulado | Modo real, tras la mudanza |
| --- | --- | --- |
| **Correo** | Devuelve la respuesta de `correo.enviar.json` y **guarda el mensaje completo en `portal.correos_salida`** | API de Gmail (seccion 6.2) |
| **Tasa de cambio** | Devuelve `tasaCambio.bcv.json` | Lectura de la pagina del BCV (seccion 6.1) |
| **Archivos** | Devuelve `archivos.subir.json` y guarda el archivo en una tabla de la base, con limite pequeno | Google Drive, que ya esta probado |

El modo se elige por variable de entorno, una por servicio (`CORREO_MODO`,
`TASA_MODO`, `ARCHIVOS_MODO`, con valores `simulado` o `real`). **Archivos y
tasa arrancan en `real`**: Drive ya funciona y la pagina del BCV se puede leer.
El correo arranca en `simulado` hasta tener la cuenta de la empresa.

**Los JSON no se escriben, se leen.** El disco de Vercel es de solo lectura,
asi que lo que cambia —el correo «enviado»— va a la base y no a un archivo.

**La bandeja de salida es lo que hace usable el modo simulado.** Hay correos de
los que depende el flujo: el enlace privado del prospecto, la bienvenida, la
copia del brief. Con el correo simulado nadie los recibiria. Una pantalla del
administrador lista `correos_salida` y permite copiar el contenido para
entregarlo a mano, que es lo que ya se hace hoy con la contrasena provisional.

### 6.1 Tasa del BCV

**No hace falta Playwright.** Comprobado el 2026-10-13: `https://www.bcv.org.ve/`
devuelve la tasa ya escrita en el HTML, sin JavaScript. Una peticion HTTP y una
expresion regular bastan:

| Dato | Donde esta en la pagina |
| --- | --- |
| Dolar | Dentro de `<div id="dolar">`, como `876,79760000` |
| Euro y las demas monedas que publica | Cada una en su `<div>` con su identificador. **Se guardan todas** |
| Fecha valor | Atributo `content="2026-10-13T00:00:00-04:00"` del primer `date-display-single` |

Playwright ademas no cabria: es una dependencia nueva y su Chromium no entra en
una funcion de Vercel.

**Un tropiezo ya encontrado.** Desde Node la peticion falla con
`UNABLE_TO_VERIFY_LEAF_SIGNATURE`: el servidor del BCV no envia su certificado
intermedio. La solucion **no** es desactivar la verificacion: es entregarle a
la peticion ese certificado intermedio, guardado en el repositorio, usando
`node:https` con su opcion `ca`.

| Pieza | Detalle |
| --- | --- |
| `finanzas.tasas_cambio` | Una fila por fuente y fecha valor. No se pisa: es historico |
| Ruta `/api/cron/tasa` | Lee la pagina, valida y guarda. Protegida con un secreto en la cabecera |
| Validacion | Numero positivo, fecha valor reconocible, y salto maximo respecto a la anterior. Una lectura rara **no se guarda** y avisa |
| Entrada a mano | El operador siempre puede registrar o corregir una tasa; queda en la auditoria |
| En la factura | La tasa se **copia** al emitir, con su fuente y su fecha. Lo que pase despues con la tabla no la toca |

**Cada hora.** El BCV publica una tasa por dia habil, asi que la consulta
horaria sirve para enterarse pronto, no porque cambie cada hora.

| Donde | Como |
| --- | --- |
| Vercel, plan gratuito (**decidido**) | Tarea programada **una vez al dia** |
| Ademas | Refresco al usar: si la ultima lectura tiene mas de una hora cuando alguien abre finanzas, se vuelve a leer. Da la misma frescura sin tarea programada |
| VPS | `cron` del sistema llamando a la misma ruta, cada hora |

**A comprobar tras desplegar:** que el BCV responde a los servidores de Vercel.
Aqui respondio, pero es habitual que filtre por pais de origen.

### 6.2 Correo por Gmail

Se puede, y con lo que ya hay: el mismo cliente OAuth, anadiendo el permiso
`gmail.send`, y la API de Gmail llamada por `fetch`. Sin libreria.

| Punto | Detalle |
| --- | --- |
| Remitente | La cuenta que autoriza. **Los correos saldran de esa direccion**, y por eso no puede ser una personal |
| Permiso | `gmail.send` solo permite enviar; no lee el buzon |
| Limite | Unos 2.000 envios al dia en Workspace, 500 en una cuenta personal. Sobra |
| Autorizacion | Hay que repetir `drive:probar` pidiendo los dos permisos, lo que emite un token nuevo |
| Mientras tanto | Modo simulado y bandeja de salida |

**`gmail.send` es un permiso «sensible» para Google**, y eso es lo que decide
la pregunta de la cuenta (seccion 11): con el proyecto de GCP dentro de la
organizacion de Workspace de la empresa, la pantalla de consentimiento se marca
como **Interna** y no hay verificacion, ni aviso de «aplicacion no verificada»,
ni caducidad a los 7 dias. Con una cuenta personal, las tres cosas aparecen.

### 6.3 Lo que no es un servicio externo

Tampoco existe en Vercel:

| Necesidad | Mientras tanto |
| --- | --- |
| Tareas programadas (fases atrasadas, proforma recurrente, enlaces vencidos) | Estado derivado al leer, y contadores en la portada con un boton para actuar. La de la tasa si existe (seccion 6.1) |
| Tiempo real | `revalidatePath` y recarga |
| PDF con un navegador en el servidor (Playwright, como pedia el paquete) | No cabe en Vercel. Se generan con una libreria de PDF (seccion 7.8) |

---

## 7. Finanzas

Cuentas por cobrar a clientes. No hay proveedores ni cuentas por pagar.

### 7.1 Ciclo y estados

```
Presupuesto ──aprobado──▶ Proforma ──▶ Factura ──▶ Pagos y retenciones ──▶ Estado de cobro
```

| Documento | Estados | Notas |
| --- | --- | --- |
| Presupuesto | `borrador` → `enviado` → `aprobado` o `rechazado` | El cliente no ve borradores. «Vencido» no se guarda: se deriva de `valido_hasta` |
| Proforma | `borrador` → `emitida` → `facturada` o `anulada` | Puede ser recurrente |
| Factura | `emitida` o `anulada` | Nace emitida. «Pagada» no se guarda: se calcula |
| Pago y retencion | `por_confirmar` → `confirmado` o `rechazado` | El cliente solo crea por confirmar |

### 7.2 Quien hace que

«Operador» es el rol `admin` o el cargo `administracion`. Los dos pueden lo mismo.

| Operacion | Quien |
| --- | --- |
| Crear, editar y enviar presupuestos | Operador |
| Aprobar o rechazar un presupuesto | Cliente con el permiso de finanzas |
| Registrar la aprobacion a nombre de un cliente sin cuenta | Operador; queda en la auditoria |
| Generar la proforma desde el presupuesto aprobado; emitirla y anularla | Operador |
| Emitir, anular y marcar como impresa una factura | Operador |
| Reportar un pago o una retencion | Cliente con el permiso de finanzas |
| Confirmar o rechazar pagos y retenciones | Operador |
| Editar ajustes: emisor, talonario, medios de pago, tasa a mano | Operador |

Los trabajadores de cualquier otro cargo no ven nada de finanzas.

### 7.3 Lo que la base impone por si misma

| Regla | Como |
| --- | --- |
| La app no puede borrar en `finanzas` | El rol `conejo_app` solo tiene `SELECT`, `INSERT` y `UPDATE` |
| Una factura emitida no se edita ni se borra | Trigger. Solo cambian la anulacion, el PDF y la marca de impresa; una anulada no se reactiva |
| Los renglones de una factura son inmutables | Trigger. Solo se insertan en la transaccion que crea la factura |
| Numeracion sin saltos | `finanzas.siguiente_numero(clave)` bloquea la fila del contador; si la transaccion falla, el numero no se consume |
| Los totales cuadran | `CHECK`: total = base imponible + exento + IVA |
| Anular exige motivo, fecha y responsable | `CHECK` |
| Una factura en bolivares lleva tasa y fuente | `CHECK` |
| Un pago confirmado tiene monto aplicado; uno rechazado, motivo | `CHECK` |
| «Quien lo hizo» apunta a un usuario real | Claves foraneas a `usuarios` |

### 7.4 Seguridad por fila

La app se conecta como `conejo_app`, sin `BYPASSRLS`, y cada operacion pasa por
`conSesion`, que declara usuario, rol, cargo y empresa dentro de la
transaccion. Sin sesion declarada no se ve ninguna fila.

| Politica | Regla |
| --- | --- |
| Operador | Acceso total. Lo decide `finanzas.es_operador()`: rol `admin`, o rol `trabajador` con cargo `administracion` |
| Cliente lee presupuestos y proformas | De su empresa, y no en borrador |
| Cliente lee facturas | De su empresa |
| Cliente lee renglones, pagos y retenciones | Si el documento padre le es visible |
| Cliente reporta pagos y retenciones | Solo por confirmar, a su nombre, sobre una factura emitida que ve |
| Cliente lee medios de pago | Solo los activos |

Un cliente tiene acceso si su fila en `clientes` tiene `puede_ver_finanzas`, y
su usuario y su empresa estan activos.

**Aprobar un presupuesto** no es un `UPDATE` del cliente —podria cambiar
montos—: es la funcion `finanzas.cliente_resuelve_presupuesto(id, aprobar)`,
que solo toca estado, quien y cuando, y rechaza si el presupuesto ya vencio.

Con RLS, un `UPDATE` sobre filas que no se ven no falla: afecta cero. Las
actions comprueban siempre el numero de filas.

### 7.5 Calculo

| Concepto | Formula |
| --- | --- |
| Subtotal del renglon | cantidad × precio unitario, redondeado a 2 decimales |
| Base imponible | Suma de los renglones gravados |
| Monto exento | Suma de los renglones exentos |
| IVA | Base imponible × porcentaje (16), redondeado |
| Total | Base imponible + exento + IVA |
| Retencion de IVA esperada | IVA × porcentaje de la empresa (75 o 100), si es agente de retencion |
| Neto a cobrar | Total − retencion esperada |

- **Lo calcula PostgreSQL**, con `NUMERIC` y `round(…, 2)`.
- `pg` devuelve `NUMERIC` como texto: los importes son `string` en los tipos y
  **nunca se convierten a `number`**.
- La vista previa del formulario usa `src/lib/finanzas/calculo.ts`, con
  aritmetica entera. Es orientativa; lo que vale es lo que calcula el servidor.
- Redondeo: mitad hacia arriba, sobre cada renglon y sobre el IVA, nunca sobre
  acumulados.

### 7.6 Moneda y tasa

Presupuesto y proforma se arman y se muestran en **dolares**. La factura se
emite en **bolivares a la tasa del dia**: guarda el monto de referencia en
dolares, la tasa, su fuente y su fecha, y esos datos quedan congelados. Una
factura emitida nunca se recalcula.

La tasa sale de `finanzas.tasas_cambio` (seccion 6.1); el operador puede
registrarla o corregirla a mano.

### 7.7 Emitir una factura

En una sola transaccion:

1. Tomar el numero con `finanzas.siguiente_numero`.
2. Insertar la factura con los importes de la proforma, la tasa del dia, la
   retencion esperada y los datos congelados del emisor y de la empresa.
3. Insertar los renglones.
4. Registrar el numero de control de la hoja.
5. Escribir la linea de auditoria.

La fecha de emision la pone la base en hora de Caracas. Corregir una factura es
anularla y emitir otra.

### 7.8 El PDF del talonario

La factura se imprime sobre papel preimpreso: el PDF lleva solo el texto
variable, cada dato en sus coordenadas en milimetros.

| Pieza | Detalle |
| --- | --- |
| Generacion | En el servidor, con una libreria de PDF en JavaScript puro (propuesta: `pdf-lib`). Se instala al llegar a esta etapa |
| Coordenadas | En `finanzas.ajustes`, editables sin desplegar: calibrar es imprimir, medir y ajustar |
| Calibracion | Hoja con cuadricula en milimetros y modo guia que recuadra cada campo, con el mismo generador |
| Entrega | Por una ruta API protegida. Se puede regenerar identico, porque sale de datos congelados |
| Punto de partida | `appFacturas/templates/factura-talonario.html` y `config/emisor.json`, con coordenadas de ejemplo |

Presupuestos y proformas se generan igual, con la marca.

### 7.9 Pagos, retenciones y cobro

- El cliente reporta: medio, referencia, fecha, monto, moneda y comprobante.
- El operador confirma fijando el **monto aplicado** en la moneda de la factura,
  con la tasa usada si pago en otra; o rechaza con motivo.
- Cada pago pertenece a una sola factura.
- **Medios de pago**: viven en `finanzas.ajustes`, cada uno con nombre, monedas
  que acepta, si pide referencia, sus datos para pagar y si esta activo. Los
  carga un operador; el cliente solo ve los activos. Se desactivan, no se
  borran: un pago viejo puede citar uno retirado.
- Una factura de un agente de retencion queda «abierta» hasta que se confirma
  la retencion de IVA que cubre lo esperado.

El estado de cobro lo calcula la vista `finanzas.v_estado_cobro_factura`:
pagado confirmado, por confirmar, retencion confirmada, saldo, estado
(`pendiente`, `parcial`, `pagada`, `anulada`) y retencion abierta. Un pago
por confirmar no reduce el saldo, y una anulada tiene saldo cero.

Cobranza: saldos por empresa y por antiguedad, en tramos de 0–30, 31–60, 61–90
y mas de 90 dias.

**Proforma recurrente.** Para contratos mensuales. No hay tareas programadas:
la portada de finanzas lista las que ya toca emitir, con un boton que deja el
borrador listo. Nunca se factura sola.

### 7.10 Comprobantes en Google Drive

| Punto | Detalle |
| --- | --- |
| Autenticacion | Cliente OAuth, no cuenta de servicio: una cuenta de servicio no tiene espacio propio |
| Permiso | `drive.file`: la app solo ve lo que ella crea. Por eso **la carpeta la crea el script, no una persona** |
| Carpeta | `ConejoApp/Comprobantes`, con una subcarpeta por empresa |
| Nombres | `pago-<id>-<fecha>`, `retencion-<id>-<fecha>`. El nombre original se descarta y el tipo se decide por la firma de los bytes |
| Variables | `DRIVE_CLIENT_ID`, `SECRET_DRIVE_KEY1`, `DRIVE_REFRESH_TOKEN`, `DRIVE_CARPETA_COMPROBANTES_ID` |
| Estado | **Probado el 2026-10-13** con `npm run drive:probar`: autoriza, crea la carpeta, sube, lee y borra. Las variables faltan en Vercel |
| Descarga | Por una ruta API: comprueba la guardia, consulta el pago dentro de `conSesion` y transmite el archivo. El id de Drive nunca llega al navegador |
| Subida | Primero a Drive, despues la fila. Si la fila falla queda un archivo huerfano, que es preferible a una fila que apunta a nada |

**Cuenta.** Hoy esta autorizada la personal del responsable. Al pasar a la de la
empresa se repite `drive:probar` y se cambian las variables; **los archivos ya
subidos no se mueven solos**, asi que el cambio va antes de recibir comprobantes
reales. Mientras la pantalla de consentimiento de GCP este en «Testing», el
acceso caduca a los 7 dias.

### 7.11 Fuera del alcance

Proveedores y cuentas por pagar, notas de credito y debito, descuentos, varias
alicuotas de IVA en un documento, anticipos y saldos a favor, libro de ventas,
facturacion electronica, pasarela de pago y contabilidad.

### 7.12 Reglas de negocio de los otros bloques

El detalle de fases, correcciones, briefs y pantallas esta en el paquete
original, en la carpeta hermana `appFacturas`:

| Tema | Donde |
| --- | --- |
| Bateria de fases, correccion, visibilidad | `appFacturas/docs/03-bateria-de-fases.md` |
| Briefs | `appFacturas/docs/05-briefs.md` |
| Pantallas | `appFacturas/docs/04-pantallas.md` y `design/` |

Esas reglas se mantienen. Como se construyen lo dice este plan, y donde difieran
manda este plan.

---

## 8. Mejoras a flujos que ya existen

| Mejora | Que cambia |
| --- | --- |
| **Hooks pasa a ser una herramienta** | Deja de ser un modulo suelto y se convierte en la primera herramienta que la app ofrece para cumplir una tarea (seccion 8.1) |
| **El inicio del cliente deja de estar vacio** | Hoy un cliente entra y solo ve su perfil. Pasa a ver sus proyectos, lo que espera su revision y su saldo |
| **La campana de avisos funciona** | El boton del layout deja de estar deshabilitado |
| **El cargo `cuentas` empieza a servir** | Es quien opera la bandeja de briefs y el tablero |
| **Empresas muestra el trabajo real** | La ficha de una empresa cuenta hoy contactos y hooks; suma proyectos activos y saldo |
| **El alta de un cliente se puede hacer sola** | Al aceptar el brief de un prospecto se crean la empresa y su usuario en una transaccion, en lugar de dos altas a mano en dos modulos |
| **La foto de perfil vuelve con la mudanza** | Su codigo esta comentado, no borrado, y la carpeta `public/uploads/avatares` se conserva. **Al cambiar de servidor hay que decidir donde viven las fotos**: en el disco del VPS —con un volumen que sobreviva a los despliegues y entre en las copias de seguridad— o en el adaptador de archivos, como los comprobantes. Lo segundo evita tener dos sitios donde se guardan archivos |

---

### 8.1 Tareas, catalogo de servicios y herramientas

El paquete define el trabajo como piezas con cinco fases fijas. Lo que pide el
dia a dia es mas fino: un objetivo que se desglosa en tareas, que se asignan y
se cumplen. Las dos cosas caben juntas si las tareas viven **dentro** de las
fases:

```
Proyecto                       el objetivo: lo que pidio el cliente
  └─ Pieza                     un entregable: lo que el cliente aprueba
       └─ 5 fases              la bateria que ve el cliente; no cambia
            └─ Tareas          el trabajo interno: quien hace que, y con que
                 └─ Herramienta   opcional: lo que la app da para hacerla
```

| Regla | Por que |
| --- | --- |
| Las cinco fases se quedan fijas | Es lo que el estudio le promete al cliente y lo que hace calculable el avance. El cliente nunca ve tareas |
| Las tareas cuelgan de las fases de trabajo (1 y 3) | Las fases 2, 4 y 5 son controles, no trabajo |
| Una tarea se asigna a una persona, de cualquier cargo | Resuelve quien hace el trabajo: no depende del cargo, depende de la asignacion |
| Una fase se puede completar cuando sus tareas estan listas | Quien la completa sigue siendo el ejecutivo |
| Las tareas salen propuestas por el tipo de servicio, y el ejecutivo las ajusta | Ni todo fijo ni todo a mano |

**Catalogo de servicios.** Lo que el cliente puede pedir no es libre: cada
servicio que vende la agencia define su formato de brief, su plantilla de fases,
los tipos de pieza habituales y las tareas sugeridas. Va en codigo, como el
catalogo de hooks. Al aceptar un brief el proyecto nace ya armado con eso, y el
ejecutivo quita, anade y asigna.

**Herramientas.** Un registro en codigo, igual que el de modulos. Cada
herramienta declara para que tipo de tarea sirve y cuando se considera hecha.
Hooks es la primera: una tarea «escribir el hook» abre el canvas con la empresa
ya puesta, y la tarea queda lista cuando la ficha aprueba la auditoria. En el
menu, «Hooks» pasa a colgar de un grupo «Herramientas», y sigue pudiendose usar
suelto.

| Tabla | Cambio |
| --- | --- |
| `portal.tareas` (nueva) | Fase de la pieza, titulo, responsable, herramienta, estado, lista en |
| `fichas_hook` | `tarea_id` opcional |

**«Marcar como lista» pasa de la fase a la tarea.** En el paquete produccion
marcaba lista la fase entera; aqui cada persona marca la suya, y la fase queda
lista para que el ejecutivo la complete cuando lo estan todas. Una fase de
trabajo sin tareas se completa como en el paquete.

**El cliente no ve tareas.** Ni su titulo, ni quien las hace: solo la bateria.
La politica RLS de `portal.tareas` no deja pasar a ningun cliente.

**Falta del negocio:** la lista de servicios que vende la agencia y las tareas
tipicas de cada uno.

## 9. Interfaz

### 9.1 El menu, por secciones

```
GENERAL
  Inicio

TRABAJO
  Tablero                    proyectos con su bateria y alertas
  Proyectos                  piezas, fases y tareas
  Briefs                     bandeja de lo que piden los clientes
  Mi trabajo                 las tareas que tengo asignadas

HERRAMIENTAS
  Hooks ▾
    Manual · Documentacion · Hooks · Auditor · Metricas · Historial

FINANZAS
  Finanzas ▾
    Presupuestos · Proformas · Facturas · Pagos · Cobranza · Ajustes

SISTEMA
  Usuarios
  Empresas
  Auditoria
  Bandeja de salida          correos simulados

MI ESPACIO                   solo clientes
  Mis proyectos              avance, y aprobar o pedir correccion
  Mis briefs                 pedir un trabajo nuevo
  Facturacion                presupuestos, facturas y reportar pagos

  Mi perfil                  siempre el ultimo
```

| Seccion | Admin | Cuentas | Administracion | Produccion, diseno, redes | Cliente |
| --- | --- | --- | --- | --- | --- |
| Inicio y Mi perfil | Si | Si | Si | Si | Si |
| Tablero, Proyectos, Briefs | Si | Solo sus empresas | No | No | No |
| Mi trabajo | Si | Si | No | Si | No |
| Hooks | Si | No | No | Solo redes | No |
| Finanzas | Si | No | Si | No | No |
| Sistema | Si | No | No | No | No |
| Mi espacio | No | No | No | No | Si. Facturacion, solo con el permiso de finanzas |

Tres decisiones de diseno del menu:

- **«Herramientas» es un rotulo de seccion, no un desplegable.** Como
  desplegable, Hooks quedaria a tres niveles (Herramientas → Hooks → Auditor) y
  la navegacion solo soporta uno. Cada herramienta nueva se suma al lado.
- **La vista de finanzas del cliente se llama «Facturacion».** El paquete la
  llama «Administracion», nombre que aqui ya usa un cargo.
- **Hooks lo sigue viendo solo `redes`**, y el admin. Quien reciba una tarea de
  hook sin ser de redes llega a la herramienta desde la tarea.

### 9.2 Rutas

| Modulo | Ruta | Contenido |
| --- | --- | --- |
| Tablero | `/dashboard/tablero` | Proyectos con su bateria y las cuatro alertas |
| Proyectos | `/dashboard/proyectos` | Listado, matriz de piezas × fases, ficha de pieza con sus tareas |
| Briefs | `/dashboard/briefs` | Recibidos, aclaraciones, las tres decisiones |
| Mi trabajo | `/dashboard/mi-trabajo` | Mis tareas por fecha, «marcar como lista», abrir la herramienta |
| Hooks | `/dashboard/hooks/**` | Sin cambios de ruta |
| Finanzas | `/dashboard/finanzas/**` | Presupuestos, proformas, facturas, pagos, cobranza, ajustes |
| Auditoria | `/dashboard/auditoria` | Quien hizo que |
| Bandeja de salida | `/dashboard/salida` | Correos simulados |
| Mis proyectos | `/dashboard/mis-proyectos` | Sus proyectos, revision en fase 5, historial |
| Mis briefs | `/dashboard/mis-briefs` | Sus briefs, nuevo brief |
| Facturacion | `/dashboard/facturacion` | Documentos, estado de cuenta, reportar pago |
| Brief por enlace | `/brief/[token]` | La unica ruta publica nueva |

### 9.3 Cambios en el armazon

| Sitio | Cambio |
| --- | --- |
| `src/lib/navegacion.ts` | Cada modulo declara su `seccion`. Criterios nuevos de visibilidad: solo clientes, un permiso del cliente, y «tiene tareas asignadas» |
| `Sidebar` | Pinta un rotulo por seccion; hoy solo existe «General». Una seccion sin modulos visibles no se pinta |
| Navegacion movil | **El cajon de hamburguesa se sustituye por una barra inferior de atajos y una hoja con el menu completo** (`docs/planMejoraDiseno.md`, fase 2). Sin boton central. La hoja agrupa por las mismas secciones, se desplaza y trae buscador, porque el menu va a ser largo; cada modulo declara su prioridad para la barra. Los modulos del portal se construyen ya sobre esa navegacion |
| Buscador global | Sin cambios: sigue leyendo del mismo registro |
| `src/proxy.ts` | Lista de rutas por tipo de usuario, la ruta publica del enlace y el paso de peticiones con cookie de renovacion |
| `components/ui` | Componente nuevo: la bateria de cinco segmentos, con texto ademas de color y `aria-label` con el porcentaje |

---

## 10. Plan por etapas

| Etapa | Entrega | Depende de |
| --- | --- | --- |
| **1. Cimientos de seguridad** | Rol `conejo_app`, `conSesion`, guardias con datos frescos, sesiones con renovacion, bloqueo de intentos, cambio obligatorio de clave, empresa activa, cabeceras, auditoria, cargo `produccion`, menu por secciones. **La app actual queda mas segura aunque no se construya nada mas** | Nada |
| **2. Externos y avisos** | Adaptadores, JSON, bandeja de salida, campana, lectura de la tasa del BCV | Nada. El correo real espera a la cuenta de la empresa |
| **3. Proyectos, bateria y tareas** | Proyectos, piezas, fases, tareas, catalogo con los dos servicios ya definidos, tablero, Mi trabajo, Hooks como herramienta | Nada |
| **4. Vista del cliente y revision** | Mis proyectos, versiones, aprobar o corregir, historial | Etapa 3 |
| **5. Presupuestos y proformas** | Editor, aprobacion del cliente, proforma ligada a proyectos | Etapa 1 |
| **6. Briefs** | Formato de producto, envio, bandeja, enlace de prospecto, brief → presupuesto → proyecto | Etapas 2, 3 y 5 |
| **7. Facturas, pagos y cobranza** | Emision, talonario, comprobantes, estado de cuenta | **Negocio**: moneda y tasa, medios de pago, contador, hoja del talonario |
| **8. Endurecimiento y piloto** | Verificacion en dos pasos, prueba con un cliente real | — |
| **9. Mudanza al VPS** | Correo real, tareas programadas cada hora, tiempo real, video por el servidor, copias de seguridad, foto de perfil | Fecha de la mudanza |

Las etapas 1 a 6 se pueden construir sin esperar al negocio. Cada una termina
en algo utilizable.

### 10.1 Ramas y publicacion

| Regla | Detalle |
| --- | --- |
| Una rama por funcionalidad | `feat/…`, `fix/…`, `chore/…`. Una etapa grande se parte en varias |
| A `main` solo lo terminado | Con `lint`, `typecheck` y las pruebas que toquen en verde |
| Subir `main` publica | Por eso el orden: **primero se pega el SQL en Neon, despues se sube** |
| El pegado en Neon | Lo hace el responsable. Cada etapa que toque el esquema entrega su SQL y dice que comprobar despues |

**La base de produccion tiene datos reales de usuarios.** Hoy
`npm run sql:produccion` vuelca el esquema **y** la semilla entera: empresa de
ejemplo, cuatro cuentas, reglas y referencia de muestra. Eso cambia en la etapa
1: el SQL de produccion pasa a llevar solo lo que la aplicacion necesita para
funcionar.

| Va a produccion | No va |
| --- | --- |
| Esquema: tablas, columnas, indices, vistas, funciones, triggers, politicas | Empresa de ejemplo |
| Filas de las que depende la logica: roles y cargos | Cuentas de prueba |
| Las 42 aperturas de hooks, que son contenido de la casa y se insertan sin pisar las existentes | Reglas y referencia de muestra |

Las columnas nuevas sobre tablas con datos entran siempre con un valor por
defecto que no cambia el comportamiento de lo que ya existe. El caso que
importa: `debe_cambiar_clave` nace en falso para los usuarios actuales, o se
les obligaria a todos a cambiar la contrasena el dia de la publicacion.

La semilla completa sigue existiendo para desarrollo (`npm run seed`).

### 10.2 Pruebas

| Bateria | Herramienta | Que cubre |
| --- | --- | --- |
| `tests/unitarias` | Playwright, sin navegador | Funciones puras: calculo de finanzas, avance y correccion de fases, hash del brief, auditor, lectura de la pagina del BCV sobre HTML guardado |
| `tests/integracion` | Playwright, con navegador | Recorridos reales por rol: accesos, sesion y renovacion, cada flujo de punta a punta |
| `db/pruebas` | Scripts propios | Modelos y RLS contra la base |

Playwright corre en el host: la imagen de desarrollo es Alpine y sus
navegadores no funcionan ahi. Cada etapa anade sus pruebas; una funcionalidad
sin su recorrido de integracion no se une a `main`.

### 10.3 Herramientas del asistente

Instaladas el 2026-10-13, antes de empezar la ejecucion:

| Herramienta | Donde | Para que |
| --- | --- | --- |
| Context7 | `.mcp.json` | Documentacion actual de librerias. Version fijada |
| `impeccable` | `.claude/skills` | Criterio y comandos de diseno de interfaz |
| `design-taste-frontend` | `.claude/skills` | Criterio visual. Esta pensada para paginas de presentacion, no para paneles: aplica al login y a lo que ve el cliente mas que al tablero |
| Skills de Emil Kowalski | `.claude/skills` | Animacion, rendimiento del movimiento y sensacion nativa en movil. Se instalaron las nueve de web; quedaron fuera las de Swift, Expo y eleccion de librerias |

Las skills aconsejan y el contrato manda: nada de librerias de componentes,
`dark:` ni colores literales.

---

## 11. Lo que necesito de ti

### Ya resuelto

| Que | Resultado |
| --- | --- |
| Rol de Neon | `neondb_owner`: no es superusuario, pero **si tiene `BYPASSRLS`**. Confirma la opcion A |
| Cargos | `cuentas` ejecutivos; `produccion` nuevo |
| Asignaciones | Cada ejecutivo ve solo sus empresas |
| Sesiones, cierre al cambiar clave, clave provisional, empresa desactivada, auditoria | Aceptado todo |
| Destino | Un VPS, previsiblemente |

### La cuenta de Google: pendiente

**De momento se sigue con la personal del responsable**, porque crear el
proyecto de GCP en la empresa pide una tarjeta. Mientras tanto el correo se
queda en modo simulado y Drive solo recibe archivos de prueba. Los motivos
para cambiarla en cuanto se pueda:

1. Los archivos quedan en el Drive de quien autoriza, y moverlos despues obliga
   a actualizar ids en la base.
2. Las credenciales de GCP pertenecen a quien creo el proyecto.
3. **Los correos saldran de esa cuenta.** Un presupuesto no puede llegarle a un
   cliente desde un Gmail personal.

Lo que hay que pedir:

| Que | Para que |
| --- | --- |
| Una cuenta de Google Workspace de la empresa dedicada a esto (por ejemplo `portal@…`, o la `cuentas@…` que ya existe) | Sera el remitente de los correos y la duena de los archivos |
| El proyecto de GCP creado **dentro de la organizacion** de Workspace, no en una cuenta suelta | Permite marcar la pantalla de consentimiento como Interna |
| API de Drive y API de Gmail habilitadas en ese proyecto, y un cliente OAuth nuevo | Sustituye al actual |

Con eso se vuelve a ejecutar `npm run drive:probar` y se cambian cuatro
variables. El codigo no cambia.

### Valores por defecto

Se construye con ellos salvo que digas otra cosa. Cada uno se cambia en un solo
sitio.

| Etapa | Que | Valor |
| --- | --- | --- |
| 1 | Tiempo sin actividad antes del modal de sesion | 15 minutos |
| 1 | Bloqueo por intentos fallidos | 5 fallos, 15 minutos |
| 1 | Conservacion de la auditoria | Siempre |
| 1 | Cuentas de prueba en produccion | Dejan de sembrarse; las que ya esten, las desactiva el admin |
| 1 | Contrasena del rol `conejo_app` | La pone el responsable en Neon y en Vercel. No pasa por el repositorio |
| 2 | Que avisa la campana, y a quien | La matriz del paquete (`appFacturas/docs/08`) |
| 3 | Cuando suma el 20 % de una fase | Al completarla |
| 3 | Limite de rondas de correccion | Sin limite; se muestra cuantas lleva |
| 3 | Plazo para que el cliente revise | Sin plazo |
| 3 | Tipos de pieza | Post, carrusel, reel, historia, video, logo y otros |
| 3 | Lo que ve quien hace una tarea | Solo el nombre de la empresa y del proyecto |
| 4 | Permiso «Aprobar» de un usuario cliente | Casilla por persona, apagada por defecto |
| 8 | Codigo QR de los dos pasos | Se decide al llegar |

### Del negocio

| Que | Bloquea |
| --- | --- |
| Moneda de facturacion y fuente de la tasa | Facturas |
| Medios de pago reales | Pagos |
| Validacion del contador (campos de la factura, IGTF, ISLR, numero de control) | Facturas |
| Hoja escaneada del talonario | Impresion |
| La lista de servicios que vende la agencia, y las tareas tipicas de cada uno | El catalogo de servicios (seccion 8.1) |
| Texto definitivo de las preguntas del brief de Diagnostico | Ese formato; el de Desarrollo de Producto esta completo |
| Cuando suma el 20 % de una fase, limite de rondas, plazo de revision del cliente | Nada: hay valores por defecto (al completarla, sin limite, sin plazo) |

### Datos

| Que | Para que |
| --- | --- |
| La cuenta de Workspace y el proyecto de GCP de la empresa, cuando haya tarjeta | Drive y correo reales |
| Fecha aproximada de la mudanza al VPS | Decide cuanto esfuerzo merece lo provisional |

---

## 12. Pendientes de logica y de negocio

Lo que no esta decidido y no se puede decidir programando. Ordenado por la
etapa a la que le hace falta. Donde hay propuesta, se sigue hasta que el negocio
diga otra cosa; lo marcado como **bloquea** detiene esa parte.

### Proyectos y tareas (etapa 3)

| # | Pregunta | Propuesta |
| --- | --- | --- |
| P1 | ¿Un proyecto puede empezar sin presupuesto aprobado? | Si. El ejecutivo puede crearlo a mano; el vinculo con un presupuesto es opcional |
| P2 | Redes sociales mensual: ¿un proyecto por mes y por empresa? ¿Lo crea el ejecutivo o nace solo? | Uno por mes, lo crea el ejecutivo desde la plantilla. No hay tareas programadas |
| P3 | Tareas tipicas de cada servicio | Las propongo yo para los dos servicios definidos y las corrige el negocio |
| P4 | ¿Que pasa con las tareas de alguien que se desactiva? | No se puede desactivar con tareas abiertas sin reasignarlas antes |
| P5 | ¿Y con las empresas de un ejecutivo que se va? | Igual: se reasignan antes |
| P6 | ¿Una empresa puede tener mas de un ejecutivo? | Si |
| P7 | Rutas de correccion: redaccion vuelve a la fase 1, diseno a la 3, proyectos especiales siempre a la 3 | Las del paquete |
| P8 | ¿Cuando se da por cerrado un proyecto? | Cuando todas sus piezas estan aprobadas; el ejecutivo lo cierra |
| P9 | ¿Se puede quitar una pieza ya empezada? | Se cancela con motivo, no se borra; deja de contar para el avance |

### Vista del cliente (etapa 4)

| # | Pregunta | Propuesta |
| --- | --- | --- |
| C1 | ¿Quien de la empresa puede aprobar piezas si nadie tiene la casilla? | Nadie: el ejecutivo ve el aviso de que falta marcarla |
| C2 | ¿El cliente puede descargar el archivo antes de aprobar? | No. Lo ve; lo descarga al aprobar |
| C3 | ¿El cliente ve las fechas estimadas de cada fase? | Si |

### Finanzas (etapas 5 y 7)

| # | Pregunta | Propuesta | |
| --- | --- | --- | --- |
| F1 | «La tasa del dia»: ¿la del dolar BCV del dia de emision? | Si | Confirmar |
| F2 | Si ese dia el BCV no publico (fin de semana, feriado) | La ultima publicada | |
| F3 | Un pago en dolares contra una factura en bolivares: ¿a que tasa se aplica? | A la del dia del pago; el operador la confirma al aplicar | Confirmar con el contador |
| F4 | ¿Los precios de los renglones llevan IVA incluido? | No: el IVA se suma aparte | |
| F5 | ¿Cuantos dias de credito tiene una factura? | Un valor por defecto en Ajustes, que se puede cambiar por empresa | **Falta el numero** |
| F6 | ¿Cuanto dura valido un presupuesto? | 15 dias, editable al crearlo | |
| F7 | ¿Desde que numero de factura y de control se empieza? | — | **Bloquea la primera factura** |
| F8 | Una factura con mas renglones de los que caben en la hoja | No se permite: se emite en dos facturas | Confirmar con el contador |
| F9 | Corregir una factura es anularla y emitir otra; no hay notas de credito | Asi | Confirmar con el contador |
| F10 | Medios de pago reales y sus datos | Los carga el operador | **Bloquea pagos** |
| F11 | Campos obligatorios de la factura, vigencia del talonario, numero de control | — | **Bloquea facturas. Contador** |
| F12 | IGTF en pagos en divisas y retenciones de ISLR | No se implementan hasta que el contador responda | **Contador** |
| F13 | Hoja del talonario, sin llenar | — | **Bloquea la impresion** |
| F14 | ¿Quien puede aprobar un presupuesto en nombre de un cliente sin cuenta? | Un operador, y queda en la auditoria | |

### Briefs (etapa 6)

| # | Pregunta | Propuesta |
| --- | --- | --- |
| B1 | Al aceptar el brief de un prospecto, ¿que datos minimos hacen falta para crear la empresa? | Nombre y RIF; el resto se completa despues |
| B2 | ¿Quien puede llenar briefs de una empresa? | Cualquier usuario de esa empresa |
| B3 | ¿Hasta cuando se puede enviar una version 2? | Hasta que el brief queda validado |
| B4 | Texto definitivo de las preguntas del brief de Diagnostico | **Falta.** Ese formato no se publica hasta tenerlo |
| B5 | Servicios que vende la agencia, mas alla de los dos definidos | **Falta la lista** |

### Transversales

| # | Pregunta | Propuesta |
| --- | --- | --- |
| T1 | ¿Dos pasos obligatoria para todos los trabajadores, o solo para admin y administracion? | Solo esos dos; disponible para el resto |
| T2 | Cuenta de Google de la empresa | Pendiente de tarjeta. Hasta entonces, correo simulado |
| T3 | Fecha de la mudanza al VPS | Sin fecha |

---

## 13. Riesgos

| Riesgo | Efecto | Mitigacion |
| --- | --- | --- |
| El alcance se multiplico por cuatro | Meses de trabajo, no semanas | Etapas que entregan algo usable cada una; la 1 ya vale por si sola |
| Cambiar el rol de conexion rompe la app actual | Caida de modulos existentes | Etapa 1 aislada, con `prueba:modelos` corriendo como el rol nuevo |
| Limite de tamano de peticion en Vercel | No caben videos por el servidor | Enlaces externos hasta la mudanza |
| Correo simulado | El prospecto no recibe su enlace solo | Bandeja de salida y entrega a mano, hasta tener la cuenta de la empresa |
| La pagina del BCV cambia de estructura o bloquea a los servidores | Deja de llegar la tasa | Validacion estricta, aviso al operador y entrada a mano |
| Migrar pegando SQL en Neon con mas de 25 tablas nuevas | Un error a medias deja el esquema inconsistente | El archivo es idempotente y se prueba entero en local antes |
| Dos repositorios de especificacion | El plan y el paquete se desincronizan | Este documento manda; el paquete es referencia de reglas de negocio |
