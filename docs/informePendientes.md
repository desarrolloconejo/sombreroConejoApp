# Informe de pendientes de la integracion

**Fecha:** 15 de octubre de 2026
**Estado:** la integracion del portal esta construida (etapas 1 a 8). La etapa 9,
la mudanza al servidor propio, espera fecha.

Este informe dice **que falta para usar la aplicacion de verdad**: que hay que
cambiar, donde se cambia y quien aporta el dato. Esta ordenado por el momento
en que hace falta. El detalle tecnico de cada punto esta en
`docs/pendientesIntegracion.md`; los pasos del despliegue, en
`docs/despliegueProduccion.md`.

Nada de lo de aqui es un error: todo funciona con lo que hay hoy. Son datos de
ejemplo que sustituir, respuestas del negocio y piezas que se dejaron para
despues a proposito.

---

## 1. Antes de publicar

| # | Que hay que hacer | Donde | Quien |
| --- | --- | --- | --- |
| 1.1 | Probar a mano cada etapa en local | `docs/verificacionManual.md` | Responsable |
| 1.2 | Pegar en Neon los archivos `db/neon/` del 01 al 16, en orden y revisando cada comprobacion. El 06 va **despues** de publicar | Editor SQL de Neon; guia en `docs/despliegueProduccion.md` | Responsable |
| 1.3 | Poner las variables nuevas en Vercel: la cadena de `conejo_app`, `TOTP_CLAVE`, `CRON_SECRET`, `APP_URL_PUBLICA`, las de Drive (incluida `DRIVE_CARPETA_COMPROBANTES_ID`) y, si se quiere, `BRIEFS_MAILBOX` | Vercel → Settings → Environment Variables | Responsable |
| 1.4 | Avisar al equipo y a los clientes de que se les pedira la verificacion en dos pasos al entrar (pueden decir que no) | — | Responsable |

## 2. Antes de que entren los clientes

| # | Que hay que hacer | Donde | Quien |
| --- | --- | --- | --- |
| 2.1 | Asignar a cada empresa su ejecutivo de cuentas. Sin asignacion, el ejecutivo no ve los proyectos de esa empresa | Empresas → ficha → «Quien la atiende» | Administrador |
| 2.2 | Marcar en cada persona de las empresas «Puede aprobar piezas» y «Puede ver las finanzas» a quien corresponda. **Nacen apagados para todos** | Usuarios → ficha | Administrador |
| 2.3 | Revisar que no quede ninguna cuenta de prueba (`@conejo.test`, `cliente@empresa.test`) activa en produccion | Usuarios | Administrador |

## 3. Antes de la primera factura real

Lo que se emite queda congelado con estos datos: una factura hecha con datos
de ejemplo solo se arregla anulandola.

| # | Que hay que poner | Hoy | Donde | Quien |
| --- | --- | --- | --- | --- |
| 3.1 | Razon social, RIF y domicilio fiscal de la agencia | En produccion, **vacios**: no se puede facturar hasta llenarlos | Finanzas → Ajustes de finanzas → Emisor | Responsable |
| 3.2 | Numero inicial de factura y serie | Serie A, desde el 1 | Ajustes de finanzas → Numeracion. **Solo sube: revisarlo dos veces** | Contador |
| 3.3 | Rango de numeros de control del talonario (desde, hasta y prefijo) | 00-000001 a 00-000500, de ejemplo | Ajustes de finanzas → Numeracion | La imprenta del talonario |
| 3.4 | El formato de impresion del talonario real, calibrado | «Carta (ejemplo)» | Ajustes de finanzas → Formatos: duplicar, ajustar el tamano, imprimir la hoja de calibracion sobre el papel real, medir y corregir | Responsable, con una hoja del talonario |
| 3.5 | Medios de pago reales con sus datos para pagar | Cuatro de ejemplo **sin datos bancarios**, que el cliente ve | Ajustes de finanzas → Medios de pago | Responsable |
| 3.6 | Que empresas son agentes de retencion de IVA, y si retienen el 75 % o el 100 % | Ninguna | Ajustes de finanzas → Datos de facturacion de las empresas | Administracion, con el RIF de cada cliente |
| 3.7 | Dias de credito por defecto y los de cada empresa que los tenga distintos | 15 dias | Ajustes de finanzas | Responsable |
| 3.8 | Confirmar que hay tasa del dolar del dia | La lee la tarea diaria del BCV; si falla, se registra a mano | Ajustes de finanzas → Tasa del dolar | Administracion |

