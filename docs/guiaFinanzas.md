# Guia de finanzas

Como funciona el modulo de finanzas de Conejo App, de principio a fin: quien
hace que, por que estados pasa cada documento, que calcula el sistema solo,
que protege la base de datos y que falta para facturar de verdad.

Escrita para el equipo, no para desarrolladores. El detalle tecnico vive en
`docs/planIntegracionPortal.md` (seccion 7); lo pendiente, en
`docs/pendientesIntegracion.md`.

---

## 1. La idea en una linea

Finanzas cubre **lo que los clientes le deben a la agencia** y como se cobra.
No hay proveedores, cuentas por pagar, contabilidad ni libro de ventas.

```
 PRESUPUESTO ──aprobado──▶ PROFORMA ──emitida──▶ FACTURA ──▶ PAGOS Y RETENCIONES ──▶ COBRANZA
  "costaria"               "vamos a cobrar"      documento     "ya pague"              "quien debe
                                                 legal                                  y desde cuando"
  en dolares               en dolares            en bolivares
```

Cada paso nace del anterior. Ningun paso ocurre solo: siempre lo dispara una
persona.

---

## 2. Quien participa

### Administracion (el «operador»)

El administrador o cualquier trabajador con el cargo **administracion**. Los
dos pueden exactamente lo mismo. Ven en el menu la seccion *Finanzas*:

| Modulo | Para que |
| --- | --- |
| **Presupuestos** | Crear, editar y enviar presupuestos; registrar la decision de un cliente sin cuenta; generar la proforma |
| **Proformas** | Revisar y emitir lo que se va a facturar; las recurrentes mensuales |
| **Facturas** | Emitir, imprimir, anular; ver y confirmar o rechazar pagos y retenciones |
| **Cobranza** | Lo que debe cada empresa, por antiguedad |
| **Ajustes de finanzas** | Emisor, impuestos, numeracion, tasa del dolar, medios de pago, formatos de impresion |

### El cliente

Solo el usuario de cliente que tenga marcada la casilla **«Puede ver las
finanzas»** en su ficha (la marca el administrador en Usuarios o Empresas).
Ve el modulo **Facturacion**, y solo con los documentos de **su** empresa:

- Presupuestos enviados: los aprueba o rechaza.
- Proformas emitidas y facturas: las consulta.
- Estado de cuenta: cuanto debe y cuanto esta vencido.
- Reportar pagos y retenciones, con su comprobante.

Un cliente sin esa casilla no ve nada de dinero, aunque vea sus proyectos.

### El resto del equipo

Ejecutivos, diseno, redes, etc. **no ven nada de finanzas.** El ejecutivo
solo toca el borde: al revisar un brief puede elegir «Pasar a presupuesto»,
y eso le deja la tarea a administracion.

---

## 3. Antes de empezar: los ajustes

Se configuran una vez en **Ajustes de finanzas** y se cambian cuando haga
falta. Hoy tienen **valores de ejemplo**.

| Ajuste | Que es | Por que importa |
| --- | --- | --- |
| **Emisor** | Razon social, RIF y domicilio fiscal de la agencia | Sin estos datos el sistema **no deja emitir** facturas |
| **IVA** | 16 % | Se suma aparte a los precios |
| **Retencion de IVA (por empresa)** | Si la empresa es agente de retencion y en que porcentaje (75 o 100 %) | Cambia cuanto se espera cobrar en efectivo |
| **Dias de credito** | Plazo para pagar una factura. 15 por defecto; cada empresa puede tener el suyo | Decide cuando vence la factura |
| **Numeracion** | Serie, proximo numero de factura y rango de numeros de control del talonario | El proximo numero **solo puede subir**; avisa cuando se acaba el rango de control |
| **Tasa del dolar** | Historico de la tasa BCV | Sin tasa no se puede facturar |
| **Medios de pago** | Transferencia, pago movil, Zelle…, con monedas que aceptan, si piden referencia y los datos para pagar | Es lo que el cliente elige al reportar un pago. Se desactivan, no se borran |
| **Formatos de impresion** | Tamano de hoja y posicion de cada dato en milimetros, con su hoja de calibracion | Para imprimir sobre el talonario preimpreso |
| **ISLR e IGTF** | Preparados | **Apagados** hasta que responda el contador |

**Regla de oro:** cambiar un ajuste **nunca** altera una factura ya emitida.
Cada factura guarda su propia copia de todo lo que imprime.

