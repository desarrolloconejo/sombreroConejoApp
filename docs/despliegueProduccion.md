# Guia de despliegue a produccion

Estado: **en preparacion**. No se publica nada hasta que la integracion del
portal este completa y probada en local. Ultima etapa anotada: **2**, mas la
verificacion en dos pasos, que se adelanto desde la etapa 8.

Este documento se va llenando etapa a etapa. Cada rama que cambie algo de
produccion —esquema, variables de entorno, un paso manual— lo anota aqui antes
de darse por terminada. El dia del despliegue se sigue de arriba abajo.

Los pasos de la base los hace el responsable: la maquina de desarrollo no
alcanza Neon, y la produccion se migra pegando SQL en su editor.

## Como leer esta guia

| Seccion | Cuando |
| --- | --- |
| 1. Antes de empezar | El dia del despliegue, antes de tocar nada |
| 2. SQL que se pega **antes** de subir | Con la version anterior todavia publicada |
| 3. Variables de entorno en Vercel | Despues del SQL, antes de subir |
| 4. Subir | — |
| 5. Comprobar la version nueva | Nada mas publicarse |
| 6. SQL que se pega **despues** de subir | Solo con el paso 5 en verde |
| 7. Vuelta atras | Si algo falla |
| 8. Cambios que notara la gente | Para avisar antes |
| 9. Pendientes y cosas sin probar | Para tenerlos presentes |

**La regla que sostiene el orden:** lo que se pega antes de subir **solo
anade**. Ningun archivo de la seccion 2 rompe la version publicada, asi que
entre pegar y subir la aplicacion sigue funcionando. Lo que le quita algo a
esa version va en la seccion 6, para despues de sustituirla.

---

## 1. Antes de empezar

- [ ] `main` local esta al dia y pasa todo: `lint`, `typecheck`, las baterias
      (`prueba:auditor`, `prueba:modelos`, `prueba:sesiones`,
      `prueba:permisos`), `test:unitarias`, `test:integracion` y el build de
      produccion.
