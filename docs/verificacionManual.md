# Verificacion manual del portal

Lo que el responsable prueba a mano, etapa por etapa, antes de publicar. Las
pruebas automaticas cubren mucho, pero no todo: aqui va lo que necesita ojos
—pantallas, textos, movil— y lo que ninguna prueba recorre todavia.

Se prueba al terminar las nueve etapas, todo junto. Cada etapa anade su
seccion al cerrarse.

## Antes de empezar

```bash
docker compose up -d --build
docker compose exec app-dev npm run seed
```

La aplicacion queda en `http://localhost:3100`. Las contrasenas de las
cuentas estan en `db/datos/semilla.mts`.

| Cuenta | Para que |
| --- | --- |
| `juanvivas043@gmail.com` | Administrador |
| `cuentas@conejo.test` | Ejecutivo de cuentas: proyectos, tablero, revision del lado del equipo |
| `diseno@conejo.test` | Disenador: Mi trabajo, tareas asignadas |
| `redes@conejo.test` | Creadora de contenido: Hooks |
| `finanzas@conejo.test` | Administracion: presupuestos y proformas |
| `cliente@empresa.test` | Cliente con permiso de aprobar piezas y de ver las finanzas |

Las cuentas `admin@conejo.test`, `pruebas@`, `sintareas@`, `bloqueo@` y
`dospasos@` son de las pruebas automaticas: no se usan a mano.

Si los proyectos de ejemplo quedaron revueltos por pruebas anteriores, se
pueden rehacer en local. **Solo en local, nunca en produccion:**

```sql
-- en pgAdmin o con: docker compose exec db psql -U conejo -d conejo_app
BEGIN;
DELETE FROM portal.revisiones; DELETE FROM portal.versiones;
UPDATE fichas_hook SET tarea_id = NULL;
DELETE FROM portal.tareas; DELETE FROM portal.comentarios_pieza;
DELETE FROM portal.pieza_contenido; DELETE FROM portal.pieza_fases;
DELETE FROM portal.piezas; DELETE FROM portal.proyectos;
COMMIT;
```

y despues `npm run seed`.

---

## Etapa 3 — Proyectos, bateria y tareas

**Como administrador**

1. Empresas → abrir la empresa de ejemplo → asignar y quitar un ejecutivo.
   El ejecutivo recibe una notificacion en la campana.
2. Usuarios → intentar desactivar a `diseno@conejo.test`, que tiene tareas:
   debe negarse hasta reasignarlas.

**Como ejecutivo (`cuentas@conejo.test`)**

3. Proyectos → crear uno desde el catalogo (redes sociales o desarrollo de
   producto). Aparecen sus piezas con las cinco fases.
4. Abrir una pieza: completar una fase, asignar una tarea a `diseno@`,
   escribir el copy y dejar un comentario interno. La bateria de cinco
   segmentos avanza; revisarla en tema claro y oscuro.
5. Tablero → pulsar cada una de las cuatro alertas (atrasada, por vencer,
   esperando al cliente, en correccion): filtran la lista. Probar los filtros
   por ejecutivo, cliente y tipo.

**Como disenador (`diseno@conejo.test`)**

6. Mi trabajo → la tarea asignada aparece en «para hacer ahora». Marcarla
   como lista y reabrirla.
7. Una tarea «Escribir el hook» abre el canvas de Hooks aunque no sea de
   redes; al aprobar la ficha en el auditor, la tarea queda lista sola.

---

## Etapa 4 — Vista del cliente y revision

**Equipo (como `cuentas@conejo.test`)**

1. Proyectos → abrir «Parrilla de octubre» → una pieza en la fase 3. En
   «Versiones», subir una imagen de menos de 4 MB. Probar tambien un PDF, un
   archivo que no sea imagen (debe rechazarse) y un enlace de un sitio que no
   este en la lista (debe rechazarse).
2. Completar hasta la fase 4. «Completar fase» debe negarse mientras no haya
   una version marcada «Para el cliente». Marcarla y completar.
3. Comprobar que llega la notificacion al cliente y que el correo queda en la
   Bandeja de salida (como administrador).

**Cliente (como `cliente@empresa.test`)**

4. El inicio dice cuantas piezas esperan su revision. Mis proyectos → el
   proyecto → «Revisar».
