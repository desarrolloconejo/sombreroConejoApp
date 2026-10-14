# Traspaso: donde quedo el trabajo y que falta

Fecha: 2026-10-14. El trabajo se paro a mitad de la etapa 4 para seguir en otro
equipo: el portatil (5,7 GB de RAM, 2,7 para Docker) no aguanta el servidor de
desarrollo, el `typecheck` y Playwright a la vez, y eso hacia fallar las
pruebas por lentitud, no por la aplicacion.

Este documento es lo primero que hay que leer al retomar. Cuando la etapa 4
quede cerrada, lo que siga vigente pasa al plan y este archivo se borra.

---

## 1. Estado del repositorio

| Rama | Que tiene | Estado |
| --- | --- | --- |
| `main` | Etapas 1, 2 y 3 completas, dos pasos, y de la etapa 4 el modelo (`feat/etapa4-modelo`) y la entrega de archivos (`feat/etapa4-archivos`) | **No subida a GitHub**: `main` se acumula en local hasta terminar el portal (subir `main` publica en Vercel) |
| `feat/etapa4-versiones` | Lado del equipo: subir versiones, marcar la del cliente, aviso y correo al completar la fase 4, ajustar la ruta, permiso de aprobar en Usuarios | Con commits, **sin unir** |
| `feat/etapa4-cliente` | Sale de la anterior. Lado del cliente: inicio, Mis proyectos, revision, aprobacion en lote; la prueba `tests/integracion/revision.spec.ts`; y la correccion de zona horaria de los componentes de cliente | Con commits, **sin unir** |

**Como pasa el codigo al otro equipo:** con el bundle
`conejoApp-etapa4.bundle` (todas las ramas), no con `git push`, para no
publicar `main` a mitad. En el otro equipo:

```bash
git fetch /ruta/a/conejoApp-etapa4.bundle "refs/heads/*:refs/heads/*"
git checkout feat/etapa4-cliente
```

Si el otro equipo no tiene el repositorio, se clona del bundle:
`git clone conejoApp-etapa4.bundle sombreroConejoApp`, y despues
`git remote set-url origin git@github.com:desarrolloconejo/sombreroConejoApp.git`.

## 2. Levantar el entorno en el otro equipo

```bash
docker compose up -d --build -V        # -V: hay dependencias nuevas desde agosto
docker compose exec app-dev npm run seed
npm ci                                 # en el host, para Playwright
npx playwright install chromium
```

- El `.env` del portatil es viejo pero sirve. Variables nuevas, todas
  opcionales en desarrollo: ver `.env.example`. `ARCHIVOS_MODO` vale
  `simulado` en el compose de desarrollo: los archivos van a la base.
- El seed es idempotente y **no rehace** los proyectos de ejemplo si ya
  existen. Para volver a tenerlos limpios (solo en local):

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

## 3. Lo que falta de la etapa 4

En este orden:

1. **Pasar la prueba de punta a punta** en `feat/etapa4-cliente`:

   ```bash
   npx playwright test --project=integracion tests/integracion/revision.spec.ts --workers=1
   ```

   Recorre dos rondas de una pieza: el ejecutivo sube una imagen y la envia; el
   cliente pide corregir la redaccion; se reenvia con un enlace; el cliente
   aprueba; se cierra el proyecto. En el portatil fallaba en puntos distintos
   cada vez por lentitud del servidor. El ultimo fallo real encontrado fue de
   hidratacion (fechas con zona distinta en servidor y navegador) y ya esta
   corregido en la rama, pero **no se llego a volver a pasar**.

2. **Unir las dos ramas a `main`**, en orden, con `--no-ff`:
   `feat/etapa4-versiones` y despues `feat/etapa4-cliente`. Antes: `lint`,
   `typecheck`, `test:unitarias` (103 casos) y `prueba:permisos` (65).

3. **Pasar la bateria de integracion completa** con `--workers=1`. Con varios
   workers el servidor de desarrollo de webpack se satura.

4. **Probar a mano lo que no tiene prueba automatica** (ver la seccion 4).

5. **Marcar en `docs/planIntegracionPortal.md`** las dos ramas como hechas,
   quitar la nota de «Escrita, sin unir», y borrar este archivo.

### Pendientes sueltos detectados