---

## 4. El recorrido, paso a paso

### Paso 1 — Presupuesto

**Que es:** la propuesta economica. «Esto costaria».

**Como nace** (dos caminos):

1. Administracion lo crea desde cero en *Presupuestos*: elige empresa y,
   si quiere, el proyecto al que corresponde.
2. Desde un brief: el ejecutivo, en la bandeja de *Briefs*, elige «Pasar a
   presupuesto». Administracion pulsa «Presupuestar» y el sistema le arma un
   borrador ya ligado a esa empresa, a ese brief y a su proyecto, si existe.

**Como se arma:** en **dolares**, por renglones (descripcion, cantidad,
precio unitario, gravado o exento). Al guardar, **la base de datos calcula**
subtotales, IVA y total; nadie escribe un total a mano. La pantalla muestra
una vista previa mientras se escribe, pero lo que vale es lo que calcula el
servidor.

**Estados:**

```
 borrador ──enviar──▶ enviado ──┬─ aprobado
                                └─ rechazado
```

| Estado | Que significa | Quien lo ve |
| --- | --- | --- |
| Borrador | En preparacion, se edita libremente | Solo administracion |
| Enviado | Ya no se edita. Al cliente le llega una notificacion | Administracion y el cliente |
| Aprobado | El cliente dijo que si. Ya se puede generar la proforma | Ambos |
| Rechazado | El cliente dijo que no, con su motivo | Ambos |

**Vencimiento:** cada presupuesto tiene un «valido hasta» (15 dias por
defecto, editable al crearlo). Pasada esa fecha aparece como **vencido** y el
cliente ya no puede aprobarlo. «Vencido» no es un estado guardado: el sistema
lo deduce de la fecha.

**Cliente sin cuenta:** si la empresa no tiene a nadie con acceso, o respondio
por otro medio (WhatsApp, llamada), administracion registra la aprobacion o el
rechazo **a su nombre**. Queda anotado que lo registro un operador, quien y
cuando.

**Que hace el cliente:** entra a *Facturacion*, abre el presupuesto y pulsa
aprobar o rechazar (con motivo). Administracion recibe la notificacion.

---

### Paso 2 — Proforma

**Que es:** el borrador de lo que se va a facturar. «Esto es lo que vamos a
cobrar». Sirve para revisar con calma antes de que exista un documento legal
con numero.

**Como nace:**

1. Desde un presupuesto **aprobado**, con el boton «Generar la proforma». Copia
   sus renglones.
2. Desde una proforma **recurrente** a la que le toca el mes (ver abajo).

**Estados:**

```
 borrador ──emitir──▶ emitida ──facturar──▶ facturada
                         │
                         └──anular──▶ anulada
```

| Estado | Que significa |
| --- | --- |
| Borrador | Se edita: titulo, notas, proyectos ligados y renglones |
| Emitida | Congelada. El cliente la ve y le llega una notificacion. Ya se puede facturar |
| Facturada | Ya tiene su factura |
| Anulada | Se descarto, con motivo |

**Proformas recurrentes (contratos mensuales):**

- Una proforma emitida se puede marcar como **recurrente**, con la fecha en
  que toca preparar la siguiente.
- Cuando llega esa fecha, la pantalla de *Proformas* la muestra arriba, en
  «toca preparar». Un boton crea la del mes siguiente como **copia en
  borrador** (mismos renglones y proyectos) y adelanta la fecha un mes.
- Administracion la revisa, la ajusta si hace falta y la emite.
- **Nunca se emite ni se factura sola.** No hay tareas automaticas que cobren.

---

### Paso 3 — Factura

**Que es:** el documento fiscal. Aqui el dinero pasa a **bolivares**.

**Como se emite:** desde una proforma **emitida**, boton «Emitir la factura».
En una sola operacion, todo o nada, el sistema:

1. Toma el **siguiente numero de factura**, sin saltos.
2. Toma el **siguiente numero de control** del talonario.
3. Convierte a bolivares con la **tasa del dolar BCV del dia** y guarda la
   tasa, su fuente y su fecha.
4. Calcula la **fecha de vencimiento**: emision + dias de credito de la
   empresa (o los de ajustes, si la empresa no tiene).
5. Calcula la **retencion de IVA esperada**, si la empresa es agente de
   retencion.
6. **Congela una copia** de los datos del emisor, del cliente y de los
   renglones.