5. La imagen se ve, el copy se puede copiar, y **no** hay boton de descarga.
6. Pedir correccion marcando solo «Redaccion»: el texto de la ruta dice que
   vuelve a la fase 1 y conserva la 3. Enviar: aparece la confirmacion y la
   pieza queda «En correccion».
7. Probar «Aprobar» en otra pieza: aparece la descarga.
8. En un proyecto con varias piezas esperando, marcar dos y «Aprobar 2».

**De vuelta como ejecutivo**

9. La ficha de la pieza corregida muestra la decision del cliente, la ronda
   2, y la fase 1 en curso con la 3 conservada. «Ajustar la ruta» deja anadir
   la fase 3; despues de completar una fase de la ronda nueva, ya no.
10. Cuando la ronda 2 llega al cliente, este ve **solo** la version nueva: la
    de la ronda 1 ya no aparece ni se descarga.
11. Con todas las piezas aprobadas, Estado → «Cerrar el proyecto».

**Permisos (como administrador)**

12. En Usuarios, quitar «Puede aprobar piezas» al cliente: sigue viendo la
    pieza, pero sin botones. Volver a marcarlo.
13. Con un cliente de otra empresa, la URL de una pieza ajena da 404.

**Movil.** Las pantallas del cliente estan hechas para movil primero:
revisar los pasos 4 a 8 en un telefono o con la ventana a 390 px.

**Fechas.** Las horas de Auditoria, Mi perfil, Hooks, Inicio y la Bandeja de
salida deben coincidir con la hora de Caracas, no ir cuatro horas por delante.

### Sin prueba automatica todavia

| Que | Estado |
| --- | --- |
| Aprobacion en lote (`aprobarVarias`) | Solo la prueba a mano del paso 8 |
| Ajustar la ruta (`ajustarRuta`) | Su regla tiene pruebas unitarias; el recorrido en pantalla, solo el paso 9 |
| Aviso «Nadie de la empresa puede aprobar» en la ficha | Solo a mano: quitar el permiso al unico cliente y abrir una pieza como ejecutivo |
| Drive real | Sin probar. Hay que ejecutar `npm run drive:probar` (crea tambien `ConejoApp/Piezas`) y subir una imagen con `ARCHIVOS_MODO=real` |

---

## Etapa 5 — Presupuestos y proformas

La semilla deja un presupuesto por aprobar, uno aprobado con su proforma
emitida, un borrador y una proforma recurrente a la que ya le toca la
siguiente.

**Administracion (como `finanzas@conejo.test`)**

1. El menu muestra Finanzas (Presupuestos y Proformas) y nada de Trabajo.
2. Presupuestos → «Nuevo presupuesto»: elegir la empresa, ponerle titulo. Se
   abre su editor.
3. Escribir dos renglones, uno exento, con cantidades decimales (2,5) y precios
   con centimos. La vista previa suma sola; guardar y comprobar que los
   importes del documento son los mismos.
4. «Guardar y enviar al cliente». El presupuesto deja de ser editable. El
   correo queda en la Bandeja de salida (como administrador) y no lleva
   importes.
5. En otro presupuesto enviado, «Registrar a nombre del cliente» → rechazarlo
   sin motivo (debe pedirlo) y con motivo. La ficha dice que lo registraste tu.

**Cliente (como `cliente@empresa.test`)**

6. El inicio avisa de los presupuestos que esperan su aprobacion.
7. Facturacion → abrir uno → los renglones y el total se leen bien en el
   telefono (390 px), sin desplazarse de lado.
8. Rechazar pide el motivo; aprobar no. Tras decidir, los botones desaparecen.
9. Un borrador no aparece, y su URL escrita a mano da «Esta pagina no existe».

**De vuelta como administracion**

10. La campana avisa de lo que decidio el cliente. En el aprobado, «Generar la
    proforma» lleva a ella en borrador, con los renglones copiados.
11. Ligarla a un proyecto, «Guardar y emitir». El cliente la ve en su
    Facturacion, con el proyecto.
12. Marcarla «Se repite cada mes» con la fecha de hoy: aparece arriba en
    Proformas. «Preparar la siguiente» crea la copia en borrador y deja de
    pedirla (la fecha avanza un mes).
13. Anular una proforma pide el motivo; anulada, no vuelve.

**Permisos (como administrador)**

14. En Usuarios, quitar «Puede ver las finanzas» al cliente: Facturacion
    desaparece de su menu y la URL lo devuelve al inicio. Volver a marcarlo.