- [ ] La contrasena del rol `conejo_app` esta generada y guardada en un gestor
      de contrasenas. No esta en ningun archivo del repositorio.

  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
  ```

- [ ] La clave `TOTP_CLAVE` esta generada (mismo comando) y guardada en el
      gestor de contrasenas, **aparte de la del rol**. Si se pierde, nadie con
      los dos pasos activados podra entrar hasta que un administrador se los
      retire.
- [ ] Hay una copia de seguridad reciente de la base de Neon (su panel permite
      crear una rama o un punto de restauracion antes de migrar).
- [ ] Se aviso a quien usa la aplicacion: tendra que volver a entrar una vez.

---

## 2. SQL que se pega antes de subir

En el editor SQL de Neon, **en este orden**. Cada archivo termina con una o
varias consultas de comprobacion y dice que resultado esperar: no se pasa al
siguiente hasta verlo.

Todos son idempotentes. Si uno falla a medias, se corrige y se vuelve a pegar
entero.

### Etapa 1 — Cimientos de seguridad

| # | Archivo | Que hace | Resultado esperado |
| --- | --- | --- | --- |
| 1 | `db/neon/01-cargo-produccion.sql` | Anade el cargo `produccion` | Una fila con `slug = produccion` |
| 2 | `db/neon/02-sesiones.sql` | Crea la tabla `sesiones` | `columnas = 11` |
| 3 | `db/neon/03-acceso.sql` | Tres columnas en `usuarios` (bloqueo por intentos, contrasena provisional) y las expone en la vista | `bloqueadas = 0`, `pendientes_de_cambio = 0` |
| 4 | `db/neon/04-auditoria.sql` | Crea la tabla `auditoria`, que solo admite lineas nuevas | `triggers = 2` |
| 5 | `db/neon/05-rol-de-la-aplicacion.sql` | Crea el rol `conejo_app`, sus permisos y la vista `vw_usuarios_acceso` | Ver abajo |

**El archivo 5 lleva un hueco.** Antes de ejecutarlo hay que sustituir
`PEGA_AQUI_LA_CONTRASENA` por la contrasena del rol, **en el editor de Neon**,
nunca en el archivo. Si se olvida, el script se detiene sin cambiar nada.

Sus tres comprobaciones:

| Comprobacion | Debe salir |
| --- | --- |
| 1 | `puede_entrar = true`; `se_salta_rls`, `es_superusuario`, `crea_roles` y `en_neon_superuser` en `false` |
| 2 | `permisos_en_auditoria = INSERT, SELECT` |
| 3 | `vista_de_acceso = 1` |

**Si `en_neon_superuser` sale `true`, se para aqui.** Significa que el rol
heredo privilegios que no debe tener, y la seguridad por fila seria decorativa.
No se cambia Vercel ni se sube hasta resolverlo.

### Etapa 2 — Externos y avisos

Necesitan el rol `conejo_app`: van despues del 5.

| # | Archivo | Que hace | Resultado esperado |
| --- | --- | --- | --- |
| 7 | `db/neon/07-esquemas-y-correos.sql` | Crea los esquemas `portal` y `finanzas`, las funciones de sesion y `portal.correos_salida` con sus politicas | `esquemas = 2`; `seguridad_por_fila = true` y `politicas = 3` |
| 8 | `db/neon/08-notificaciones.sql` | Crea `portal.notificaciones`, lo que se lee en la campana, con sus politicas | `seguridad_por_fila = true` y `politicas = 3` |
| 9 | `db/neon/09-tasas-de-cambio.sql` | Crea `finanzas.tasas_cambio` y deja que la tarea programada escriba y notifique | `seguridad_por_fila = true` y `politicas = 2`; `permisos = INSERT, SELECT` |

### Verificacion en dos pasos (adelantada de la etapa 8)

Necesita el rol y la vista del 5.

| # | Archivo | Que hace | Resultado esperado |
| --- | --- | --- | --- |
| 10 | `db/neon/10-dos-pasos.sql` | Cuatro columnas en `usuarios`, la tabla `codigos_respaldo` y tres columnas mas en `vw_usuarios_acceso` | `con_dos_pasos = 0` y `los_omitieron = 0`; `permisos = DELETE, INSERT, SELECT, UPDATE` |

### Etapa 3 — Proyectos, bateria y tareas

Necesita el esquema `portal` y las funciones de sesion del 07.

| # | Archivo | Que hace | Resultado esperado |
| --- | --- | --- | --- |
| 11 | `db/neon/11-proyectos.sql` | Crea asignaciones, proyectos, piezas, su copy, sus fases, tareas y comentarios internos, con sus politicas y las vistas del avance | `tablas = 7` y `con_seguridad_por_fila = 7`; `politicas = 22`; `vistas = 2` |
| 12 | `db/neon/12-hooks-herramienta.sql` | Anade `fichas_hook.tarea_id`: la ficha que cumple una tarea | `columna = 1` e `indice = 1` |

No inserta datos. Tras publicar, el administrador asigna a cada ejecutivo
(cargo `cuentas`) sus empresas desde Empresas: sin asignaciones, un ejecutivo
no ve ningun proyecto.

### Etapa 4 — Vista del cliente y revision

| # | Archivo | Que hace | Resultado esperado |
| --- | --- | --- | --- |
| 13 | `db/neon/13-revision-del-cliente.sql` | Permiso de aprobar, versiones, decisiones del cliente, almacen simulado de archivos y la funcion `portal.decidir_fase_5` | `tablas = 3` y `con_seguridad_por_fila = 2`; `politicas = 6` y `funciones = 3`; `nadie_aprueba_aun` igual a `clientes` |

El permiso de aprobar nace apagado para todos: tras publicar, el
administrador lo marca en Usuarios a quien deba decidir por cada empresa.

### Etapa 5 — Presupuestos y proformas

| # | Archivo | Que hace | Resultado esperado |
| --- | --- | --- | --- |
| 14 | `db/neon/14-presupuestos-y-proformas.sql` | Permiso de finanzas de cada cliente, presupuestos, proformas, renglones, contadores de numeracion y sus funciones. Deja a quien opera finanzas leer los proyectos | `tablas = 5` y `con_seguridad_por_fila = 5`; `politicas = 8`, `funciones = 10` y `politica_proyectos = 1`; `clientes_con_finanzas = 0` |

El permiso de finanzas nace apagado para todos: tras publicar, el
administrador lo marca en Usuarios a quien deba ver los presupuestos de cada
empresa. La numeracion empieza en 1 para presupuestos y proformas.

### Etapa 6 — Briefs

| # | Archivo | Que hace | Resultado esperado |
| --- | --- | --- | --- |
| 15 | `db/neon/15-briefs.sql` | Prospectos y enlaces privados, briefs, versiones congeladas, aclaraciones, `brief_id` en proyectos y presupuestos, y sus funciones. Amplia la campana y la bandeja de salida para que un prospecto avise y encole la copia de su brief (`correos_salida.enlace_id`) | `tablas = 5` y `con_seguridad_por_fila = 5`; `politicas = 12`, `funciones = 12` y `columnas = 3`; `briefs = 0` |

No inserta datos. Los formatos de brief van en el codigo, no en la base.
Solo anade: las politicas ampliadas dejan pasar lo mismo que antes, mas el
rol `prospecto`, que la version publicada no usa.

### Etapa 7 — Facturas, pagos y cobranza

| # | Archivo | Que hace | Resultado esperado |
| --- | --- | --- | --- |
| 16 | `db/neon/16-facturas-y-pagos.sql` | Ajustes de finanzas, formatos de impresion, medios de pago, facturas y renglones, pagos y retenciones, la vista del estado de cobro, y en empresas la retencion de IVA y los dias de credito | `tablas = 6` y `con_seguridad_por_fila = 6`; `funciones = 9`, `columnas_empresa = 3` y `vista = 1`; `formatos = 1`, `medios = 4`, `facturas = 0` y `emisor_vacio = true` |
| 17 | `db/neon/17-comentarios-por-fase.sql` | En `portal.comentarios_pieza`, la fase y la tarea de cada comentario (los de antes quedan como generales), dos comprobaciones y un indice | `columnas = 2`, `restricciones = 2` e `indice = 1` |
| 18 | `db/neon/18-proyecto-por-ejecutivo.sql` | Un proyecto lo puede llevar un ejecutivo de otra cuenta, que gestiona solo ese proyecto: funcion `portal.gestiona_proyecto`, `gestiona_pieza` la usa, politicas de proyectos y piezas, y trigger para que solo un administrador cambie quien lo lleva | `funcion = 1`, `pieza_la_usa = true`, `trigger = 1` y `politicas = 3` |
| 19 | `db/neon/19-avisos-a-ejecutivos.sql` | Funcion `portal.ejecutivos_de_empresa`: los ejecutivos de una empresa, para avisarles de sus presupuestos aunque quien avisa (administracion, el cliente) no lea las asignaciones | `funcion = 1` y `con_search_path = true` |
| 20 | `db/neon/20-nomenclatura-de-archivos.sql` | La nomenclatura de los archivos: `empresas.sigla` (unica) y `portal.proyectos.nombre_corto`, los triggers que los proponen a partir del nombre si llegan vacios, la propuesta para las empresas y proyectos que ya existen, `portal.orden_de_pieza` y `portal.proyectos_para_nombrar` (nombre y nombre corto de los proyectos en marcha, para el armador) |
| 21 | `db/neon/21-foto-y-recuperar-clave.sql` | La foto de perfil en Drive (`usuarios.foto_archivo`) y «Olvide mi contrasena»: la tabla `restablecimientos_clave` y las politicas de la bandeja de salida, que aceptan al rol sistema | `columna = 1`, `tabla = 1`, `permisos = 3` y `politicas_con_sistema = 3` | `sin_sigla = 0`, `sin_nombre_corto = 0` y `siglas_repetidas = 0`. **Despues, revisar a ojo la lista de siglas** que devuelve y corregir en Empresas las que no gusten |

Trae un formato de impresion de ejemplo (carta) y cuatro medios de pago de
ejemplo sin datos bancarios. **El emisor nace vacio: no se puede emitir
ninguna factura hasta llenarlo** en Finanzas → Ajustes de finanzas. Todo lo
provisional esta en `docs/pendientesIntegracion.md`.

---

## 3. Variables de entorno en Vercel

En Settings → Environment Variables, entorno de produccion.

### Etapa 1

| Variable | Accion | Valor |
| --- | --- | --- |
| `DATABASE_URL` | **Cambiar** | La misma cadena agrupada de Neon (host con `-pooler`, `sslmode=verify-full`), con usuario `conejo_app` y su contrasena en lugar de los del dueno. Marcada como Sensitive |
| `JWT_EXPIRACION` | **Borrar** | Ya no se usa |
| `JWT_SECRET` | Comprobar | Que **no** sea el de ejemplo de `.env.example`: la version nueva lo rechaza en produccion y no arrancaria |
| `SESION_ACCESO_SEGUNDOS`, `SESION_HORAS`, `SESION_INACTIVIDAD_MINUTOS` | No definir | Tienen valor por defecto (30 minutos, 12 horas, 15 minutos). Solo existen para pruebas |

### Etapa 2

| Variable | Accion | Valor |
| --- | --- | --- |
| `APP_URL_PUBLICA` | **Anadir** | La direccion publica de la aplicacion, sin barra final (`https://app.…`). Es el enlace que llevan los correos. Sin ella los correos salen sin enlace |
| `CRON_SECRET` | **Anadir** | Un secreto de 32 caracteres o mas, marcado como Sensitive. Protege las tareas programadas; Vercel lo envia solo en cada llamada. Sin el, la tarea de la tasa responde 503 y no corre. Se genera igual que la contrasena del rol |
| `TASA_MODO` | No definir | Sin definir vale `real`: lee la pagina del BCV |
| `CORREO_MODO` | No definir | Sin definir vale `simulado`: no se envia nada y los mensajes quedan en la bandeja de salida. Se pone en `real` el dia que exista la cuenta de Google de la empresa |

