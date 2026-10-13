# Plan de integracion del portal completo en Conejo App

Fecha: 2026-10-13. Sustituye como plan maestro a `docs/integracionFinanzas.md`,
que pasa a ser el capitulo de finanzas (seccion 7).

**Fuentes.** El paquete de especificacion `appFacturas` (documentos 01 a 10,
esquema, reglas SQL, configuracion y maquetas), su diagnostico, y el codigo de
Conejo App en `main` (commit `b559385`). Los huecos de seguridad de la seccion 5
estan comprobados contra el codigo, con el archivo donde se ven.

## Decisiones tomadas

| Tema | Decision |
| --- | --- |
| Alcance | **Todo el flujo**: brief → presupuesto → proyecto y piezas con bateria de 5 fases → revision del cliente → proforma → factura → pagos y retenciones |
| Dependencias | Solo las imprescindibles. Sigue sin entrar ninguna libreria nueva |
| Seguridad por fila | Opcion A: la app se conecta con el rol sin privilegios `conejo_app` |
| Quien opera finanzas | Rol `admin` y cargo `administracion` |
| Comprobantes | Google Drive, `ConejoApp/Comprobantes`. Probado el 2026-10-13 |
| Servicios externos | **Simulados con JSON** mientras la app viva en Vercel (seccion 6) |
| Plataforma | Vercel es temporal: la app se mudara. El plan separa lo que se construye ya de lo que se enciende tras la mudanza (seccion 10) |
| Aprovechar la integracion | Cerrar huecos de seguridad y mejorar flujos actuales (secciones 5 y 8) |

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
                      fija fechas, asigna                      │ piezas × 5 fases
                      completa fases  ◀── «lista» ──────────── trabaja fases 1 a 3
                      fase 4: envia al cliente
 fase 5: aprueba
 o pide correccion ─▶ la pieza vuelve a la fase que toque
                                            proforma → factura
 reporta pagos y retenciones ─────────────▶ confirma · cobranza