15. Como `cuentas@conejo.test` o `redes@conejo.test`, `/dashboard/presupuestos`
    devuelve al inicio.

### Sin hacer todavia

| Que | Cuando |
| --- | --- |
| PDF de presupuestos y proformas | Etapa 7, con la libreria del PDF de la factura |
| Correo al cliente cuando se emite una proforma | Solo campana por ahora; se decide con el correo real |

## Etapa 6 — Briefs

La semilla deja un brief enviado de la empresa del cliente de prueba y un
borrador a medias. El correo va simulado: las copias quedan en la Bandeja de
salida.

**Cliente (como `cliente@empresa.test`)**

1. Mi espacio → Mis briefs → empezar un Brief de Desarrollo de Producto. La
   empresa, el nombre y el correo vienen precargados.
2. Llenar dos pasos, cerrar la pestana y volver: lo escrito sigue ahi (se
   guarda solo cada pocos segundos).
3. En «Alcance», marcar el empaque como «Lo tengo yo»: el paso del empaque
   desaparece del recorrido. Probar «No lo se» en alguna pregunta.
4. Enviar sin la fecha de entrega: la pide. Con ella, muestra el codigo
   `ECS-…` y la pantalla pasa a «Lo que enviaste».
5. «Cambiar algo: enviar una version nueva»: se abre con lo enviado; al
   reenviar, el codigo es el mismo y dice «version 2».
6. En el telefono (390 px), los pasos y los botones se leen sin desplazarse de
   lado.

**Ejecutivo (como `cuentas@conejo.test`)**

7. La campana avisa del brief nuevo. Trabajo → Briefs → «Por decidir» lo
   muestra.
8. Proponer otra fecha pide la fecha y el motivo; el cliente los ve en su
   brief.
9. Escribir en las aclaraciones: el cliente lo ve y puede responder.
10. «Aceptar y abrir proyecto»: nace el proyecto. Completar su fase 1 deja el
    brief «Validado» para el cliente.
11. En otro brief, «Convertir en presupuesto»: como `finanzas@conejo.test`,
    Presupuestos lo muestra en «Briefs que esperan su presupuesto».
12. «Descartar» pide el motivo, y el cliente lo ve.

**Prospecto (enlace privado)**

13. Como ejecutivo, en Briefs → Enlaces para prospectos, generar un enlace con
    un correo inventado. Aparece una vez, con «Copiar el enlace». Al recargar
    ya no se ve: solo queda la fila con su estado.
14. Abrir el enlace en una ventana privada: saluda al contacto, «Empezar el
    brief», llenarlo y enviarlo. El panel (`/dashboard`) sigue pidiendo
    iniciar sesion.
15. De vuelta como ejecutivo: el brief esta en «Por decidir» marcado
    «prospecto». Aceptarlo muestra la contrasena provisional del nuevo
    cliente; con ella se entra y se pide cambiarla.
16. Generar otro enlace y revocarlo: abrirlo dice «Este enlace ya no es
    valido». Lo mismo con una direccion inventada `/brief/loquesea`.

### Sin hacer todavia

| Que | Cuando |
| --- | --- |
| PDF del brief adjunto a la copia por correo | Etapa 7, con la libreria del PDF |
| Brief de Diagnostico | Cuando se tengan sus preguntas (B4) |
| Enlace al prospecto por correo | No se hara: el enlace es un token, y ningun correo lleva tokens |

## Etapa 7 — Facturas, pagos y cobranza

Se construyo con **datos de ejemplo** (emisor ficticio, numeracion, talonario
tamano carta, cuatro medios de pago). La semilla deja una factura de la
empresa de ejemplo con un pago reportado por confirmar.

**Ajustes (como `finanzas@conejo.test`)**

1. Finanzas muestra Presupuestos, Proformas, Facturas, Cobranza y Ajustes de
   finanzas.
2. Ajustes de finanzas → escribir un RIF mal (`12345`): no se guarda y dice
   como escribirlo.
3. Numeracion: bajar el proximo numero de factura no se puede; subirlo si.
4. Medios de pago: anadir uno, editarlo y desactivarlo. El cliente deja de
   verlo.
5. Datos de facturacion: marcar la empresa de ejemplo como «Retiene el 75 %».
   La proxima factura que se le emita dice cuanto se espera de retencion.