### Verificacion en dos pasos

| Variable | Accion | Valor |
| --- | --- | --- |
| `TOTP_CLAVE` | **Anadir** | 32 bytes en base64url, marcada como Sensitive. Cifra el secreto de los dos pasos de cada persona. Sin ella nadie puede configurarlos ni entrar con ellos. **No se cambia nunca una vez en uso**: cambiarla deja fuera a quien los tenga activados |

### Etapa 4

| Variable | Accion | Valor |
| --- | --- | --- |
| `DRIVE_CLIENT_ID`, `SECRET_DRIVE_KEY1`, `DRIVE_REFRESH_TOKEN` | **Anadir** | Las que deja `npm run drive:probar` en el `.env` local. Marcadas como Sensitive. Son las mismas que usaran los comprobantes en la etapa 7 |
| `DRIVE_CARPETA_PIEZAS_ID` | **Anadir** | El id de `ConejoApp/Piezas`, que tambien deja `drive:probar` (hay que volver a ejecutarlo: antes solo creaba la de comprobantes) |
| `ARCHIVOS_MODO` | No definir | Sin definir vale `real`: las versiones van a Drive. `simulado` las guarda en la base, hasta 4 MB, y es solo para desarrollo |

Sin las variables de Drive, subir un archivo falla con un mensaje claro; las
versiones por enlace (Figma, Frame.io...) funcionan igual.