| Tema | Detalle |
| --- | --- |
| Horas en UTC | Los formateadores de fecha de los componentes de **servidor** no fijan zona: las horas salen 4 horas adelantadas (Auditoria, Mi perfil, Hooks, Inicio, Bandeja de salida). Los de cliente ya estan corregidos. Arreglo: `timeZone: "America/Caracas"` en cada `Intl.DateTimeFormat` con hora. Se propuso como tarea aparte |
| Aprobacion en lote | `aprobarVarias` escrita, sin prueba de integracion |
| Ajustar la ruta | `ajustarRuta` escrita y con pruebas unitarias de su regla; sin prueba de integracion |
| Aviso C1 | El ejecutivo ve «Nadie de la empresa puede aprobar» en la ficha: sin probar en pantalla |
| Drive real | Sin probar: hay que volver a ejecutar `npm run drive:probar` (ahora crea tambien `ConejoApp/Piezas`) y subir una imagen con `ARCHIVOS_MODO=real` |
| Movil | Las pantallas del cliente estan hechas para movil primero, pero no se revisaron a 390 px |

## 4. Como verificar la etapa 4

Con la semilla: ejecutivo `cuentas@conejo.test`, cliente
`cliente@empresa.test` (con permiso de aprobar), disenador
`diseno@conejo.test`; las contrasenas estan en `db/datos/semilla.mts`.

**Equipo (como `cuentas@conejo.test`)**

1. Proyectos → abrir «Parrilla de octubre» → una pieza en la fase 3. En
   «Versiones», subir una imagen de menos de 4 MB. Probar tambien un PDF, un
   archivo que no sea imagen (debe rechazarse) y un enlace de un sitio que no
   este en la lista (debe rechazarse).
2. Completar hasta la fase 4. «Completar fase» debe negarse mientras no haya
   una version marcada «Para el cliente». Marcarla y completar.
3. Comprobar que llega la notificacion al cliente y que el correo queda en la
   Bandeja de salida (como admin).

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

**Permisos (como admin)**

10. En Usuarios, quitar «Puede aprobar piezas» al cliente: sigue viendo la
    pieza, pero sin botones. Volver a marcarlo.
11. Con un cliente de otra empresa, la URL de una pieza ajena da 404.

## 5. Lo que viene despues de la etapa 4

| Etapa | Que entrega | Bloqueos |
| --- | --- | --- |
| 5. Presupuestos y proformas | Editor de renglones, envio y aprobacion del cliente, proforma ligada a proyectos, recurrentes | Ninguno: hay valores por defecto (F4, F6, F14 del plan) |
| 6. Briefs | Formularios por pasos (Desarrollo de producto completo en `appFacturas/config/briefs`), envio con codigo y copia, bandeja del ejecutivo, enlace privado para prospectos, brief → presupuesto → proyecto | Falta el texto del brief de Diagnostico (B4) y la lista de servicios (B5) |
| 7. Facturas, pagos y cobranza | Emision en talonario, PDF, comprobantes en Drive, pagos y retenciones, estado de cuenta | **Bloqueada por el negocio**: contador (F7, F11, F12), medios de pago (F10), hoja del talonario (F13) |
| 8. Endurecimiento y piloto | Prueba con un cliente real | — |
| 9. Mudanza al VPS | Correo real, tareas cada hora, tiempo real, video por el servidor, copias, foto de perfil | Fecha de la mudanza |

El paquete de especificacion `appFacturas` tiene que estar en la carpeta
hermana del repositorio para las etapas 5 a 7 (finanzas y briefs): sus reglas
de la bateria ya pasaron a `docs/reglasBateria.md`, pero las de finanzas y
briefs no.

## 6. Problemas conocidos del entorno

| Sintoma | Causa | Que hacer |
| --- | --- | --- |
| `Manifest file is empty` o `Unexpected end of JSON input` en `/login` | El servidor de desarrollo compila otra ruta a la vez | Recargar. Las pruebas nuevas lo hacen solas |
| `ENOMEM` en los registros de `app-dev`, conexiones cortadas | Sin memoria en la maquina de Docker | `docker compose restart app-dev`; si Docker no responde, reiniciar Docker Desktop |
| Pruebas que fallan en un paso distinto cada vez | Lentitud del servidor de desarrollo | `--workers=1`, y no lanzar el `typecheck` a la vez |
| Clics que «no hacen nada» en las pruebas | Pulsar antes de que la pagina hidrate, o un error de hidratacion | Abrir con `waitUntil: "networkidle"`; revisar la consola por «Hydration failed» |
| El navegador del panel de Claude hace peticiones mientras corren las pruebas | Renueva la sesion en segundo plano | Cerrarlo antes de pasar la bateria |