6. Formatos de impresion → «Carta (ejemplo)» → «Hoja de calibracion»: sale un
   PDF con cuadricula y cada dato recuadrado. «Duplicar» crea «Copia de
   Carta (ejemplo)»; cambiar una medida y ver la hoja a escala moverse.

**Facturar**

7. Proformas → abrir una emitida → «Emitir la factura»: lleva a la factura,
   con numero `A-…`, numero de control y la tasa del BCV.
8. «Abrir el PDF para imprimir»: el texto cae en las posiciones del formato.
   Imprimirlo en papel carta y compararlo con la hoja de calibracion.
9. «Marcar como impresa» queda anotado con la fecha.
10. Anular pide el motivo; anulada, la proforma vuelve a ofrecer «Emitir la
    factura».

**Pagos**

11. Como `cliente@empresa.test`: Facturacion muestra «Por pagar», «Vencido»
    y la lista de facturas. Abrir una y reportar un pago sin comprobante: lo
    pide. Con una imagen o un PDF, queda «Por confirmar».
12. En el telefono (390 px) la factura y el formulario se leen sin
    desplazarse de lado.
13. Como administracion: Facturas muestra «Pagos por confirmar». En la ficha,
    «Confirmar» sugiere el monto (en dolares, convertido con la tasa);
    confirmarlo baja el saldo y la factura pasa a «Pago parcial».
14. «Registrar un pago a nombre del cliente» y rechazarlo con motivo: el
    cliente ve el motivo.
15. Una factura con pagos sin rechazar no se puede anular.

**Cobranza**

16. Cobranza muestra lo que debe cada empresa por antiguedad, con el total.
    Pulsar una empresa lleva a sus facturas abiertas.
17. Como `cuentas@conejo.test`, `/dashboard/cobranza` y `/dashboard/facturas`
    devuelven al inicio.

### Sin hacer todavia

Todo esta en `docs/pendientesIntegracion.md`. Lo mas importante: aplicar ISLR
e IGTF cuando el contador responda, y calibrar el talonario real.

## Etapa 8 — Endurecimiento

**Tasa del dolar (como `finanzas@conejo.test`)**

1. Ajustes de finanzas → Tasa del dolar muestra la que se usa hoy y de donde
   salio (BCV o a mano), y las ultimas.
2. Registrar una tasa de una fecha pasada sin tasa: queda «a mano».
3. Registrar otra un 50 % mas alta que la anterior: pide confirmarla con una
   casilla.
4. Registrar otra vez la misma fecha: dice que ya hay una y no la cambia.

**Pruebas automaticas nuevas**

5. `npm run test:unitarias` incluye `guardias.spec.ts` (toda action, page y
   ruta con su guardia) y `prueba:permisos` la seccion «Estructura».

**Piloto**: se sigue `docs/planPiloto.md` cuando se elija cliente y fecha.

## Mejora — Desplegables y botones de copiar

**Desplegables (en claro, en oscuro y en el telefono)**

1. Ningun desplegable abre la lista azul del sistema: todos se ven con los
   colores del tema. Revisar:
   - Tablero: los filtros.
   - Una pieza: el responsable de la fase y de las tareas.
   - Proyecto nuevo: el tipo de cada pieza.
   - Presupuesto: el IVA de los renglones.
   - Factura: el formato de impresion.
   - Reportar un pago: medio y moneda.
   - Ajustes de finanzas: la retencion de cada empresa y la alineacion en un
     formato.
   - Briefs: el tipo de brief del enlace.
2. Dentro de las tablas (alineacion de un formato, renglones) la lista se ve
   entera y no queda cortada; cerca del borde de abajo abre hacia arriba.
3. Con el teclado: Tab hasta el desplegable, flechas, Enter para elegir y
   Escape para cerrar.

**Botones de copiar (como `admin@conejo.test` y `finanzas@conejo.test`)**

4. Empresas → una ficha: nombre, RIF, telefono, direccion y cada enlace de
   redes tienen su boton; al pulsarlo sale «Copiado el RIF» y se pega bien en
   otro sitio.
5. Usuarios → una ficha: correo y telefono.
6. Una factura: numero, numero de control, y razon social, RIF y domicilio
   del cliente y del emisor.
7. Cobranza: el RIF y el telefono de cada empresa con deuda, tambien en el
   telefono.

**Bandeja de briefs (como `cuentas@conejo.test`)**