7. Marca la proforma como facturada, anota quien lo hizo y notifica al
   cliente.

Si algo falla, el numero **no se consume** y la pantalla dice por que:

| Mensaje | Que hacer |
| --- | --- |
| Faltan los datos del emisor | Llenarlos en Ajustes de finanzas |
| No hay tasa del dolar registrada | Registrar la tasa a mano |
| Se acabaron los numeros de control | Cargar el rango del talonario nuevo |
| Mas renglones de los que caben en la hoja | Facturar en dos facturas |
| La proforma no tiene renglones / no esta emitida | Revisar la proforma |

**Estados:** solo dos.

| Estado | Que significa |
| --- | --- |
| Emitida | Vale. **No se puede editar** |
| Anulada | Invalidada con motivo, fecha y responsable. No se reactiva |

«Pagada» **no es un estado que alguien marque**: lo calcula el sistema con
los pagos (paso 5).

**Corregir una factura:** no se edita. Se **anula** con motivo y la proforma
vuelve a poder facturarse, para emitir una nueva con otro numero. No hay notas
de credito.

**Imprimir:** la factura se imprime sobre el **talonario preimpreso**. El PDF
lleva solo los datos variables, cada uno en su posicion en milimetros segun el
formato elegido. Para ajustar la impresora hay una hoja de calibracion con
cuadricula. Se puede reimprimir identica las veces que haga falta y en
cualquier formato, porque sale de la copia congelada. Despues de imprimirla se
marca como «impresa».

#### La tasa del dolar

- El sistema **lee la tasa del sitio del BCV una vez al dia** y la guarda.
  Ademas, si al abrir finanzas la ultima lectura tiene mas de una hora, la
  vuelve a leer.
- Se guarda un historico: una fecha que ya tiene tasa no se pisa.
- Si un dia el BCV no publica (fin de semana, feriado), se usa **la ultima
  publicada**.
- Una lectura sospechosa (por ejemplo, un salto enorme) **no se guarda** y
  avisa a administracion.
- Administracion siempre puede **registrarla a mano**. Si difiere en mas de un
  25 % de la anterior, el sistema pide confirmarla, porque con esa tasa salen
  facturas que ya no cambian.
- Una factura emitida **nunca se recalcula**, aunque despues cambie la tasa.

---

### Paso 4 — Pagos y retenciones

**El cliente reporta** desde *Facturacion*, en la factura:

- medio de pago (de los activos en ajustes);
- referencia, fecha, monto y moneda;
- **comprobante**: foto o PDF. Se guarda en Google Drive de la agencia y solo
  se puede ver a traves de la aplicacion.

El pago queda **«por confirmar»** y **todavia no baja la deuda**.
Administracion recibe la notificacion.

**Administracion lo revisa** contra el banco, desde la factura:

```
 por_confirmar ──┬─ confirmar ──▶ confirmado   (baja el saldo)
                 └─ rechazar  ──▶ rechazado    (con motivo; el cliente lo ve)
```

- **Confirmar:** se indica el **monto que se aplica** en bolivares. Si el
  cliente pago en dolares, se indica tambien la tasa usada para convertirlo.
- **Rechazar:** con motivo (no llego, monto distinto, referencia que no
  existe…).
- El cliente recibe la notificacion en ambos casos.
- Lo que reporto el cliente **no se puede modificar**; solo se confirma o
  se rechaza.
- Administracion tambien puede **registrar un pago a nombre del cliente**
  (por ejemplo, uno que llego sin reporte).
- Cada pago pertenece a **una sola factura**. Si un cliente paga dos facturas
  con una transferencia, se reportan dos pagos.

**Retenciones de IVA:** si la empresa es agente de retencion, no paga el IVA
completo; retiene el 75 % o el 100 % y lo entrega al fisco. El cliente
reporta la retencion igual que un pago, con su comprobante, y administracion
la confirma. **La factura no se considera cerrada** hasta que la retencion
esperada este confirmada.

Ejemplo con un agente de retencion del 75 %:

| Concepto | Monto |
| --- | --- |
| Base imponible | Bs 10.000,00 |
| IVA 16 % | Bs 1.600,00 |
| **Total factura** | **Bs 11.600,00** |
| Retencion esperada (75 % del IVA) | Bs 1.200,00 |
| **Neto que debe pagar en dinero** | **Bs 10.400,00** |