```

Tres bloques que hoy no existen en Conejo App, mas finanzas:

| Bloque | Que cubre |
| --- | --- |
| **Proyectos y bateria** | Proyectos por empresa, piezas, 5 fases por pieza, avance calculado, tablero interno con alertas, cola «Mi trabajo» |
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
| Cargo `cuentas`, que ningun modulo usa | Es el «ejecutivo de cuentas» del paquete |
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
| Plantillas del talonario y de la copia del brief | Se reutilizan como pages imprimibles |
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
| EJECUTIVO | rol `trabajador`, cargo `cuentas` | **A confirmar** (pregunta 2) |
| PRODUCCION | rol `trabajador`, cargos `diseno` y `redes` | **A confirmar** (pregunta 2) |
| — | cargo `administracion` | Opera finanzas; no ve produccion salvo decision contraria |
| Asignacion ejecutivo ↔ cliente | Tabla nueva `portal.asignaciones` | **A confirmar** si se quiere (pregunta 3) |
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
| `usuarios` | `version_sesion`, `debe_cambiar_clave`, `intentos_fallidos`, `bloqueado_hasta` (seccion 5) |
| `fichas_hook` | `pieza_id` opcional (seccion 8) |

### 4.2 Esquema `portal`

| Tabla | Que guarda |
| --- | --- |
| `asignaciones` | Que ejecutivo atiende a que empresa |
| `proyectos` | Empresa, nombre, tipo (`redes_sociales` o `especial`), estado, fecha estimada de cierre, brief de origen |
| `piezas` | Proyecto, titulo, tipo, orden, ronda, responsable |
| `pieza_contenido` | El `copy` de la pieza, **en tabla aparte** (ver abajo) |
| `pieza_fases` | Cinco filas por pieza: estado, fecha estimada, responsable, completada en, marcada lista en |
| `versiones` | Archivos o enlaces externos de una pieza: numero, ronda, fase, autor, enviada al cliente en |
| `revisiones` | Decision del cliente en la fase 5: aprobada o correccion, tipo, comentario, fases reabiertas |
| `comentarios_pieza` | Comentarios internos; nunca salen al cliente |
| `recursos_marca` | Boveda de marca por empresa |
| `prospectos` | Empresa y contacto de quien aun no es cliente |
| `briefs` | Formato y version, empresa o prospecto, estado, codigo, fechas, borrador en curso |
| `brief_versiones` | Contenido congelado al enviar, con su hash. Inmutable por trigger |
| `brief_aclaraciones` | Hilo entre ejecutivo y solicitante |
| `enlaces_brief` | Enlace privado del prospecto: solo el hash del token, vencimiento, revocacion |
| `eventos` | **Bitacora general** de solo anadir (sin `UPDATE`, `DELETE` ni `TRUNCATE`) |
| `notificaciones` | Avisos del portal, una fila por usuario |
| `correos_salida` | Cada correo que la app «envia» (seccion 6) |

Vistas: `portal.v_progreso_pieza` y `portal.v_progreso_proyecto`. **El avance
no se guarda**: no existen columnas de porcentaje ni de fase actual.

Las plantillas de fase no son tabla: van en `src/lib/portal/catalogo.ts`. Los
formatos de brief tampoco: son JSON versionados dentro del repositorio, y cada
version enviada guarda el texto exacto de sus preguntas.

**Por que `pieza_contenido` es una tabla y no una columna.** El paquete
protegia el `copy` solo en la capa de servicios; su propio diagnostico lo marca
como hueco (nada en la base impedia leerlo antes de la fase 5). RLS decide por
fila, no por columna: separando el contenido en su tabla, la base misma puede
negarselo al cliente hasta que la pieza llegue a la fase 5.

### 4.3 Esquema `finanzas`

Lo descrito en `docs/integracionFinanzas.md`, con cuatro cambios por el alcance
nuevo:

| Cambio | Detalle |
| --- | --- |
| Vuelven los vinculos | `presupuestos.brief_id`, `presupuestos.proyecto_id`, `facturas.proyecto_id`, y la tabla `proforma_proyectos` |
| La bitacora deja de ser propia | `finanzas.eventos` desaparece: todo escribe en `portal.eventos` |
| Los ajustes siguen aqui | `finanzas.ajustes` (emisor, talonario, medios de pago) |
| Los seis ajustes de su seccion 4.4 | Siguen pendientes de visto bueno (pregunta 1) |

---

## 5. Seguridad: lo que se cierra aprovechando la integracion

Cada hueco esta comprobado en el codigo actual.

| # | Hueco | Donde se ve | Efecto hoy | Arreglo |
| --- | --- | --- | --- | --- |
| 1 | Las actions de Usuarios y Empresas deciden con el **token**, no con la base | `requerirAdmin` en `src/actions/usuarios.ts` y `src/actions/empresas.ts`; `src/lib/sesion.ts:144-159` | Un administrador degradado o **desactivado** sigue pudiendo crear usuarios y restablecer contrasenas hasta 8 horas | `requerirAdmin` pasa a leer el usuario fresco, como ya hace `requerirCargo` |
| 2 | No hay forma de cerrar una sesion desde el servidor | Cambiar la contrasena (`src/actions/perfil.ts`) no toca ninguna sesion | Una sesion robada sobrevive al cambio de contrasena | `usuarios.version_sesion` viaja en el token; la guardia la compara. Sube al cambiar o restablecer contrasena, al desactivar y al cambiar rol o cargo |
| 3 | El login no limita intentos | `src/actions/auth.ts` no cuenta fallos | Fuerza bruta sin freno, solo ralentizada por bcrypt | `intentos_fallidos` y `bloqueado_hasta`: 5 fallos, 15 minutos. El mensaje no revela si la cuenta existe |
| 4 | La contrasena provisional no caduca ni obliga a cambiarse | `src/actions/usuarios.ts:184-207`: se genera y se entrega; no hay `debe_cambiar_clave` | La clave que conoce el administrador puede seguir en uso para siempre | `debe_cambiar_clave`: el dashboard redirige a cambiarla antes de dejar hacer nada |
| 5 | Un cliente de una empresa **desactivada** sigue entrando | `empresaActiva` solo se usa para pintar un aviso en `DetalleUsuario.tsx` | Hoy no ve nada sensible; con proyectos y finanzas, si | Login y `requerirEmpresa` exigen empresa activa. Las politicas RLS tambien |
| 6 | La app se conecta como superusuario de la base | `docker-compose.yml:25`, `.env.example` | Cualquier politica RLS seria decorativa | Rol `conejo_app` (decidido) |
| 7 | `vw_usuarios_completos` expone `password_hash` | `db/schema.sql:597` | Depende de que ningun modelo lo pida por error | Vista aparte solo para el login; la general deja de traerlo |
| 8 | Sin cabeceras de seguridad | `next.config.ts` no define `headers` | La app se puede incrustar en un marco ajeno; sin politica de contenido | `Content-Security-Policy`, `frame-ancestors 'none'`, `X-Content-Type-Options`, `Referrer-Policy`, HSTS |
| 9 | No hay bitacora general | Solo existe `ediciones_ficha` | No queda rastro de quien creo un usuario, desactivo una empresa o restablecio una clave | `portal.eventos`, que tambien registran los modulos actuales |
| 10 | El secreto de ejemplo del `.env.example` es valido | Mide mas de 32 caracteres, asi que `src/lib/jwt.ts` lo acepta | Un despliegue que olvide cambiarlo arranca firmando con un secreto publico | `jwt.ts` rechaza ese valor concreto en produccion |
| 11 | Tres cuentas de prueba con contrasena en el repositorio | `db/datos/semilla.mts` | Entran a produccion si se siembran alli | `sql:produccion` deja de incluirlas |

### Aislamiento entre clientes, en la base

El paquete solo ponia RLS en finanzas; el aislamiento de proyectos y briefs
dependia de que ningun servicio se equivocara. Ya que la app pasa a un rol sin
privilegios, se extiende:

| Sobre | Regla en la base |
| --- | --- |
| `portal.proyectos`, `piezas`, `pieza_fases`, `revisiones` | Un cliente solo ve filas de su empresa |
| `portal.pieza_contenido`, `versiones` | Un cliente solo las ve con la pieza en fase 5 o aprobada, y de las versiones solo la marcada como enviada |
| `portal.comentarios_pieza`, `correos_salida`, `asignaciones` | Un cliente no ve ninguna |
| `portal.briefs` y sus tablas | Un cliente solo ve los de su empresa |
| `portal.eventos` | Un cliente solo ve los tipos de la lista blanca, de su empresa |
| `finanzas.*` | Lo ya planificado |

Para los trabajadores la base deja pasar segun rol y cargo; el filtro fino (que
ejecutivo, que pieza asignada) lo aplica la capa de servidor.

`conSesionFinanzas` se generaliza a **`conSesion`**, que declara usuario, rol,
cargo y empresa, y por ella pasan todos los modelos nuevos. Sin sesion
declarada, cero filas.

### Lo que no se puede cerrar todavia

| Tema | Por que | Cuando |
| --- | --- | --- |
| Verificacion en dos pasos | Se puede hacer sin libreria (TOTP con `node:crypto`), pero es una etapa propia | Antes de emitir facturas reales. **A decidir** (pregunta 7) |
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
| **Correo** | Devuelve la respuesta de `correo.enviar.json` y **guarda el mensaje completo en `portal.correos_salida`** | SMTP o API del proveedor |
| **Tasa de cambio** | Devuelve `tasaCambio.bcv.json`. El operador puede corregirla a mano | Consulta a la fuente que decida el negocio |
| **Archivos** | Devuelve `archivos.subir.json` y guarda el archivo en una tabla de la base, con limite pequeno | Google Drive, que ya esta probado |

El modo se elige por variable de entorno, una por servicio (`CORREO_MODO`,
`TASA_MODO`, `ARCHIVOS_MODO`, con valores `simulado` o `real`). **Archivos
arranca en `real`** porque Drive ya funciona; los otros dos, en `simulado`.

**Los JSON no se escriben, se leen.** El disco de Vercel es de solo lectura,
asi que lo que cambia —el correo «enviado»— va a la base y no a un archivo.

**La bandeja de salida es lo que hace usable el modo simulado.** Hay correos de
los que depende el flujo: el enlace privado del prospecto, la bienvenida, la
copia del brief. Con el correo simulado nadie los recibiria. Una pantalla del
administrador lista `correos_salida` y permite copiar el contenido para
entregarlo a mano, que es lo que ya se hace hoy con la contrasena provisional.

Lo que no es un servicio externo pero tampoco existe en Vercel:

| Necesidad | Mientras tanto |
| --- | --- |
| Tareas programadas (fases atrasadas, proforma recurrente, enlaces vencidos) | Estado derivado al leer, y contadores en la portada con un boton para actuar |
| Tiempo real | `revalidatePath` y recarga |
| PDF en el servidor | Pages imprimibles desde el navegador |

---

## 7. Capitulos de detalle

| Capitulo | Donde |
| --- | --- |
| Finanzas | `docs/integracionFinanzas.md`, con los cambios de la seccion 4.3 |
| Bateria de fases, correccion, visibilidad | `appFacturas/docs/03-bateria-de-fases.md` |
| Briefs | `appFacturas/docs/05-briefs.md` |
| Pantallas | `appFacturas/docs/04-pantallas.md` y `design/` |

Las reglas de negocio de esos documentos se mantienen. Lo que cambia es como se
construyen, y eso lo dicen las secciones 2 a 6 de este plan.

---

## 8. Mejoras a flujos que ya existen

| Mejora | Que cambia |
| --- | --- |
| **Hooks se conecta con las piezas** | Una pieza de tipo reel o video puede llevar su hook: desde la pieza se abre el canvas con la empresa ya puesta, y la ficha queda ligada por `fichas_hook.pieza_id`. Hoy la ficha de un hook no sabe a que trabajo pertenece. **Opcional** (pregunta 6) |
| **El inicio del cliente deja de estar vacio** | Hoy un cliente entra y solo ve su perfil. Pasa a ver sus proyectos, lo que espera su revision y su saldo |
| **La campana de avisos funciona** | El boton del layout deja de estar deshabilitado |
| **El cargo `cuentas` empieza a servir** | Es quien opera la bandeja de briefs y el tablero |
| **Empresas muestra el trabajo real** | La ficha de una empresa cuenta hoy contactos y hooks; suma proyectos activos y saldo |
| **El alta de un cliente se puede hacer sola** | Al aceptar el brief de un prospecto se crean la empresa y su usuario en una transaccion, en lugar de dos altas a mano en dos modulos |
| **La foto de perfil puede volver** | El dia que los archivos pasen por el adaptador, el codigo comentado se reconecta a el |

---

## 9. Interfaz

| Modulo | Ruta | Visible para | Contenido |
| --- | --- | --- | --- |
| Tablero | `/dashboard/tablero` | `cuentas`, admin | Proyectos con su bateria y las cuatro alertas |
| Proyectos | `/dashboard/proyectos` | `cuentas`, admin | Listado, matriz de piezas × fases, ficha de pieza |
| Mi trabajo | `/dashboard/mi-trabajo` | `diseno`, `redes` | Cola de piezas asignadas, «marcar como lista» |
| Briefs (bandeja) | `/dashboard/briefs` | `cuentas`, admin | Recibidos, aclaraciones, las tres decisiones |
| Finanzas | `/dashboard/finanzas` | `administracion`, admin | Presupuestos, proformas, facturas, pagos, cobranza, ajustes |
| Bandeja de salida | `/dashboard/salida` | admin | Correos simulados |
| Mis proyectos | `/dashboard/mis-proyectos` | cliente | Sus proyectos, revision en fase 5, historial |
| Mis briefs | `/dashboard/mis-briefs` | cliente | Sus briefs, nuevo brief |
| Administracion | `/dashboard/administracion` | cliente con Finanzas | Documentos, estado de cuenta, reportar pago |
| Brief por enlace | `/brief/[token]` | sin sesion | La unica ruta publica nueva |

Cambios en el armazon: el registro de modulos gana criterios para «solo
clientes» y para un permiso concreto; el proxy gana una lista de rutas por tipo
de usuario y la ruta publica del enlace.

La bateria es un componente nuevo de `components/ui`: cinco segmentos, con
texto ademas de color y `aria-label` con el porcentaje.

---

## 10. Plan por etapas

| Etapa | Entrega | Depende de |
| --- | --- | --- |
| **0. Preparacion** | Consulta de `BYPASSRLS` en Neon; respuestas de la seccion 11 | Tu |
| **1. Cimientos de seguridad** | Rol `conejo_app`, `conSesion`, guardias con datos frescos, `version_sesion`, bloqueo de intentos, cambio obligatorio de clave, empresa activa, cabeceras, bitacora general. **La app actual queda mas segura aunque no se construya nada mas** | Etapa 0 |
| **2. Externos simulados y avisos** | Adaptadores, JSON, bandeja de salida, campana | — |
| **3. Proyectos y bateria** | Proyectos, piezas, fases, avance, tablero, Mi trabajo | Preguntas 2 y 3 |
| **4. Vista del cliente y revision** | Mis proyectos, versiones, aprobar o corregir, historial | Pregunta 4 |
| **5. Presupuestos y proformas** | Editor, aprobacion del cliente, proforma ligada a proyectos | Pregunta 1 |
| **6. Briefs** | Formato de producto, envio, bandeja, enlace de prospecto, brief → presupuesto → proyecto | Etapas 2, 3 y 5 |
| **7. Facturas, pagos y cobranza** | Emision, talonario, comprobantes, estado de cuenta | **Negocio**: moneda y tasa, medios de pago, contador, hoja del talonario |
| **8. Endurecimiento y piloto** | Dos pasos si se decide, prueba con un cliente real | — |
| **9. Mudanza fuera de Vercel** | Correo real, tareas programadas, tiempo real, video por el servidor, copias de seguridad, foto de perfil | Tu decision de a donde |

Las etapas 1 a 6 se pueden construir sin esperar al negocio. Cada una termina
en algo utilizable y se registra en `agent.md`.

---

## 11. Lo que necesito de ti

### Para empezar (etapas 0 y 1)

| # | Que | Por que |
| --- | --- | --- |
| A | Ejecutar en el editor SQL de Neon: `SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user;` y pasarme el resultado | Si el rol de produccion se salta el RLS, hay que crear el nuevo antes que nada |
| B | Confirmar que aceptas cerrar las sesiones abiertas una vez | Al introducir `version_sesion` todos tendran que volver a entrar |

### Decisiones tuyas

| # | Pregunta | Mi propuesta |
| --- | --- | --- |
| 1 | Los seis ajustes al modelo de finanzas (`integracionFinanzas.md`, seccion 4.4) | Aceptarlos todos |
| 2 | Que cargos hacen de ejecutivo y de produccion | `cuentas` ejecutivo; `diseno` y `redes` produccion |
| 3 | ¿Cada ejecutivo ve solo sus empresas asignadas, o todos ven todas? | Empezar con todos ven todas; la tabla de asignaciones queda lista |
| 4 | Video en revision mientras estemos en Vercel | Imagenes y PDF subidos a Drive; video como enlace externo (Frame.io, Drive, Dropbox) hasta la mudanza |
| 5 | Como se imprime la factura | Desde el navegador |
| 6 | ¿Conectar Hooks con las piezas? | Si, como vinculo opcional |
| 7 | ¿Verificacion en dos pasos para quien emite facturas? | Si, en la etapa 8 |
| 8 | ¿Se aceptan rutas API (`route.ts`)? Hacen falta para descargar archivos | Si |

### Del negocio

| Que | Bloquea |
| --- | --- |
| Moneda de facturacion y fuente de la tasa | Facturas |
| Medios de pago reales | Pagos |
| Validacion del contador (campos de la factura, IGTF, ISLR, numero de control) | Facturas |
| Hoja escaneada del talonario | Impresion |
| Texto definitivo de las preguntas del brief de Diagnostico | Ese formato; el de Desarrollo de Producto esta completo |
| Cuando suma el 20 % de una fase, limite de rondas, plazo de revision del cliente | Nada: hay valores por defecto (al completarla, sin limite, sin plazo) |

### Datos

| Que | Para que |
| --- | --- |
| A donde se mudara la app y cuando, aunque sea aproximado | Decide cuanto esfuerzo merece lo provisional |
| La cuenta compartida de Drive | Antes de recibir archivos reales |
| Proveedor de correo previsto | Para que el adaptador real no sea una sorpresa |

---

## 12. Riesgos

| Riesgo | Efecto | Mitigacion |
| --- | --- | --- |
| El alcance se multiplico por cuatro | Meses de trabajo, no semanas | Etapas que entregan algo usable cada una; la 1 ya vale por si sola |
| Cambiar el rol de conexion rompe la app actual | Caida de modulos existentes | Etapa 1 aislada, con `prueba:modelos` corriendo como el rol nuevo |
| Limite de tamano de peticion en Vercel | No caben videos por el servidor | Enlaces externos hasta la mudanza |
| Correo simulado | El prospecto no recibe su enlace solo | Bandeja de salida y entrega a mano |
| Migrar pegando SQL en Neon con mas de 25 tablas nuevas | Un error a medias deja el esquema inconsistente | El archivo es idempotente y se prueba entero en local antes |
| Dos repositorios de especificacion | El plan y el paquete se desincronizan | Este documento manda; el paquete es referencia de reglas de negocio |