8. Briefs abre en la pestana «Por decidir», con el numero de cada bandeja en
   su pestana. Las otras dos se abren al pulsarlas y la URL cambia
   (`?ver=curso`, `?ver=cerrados`), asi que se pueden compartir o recargar.
9. Cada fila se lee de arriba abajo: quien lo pide, que hay que hacer, y en
   pequeno el tipo de brief, la fecha aspirada y el codigo. A la derecha,
   cuanto hace que llego («hace 2 dias»).
10. «Por decidir» va del que mas lleva esperando al mas nuevo.
11. En el telefono las tres pestanas caben a lo ancho y el nombre no se
    corta: la hora y la etiqueta van debajo.

**Ficha de un brief y fechas (como `cuentas@conejo.test`)**

12. En la ficha de un brief, la columna del brief y la de la derecha
    arrancan a la misma altura, y todas las tarjetas (Brief completo,
    Estado, Fecha de entrega, Decision, Aclaraciones) llevan su titulo dentro.
13. En Decision, «Aceptar y abrir proyecto» ocupa todo el ancho. Debajo,
    «Convertir en presupuesto» y «Descartar» comparten la fila; si la
    columna es estrecha, bajan uno bajo el otro, del mismo ancho y sin
    partir el texto. Al descartar, «Volver» y «Descartar el brief» van en dos
    mitades.
14. Ninguna fecha abre el calendario del sistema: todas abren el de la app,
    con sus colores, en claro y en oscuro. Revisar al menos la fecha que se
    propone en un brief, la fecha aspirada al enviar un brief, la tasa del
    dolar, la fecha de un pago, la validez de un presupuesto, las fechas de
    un proyecto, la de una fase y la de una tarea.
15. En el calendario: los dias fuera de lo permitido salen tachados, hoy va
    marcado, las flechas mueven el dia, Re Pag y Av Pag el mes, Enter elige
    y Escape cierra.
16. Se puede escribir la fecha a mano: `14/11/2026` vale; `31/02/2026` se
    marca en rojo y pide escribirla asi: dd/mm/aaaa.

**Proyectos y piezas (como `cuentas@conejo.test`)**

17. Proyectos se ve en tarjetas: la bateria arriba a lo ancho con el
    porcentaje grande y «N de M piezas aprobadas», debajo la empresa (con su
    estado si no esta activo) y el proyecto, y al pie el ejecutivo, el cierre
    y las alertas. Nada se monta sobre nada. Los pausados, cerrados y
    cancelados se ven atenuados.
18. «Ordenar» (Cliente o Cierre) reordena las tarjetas; pulsar otra vez el
    mismo invierte el orden. Buscar y filtrar funcionan como antes.
19. En un proyecto, «Cambiar el estado»: cada opcion es una fila entera con
    su icono, su nombre y lo que significa; ningun texto se parte. Cancelar
    va en el tono de peligro.
20. En una pieza, las dos columnas arrancan a la misma altura, las fases y
    las tareas tienen mas aire, y Versiones, Copy, Decisiones del cliente y
    Comentarios llevan su titulo dentro de la tarjeta.
21. En Versiones, cambiar entre «Archivo» y «Enlace» no cambia el alto de la
    tarjeta. El archivo se elige pulsando la zona o arrastrandolo encima;
    dice su nombre y peso y se puede quitar. Nada sale en ingles.
22. Lo mismo con el comprobante al reportar un pago.
23. Como `cliente@empresa.test`, la pieza en revision (Mis proyectos) tiene
    sus tarjetas con titulo y el mismo aire.

**Altos parejos (en cualquier pantalla con varios campos en fila)**

24. En una fila, el cuadro de texto, el desplegable y la fecha miden lo
    mismo: al editar una tarea (titulo, quien la hace, para cuando), en
    «Fecha y responsable de la fase», en los renglones de un presupuesto y
    en los datos de facturacion de una empresa. Ninguno sobresale.
25. En un brief con una pregunta de fecha, esa pregunta abre el calendario
    de la app, no el del sistema.

**Siete mejoras (proyectos, comentarios, completar, indice, volver, barra y Mi trabajo)**

26. Nuevo proyecto (como `cuentas@conejo.test`): «Lo lleva» dice «Tu» y no
    se puede cambiar (ver el punto 40).
27. En una pieza, cada fase tiene «Comentarios · N». Un comentario escrito
    en la fase 3 eligiendo «Sobre la tarea» sale en esa fase con la tarea
    como etiqueta. Los comentarios de antes estan en «Comentarios generales».