La factura queda pagada cuando hay Bs 10.400 en pagos confirmados **y** la
retencion de Bs 1.200 confirmada.

---

### Paso 5 — Estado de cobro y cobranza

**Estado de cada factura** (lo calcula el sistema, nadie lo marca):

| Estado | Cuando |
| --- | --- |
| Pendiente | No tiene pagos confirmados |
| Parcial | Tiene pagos confirmados, pero queda saldo o falta la retencion |
| Pagada | Saldo cero y retencion confirmada (si aplica) |
| Anulada | Fue anulada: su saldo es cero |

Recordatorio: un pago **por confirmar no cuenta**. Por eso un cliente puede
ver «pendiente» aunque ya haya reportado: falta que administracion confirme.

**Cobranza** (administracion) lista a cada empresa que debe algo, con su
saldo repartido segun **cuanto lleva vencido**:

| Columna | Que suma |
| --- | --- |
| Por vencer | Facturas que aun no llegan a su fecha de vencimiento |
| 1–30 dias | Vencidas hace hasta un mes |
| 31–60 dias | Vencidas hace uno a dos meses |
| 61–90 dias | Vencidas hace dos a tres meses |
| Mas de 90 | Vencidas hace mas de tres meses |
| Total | Todo lo que debe |

Tambien indica cuantas retenciones siguen abiertas. Ordena primero a quien
mas debe e incluye RIF y telefono para llamar.

**Estado de cuenta** (cliente): cuanto debe en total, cuanto esta vencido,
cuantas facturas tiene abiertas y cuantos pagos esperan confirmacion.

---

## 5. Como encaja con el trabajo (briefs y proyectos)

El trabajo y el cobro **van en paralelo**, no en cadena:

```
 TRABAJO   brief ──▶ el ejecutivo acepta ──▶ proyecto ──▶ piezas y fases ──▶ revision del cliente
                │                               ╎
                └─ «pasar a presupuesto»        ╎ (se liga)
                          │                     ╎
 COBRO                    ▼                     ╎
           presupuesto ──▶ proforma ──▶ factura ──▶ pagos ──▶ cobranza
```

- **Aprobar un presupuesto no crea el proyecto.** El proyecto lo abre el
  ejecutivo al aceptar el brief (o a mano en *Proyectos*).
- Un presupuesto se puede **ligar a un proyecto** de la misma empresa, y una
  proforma a **uno o varios**, para saber que se cobra por que trabajo.
- Una proforma recurrente puede cubrir el trabajo de varios proyectos del mes.
- El avance de un proyecto no depende de que este pagado, ni al reves.

---

## 6. Las notificaciones de finanzas

Todas llegan a la **campana**. El envio de un presupuesto, ademas, sale por
correo a quien puede ver las finanzas de esa empresa.

| Cuando | Le llega a |
| --- | --- |
| Se envia un presupuesto | Cliente con permiso de finanzas |
| El cliente aprueba o rechaza un presupuesto | Administracion |
| Se emite una proforma | Cliente |
| Se emite una factura | Cliente |
| El cliente reporta un pago o una retencion | Administracion |
| Se confirma o rechaza un pago | Cliente |
| La lectura automatica de la tasa sale rara y se descarta | Administracion |

Ningun correo lleva contrasenas ni codigos, y todos quedan guardados en la
*Bandeja de salida*.

---

## 7. Lo que protege el sistema por si solo

Estas reglas no dependen de que alguien las recuerde: la base de datos las
impone y no se pueden saltar ni con un error de programacion.

| Regla | Para que |
| --- | --- |
| Nadie puede **borrar** nada de finanzas | Todo queda; lo que sobra se anula con motivo |
| Una factura emitida **no se edita**; sus renglones tampoco | Lo que se entrego al cliente es lo que queda |
| La numeracion **no tiene saltos** y solo avanza | Exigencia fiscal |
| Los totales **siempre cuadran** (total = base + exento + IVA) | No hay importes inventados |
| Los importes los calcula la base, no la pantalla | Una sola fuente de verdad |
| Anular exige motivo, fecha y responsable | Trazabilidad |
| Una factura en bolivares lleva tasa y fuente | Se sabe de donde sale cada monto |
| Un pago confirmado tiene monto aplicado; uno rechazado, motivo | No hay pagos a medias |
| El cliente solo ve lo de **su** empresa, y nunca los borradores | Aislamiento entre clientes |
| El cliente solo puede crear pagos «por confirmar» y a su nombre | No puede darse por pagado |
| El cliente aprueba un presupuesto sin poder tocar sus montos | Solo cambia el estado |
| Toda accion queda en **Auditoria**: quien, que y cuando | Responsabilidad |