La cadena del dueno (`neondb_owner`) se guarda aparte: hace falta para la
vuelta atras de la seccion 7 y deja de estar en Vercel.

Un cambio de variable solo afecta a los despliegues nuevos: la version
publicada sigue con la conexion anterior hasta que se suba.

### Etapa 6

| Variable | Accion | Valor |
| --- | --- | --- |
| `BRIEFS_MAILBOX` | Opcional | Un buzon del estudio que recibe copia de cada brief enviado. Sin el, la copia va a quien lo envia y a quien lo atiende |

### Etapa 7

| Variable | Accion | Valor |
| --- | --- | --- |
| `DRIVE_CARPETA_PERFILES_ID` | **Anadir** | El id de `ConejoApp/Perfiles`, que deja `npm run drive:probar` en el `.env` local. Sin ella, subir la foto de perfil falla con un mensaje claro |
| `DRIVE_CARPETA_COMPROBANTES_ID` | **Anadir** si no esta | El id de `ConejoApp/Comprobantes`, que deja `npm run drive:probar` en el `.env` local. Sin ella, reportar un pago con comprobante falla con un mensaje claro |

---

## 4. Subir

```bash
git push origin main
```

Vercel compila y publica. Si el build falla, la version anterior sigue en
servicio.

---

## 5. Comprobar la version nueva

En la aplicacion publicada, con la cuenta de administrador.

### Etapa 1

- [ ] Entrar. La sesion anterior ya no vale: es lo esperado.
- [ ] Cerrar sesion y volver a entrar.
- [ ] Mi perfil muestra «Sesiones abiertas», con «Esta sesion» marcada.
- [ ] El menu sale agrupado: General, Herramientas, Sistema.
- [ ] Auditoria (en Sistema) lista los inicios de sesion recien hechos.
- [ ] Las cabeceras estan puestas: en las herramientas del navegador, la
      respuesta de `/login` trae `Content-Security-Policy` y no trae
      `X-Powered-By`.
- [ ] No hay errores de «Content Security Policy» en la consola del navegador
      al recorrer Inicio, Hooks, Usuarios y Empresas.
- [ ] Crear un usuario de prueba, entrar con su contrasena provisional en una
      ventana privada y comprobar que obliga a cambiarla. Despues, desactivarlo.

### Etapa 2

- [ ] En Vercel, Settings → Cron Jobs lista `/api/cron/tasa`. Lanzarla a mano
      con su boton «Run» y comprobar el resultado en Auditoria, filtrando por
      el modulo «Tasa de cambio»: debe aparecer «Tasa de cambio registrada».
      Si aparece «Lectura de la tasa rechazada», el motivo esta en su detalle
      (ver la seccion 9).
- [ ] Bandeja de salida (en Sistema) abre, y muestra el aviso de que el correo
      esta en modo simulado.
- [ ] La campana del encabezado se abre y dice que no hay notificaciones (o
      las lista), en escritorio y en el telefono.
- [ ] El usuario de prueba creado arriba dejo su correo de bienvenida en la
      bandeja. Abrirlo, comprobar que **no** lleva la contrasena y que el
      enlace apunta a la direccion publica, y anotarlo como entregado.

### Etapa 3

- [ ] Asignar al menos un ejecutivo de cuentas a una empresa desde su ficha.
- [ ] Con ese ejecutivo, abrir Proyectos (en Trabajo) y crear un proyecto de
      prueba con una pieza. Su pagina muestra la bateria al 0 % y la matriz.
- [ ] En la ficha de la pieza, marcar la tarea de redaccion y completar la
      fase: la bateria pasa al 20 %.
- [ ] El Tablero (en Trabajo) muestra el proyecto de prueba, y al pulsar una
      alerta filtra la tabla.
- [ ] Asignar una tarea a otra persona: le llega la notificacion, y en Mi
      trabajo la ve y la puede marcar.
- [ ] En un proyecto de prueba con un reel, asignar «Escribir el hook» a
      alguien que no sea de redes. Con su cuenta, abrir Hooks desde Mi
      trabajo, escribir un hook que apruebe y auditarlo: la tarea queda lista.
- [ ] Cancelar el proyecto de prueba desde «Estado»: sale del Tablero.

### Etapa 4

- [ ] En Usuarios, marcar «Puede aprobar piezas» en la persona de contacto de
      una empresa de prueba.
- [ ] Con un proyecto de prueba de esa empresa: en la fase 3, subir una imagen
      (Drive) y, en la fase 4, marcarla «Para el cliente» y completar la fase.
      La version aparece en Drive, en `ConejoApp/Piezas`, con el nombre
      estandar del estudio.
- [ ] Con la cuenta del cliente: el inicio dice que una pieza espera su
      revision; la imagen se ve; «Descargar» no aparece hasta aprobarla.
