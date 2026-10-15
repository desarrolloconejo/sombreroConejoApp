# Pendientes de la integracion

Registro vivo de todo lo que se construyo con valores de ejemplo, lo que se
dejo sin hacer y lo que espera una respuesta del negocio. Cada etapa lo
actualiza al cerrarse. **Al terminar la integracion, de aqui sale el informe
final de lo que falta**: que cambiar, donde y quien lo aporta.

No es una lista de errores: todo lo de aqui funciona con lo que hay. Es lo que
hay que sustituir o completar para usarlo de verdad.

Columnas: **Donde** dice en que sitio se cambia (una pantalla de la
aplicacion, una variable de Vercel, el codigo). **Quien** dice quien aporta el
dato.

---

## 1. Valores provisionales que hay que sustituir

Lo que hoy tiene un valor de ejemplo. Se cambia sin tocar codigo salvo que se
diga lo contrario.

| # | Que | Valor de ejemplo | Donde se cambia | Quien | Etapa |
| --- | --- | --- | --- | --- | --- |
| V1 | Datos del emisor de las facturas (razon social, RIF, domicilio fiscal) | Una empresa ficticia en la semilla. En produccion nacen vacios y hay que llenarlos antes de emitir | Finanzas → Ajustes → Emisor | Responsable | 7 |
| V2 | Serie y proximo numero de factura | Serie `A`, desde el 1 | Finanzas → Ajustes → Numeracion. Solo sube, nunca baja | Contador (F7) | 7 |
| V3 | Rango de numeros de control del talonario | `00-000001` a `00-000500` | Finanzas → Ajustes → Numeracion | Imprenta del talonario (F7, F11) | 7 |
| V4 | Formato de impresion de la factura | «Carta (ejemplo)», 215,9 × 279,4 mm, con posiciones de ejemplo | Finanzas → Ajustes → Formatos de impresion: crear el del talonario real y calibrarlo con su hoja de cuadricula | Responsable, con la hoja del talonario (F13) | 7 |
| V5 | Medios de pago | Transferencia, pago movil, Zelle y efectivo, sin datos bancarios | Finanzas → Ajustes → Medios de pago: cargar los reales con sus datos y desactivar los que no sirvan | Responsable (F10) | 7 |
| V6 | Porcentaje de IVA | 16 % | Finanzas → Ajustes → Impuestos | Contador | 7 |
| V7 | Retencion de ISLR | Preparada y **apagada** | Finanzas → Ajustes → Impuestos | Contador (F12) | 7 |
| V8 | IGTF en pagos en divisas | Preparado y **apagado** | Finanzas → Ajustes → Impuestos | Contador (F12) | 7 |
| V9 | Agente de retencion de IVA de cada empresa (75 % o 100 %) | Ninguna empresa lo es | Ficha de cada empresa | Administracion, con el RIF de cada cliente | 7 |
| V10 | Cuenta de Google de la aplicacion (remitente del correo y duena de los archivos de Drive) | La personal del responsable; correo simulado | Variables `DRIVE_*` y de correo en Vercel, tras `npm run drive:probar` | Responsable, cuando haya tarjeta para GCP | 2, 4 |

## 2. Decisiones del negocio que faltan

Lo que no se puede decidir programando. Donde hay propuesta, el sistema ya la
sigue.

| # | Pregunta | Hoy | Bloquea |
| --- | --- | --- | --- |
| F1 | ¿La tasa de la factura es la del dolar BCV del dia de emision? | Si | — |
| F3 | Un pago en dolares contra una factura en bolivares, ¿a que tasa? | A la del dia del pago; el operador la confirma | — |
| F5 | Dias de credito de una factura | Un valor en ajustes, que se puede cambiar por empresa | — |
| F7 | Numero inicial de factura y de control | Valores de ejemplo (V2, V3) | La primera factura real |
| F8 | Una factura con mas renglones de los que caben en la hoja | No se permite: se emite en dos | — |
| F9 | Corregir una factura es anularla y emitir otra | Asi | — |
| F10 | Medios de pago reales y sus datos | Ejemplo (V5) | Cobrar de verdad |
| F11 | Campos obligatorios de la factura y vigencia del talonario | Los del paquete | Facturas validas ante el SENIAT |
| F12 | IGTF y retenciones de ISLR | Apagados (V7, V8) | — |
| F13 | Hoja escaneada del talonario | Formato de ejemplo (V4) | Imprimir sobre el papel real |
| F15 | ¿Que formato de impresion se usa: carta, media carta u otro? | Carta de ejemplo; se pueden tener varios | Calibrar el definitivo |
| B4 | Preguntas del brief de Diagnostico | Ese formato no se publica | El brief de Diagnostico |
| B5 | Servicios que vende la agencia y sus tareas tipicas | Dos servicios definidos | Ampliar el catalogo |