28. Marcar una tarea: el circulo rebota, suelta un anillo y el titulo se
    tacha con una raya que avanza. En Mi trabajo, la tarea llega a «Hechas»
    con un pequeno rebote.
29. Completar una fase: el aviso sale lleno de color, con un icono, y dice
    lo que sigue («…: completada · sigue X»); la bateria de arriba brilla.
    Como cliente, aprobar una pieza muestra el aviso de logro.
30. Con «reducir movimiento» activado en el sistema, nada de lo anterior se
    mueve: solo cambia el estado.
31. En una pagina con varias secciones (una pieza, un brief, Ajustes de
    finanzas) aparece abajo a la derecha un boton redondo con un numero. Al
    pulsarlo, «En esta pagina» lista las secciones, marca la que se ve y
    lleva a cada una. En una pagina corta no aparece.
32. Toda pagina del panel tiene «Volver» junto a las migas: vuelve a la
    pagina anterior; si se entro directo (un enlace, una recarga), sube un
    nivel. Nunca saca de la aplicacion.
33. Las listas de los desplegables, el calendario, el buscador y la campana
    usan la barra fina, que aparece al pasar el raton.
34. Mi trabajo (como `diseno@conejo.test`) abre con «Fases a tu cargo»: las
    fases de las que es responsable, con su fecha (en rojo si vencio), sus
    tareas pendientes de quien sean y «Abrir la pieza». Al poner a alguien
    como responsable de una fase en una pieza, la fase le aparece en su Mi
    trabajo.

## Revision del responsable — Bloque 1

Lo que el responsable pidio corregir al revisar la aplicacion (R3, R4, R6,
R9, R13, R14 y R16 de `docs/pendientesIntegracion.md`).

35. Brief del cliente (como `cliente@empresa.test`, Mis briefs → empezar):
    el paso «03 · El producto por dentro» no sale marcado hasta escribir algo
    en el.
36. Mis proyectos del cliente: el aviso «N piezas esperan tu revision» lleva
    directo a la pieza si es una; si son varias, lista cada una con su
    enlace. En Inicio, el de presupuestos por aprobar lleva directo al
    presupuesto si es uno.
37. Ficha de un brief (como `cuentas@conejo.test`): «Aceptar y abrir
    proyecto», «Convertir en presupuesto» y «Descartar» abren una ventana que
    explica que va a pasar. Cancelar no hace nada. Al confirmar, la ventana
    muestra el resultado (y «Abrir el proyecto» al aceptar). Descartar pide
    el motivo dentro de la ventana.
38. Con el brief de un prospecto (generar un enlace, llenarlo en una
    ventana privada): convertirlo en presupuesto muestra en la ventana su
    cuenta y su contrasena provisional, con boton de copiar. Como
    administrador, en Usuarios, esa cuenta puede aprobar piezas y ver las
    finanzas.
39. Como administrador, al crear un usuario cliente a mano, nace sin esos
    dos permisos.
40. Como `cuentas@conejo.test`, al editar un proyecto «Lo lleva» se ve pero
    no se cambia. Como `admin@conejo.test`, «Lo lleva» ofrece primero los
    ejecutivos de la empresa y despues los de otra cuenta, marcados. Un
    ejecutivo al que se le da un proyecto de una empresa que no atiende lo
    ve en Proyectos y lo gestiona, pero no ve los briefs ni otros proyectos
    de esa empresa.
41. Pieza en fase 4: la tarjeta de la fase lista las versiones de la ronda
    con «Para el cliente»; «Completar fase» esta deshabilitado con el motivo
    hasta elegir una. La tarjeta Versiones solo sube y muestra cual ve el
    cliente.
42. Avisos (campana): como `finanzas@conejo.test`, crear y enviar un
    presupuesto a Distribuidora Ejemplo; `cuentas@conejo.test` recibe los dos
    avisos. Registrar el rechazo a nombre del cliente: le llega al cliente y
    al ejecutivo, y no a quien lo registro. Poner a alguien como responsable
    de una fase le avisa; comentar en una fase avisa a quien la lleva y al
    ejecutivo, nunca a quien comenta.

## Revision del responsable — Bloque 2

Reorganizar las pantallas (R1, R2, R5, R7 y R8 de
`docs/pendientesIntegracion.md`).