- [ ] Pedir una correccion de redaccion: la pieza vuelve a la fase 1 y el
      ejecutivo recibe la notificacion. Reenviarla y aprobarla: se descarga.
- [ ] Con un cliente SIN el permiso: ve la pieza, pero no los botones.
- [ ] Con una cuenta de otro cargo, `/dashboard/proyectos` devuelve al inicio.

### Verificacion en dos pasos

- [ ] Al entrar por primera vez con la version nueva aparece la pantalla
      «Protege tu cuenta con un segundo paso». Es lo esperado: les pasara a
      todos.
- [ ] Configurarla con Google Authenticator en un telefono de verdad: anadir
      cuenta, escribir la clave, activar con el codigo. **Guardar los diez
      codigos de respaldo.**
- [ ] Cerrar sesion y volver a entrar: tras la contrasena pide el codigo.
- [ ] Con el usuario de prueba, pulsar «Ahora no, entrar sin ella» y comprobar
      que no se le vuelve a preguntar.

### Etapa 5

- [ ] En Usuarios, marcar «Puede ver las finanzas» en la persona de contacto
      de una empresa de prueba.
- [ ] Con una cuenta de administracion: crear un presupuesto para esa
      empresa, anadir renglones y enviarlo. El numero es el siguiente y los
      importes coinciden con la vista previa.
- [ ] Con la cuenta del cliente: Facturacion muestra el presupuesto por
      aprobar; aprobarlo. Administracion genera la proforma y la emite.

### Etapa 6

- [ ] Con la cuenta del cliente de prueba: Mis briefs → empezar un Brief de
      Desarrollo de Producto, llenarlo, cerrar la pestana a medias y volver:
      sigue donde lo dejo. Enviarlo: muestra su codigo `ECS-…`.
- [ ] Con su ejecutivo: el brief aparece en Briefs → Por decidir, y en la
      campana. Aceptarlo abre el proyecto.
- [ ] En Briefs → Enlaces para prospectos, generar un enlace con un correo
      propio y abrirlo en una ventana privada: se llena y se envia sin cuenta.
      Aceptarlo muestra la contrasena provisional del nuevo cliente.
- [ ] Revocar ese enlace y volver a abrirlo: dice que ya no es valido.

### Etapa 7

- [ ] En Finanzas → Ajustes de finanzas: llenar el emisor (razon social, RIF,
      domicilio fiscal) y revisar la numeracion. **Con datos reales, no de
      ejemplo**: lo que se emita queda con ellos.
- [ ] En Ajustes de finanzas → Tasa del dolar, comprobar que hay tasa del dia (la lee la tarea programada). Si no la hay, registrarla a mano.
- [ ] Con una proforma emitida de prueba: «Emitir la factura». Abre la
      factura con su numero y numero de control.
- [ ] «Abrir el PDF para imprimir»: sale el PDF con el texto en su sitio.
- [ ] Anular esa factura de prueba con motivo: la proforma vuelve a poder
      facturarse.
- [ ] Con un cliente con permiso de finanzas: Facturacion muestra la factura;
      reportar un pago con un comprobante de prueba. Aparece en Drive, en
      `ConejoApp/Comprobantes`.
- [ ] Rechazarlo con motivo desde la ficha: el cliente ve el motivo.

---

## 6. SQL que se pega despues de subir

Solo con la seccion 5 en verde.

### Etapa 1

| # | Archivo | Que hace | Resultado esperado |
| --- | --- | --- | --- |
| 6 | `db/neon/06-vista-sin-hash.sql` | Quita el hash de la contrasena de `vw_usuarios_completos` | `columnas_con_hash = 0`, y la segunda consulta devuelve el numero de usuarios |

Va despues porque la version anterior lee el hash de esa vista para iniciar
sesion. La nueva lo lee de `vw_usuarios_acceso`.

Tras pegarlo: cerrar sesion y volver a entrar una vez mas.

---

## 7. Vuelta atras

| Que falla | Que hacer |
| --- | --- |
| El build de Vercel | Nada: la version anterior sigue publicada. Se corrige y se vuelve a subir |
| La version nueva no conecta a la base | Devolver `DATABASE_URL` a la cadena del dueno y volver a desplegar. La version nueva funciona tambien con esa conexion |
| La version nueva arranca pero algo esta roto | En Vercel, Deployments → la version anterior → Promote to Production. Es valido **mientras no se haya pegado la seccion 6**: la version anterior necesita el hash en la vista general |
| Ya se pego la seccion 6 y hay que volver a la version anterior | Antes de promoverla, pegar de nuevo la vista de `db/neon/03-acceso.sql`, que la deja con el hash |

El SQL de la seccion 2 no hace falta deshacerlo: solo anade, y la version
anterior lo ignora.

---

## 8. Cambios que notara la gente

### Etapa 1

- Todos tendran que **volver a entrar una vez** al publicar.
- La sesion dura como maximo **12 horas**. Tras **15 minutos sin actividad**
  sale un aviso antes de pausarla; con actividad se renueva sola.