## 3. Lo que no se hizo y queda pendiente

| Que | Por que | Cuando |
| --- | --- | --- |
| **Registrar la tasa del dolar a mano** | No hay pantalla. Hoy la tasa solo llega de la lectura diaria del BCV; **si un dia falla y no hay ninguna anterior, no se puede facturar**. La base ya admite tasas manuales (`origen = 'manual'`) | Antes de facturar en produccion |
| ISLR e IGTF se aplican | Los ajustes existen y nacen apagados, pero encenderlos todavia no cambia ningun calculo: falta la regla del contador (F12). El operador ya puede registrar una retencion de ISLR; el cliente no la ve en su formulario | Cuando el contador responda |
| PDF de presupuestos, proformas y de la copia del brief | La libreria ya esta (`pdf-lib`); falta el diseno con la marca | Cuando se pida |
| Correo al cliente cuando se le emite una factura o se resuelve un pago | Hoy solo la campana. Se decide con el correo real | Con la cuenta de la empresa |
| Una factura solo admite los renglones que caben en el formato habitual (F8) | Una proforma mas larga se factura en dos, a mano | Decision tomada; confirmar con el contador |
| Tiempo real (la bateria y la campana se actualizan al recargar) | No cabe en Vercel | Mudanza al VPS (etapa 9) |
| Video por el servidor (hoy va por enlace) y archivos de mas de 4 MB | Limite de peticion de Vercel | Etapa 9 |
| Foto de perfil | El disco de Vercel es de solo lectura | Etapa 9 |
| Tareas programadas cada hora (solo existe la de la tasa, diaria) | Plan de Vercel | Etapa 9 |
| Boveda de marca e historial del cliente sacado de la auditoria | No se pidieron con prioridad | Cuando se pidan |
| Limite de intentos por IP en `/brief/[token]` | El token tiene 256 bits de azar | Reconsiderar en el VPS |
| El enlace del prospecto no se manda por correo | Ningun correo lleva tokens. El ejecutivo lo entrega a mano | Decision tomada |

## 4. Sin probar fuera de local

| Que | Estado |
| --- | --- |
| La aplicacion conectada como `conejo_app` a traves de la cadena agrupada de Neon | Sin probar contra Neon |
| Seguridad por fila de todas las tablas | Probada en local con `prueba:permisos`; sin probar contra Neon |
| Subida y descarga en Drive en modo real (piezas y comprobantes) | Probada en modo simulado; `drive:probar` paso el 2026-10-13. Los comprobantes usan `DRIVE_CARPETA_COMPROBANTES_ID` |
| Impresion sobre el talonario real | Sin probar: no hay hoja del talonario (F13). El PDF y la hoja de calibracion se revisaron en pantalla |
| Correo real por Gmail | Simulado hasta tener la cuenta de la empresa |
| Archivos `db/neon/` 01 a 16 | Ensayados en local; ninguno pegado en produccion todavia |

## 5. Puntos a tener en cuenta

Lo que no es un pendiente pero conviene saber antes del despliegue y del
primer uso real.

| Punto | Por que importa |
| --- | --- |
| **Antes de la primera factura real**: llenar el emisor, fijar la numeracion y el rango de control del talonario reales, y crear y calibrar su formato de impresion | Lo que se emite queda congelado con esos datos: una factura con datos de ejemplo hay que anularla |
| **La numeracion solo sube** | Si se fija un numero por error demasiado alto, no se puede bajar: los numeros saltados quedan sin usar. Revisarlo dos veces antes de guardar |
| El emisor de produccion nace vacio | Con el, no se puede facturar hasta llenarlo: es a proposito |
| Los medios de pago de ejemplo no tienen datos bancarios | El cliente los ve tal cual: cargar los datos reales o desactivarlos antes de que un cliente reporte pagos |
| El permiso de finanzas y el de aprobar piezas nacen apagados para todos los clientes | Hay que marcarlos en Usuarios a quien corresponda, o el cliente no vera Facturacion ni podra aprobar |
| Las cuentas de prueba (`*@conejo.test`, `cliente@empresa.test`) son solo de desarrollo | `sql:produccion` no las lleva; si alguna existiera en produccion, se desactiva |
| La pasada completa de pruebas del navegador falla de forma intermitente en desarrollo | El servidor de desarrollo de Next se carga con el uso y, al compilar una pagina por primera vez, a veces recarga y corta una navegacion. Las que fallan pasan solas tras reiniciar `app-dev`. En produccion no hay compilacion en caliente |
| Los archivos de `db/neon/` se pegan **en orden** y antes de subir, salvo el 06 | Cada uno da por hecho los anteriores; el 06 va despues de publicar |
| Los ensayos de `db/neon/` se hicieron sobre la base local, no sobre Neon | La primera vez contra Neon conviene hacerlo con calma y revisar cada comprobacion |