43. Con la ventana a 1280 px o mas, toda pagina con secciones tiene a la
    derecha la columna «En esta pagina»: marca la seccion que se ve y lleva a
    cada una. El contenido no cambia de ancho al aparecer. A 1024 px o en el
    telefono, el indice es el boton redondo de abajo a la derecha.
44. Una pieza, un brief, Ajustes de finanzas y el formato de impresion
    muestran sus secciones en el indice; los titulos no llevan el contador
    (Mi trabajo: «Para hacer ahora», sin el numero).
45. Briefs (como `cuentas@conejo.test`): cada pestana tiene buscador
    (empresa o codigo), filtros de origen y formato (se pueden marcar varios;
    sin ninguno, todos), orden (recibido, ultimo movimiento, fecha que
    aspira, empresa) y paginas. Cambiar de filtro no cambia de pestana, y
    «Limpiar filtros» tampoco.
46. Cobranza: buscador por empresa o RIF, filtro de situacion y orden por
    total, vencido, mas de 90 dias o empresa. Las cifras de arriba son de
    todo; los totales de la tabla, de lo filtrado.
47. Como cliente, Mis proyectos y Mis briefs tienen la misma barra
    (buscador, filtro de estado y orden). En Mis briefs, «Nuevo brief» abre
    una ventana: se elige el formato, dice que va a pasar y Cancelar no crea
    nada; «Empezar el brief» lleva al formulario.
48. Empresas (como administrador): la ficha («Ver la ficha») dice quien la
    atiende, sin botones; se asigna y se quita en «Editar». Usuarios: retirar
    la verificacion en dos pasos esta en «Editar», no en la ficha.
49. Inicio, entrando con cada cuenta: el ejecutivo ve briefs por decidir y
    piezas que piden atencion; diseno, sus tareas y fases; finanzas, pagos
    por confirmar, presupuestos por enviar, proformas por facturar, por
    cobrar y la tasa; el administrador, todo eso y la actividad reciente; el
    cliente, sus proyectos, sus briefs en curso y su saldo. Cada bloque lleva
    a su modulo.

## Revision del responsable — Bloque 3

Pulido (R15, R17 y R19 de `docs/pendientesIntegracion.md`).

50. Un presupuesto, una proforma y una factura (de administracion y del
    cliente) y la portada de Facturacion: las dos columnas terminan a la
    misma altura. En la factura, «Abrir el PDF para imprimir» y «Marcar como
    impresa» van uno bajo el otro, del mismo ancho.
51. Tablero: pulsar una alerta o «Filtrar» no sube la pagina.
52. Pasar el raton por cualquier boton, plegable («Comentarios», «Fecha y
    responsable de la fase»), casilla u opcion muestra la mano; uno
    deshabilitado, el cursor de no permitido. En el telefono, tocar algo no
    lo deja con el color de «encima».

## Revision del responsable — Bloque 4

Nomenclatura de archivos (R18 y R20 de `docs/pendientesIntegracion.md`).

53. Empresas (como administrador): cada empresa tiene su **sigla** en
    «Editar» y en la ficha. Al registrar una nueva, se propone sola mientras
    se escribe el nombre («Cafe Sendero, C.A.» → CAFE-SENDERO) y debajo dice
    como quedara. Repetir la sigla de otra empresa da error. Revisar las
    siglas propuestas para las empresas de antes.
54. Proyectos: al abrir o editar un proyecto aparece el **nombre corto**,
    propuesto a partir del nombre («Parrilla de octubre» →
    PARRILLA-OCTUBRE).
55. En una pieza, al elegir un archivo para subir, la tarjeta Versiones dice
    «Se guardara como SIGLA_NOMBRE-CORTO_TIPO_AAMM_v0N.ext». Al guardarlo,
    la version se llama asi. Con dos piezas del mismo tipo en el proyecto, el
    tipo lleva su orden (POST-01, POST-02).
56. Cuando el cliente aprueba una pieza cuya version es un archivo, al
    descargarla se llama ..._APROBADO-CLIENTE.ext.
57. Herramientas → **Nombres de archivo** (cualquier persona del equipo):
    elegir cliente, proyecto (o escribir uno), tipo, mes, version y
    extension arma el nombre; mientras falte algo lo dice y no deja copiar.
    «Copiar nombre» lo copia. Entrando con alguien de diseno o redes, la
    lista de proyectos trae todos los de la empresa, tambien en los que no
    trabaja, aunque no pueda abrirlos. Un cliente no ve el modulo.