- **Cinco contrasenas equivocadas** bloquean la cuenta 15 minutos. El mensaje
  es el mismo para correo inexistente, contrasena equivocada y cuenta
  bloqueada.
- Una cuenta **nueva** o con la contrasena **restablecida** tiene que elegir
  una propia al entrar. Las cuentas actuales no.
- Cambiar la contrasena cierra las demas sesiones de esa persona.
- Desactivar a alguien, o cambiarle el rol, el cargo o la empresa, lo saca en
  su siguiente clic.
- El menu cambia de orden: Hooks sube a «Herramientas»; Usuarios, Empresas y
  Auditoria quedan en «Sistema».

### Etapa 2

- Al dar de alta a alguien o restablecerle la contrasena se escribe un correo
  de aviso. **Con el correo en modo simulado no le llega a nadie**: aparece en
  la bandeja de salida para entregarlo a mano. La contrasena provisional se
  sigue entregando en mano; el correo nunca la lleva.
- El administrador tiene una entrada nueva en Sistema: «Bandeja de salida».
- La tasa del BCV se lee sola una vez al dia. Todavia no se muestra en ninguna
  pantalla: la usara finanzas. Si un dia no se puede leer, llega una
  notificacion a los administradores.
- **La campana funciona.** Avisa a los administradores cuando una cuenta se
  bloquea por intentos y cuando un correo no se pudo enviar, y a cada persona
  cuando le restablecen la contrasena. Se actualiza al cargar una pagina, no
  en tiempo real.

### Etapa 3

- En la ficha de cada empresa aparece «Quien la atiende»: ahi el
  administrador asigna los ejecutivos de cuentas. **Un ejecutivo solo ve los
  proyectos de las empresas que tiene asignadas**, y recibe una notificacion
  al asignarle una.
- No se puede desactivar a alguien con tareas abiertas, proyectos a su cargo o
  empresas asignadas: el mensaje dice cuantas tiene, y hay que reasignarlas
  antes.
- **Mi trabajo** aparece para todo el equipo salvo administracion: las tareas
  de cada uno, de todos los proyectos.
- **Tablero** y **Proyectos** aparecen en la seccion Trabajo para el administrador y los
  ejecutivos de cuentas. Cada pieza recorre cinco fases; el ejecutivo las
  completa, y quien tiene una tarea la marca como lista y recibe una
  notificacion cuando le asignan una o cuando su fase empieza.

### Etapa 4

- **Los clientes ven sus proyectos** en «Mi espacio → Mis proyectos», y el
  inicio les dice cuantas piezas esperan su revision.
- **Solo decide quien tenga «Puede aprobar piezas»**, que nace apagado para
  todos: el administrador se lo marca a cada persona en Usuarios. Si en una
  empresa nadie lo tiene, el ejecutivo ve el aviso en la ficha de la pieza.
- El equipo sube cada version a la ficha de la pieza; el ejecutivo elige en la
  fase 4 la que vera el cliente. Sin ella, la fase 4 no se completa.
- Al pedir una correccion, la pieza vuelve a la fase que toca y sus tareas a
  pendiente; la ronda sube.

### Verificacion en dos pasos

- **A todos se les pedira configurarla la primera vez que entren.** Usa una
  app de codigos en el telefono: Google Authenticator, Microsoft Authenticator
  o Authy. Lleva un minuto.
- Quien no la quiera pulsa «Ahora no, entrar sin ella» y no se le vuelve a
  preguntar. Puede activarla despues desde Mi perfil.
- Al activarla recibe **diez codigos de respaldo**, que solo se muestran una
  vez. Sirven para entrar sin el telefono.
- Quien pierda el telefono y los codigos se lo dice a un administrador, que se
  la retira desde la ficha de esa persona en Usuarios.
- Conviene avisar antes de publicar, para que tengan la app instalada.

### Etapa 5

- **Presupuestos** y **Proformas** aparecen para el administrador y
  administracion. La base numera y calcula los importes: no se escriben a
  mano.
- **Los clientes con «Puede ver las finanzas»** ven Facturacion: aprueban o
  rechazan presupuestos y ven sus proformas. El permiso nace apagado.

### Etapa 6

- **Los clientes envian briefs** desde «Mi espacio → Mis briefs». Pueden
  llenarlo entre varios, guardar a medias y enviar una version nueva mientras
  no este validado.
- **Los ejecutivos de cuentas deciden** en Trabajo → Briefs: proponer otra
  fecha, aceptar (abre el proyecto), pasar a presupuesto o descartar con
  motivo, que el cliente ve.
- **Quien aun no es cliente** recibe un enlace privado que el ejecutivo genera
  en Briefs. El enlace se ve una sola vez y **no sale por correo**: el
  ejecutivo lo copia y se lo hace llegar. Vale 7 dias.

### Etapa 7

- **Administracion factura desde la aplicacion**: Facturas, Cobranza y Ajustes
  de finanzas aparecen en Finanzas. La factura sale de la proforma emitida, en
  bolivares a la tasa del BCV, y se imprime sobre el talonario.
- **Los clientes con «Puede ver las finanzas»** ven sus facturas y lo que
  deben, y **reportan sus pagos** con el comprobante. Un pago reportado no
  baja la deuda hasta que administracion lo confirma.
