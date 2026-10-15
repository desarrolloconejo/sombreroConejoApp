# Informe de la integracion del portal

**Fecha:** 15 de octubre de 2026
**Estado:** etapas 1 a 8 construidas y unidas en `main`, en local. **Nada se ha
publicado todavia**: se publica al terminar las pruebas del responsable. La
etapa 9 (mudanza al servidor propio) espera fecha.

Que hace hoy la aplicacion, como se probo y como probarla. Lo que falta para
usarla de verdad esta en `docs/informePendientes.md`.

---

## 1. Que hace hoy, segun quien entra

### Todos

- Entrar con correo y contrasena, con **verificacion en dos pasos** (app de
  codigos en el telefono, con codigo QR). Se pide al entrar; quien no la
  quiera lo dice y no se le vuelve a preguntar.
- La sesion dura lo que dura el trabajo: se renueva sola y avisa antes de
  cerrarse por inactividad. Cinco intentos fallidos bloquean la cuenta 15
  minutos.
- Mi perfil: datos, contrasena, tema claro u oscuro, sesiones abiertas.
- La **campana** avisa de lo que le toca a cada uno.

### El equipo de la agencia

| Quien | Que |
| --- | --- |
| Ejecutivo de cuentas | **Tablero** con las alertas de sus proyectos; **Proyectos** con piezas, fases y tareas y su bateria de avance; **Briefs**: decide cada brief recibido (aceptar y abrir proyecto, pasar a presupuesto, proponer otra fecha o descartar), y genera **enlaces privados** para que un prospecto llene su brief sin cuenta |
| Cualquiera con tareas | **Mi trabajo**: sus tareas de todos los proyectos, para marcarlas como listas |
| Redes | **Hooks**: crear y auditar hooks, tambien desde una tarea |
| Administracion (finanzas) | **Presupuestos** y **Proformas** (con proformas recurrentes); **Facturas**: emitir desde la proforma, imprimir sobre el talonario, anular, confirmar o rechazar pagos; **Cobranza**: lo que debe cada empresa por antiguedad; **Ajustes de finanzas**: emisor, impuestos, numeracion, tasa del dolar, medios de pago, formatos de impresion y datos de facturacion de cada empresa |
| Administrador | Todo lo anterior, mas **Usuarios**, **Empresas** (con sus ejecutivos), **Auditoria** (quien hizo que) y **Bandeja de salida** (los correos) |

### Los clientes

| Que | Para quien |
| --- | --- |
| **Mis proyectos**: el avance de cada proyecto y pieza; revisar, aprobar o pedir correccion en la fase de revision | Quien tenga «Puede aprobar piezas» decide; los demas ven |
| **Mis briefs**: llenar un brief por pasos, entre varios, guardando a medias, y enviarlo; ver aclaraciones y versiones | Cualquiera de la empresa |
| **Facturacion**: aprobar o rechazar presupuestos, ver proformas y facturas, el estado de cuenta, y **reportar pagos** con su comprobante | Quien tenga «Puede ver las finanzas» |

### Sin cuenta

- Un **prospecto** llena su brief por el enlace privado que le da el
  ejecutivo. Al aceptarlo, se convierte en cliente.

---

## 2. Como se ha comprobado

| Que | Resultado |
| --- | --- |
| Revision de estilo del codigo y de tipos | Sin errores |
| Pruebas unitarias (reglas, calculos, PDF, menu, y que toda accion, pagina y descarga compruebe quien la pide) | 145 de 145 |
| Lo que la base de datos permite a cada persona (permisos y proteccion por empresa) | 118 de 118 comprobaciones |
| Modelos, sesiones y auditor de hooks | 53, 22 y 19 de 19, todas correctas |
| Recorridos completos en el navegador (entrar, crear, aprobar, facturar, pagar…) | 56 de 57 en la pasada final; la que fallo (registrar la tasa a mano) era la propia prueba, que tropezaba con tasas de corridas anteriores. Corregida, pasa |
| Compilacion de produccion | Compila sin errores |

Pasada final del 15 de octubre: con el servidor de desarrollo reiniciado y un
solo navegador, 16,8 minutos.

Cada archivo de cambios para la base de produccion (`db/neon/` 01 a 16) se
ensayo dos veces sobre una copia local de la base anterior.

**Nota sobre el navegador:** el servidor de desarrollo, tras mucho uso, a veces
corta una navegacion la primera vez que prepara una pagina. Cuando una prueba
falla por eso, pasa al repetirla tras reiniciarlo. En produccion no ocurre: las
paginas ya van preparadas.

---

## 3. Guia para probar manana

### Arrancar

```bash
docker compose up -d
docker compose exec app-dev npm run seed
```

La aplicacion queda en `http://localhost:<APP_PORT>` (el puerto esta en el
`.env`); desde el telefono, con la IP del equipo en la red local. Las cuentas
de prueba y sus contrasenas estan en `db/datos/semilla.mts`.

| Cuenta | Para probar |
| --- | --- |
| `cuentas@conejo.test` | Ejecutivo: Tablero, Proyectos, Briefs y enlaces de prospecto |
| `finanzas@conejo.test` | Administracion: presupuestos, proformas, facturas, pagos, cobranza y ajustes |
| `cliente@empresa.test` | Cliente con todos los permisos: Mis proyectos, Mis briefs y Facturacion |
| `redes@conejo.test`, `diseno@conejo.test` | Equipo: Mi trabajo y Hooks |
| `admin@conejo.test` | Administrador: Usuarios, Empresas, Auditoria, Bandeja de salida |

### Recorrido sugerido (unas dos horas)

1. **Cliente envia un brief** (`cliente@empresa.test`): Mis briefs → empezar,
   llenar, enviar. Anotar el codigo.
2. **Ejecutivo lo acepta** (`cuentas@conejo.test`): Briefs → abrirlo →
   aceptar. Nace el proyecto; completar su fase 1.
3. **Prospecto por enlace**: en Briefs, generar un enlace y abrirlo en una
   ventana privada; llenarlo y enviarlo. Aceptarlo da la contrasena del nuevo
   cliente.
4. **Proyecto y revision**: en una pieza, avanzar fases, subir una version y
   marcarla para el cliente; como cliente, pedir correccion y luego aprobar.
5. **Presupuesto a factura** (`finanzas@conejo.test`): presupuesto → enviar;
   como cliente, aprobarlo; generar la proforma, emitirla y **emitir la
   factura**. Abrir el PDF para imprimir.
6. **Pago**: como cliente, reportar un pago con una foto o PDF de
   comprobante; como administracion, confirmarlo y ver bajar el saldo en
   Cobranza.
7. **En el telefono**: repetir los pasos del cliente en el movil.

El paso a paso completo, etapa por etapa, esta en `docs/verificacionManual.md`.
Lo que se encuentre conviene anotarlo con la hora y la cuenta usada.

---

## 4. Documentos

| Documento | Para que |
| --- | --- |
| `docs/informePendientes.md` | Que falta para usarla de verdad, por momento, con quien aporta cada dato |
| `docs/verificacionManual.md` | La prueba a mano, etapa por etapa |
| `docs/despliegueProduccion.md` | Los pasos del dia de publicar |
| `docs/planPiloto.md` | La prueba con un cliente real |
| `docs/pendientesIntegracion.md` | El registro detallado de pendientes |
| `docs/planIntegracionPortal.md` | El plan maestro y las decisiones tomadas |