El dinero se maneja siempre con decimales exactos, nunca con numeros de coma
flotante, y se redondea a dos decimales en cada renglon y en el IVA (mitad
hacia arriba).

---

## 8. Recorrido de prueba (unos 20 minutos)

Las cuentas de prueba y sus contrasenas estan en `db/datos/semilla.mts`. Usa
dos ventanas: una normal y otra privada.

1. **Administracion** (`finanzas@conejo.test`): *Presupuestos* → nuevo →
   elige la empresa del cliente de prueba → anade dos renglones → **Guardar y
   enviar al cliente**.
2. **Cliente** (`cliente@empresa.test`, ventana privada): mira la campana →
   *Facturacion* → abre el presupuesto → **Aprobar el presupuesto**.
3. **Administracion**: abre el presupuesto (ya dice aprobado) → **Generar
   la proforma** → revisala → **Guardar y emitir**.
4. **Administracion**: en la proforma, **Emitir la factura**. Mira el numero, el
   numero de control, la tasa y el vencimiento. Abre el **PDF**.
5. **Cliente**: *Facturacion* → la factura → **Reportar** un pago, por la mitad
   del monto, con cualquier imagen como comprobante. Mira el estado de cuenta:
   el saldo **no** ha bajado.
6. **Administracion**: en la factura, **Confirmar** el pago. Ve a *Cobranza*:
   el saldo de la empresa bajo y la factura esta «parcial».
7. Repite el pago por el resto y confirma: la factura pasa a «pagada» y la
   empresa sale de Cobranza.
8. Extra: anula una factura con motivo y comprueba que la proforma se puede
   volver a facturar con otro numero.

---

## 9. Lo que falta para facturar de verdad

Todo funciona, pero con **valores de ejemplo**. Antes de la primera factura
real hace falta (la mayoria lo responde el contador):

| Falta | Bloquea |
| --- | --- |
| Datos reales del emisor (razon social, RIF, domicilio fiscal) | Emitir facturas |
| Numero de factura y de control desde el que se empieza | La primera factura |
| Campos obligatorios de la factura y vigencia del talonario | Emitir facturas |
| La hoja del talonario real, para medir y calibrar | Imprimir |
| Medios de pago reales y sus datos | Que los clientes paguen |
| Dias de credito por defecto | El vencimiento correcto |
| Confirmar a que tasa se aplica un pago en dolares | Confirmar pagos en divisas |
| Que hacer con IGTF e ISLR | Encenderlos |
| Que facturas con muchos renglones se parten en dos, y que se corrige anulando | Confirmar el criterio |
| Pasar el Google Drive de los comprobantes a la cuenta de la empresa | Recibir comprobantes reales |

**Fuera del alcance de esta version:** proveedores y cuentas por pagar, notas
de credito y debito, descuentos, varias tasas de IVA en un documento,
anticipos y saldos a favor, libro de ventas, factura electronica, pasarela de
pago y contabilidad.

---

## 10. Glosario

| Termino | Significado |
| --- | --- |
| Operador | Quien opera finanzas: el administrador o el cargo administracion |
| Presupuesto | Propuesta economica que el cliente aprueba o rechaza |
| Proforma | Borrador de lo que se va a facturar; puede repetirse cada mes |
| Factura | Documento fiscal con numero y numero de control, en bolivares |
| Numero de control | Numero preimpreso de cada hoja del talonario |
| Tasa BCV | Tasa oficial del dolar del Banco Central de Venezuela |
| Gravado / exento | Renglon que paga IVA / que no lo paga |
| Base imponible | Suma de los renglones gravados |
| Agente de retencion | Empresa obligada a retener parte del IVA y entregarlo al fisco |
| Retencion esperada | La parte del IVA que el cliente retendra |
| Monto aplicado | Lo que un pago abona realmente a la factura, en bolivares |
| Saldo | Lo que falta por cobrar de una factura |
| Dias de credito | Plazo para pagar una factura desde su emision |
| Antiguedad | Cuantos dias lleva vencido un saldo |
| Copia congelada | Los datos que la factura guarda al emitirse y que ya no cambian |