- Lo que hoy es de ejemplo (talonario, medios de pago, impuestos) se ajusta
  en Ajustes de finanzas. No hace falta tocar codigo.

---

## 9. Pendientes y cosas sin probar

Lo que no se pudo comprobar en local y hay que mirar el dia del despliegue, o
resolver antes.

### Etapa 1

| Tema | Estado |
| --- | --- |
| `conejo_app` a traves de la cadena agrupada de Neon | **Sin probar.** Es lo primero que se vera en la seccion 5. La vuelta atras esta en la seccion 7 |
| `statement_timeout` en el servidor | Sin poner. El tope de 15 segundos del lado de la aplicacion cubre el caso |
| Seguridad por fila | No hay politicas todavia: llegan con las tablas del portal. El rol, `conSesion` y las vistas ya estan preparados |
| Lineas de auditoria de crear y editar usuarios y empresas, y de restablecer contrasena | Pasan el `typecheck`; sin ejercitar en el navegador |
| Aviso de inactividad | Probado con plazos de 40 segundos, no con los 30 minutos reales |
| Cuentas de prueba en produccion | Si existen, las desactiva el administrador desde Usuarios |

### Etapa 2

| Tema | Estado |
| --- | --- |
| Correo en modo real (Gmail) | **Probada la autorizacion y un envio** (2026-10-27, `npm run correo:probar`); falta ver el primer correo enviado por la propia aplicacion. Por ahora con la cuenta personal del responsable. Antes de poner `CORREO_MODO=real`: `npm run google:autorizar` (pide Drive y Gmail y dice si se concedieron) y `npm run correo:probar -- destino`. Pasos en `docs/pruebaGoogleReal.md` |
| El BCV desde los servidores de Vercel | **Sin probar.** Desde aqui responde, pero es habitual que filtre por pais de origen. Si rechaza a Vercel, la tarea lo notificara cada dia y la tasa habra que registrarla a mano hasta mudarse al VPS |
| Certificado del BCV | El suyo vence el **20 de noviembre de 2026**. Si al renovarlo cambian de autoridad, la lectura fallara y lo notificara: hay que sustituir el intermedio de `src/lib/externos/certificados/bcvIntermedio.ts`. No se arregla apagando la verificacion |
| Frecuencia de la tarea | Una vez al dia (18:30 de Caracas), que es lo que permite el plan gratuito de Vercel. El «refresco al usar» del plan llega con el modulo de finanzas |
| Registrar una tasa a mano | La base ya lo admite, para `admin` y `administracion`. La pantalla llega con finanzas (etapa 5) |
| Correos que quedan «pendientes» | En modo real, si la funcion se corta entre confirmar el cambio y enviar, el correo queda como pendiente. No hay tarea que lo recoja: se reintenta a mano desde la bandeja |

### Verificacion en dos pasos

| Tema | Estado |
| --- | --- |
| Probada con una app real en un telefono | **Sin probar.** Las pruebas calculan los codigos con el mismo estandar y dan los valores de referencia del RFC 6238, pero nadie ha escaneado ni tecleado la clave en Google Authenticator todavia |
| Codigo QR | Se muestra al configurar (dependencia nueva: `qrcode-generator`, que Vercel instala sola desde `package-lock.json`; no pide SQL ni variables). **Sin escanear con un telefono real**: las pruebas fijan su estructura, no que una app lo lea. Si no se leyera, la clave para teclear y el enlace siguen debajo |
| Obligatoria para administradores | **No lo es.** El plan la queria obligatoria para `admin` y `administracion`; por decision del responsable (2026-10-13) se pide por defecto a todos y cualquiera puede decir que no. Un administrador sin dos pasos sigue siendo posible |
| Quien eligio «ahora no» | No se le vuelve a preguntar. No hay forma de volver a pedirselo a todos salvo pegando SQL |

### Etapa 3

| Tema | Estado |
| --- | --- |
| `db/neon/11-proyectos.sql` | Ensayado sobre una base nueva con el esquema de `main` antes de la etapa 3: aplica limpio y deja las tres comprobaciones en su valor |
| Seguridad por fila de proyectos, piezas, fases y tareas | Probada con `prueba:permisos` en local, con el rol `conejo_app`. Sin probar contra Neon |
| Cuentas de ejemplo | La semilla anade `cuentas@conejo.test` y dos proyectos de ejemplo. Son solo de desarrollo: `sql:produccion` no los lleva |

---

### Etapa 4

| Tema | Estado |
| --- | --- |
| Subida a Drive en modo real | **Sin probar.** Aqui se probo en modo simulado. Hace falta volver a ejecutar `npm run drive:probar` (crea `ConejoApp/Piezas`) y comprobar la subida desde Vercel |
| Peso maximo | 4 MB por archivo, por el limite de peticion de Vercel. Tras la mudanza se puede subir |
| Tiempo real | No hay: la bateria del cliente se actualiza al recargar. Va con la mudanza (etapa 9) |
| Boveda de marca e historial del cliente desde la auditoria | No se hicieron: el historial de cada pieza sale de sus decisiones. Quedan para cuando se pidan |
| Correo de «pieza lista para revisar» | En modo simulado queda en la bandeja de salida |

