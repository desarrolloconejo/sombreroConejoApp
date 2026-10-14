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
| `cliente@empresa.test` | Cliente con permiso de aprobar |

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
