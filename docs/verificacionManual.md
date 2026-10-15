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