### Etapa 6

| Tema | Estado |
| --- | --- |
| `db/neon/15-briefs.sql` | Ensayado dos veces sobre una base con el esquema del cierre de la etapa 5: aplica limpio, deja las comprobaciones en su valor y las politicas quedan identicas a las de una base nueva |
| Seguridad por fila de briefs, enlaces y el rastro del prospecto | Probada con `prueba:permisos` en local, con el rol `conejo_app`. Sin probar contra Neon |
| PDF del brief en el correo | No va todavia: llega con la libreria de la factura, en la etapa 7 |
| Brief de Diagnostico | No se publica hasta tener sus preguntas (B4) |
| Limite de intentos en `/brief` | No hay: el token tiene 256 bits de azar. Se reconsidera en el VPS |

### Etapa 7

| Tema | Estado |
| --- | --- |
| `db/neon/16-facturas-y-pagos.sql` | Ensayado dos veces sobre una base con el esquema del cierre de la etapa 6: aplica limpio y las politicas quedan identicas a las de una base nueva |
| Seguridad por fila de facturas, pagos y ajustes | Probada con `prueba:permisos` en local. Sin probar contra Neon |
| Valores de ejemplo | Emisor, numeracion, talonario, medios de pago e impuestos: ver `docs/pendientesIntegracion.md` |
| Impresion sobre el talonario real | Sin probar: falta la hoja del talonario (F13) |
| Registrar la tasa a mano | Hecho en la etapa 8: Finanzas → Ajustes de finanzas → Tasa del dolar |
| Comprobantes en Drive real | Sin probar desde Vercel: aqui en modo simulado |

### Mejoras posteriores al cierre

| Tema | Estado |
| --- | --- |
| `db/neon/17-comentarios-por-fase.sql` | Ensayado dos veces sobre la base local: aplica limpio y la comprobacion da lo esperado. Solo anade columnas |
| Proyectos solo de ejecutivos de cuentas | Sin cambio de esquema. Los proyectos que hoy lleva un admin siguen igual hasta que se les cambie el ejecutivo |
| `db/neon/18-proyecto-por-ejecutivo.sql` | Ensayado dos veces sobre la base local: aplica limpio y la comprobacion da lo esperado. La version publicada no tiene proyectos, asi que no la toca |
| `db/neon/19-avisos-a-ejecutivos.sql` | Ensayado dos veces sobre la base local. Solo anade una funcion |
| `db/neon/20-nomenclatura-de-archivos.sql` | Ensayado dos veces sobre la base local, la primera sin las columnas: propone siglas sin repetir (con -2, -3…) y nombres cortos. Solo anade; la version publicada inserta sin ellas y los triggers las rellenan |
| Archivos subidos antes del cambio | Conservan su nombre. Solo los nuevos siguen la nomenclatura |
| `db/neon/21-foto-y-recuperar-clave.sql` | Ensayado dos veces sobre la base local. Solo anade; las politicas nuevas de la bandeja aceptan todo lo que aceptaban las anteriores |
| Foto de perfil y archivos con Drive real | Probado en local con `ARCHIVOS_MODO=real` el 2026-10-27: la foto, una version de pieza y un comprobante llegaron a sus carpetas y se leyeron desde la app |
| «Olvide mi contrasena» | Probado en local con el correo simulado (el enlace en la consola). **Necesita `CORREO_MODO=real` y `APP_URL_PUBLICA` en Vercel**: sin el correo real, el enlace no le llega a nadie (el administrador puede seguir restableciendo a mano) |

## Registro por etapa

| Etapa | SQL antes | Variables | SQL despues | Anotada |
| --- | --- | --- | --- | --- |
| 1. Cimientos de seguridad | 01 a 05 | `DATABASE_URL`, `JWT_EXPIRACION` | 06 | Si |
| 2. Externos y avisos | 07, 08, 09 | `APP_URL_PUBLICA`, `CRON_SECRET` | — | Si. El adaptador de archivos pasa a la etapa 4 |
| Dos pasos (de la etapa 8) | 10 | `TOTP_CLAVE` | — | Si |
| 3. Proyectos, bateria y tareas | 11, 12 | — | — | Si |
| 4. Vista del cliente y revision | 13 | `DRIVE_*`, `DRIVE_CARPETA_PIEZAS_ID` | — | Si |
| 5. Presupuestos y proformas | 14 | — | — | Si |
| 6. Briefs | 15 | `BRIEFS_MAILBOX` (opcional) | — | Si |
| 7. Facturas, pagos y cobranza | 16 | `DRIVE_CARPETA_COMPROBANTES_ID` | — | Si, con datos de ejemplo |
| 8. Endurecimiento y piloto | — | — | — | Si. El piloto, despues de publicar: `docs/planPiloto.md` |
| Mejoras posteriores (comentarios por fase) | 17 | — | — | Si |
| Revision del responsable, bloque 1 | 18, 19 | — | — | Si |
