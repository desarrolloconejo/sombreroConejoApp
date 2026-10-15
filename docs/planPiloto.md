# Plan del piloto con un cliente real

La etapa 8 del plan del portal termina con una prueba controlada: un cliente
real usa la aplicacion durante unas semanas, con el equipo pendiente, antes de
abrirla a todos. Este documento dice como prepararla, que hacer cada semana,
que observar y como volver atras si algo sale mal.

**Lo que falta decidir** (lo decide el responsable):

| Que | Propuesta |
| --- | --- |
| Que cliente | Uno de confianza, con un proyecto en curso y una persona de contacto que use el telefono a diario. Mejor si ya tiene presupuestos o proformas este mes |
| Cuando | Despues de publicar la integracion y de pasar la verificacion manual de todas las etapas |
| Cuanto dura | Cuatro semanas |
| ¿Se factura de verdad en el piloto? | **No al principio.** Facturar exige los datos reales del emisor, la numeracion y el talonario calibrado (`docs/pendientesIntegracion.md`). Se propone empezar con proyectos, revision, briefs y presupuestos, y sumar facturas cuando lo anterior este resuelto |

---

## 1. Antes de empezar

### Lo tecnico

- [ ] Publicada la version con la integracion completa, siguiendo
      `docs/despliegueProduccion.md` (archivos `db/neon/` 01 a 16 en orden).
- [ ] Pasada la verificacion manual de cada etapa (`docs/verificacionManual.md`).
- [ ] La tasa del dolar del dia aparece en Ajustes de finanzas.
- [ ] El correo: si sigue en modo simulado, alguien del equipo revisa la
      Bandeja de salida cada dia y entrega a mano lo importante.

### La agencia

- [ ] Cada persona del equipo que participa entra, cambia su contrasena y
      decide si activa los dos pasos.
- [ ] La empresa del cliente tiene asignado a su ejecutivo de cuentas
      (Empresas → ficha → «Quien la atiende»).
- [ ] El proyecto en curso del cliente esta creado, con sus piezas y tareas.

### El cliente

- [ ] Su persona de contacto tiene cuenta (Usuarios → alta), con la
      contrasena provisional entregada **en mano o por telefono, nunca por
      correo**.
- [ ] Marcadas, para esa persona, «Puede aprobar piezas» y, si el piloto lo
      incluye, «Puede ver las finanzas».
- [ ] Una llamada corta de bienvenida: como entrar, que vera, a quien
      escribir si algo falla.

---

## 2. Semana a semana

| Semana | El cliente | El equipo |
| --- | --- | --- |
| 1 | Entra, configura (o no) los dos pasos, ve Mis proyectos y la bateria de su proyecto | Trabaja las piezas con sus fases y tareas en la aplicacion, no fuera |
| 2 | Revisa y aprueba o pide correccion de al menos una pieza en la fase 5 | Sube las versiones a la ficha de cada pieza y elige la que vera el cliente |
| 3 | Envia un brief nuevo desde Mis briefs (o lo llena un prospecto por enlace) | Decide el brief en la bandeja: proyecto, presupuesto o descarte |
| 4 | Aprueba o rechaza un presupuesto en Facturacion | Arma el presupuesto, lo envia, genera la proforma. Si ya esta lo real del talonario: emite la factura y confirma el pago que reporte el cliente |

---

## 3. Que observar

| Que | Como se sabe |
| --- | --- |
| ¿Entra sin ayuda? | Si pide la contrasena otra vez o se bloquea (la campana avisa a los administradores de los bloqueos) |
| ¿Entiende en que punto esta su proyecto? | Preguntarle al final de la semana 1, sin mirar la pantalla: «¿cuanto le falta a tu proyecto?» |
| ¿Aprueba desde el telefono? | Auditoria → filtrar por la empresa: quien aprobo y cuando |
| ¿Le llegan los avisos? | La campana del cliente; en modo simulado, la Bandeja de salida |
| ¿El equipo lo usa o trabaja por fuera? | Mi trabajo y el Tablero: tareas marcadas, fases completadas |
| Errores | Cualquier pantalla de «Algo salio mal», con la hora, al ejecutivo de cuentas |

Al final de cada semana, el ejecutivo apunta en una nota corta: que funciono,
que costo, que pidio el cliente. Eso alimenta el informe del piloto.

---

## 4. Si algo sale mal

| Que pasa | Que hacer |
| --- | --- |
| El cliente no puede entrar | Usuarios → «Restablecer contrasena» y entregarsela en mano. Si perdio el telefono de los dos pasos, «Retirar los dos pasos» en su ficha |
| Una pantalla falla | Se sigue por el canal de siempre (correo, mensajes) y se anota la hora y lo que hacia. Se corrige y se publica una version nueva |
| Algo grave en la aplicacion entera | La vuelta atras de `docs/despliegueProduccion.md`, seccion 7 |
| Una factura sale mal | Se anula con su motivo y se emite otra (F9). Nunca se edita |

---

## 5. Cuando se da por bueno

- El cliente entro solo, aprobo al menos una pieza y respondio a un
  presupuesto desde la aplicacion.
- El equipo trabajo ese proyecto en la aplicacion de principio a fin.
- No quedo ningun error abierto que impida trabajar.

Con eso se prepara el informe del piloto y se decide abrir la aplicacion al
resto de clientes, por tandas.