## 4. Respuestas que faltan

### Del contador

| # | Pregunta | Mientras tanto la aplicacion hace |
| --- | --- | --- |
| F7 | ¿Desde que numero de factura y de control se empieza? | Ejemplo (punto 3.2 y 3.3) |
| F11 | ¿Que campos son obligatorios en la factura? ¿Vigencia del talonario? | Los del paquete original: emisor, cliente con RIF y domicilio, fecha, renglones, base, exento, IVA, total, tasa y referencia en dolares |
| F12 | ¿Se cobra IGTF en pagos en divisas? ¿Como se tratan las retenciones de ISLR? | Los dos estan en ajustes, **apagados y sin calcular nada**. Hace falta la regla para programarlos |
| F8 | Una factura con mas renglones de los que caben en la hoja | No se permite: se factura en dos |
| F9 | ¿Corregir una factura es anularla y emitir otra? | Asi |
| F3 | Un pago en dolares contra una factura en bolivares, ¿a que tasa? | La del dia del pago; administracion la confirma |
| F1 | ¿La tasa de la factura es la del BCV del dia de emision? | Si, o la ultima publicada |

### Del responsable

| # | Que | Para que |
| --- | --- | --- |
| F13 / F15 | Una hoja escaneada del talonario y su tamano (carta, media carta…) | Calibrar la impresion (punto 3.4) |
| F10 | Medios de pago reales y sus datos | Punto 3.5 |
| V10 | La cuenta de Google Workspace de la empresa y su proyecto de GCP (pide tarjeta) | Que los correos salgan de la empresa y los archivos sean suyos. Hoy el correo esta simulado: los mensajes quedan en la Bandeja de salida |
| P10 | Cliente, fecha y alcance del piloto | Seguir `docs/planPiloto.md` |
| B4 | Las preguntas del brief de Diagnostico | Publicar ese tipo de brief. Hoy solo esta el de Desarrollo de Producto |
| B5 | La lista de servicios que vende la agencia y sus tareas tipicas | Ampliar el catalogo, hoy con dos servicios |
| — | Fecha de la mudanza al servidor propio | Etapa 9 |

## 5. Lo que queda por construir

Se dejo para despues a proposito. Ninguno impide usar la aplicacion.

| Que | Cuando |
| --- | --- |
| Calcular IGTF y retenciones de ISLR | Cuando el contador responda (F12) |
| PDF de presupuestos, proformas y de la copia del brief, con la marca | Cuando se pida. La libreria ya esta |
| Correo al cliente cuando se le emite una factura o se resuelve un pago (hoy avisa la campana) | Con la cuenta de correo de la empresa |
| Corregir una tasa ya guardada (hoy no se puede: es un historico) | Si hace falta |
| Tiempo real: que la bateria y la campana se actualicen solas (hoy al recargar) | Mudanza (etapa 9) |
| Videos por el servidor y archivos de mas de 4 MB (hoy los videos van por enlace) | Mudanza |
| Foto de perfil | Mudanza |
| Tareas programadas cada hora (hoy solo la tasa, una vez al dia) | Mudanza |
| Boveda de marca e historial del cliente | Cuando se pida |

## 6. Lo que no se ha probado fuera de este equipo

Todo esta probado en local. Esto se vera por primera vez en produccion:

| Que | Como se comprueba |
| --- | --- |
| La aplicacion conectada a Neon con su usuario propio y la seguridad por empresa | Seccion 5 de `docs/despliegueProduccion.md`, tras publicar |
| Subir versiones y comprobantes a Google Drive de verdad | Subir uno de prueba tras publicar |
| El correo real por Gmail | Cuando este la cuenta de la empresa |
| Imprimir sobre el talonario real | Con la hoja del talonario (punto 3.4) |
| Los archivos de `db/neon/` contra Neon | Al pegarlos (punto 1.2), con calma |

---

## Resumen para decidir

- **Para publicar** hace falta solo el trabajo del punto 1: no hay respuestas
  del negocio pendientes que lo bloqueen.
- **Para que entren los clientes**, el punto 2: diez minutos por empresa.
- **Para facturar de verdad**, el punto 3 y las respuestas del contador (F7,
  F11, F12) y la hoja del talonario (F13). Hasta entonces se puede usar todo
  lo demas, incluidos presupuestos y proformas.
- El **piloto** puede empezar en cuanto se publique, sin facturas reales.
