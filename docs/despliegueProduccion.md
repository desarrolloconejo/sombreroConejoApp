# Guia de despliegue a produccion

Estado: **en preparacion**. No se publica nada hasta que la integracion del
portal este completa y probada en local. Ultima etapa anotada: **2** (en curso).

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
| `CORREO_MODO` | No definir | Sin definir vale `simulado`: no se envia nada y los mensajes quedan en la bandeja de salida. Se pone en `real` el dia que exista la cuenta de Google de la empresa |

La cadena del dueno (`neondb_owner`) se guarda aparte: hace falta para la
vuelta atras de la seccion 7 y deja de estar en Vercel.

Un cambio de variable solo afecta a los despliegues nuevos: la version
publicada sigue con la conexion anterior hasta que se suba.

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

- [ ] Bandeja de salida (en Sistema) abre, y muestra el aviso de que el correo
      esta en modo simulado.
- [ ] El usuario de prueba creado arriba dejo su correo de bienvenida en la
      bandeja. Abrirlo, comprobar que **no** lleva la contrasena y que el
      enlace apunta a la direccion publica, y anotarlo como entregado.

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
| Correo en modo real (Gmail) | **Escrito y sin probar.** No hay cuenta de Google de la empresa. Antes de poner `CORREO_MODO=real` hay que repetir `npm run drive:probar` pidiendo tambien el permiso `gmail.send`, y probar un envio |
| Correos que quedan «pendientes» | En modo real, si la funcion se corta entre confirmar el cambio y enviar, el correo queda como pendiente. No hay tarea que lo recoja: se reintenta a mano desde la bandeja |

---

## Registro por etapa

| Etapa | SQL antes | Variables | SQL despues | Anotada |
| --- | --- | --- | --- | --- |
| 1. Cimientos de seguridad | 01 a 05 | `DATABASE_URL`, `JWT_EXPIRACION` | 06 | Si |
| 2. Externos y avisos | 07 | `APP_URL_PUBLICA` | — | En curso: falta avisos, tasa y archivos |
| 3. Proyectos, bateria y tareas | — | — | — | Pendiente |
| 4. Vista del cliente y revision | — | — | — | Pendiente |
| 5. Presupuestos y proformas | — | — | — | Pendiente |
| 6. Briefs | — | — | — | Pendiente |
| 7. Facturas, pagos y cobranza | — | — | — | Pendiente |
| 8. Endurecimiento y piloto | — | — | — | Pendiente |
