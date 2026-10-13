# Integracion del modulo de Finanzas en Conejo App

Documento de integracion. Fecha: 2026-10-09. Ultima revision: 2026-10-13. Desde esa revision vive en `docs/integracionFinanzas.md` de Conejo App; la copia de `appFacturas` se mantiene igual a esta.

> **Desde el 2026-10-13 este documento es el capitulo de finanzas de un plan mayor**, `docs/planIntegracionPortal.md`, porque el alcance paso de «solo finanzas» al flujo completo (briefs, proyectos, piezas y fases). Donde los dos difieran, manda el plan. Estas cosas de este documento cambian por eso y por decisiones posteriores:
>
> - **Vuelven los vinculos con proyectos y briefs**: `presupuestos.brief_id`, `presupuestos.proyecto_id`, `facturas.proyecto_id` y la tabla `proforma_proyectos`. Lo que aqui dice «se eliminan» ya no aplica.
> - **La bitacora es general**: `finanzas.eventos` no se crea; todo escribe en `portal.eventos`.
> - **La factura se genera como PDF con una libreria**, no imprimiendo desde el navegador: de la seccion 9.1 vale la opcion B.
> - **Moneda:** los montos se arman en dolares y la factura se emite en bolivares a la tasa del dia.
> - **`conSesionFinanzas` pasa a llamarse `conSesion`** y la usan todos los modulos nuevos, declarando tambien la empresa.
> - **El correo y la tasa de cambio dejan de estar fuera**: entran como servicios simulados con JSON mientras la app viva en Vercel.

**Fuentes.** El paquete de especificacion del portal (este repositorio, analizado en `diagnostico/`), el informe de contexto `docs/contextoAppConejo.md` y, desde la segunda revision, **el codigo real de Conejo App** (`sombreroConejoApp`, rama `main`, commit `8ae8b67`). Lei completos `db/schema.sql`, `src/lib/db.ts`, `src/lib/sesion.ts` y `src/proxy.ts`, y las partes relevantes de `navegacion.ts`, `parametros.ts`, `seed.mts`, `generarSql.mts`, los tipos de sesion y `CLAUDE.md`. El resultado de esa validacion esta en la seccion 16. No modifique nada en ese repositorio.

**Decisiones ya tomadas por ti:**

| Tema | Decision |
|---|---|
| Alcance | Solo finanzas: presupuesto → proforma → factura → pagos y retenciones. Cuentas por cobrar a clientes |
| Dependencias | Solo las imprescindibles. Todo lo demas se adapta al stack actual |
| Seguridad | Se conserva la seguridad por fila (RLS) en PostgreSQL |
| RLS: como se conecta la app (2026-10-13) | **Opcion A**: la app pasa a un rol sin privilegios, `conejo_app` (seccion 5) |
| Quien opera finanzas (2026-10-13) | El rol `admin` **y** los trabajadores con cargo `administracion` (secciones 2.2, 5.5 y 6.2) |
| Comprobantes (2026-10-13) | **Google Drive**, en la carpeta `ConejoApp/Comprobantes`, con un cliente OAuth de GCP. De momento en el Drive personal del responsable; despues pasara a una cuenta compartida del estudio (seccion 9.2) |
| Factura en talonario | Sin decidir. Este documento presenta opciones y una recomendacion (seccion 9.1) |

**Revision del 2026-10-13.** Se cierran tres de las seis decisiones tecnicas de la seccion 15. Las secciones afectadas estan reescritas con lo decidido; lo que eran opciones descartadas se conserva solo donde explica el porque.

---

## 1. Resumen

El paquete no trae codigo de aplicacion, asi que no hay nada que «pegar». Lo que se integra es un **diseño**: el modelo de datos financiero, sus reglas en SQL y sus reglas de negocio. Ese diseño se reescribe con las convenciones de Conejo App como un modulo mas, siguiendo el camino de 11 pasos que la app ya tiene establecido.

| Del paquete | Que pasa con ello |
|---|---|
| Tablas de `finanzas`, restricciones, triggers, vista de cobro, numeracion | **Se portan** a `db/schema.sql`, reescritas en el estilo de Conejo |
| Politicas RLS y funcion de aprobacion de presupuesto | **Se portan**, adaptadas a `empresas`, `clientes` y `usuarios` de Conejo |
| Reglas de calculo, estados, permisos | **Se implementan** en models, actions y funciones puras |
| Plantilla del talonario y hoja de calibracion | **Se reutilizan** casi tal cual (HTML y CSS en milimetros) |
| Maqueta de la pantalla del cliente | **Referencia visual**, reconstruida con los componentes de Conejo |
| `schema.prisma`, `seed.ts`, prompts por etapa | **No se usan**. Sirven solo de referencia |
| Google Drive | **Entra**, solo para los comprobantes de pagos y retenciones, sin libreria: la API se llama por `fetch` (seccion 9.2) |
| Prisma, Zod, Auth.js, pg-boss, Playwright, SSE, correo, 2FA | **No entran**. Cada uno tiene sustituto o queda fuera (seccion 3) |
| Proyectos, piezas, fases, briefs | **Fuera del alcance**. Se eliminan los vinculos que finanzas tenia con ellos |

**Lo que mas pesa:**

1. **RLS exige que la app deje de conectarse como dueño de la base.** Es el cambio de infraestructura mas grande y afecta a toda la app, no solo a finanzas (seccion 5).
2. **Conejo no tiene correo, ni almacenamiento de archivos, ni tareas programadas.** Tres cosas que el paquete daba por hechas. El almacenamiento se resuelve con Google Drive (seccion 9.2); finanzas funciona sin las otras dos.
3. **Cuatro decisiones del negocio siguen bloqueando la factura y los pagos** (moneda y tasa, medios de pago, validacion del contador, hoja del talonario). Presupuestos y proformas se pueden construir sin ellas.

---

## 2. Como encaja: correspondencia de conceptos

### 2.1 Entidades

| En el paquete | En Conejo App | Accion |
|---|---|---|
| `clientes` (la empresa cliente) | `empresas` | Se usa `empresas`. Hay que añadirle datos fiscales |
| `usuarios` | `usuarios` | Se usa tal cual |
| `membresias_cliente` con `puede_ver_finanzas` | `clientes` (persona de contacto, una sola empresa por usuario) | Se añade la columna `puede_ver_finanzas` a `clientes` |
| `membresias_cliente.puede_aprobar` | — | No aplica: era para aprobar piezas |
| `asignaciones` ejecutivo ↔ cliente | — | No aplica: los ejecutivos no ven finanzas |
| `eventos` (bitacora inmutable) | No hay bitacora general. Existe el patron `ediciones_ficha` | Se crea una bitacora propia de finanzas |
| `notificaciones` | No existe | Fuera de la primera version (seccion 3) |
| `proyectos`, `briefs` | No existen | Se eliminan esas columnas y la tabla `proforma_proyectos` |

**Cuidado con el nombre `clientes`.** En el paquete significa la empresa; en Conejo, la persona de contacto. En todo lo portado, `cliente_id` pasa a ser `empresa_id` y `cliente_snapshot` pasa a `empresa_snapshot`.

### 2.2 Roles

| Rol del paquete | Equivalente en Conejo | Acceso a finanzas |
|---|---|---|
| ADMIN | rol `admin` | Total |
| — (no existia) | rol `trabajador` con cargo `administracion` | **Total**, igual que el admin |
| EJECUTIVO, PRODUCCION | rol `trabajador`, cualquier otro cargo | Ninguno |
| CLIENTE con permiso Finanzas | usuario con fila en `clientes` y `puede_ver_finanzas = true` | Lee lo de su empresa, aprueba presupuestos, reporta pagos y retenciones |
| CLIENTE sin el permiso | usuario cliente sin la casilla | Ninguno |

**Decidido: finanzas la operan el rol `admin` y el cargo `administracion`.** Conejo tiene ese cargo, que el paquete no contemplaba, y su descripcion en el esquema es literalmente «Administracion y facturacion» (`db/schema.sql:64`). En todo este documento, «operador» significa cualquiera de los dos, y donde las tablas de operaciones dicen «admin» debe leerse «operador». Los dos pueden lo mismo: no hay acciones reservadas al admin dentro del modulo.

Sigue siendo cierto que solo el rol `admin` da de alta usuarios y empresas, y por tanto solo el admin marca la casilla `puede_ver_finanzas` de un cliente y edita los datos fiscales de una empresa: eso vive en los modulos de Usuarios y Empresas, no en finanzas.

### 2.3 Convenciones

| Aspecto | Paquete | Conejo App | Se adopta |
|---|---|---|---|
| Acceso a datos | Prisma | SQL puro con `pg` | Conejo |
| Esquema | `schema.prisma` + scripts SQL | Un solo `db/schema.sql` idempotente | Conejo |
| Conjuntos cerrados | Enums de PostgreSQL en mayusculas | `TEXT` + `CHECK`, en minusculas, con espejo en `src/types` | Conejo |
| Identificadores | UUID | Enteros, segun las URL `?id=<n>` (a confirmar) | Conejo |
| Nombres | Español con tildes en documentos | Español sin tildes en codigo y tablas | Conejo |
| Validacion | Zod | Manual en `src/lib/validaciones.ts` | Conejo |
| Dinero | `Decimal` de Prisma | Sin libreria | `NUMERIC` en SQL (seccion 6.3) |
| Mutaciones | Server Actions | Server Actions con `useActionState` y `EstadoFormulario` | Conejo |
| Esquemas de PostgreSQL | Tres (`operacion`, `finanzas`, `briefs`) | Uno | **Se mantiene un esquema `finanzas` aparte** |

**Por que un esquema `finanzas` separado.** Con SQL puro no cuesta nada (los nombres van calificados: `finanzas.facturas`) y aporta tres cosas: los permisos se conceden por esquema, el RLS queda acotado y no hay choque de nombres con las tablas actuales.

---

## 3. Lo que el paquete pedia y Conejo no tiene

| Pieza del paquete | Situacion en Conejo | Propuesta |
|---|---|---|
| **Prisma** | No se usa ORM | Models en SQL puro. Sin impacto |
| **Zod** | Validacion manual | Validadores `validarPresupuesto`, `validarPago`, etc. en el estilo actual |
| **Auth.js** | JWT propio con `jose` | Se usan las guardias de `src/lib/sesion.ts` |
| **2FA obligatoria para administradores** | No existe | **Fuera del alcance.** Lo señalo como riesgo: el paquete la exigia justamente para quien emite facturas |
| **pg-boss y worker** | Vercel no tiene procesos permanentes | Sin cola. La proforma recurrente y el vencimiento de presupuestos se resuelven sin tareas programadas (seccion 8) |
| **Server-Sent Events y `LISTEN/NOTIFY`** | Sin rutas API; funciones sin estado | Fuera. Basta `revalidatePath` |
| **Correo (avisos financieros)** | Conejo no envia correo: las contraseñas se entregan en mano | **Fuera de la primera version.** Se sustituye por contadores en pantalla («3 pagos por confirmar») |
| **Google Drive** | Sin almacenamiento; la subida de foto esta desactivada | **Decidido: se usa**, pero con un cliente OAuth y no con cuenta de servicio, y solo para comprobantes (seccion 9.2) |
| **Playwright para PDF** | Chromium no cabe razonablemente en una funcion de Vercel | Decision abierta (seccion 9). Recomiendo imprimir desde el navegador |
| **Dos usuarios de base de datos** | Uno | Necesario para RLS (seccion 5) |
| **`psql` para aplicar reglas** | Produccion se migra pegando SQL en Neon | El SQL se reescribe sin metacomandos de `psql` |

---

## 4. Cambios en la base de datos

Todo va en `db/schema.sql`, idempotente, como el resto.

### 4.1 Tablas existentes que se amplian

**`empresas`** — datos fiscales que finanzas necesita:

| Columna nueva | Tipo | Para que |
|---|---|---|
| `razon_social` | `TEXT` | Nombre legal para la factura. `nombre` queda como nombre comercial |
| `domicilio_fiscal` | `TEXT` | Solo si `direccion` no es ya el domicilio fiscal (a confirmar) |
| `correo_facturacion` | `TEXT` | Contacto administrativo |
| `es_agente_retencion` | `BOOLEAN NOT NULL DEFAULT false` | Si la empresa retiene IVA al estudio |
| `retencion_iva_pct` | `NUMERIC(5,2)` con `CHECK` (nulo, 75 o 100) | Porcentaje que retiene |

El formulario `FormularioEmpresa` y `validarEmpresa` crecen con estos campos.

**`clientes`** — el permiso:

| Columna nueva | Tipo | Para que |
|---|---|---|
| `puede_ver_finanzas` | `BOOLEAN NOT NULL DEFAULT false` | Casilla que activa el administrador por usuario cliente |

Se expone en `vw_usuarios_completos` como `puedeVerFinanzas` y se añade la casilla a los formularios de alta y edicion de usuarios.

### 4.2 Esquema nuevo `finanzas`

Ocho tablas del paquete pasan a siete, mas dos nuevas.

| Tabla | Origen | Cambios al portar |
|---|---|---|
| `finanzas.secuencias` | Igual | — |
| `finanzas.presupuestos` | Portada | Sin `brief_id` ni `proyecto_id`. `empresa_id`. Estados en minusculas con `CHECK` |
| `finanzas.proformas` | Portada | `empresa_id`. Conserva `recurrente` y `proxima_emision` |
| `finanzas.facturas` | Portada | Sin `proyecto_id`. `empresa_snapshot` |
| `finanzas.documento_items` | Portada | — |
| `finanzas.pagos` | Portada | — |
| `finanzas.retenciones` | Portada | — |
| `finanzas.proforma_proyectos` | **Eliminada** | No hay proyectos |
| `finanzas.eventos` | **Nueva** | Bitacora de solo añadir: quien, que accion, sobre que documento, `antes` y `despues` en `JSONB`. Con trigger que bloquea `UPDATE`, `DELETE` y `TRUNCATE` |
| `finanzas.ajustes` | **Nueva** | Configuracion editable por el administrador (seccion 7) |

### 4.3 Reglas que se portan sin cambios de fondo

| Regla | Origen en el paquete |
|---|---|
| 13 `CHECK` de finanzas (totales que cuadran, anulacion completa, tasa obligatoria en VES, estados de pago coherentes, un solo padre por renglon) | `prisma/sql/02_restricciones.sql:42-64` |
| Factura inmutable: sin borrado, solo cambian anulacion, PDF e impresion; una anulada no se reactiva | `prisma/sql/03_inmutabilidad.sql:93-123` |
| Renglones de factura inmutables y solo insertables en la transaccion que crea la factura | `prisma/sql/03_inmutabilidad.sql:126-147` |
| `finanzas.siguiente_numero(clave)`: consecutivo sin saltos | `prisma/sql/03_inmutabilidad.sql:154-163` |
| Vista `finanzas.v_estado_cobro_factura` | `prisma/sql/05_vistas.sql:66-97` |

Como las tablas son nuevas, los `CHECK` van dentro del `CREATE TABLE`; desaparece la funcion auxiliar y el `\o /dev/null` del paquete, que no funcionan en el editor de Neon. La vista se suelta al principio del archivo y se recrea al final, igual que `vw_usuarios_completos`.

### 4.4 Ajustes al modelo que recomiendo hacer ahora

Son los huecos que encontre en el diagnostico (`diagnostico/07-brechas-e-inconsistencias.md`). Corregirlos al crear las tablas es barato; despues, con facturas inmutables emitidas, no. **Cada uno cambia el modelo del paquete y necesita tu visto bueno.**

| # | Ajuste | Motivo |
|---|---|---|
| 1 | `facturas.fecha_vencimiento DATE` | La maqueta muestra vencimientos y la cobranza los necesita; el paquete no tenia la columna |
| 2 | `base_imponible` y `monto_exento` tambien en presupuestos y proformas | Hoy solo guardan subtotal, aunque sus renglones pueden ser exentos |
| 3 | `pagos.tasa_cambio` y `pagos.tasa_fuente` | Un pago en bolivares contra una factura en dolares no dejaba rastro de la tasa |
| 4 | Claves foraneas a `usuarios` en `creado_por`, `aprobado_por`, `anulada_por`, `reportado_por`, `confirmado_por` | En el paquete eran identificadores sueltos |
| 5 | «Vencido» del presupuesto como estado **derivado** (`valido_hasta` pasado y aun `enviado`), no guardado | Nadie lo iba a actualizar: no hay tareas programadas |
| 6 | La vista de cobro devuelve saldo cero para facturas anuladas | Evita que la cobranza tenga que acordarse de filtrarlas |

**No recomiendo añadir ahora:** notas de credito y debito, descuentos, varias alicuotas de IVA, anticipos. No estaban en el paquete y son alcance nuevo; los listo en la seccion 14.

---

## 5. Seguridad por fila: el cambio de infraestructura

### 5.1 El problema

RLS solo protege si quien consulta **no** es dueño de las tablas ni tiene el atributo `BYPASSRLS`. Segun el informe de contexto, Conejo se conecta con un unico usuario (`POSTGRES_USER` en Docker; el rol de Neon en produccion), que es quien crea las tablas.

- En Docker, `POSTGRES_USER` es superusuario: se salta cualquier politica.
- En Neon, los roles creados desde el panel suelen pertenecer a `neon_superuser`, que tiene `BYPASSRLS`. **Hay que comprobarlo** con:

```sql
SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user;
```

Si cualquiera de las dos columnas es verdadera, las politicas se escriben pero no protegen nada.

### 5.2 Opciones

| | Opcion A: la app pasa a un rol sin privilegios | Opcion B: cambio de rol dentro de la transaccion |
|---|---|---|
| Como | Se crea un rol `conejo_app` con `LOGIN`, sin `BYPASSRLS`, no dueño. `DATABASE_URL` apunta a el. El rol dueño queda solo para el seed y el esquema | La app sigue conectandose como hoy. Las consultas de finanzas ejecutan `SET LOCAL ROLE conejo_finanzas` al abrir la transaccion |
| Proteccion | **Real.** Un error de programacion que consulte finanzas sin declarar la sesion recibe cero filas | **Parcial.** Si alguien olvida el envoltorio, la consulta corre como dueño y ve todo |
| Coste | `GRANT` sobre todas las tablas actuales; segunda cadena de conexion para el seed; nueva variable en Vercel; crear el rol en Neon y en Docker | Crear un rol sin `LOGIN`; ningun cambio de conexion |
| Riesgo | Toca el arranque de toda la app | Deja la puerta que RLS debia cerrar |

**Decidido: opcion A.** Es la que el paquete exige («nunca al reves») y la unica que cumple lo que elegiste. La opcion B queda descartada; la tabla se conserva para que conste por que.

### 5.3 Que implica la opcion A

| Sitio | Cambio |
|---|---|
| `db/schema.sql` | Crea el rol de forma idempotente y **sin contraseña ni `LOGIN`** (un bloque `DO` que consulta `pg_roles`). Asi el archivo sigue pudiendose pegar entero en Neon y los `GRANT` nunca fallan por rol inexistente. Despues, el bloque de permisos: lectura y escritura sobre las tablas y secuencias de `public`, `ALTER DEFAULT PRIVILEGES` para las futuras; en `finanzas`, solo `SELECT`, `INSERT`, `UPDATE` (nunca `DELETE`) |
| Neon y Docker | Una sola vez, a mano: `ALTER ROLE conejo_app LOGIN PASSWORD '…'`. La contraseña nunca entra al repositorio |
| Docker | El volumen `datos_db` ya existe, asi que un script de inicializacion del contenedor no se ejecutaria: el `ALTER ROLE` se lanza a mano o desde un script npm nuevo |
| `.env`, `.env.example` y Vercel | `DATABASE_URL` → `conejo_app`. Nueva `DATABASE_URL_MIGRACIONES` → rol dueño (hoy `conejo` en Docker) |
| `db/seed.mts` | Hoy abre su conexion con `DATABASE_URL` (`db/seed.mts:28`). Pasa a usar `DATABASE_URL_MIGRACIONES` |
| `db/generarSql.mts` | No se conecta a la base: solo lee `schema.sql` y genera texto. **No cambia** |
| `db/pruebas/modelos.mts` | Usa `src/lib/db.ts`, o sea `DATABASE_URL`: pasara a correr como `conejo_app` sin tocarlo, que es lo deseable |
| `src/lib/db.ts` | Sin cambios en el pool. Solo se añade `conSesionFinanzas` |

**Efecto sobre la vista de usuarios.** `vw_usuarios_completos` expone `password_hash` (`db/schema.sql:597`). Con el rol nuevo sigue funcionando igual, porque se le concede lectura sobre `public`; lo menciono solo para que el `GRANT` no la olvide.

**A verificar:** que el agrupador de conexiones de Neon (host con `-pooler`) admite un rol creado por SQL. Deberia; no lo he probado.

### 5.4 Como declara la app quien es el usuario

Una funcion nueva junto a `transaccion`, en `src/lib/db.ts`:

```ts
export function conSesionFinanzas<T>(
  quien: { usuarioId: number; rol: NombreRol; cargo: SlugCargo | null },
  tarea: (cliente: Ejecutor) => Promise<T>,
): Promise<T> {
  return transaccion(async (cliente) => {
    await ejecutar(
      `SELECT set_config('app.usuario_id', $1, true),
              set_config('app.rol',        $2, true),
              set_config('app.cargo',      $3, true)`,
      [String(quien.usuarioId), quien.rol, quien.cargo ?? ""],
      cliente,
    );
    return tarea(cliente);
  });
}
```

- Son **tres** variables de sesion y no dos: al abrir finanzas al cargo `administracion`, la base necesita saber el cargo para decidir. `cargo` es el `cargoSlug` del usuario fresco; para un cliente va vacio.
- El tercer argumento `true` limita el valor a la transaccion. Es compatible con el agrupador de Neon, porque todo ocurre entre `BEGIN` y `COMMIT` sobre la misma conexion.
- **`quien` sale de `requerirUsuario()`, nunca del token.** Coincide con la regla de Conejo: el token enruta, la base decide.
- Los models de finanzas reciben el `ejecutor` como parametro **obligatorio**, no opcional. Asi no se pueden llamar fuera del envoltorio.
- Tambien las lecturas de las pages pasan por aqui. Sin sesion declarada, finanzas devuelve cero filas.
- El reintento automatico de `db.ts` no aplica dentro de transacciones; no cambia nada.

### 5.5 Politicas adaptadas

| Politica | Regla en Conejo |
|---|---|
| `operador_total` (las 9 tablas; en el paquete, `admin_total`) | `finanzas.es_operador()` |
| `cliente_lee` en presupuestos y proformas | Estado distinto de `borrador` y `empresa_id` entre las del usuario |
| `cliente_lee` en facturas | `empresa_id` entre las del usuario |
| `cliente_lee` en renglones, pagos y retenciones | El documento padre le es visible |
| `cliente_reporta` en pagos y retenciones | Solo `por_confirmar`, a su nombre, sobre factura visible y emitida |
| Trabajadores de cualquier otro cargo | Ninguna politica: cero filas |

Quien es operador se decide en un solo sitio, para que las nueve politicas no repitan la condicion:

```sql
CREATE OR REPLACE FUNCTION finanzas.es_operador() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.rol', true), '') = 'admin'
      OR (nullif(current_setting('app.rol', true), '') = 'trabajador'
          AND nullif(current_setting('app.cargo', true), '') = 'administracion')
$$;
```

Se exige `rol = 'trabajador'` junto al cargo a proposito: un cliente nunca tiene cargo, pero la condicion no debe depender de que la aplicacion lo mande vacio.

La funcion que resuelve «las empresas cuyas finanzas ve el usuario» se reescribe sobre las tablas de Conejo:

```sql
CREATE OR REPLACE FUNCTION finanzas.empresas_con_finanzas() RETURNS SETOF integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT c.empresa_id
    FROM clientes c
    JOIN usuarios u ON u.id = c.usuario_id
    JOIN empresas e ON e.id = c.empresa_id
   WHERE c.usuario_id = nullif(current_setting('app.usuario_id', true), '')::integer
     AND nullif(current_setting('app.rol', true), '') = 'cliente'
     AND u.activo AND e.activo
     AND c.puede_ver_finanzas
$$;
```

`finanzas.cliente_resuelve_presupuesto(id, aprobar)` se porta igual: sigue siendo la unica via para que un cliente apruebe o rechace, y solo toca estado, quien y cuando. Se le añade rechazar la aprobacion si `valido_hasta` ya paso.

**Trampa a recordar:** con RLS, un `UPDATE` sobre filas que el usuario no ve no falla, afecta cero filas. Las actions deben comprobar el numero que devuelve `ejecutar`.

---

## 6. Capa de servidor

### 6.1 Archivos nuevos

```
src/
  types/finanzas.ts                 estados, monedas, tipos de fila; reexportado desde index.ts
  lib/finanzas/
    calculo.ts                      funciones puras: subtotal, base, IVA, total, retencion, neto
    catalogo.ts                     estados y sus etiquetas, monedas, tramos de antiguedad
    talonario.ts                    arma las posiciones en mm a partir de los ajustes
  lib/drive.ts                      token de acceso y subida/lectura de archivos en Google Drive
  models/
    presupuestos.ts  proformas.ts  facturas.ts  itemsDocumento.ts
    pagos.ts  retenciones.ts  cobranza.ts  eventosFinanzas.ts  ajustesFinanzas.ts
  actions/
    finanzasPresupuestos.ts  finanzasProformas.ts  finanzasFacturas.ts
    finanzasPagos.ts  finanzasAjustes.ts
    administracion.ts               las acciones del cliente
db/
  pruebas/finanzasCalculo.mts       casos de calculo, sin base
  pruebas/finanzasRls.mts           aislamiento por rol, contra la base
```

`src/lib/finanzas/` sigue el precedente de `src/lib/hooks/`: criterio del negocio como funciones puras, probadas sin base.

### 6.2 Guardias

| Guardia | Para | Estado |
|---|---|---|
| `requerirFinanzas()` | Todo `/dashboard/finanzas/**`. Devuelve el `UsuarioCompleto` fresco | **Nueva**, en `src/lib/sesion.ts` |
| `requerirFinanzasEmpresa()` | Todo `/dashboard/administracion/**`. Devuelve `{ usuario, empresaId }` y expulsa si no es cliente o no tiene `puedeVerFinanzas` | **Nueva**, sobre `requerirEmpresa()` |

**Por que no sirve `requerirAdmin()`.** Al leer el codigo vi que `requerirAdmin()` decide con el **token**, no con la base (`src/lib/sesion.ts:144-159`): un administrador al que se le quita el rol lo conserva hasta ocho horas. Para Usuarios y Empresas es un riesgo asumido; para emitir y anular facturas no. Ademas, `conSesionFinanzas` necesita el rol fresco para declararlo ante la base.

`requerirFinanzas()` es una linea sobre lo que ya existe: **`requerirCargo("administracion")`**, que lee de la base y deja pasar siempre al admin (`src/lib/sesion.ts:92-104`). Con eso entran exactamente los dos operadores decididos.

Hay doble barrera: la guardia decide si se entra; el RLS decide que filas salen aunque la guardia fallara. Las dos tienen que decir lo mismo, y por eso el cargo viaja como tercera variable de sesion (seccion 5.4) y la base lo evalua en `finanzas.es_operador()` (seccion 5.5).

**Un cambio de cargo surte efecto en la siguiente peticion**, no a las ocho horas: ni la guardia ni el RLS leen el token. Lo unico que se queda atras es el proxy, que si enruta con el cargo del token; a quien se le quite el cargo el proxy lo deja pasar y la guardia lo devuelve a `/dashboard`.

### 6.3 Dinero sin libreria de decimales

Conejo no admite `decimal.js`. No hace falta:

- **Los importes se calculan en PostgreSQL**, con `NUMERIC`. El model inserta los renglones y calcula subtotales, base, exento, IVA y total con `round(…, 2)` en la misma sentencia. `round` sobre `NUMERIC` redondea la mitad hacia arriba para valores positivos, que es la regla del paquete.
- `pg` devuelve `NUMERIC` como texto. Los tipos de fila declaran los importes como `string` y **nunca se convierten a `number`**.
- La vista previa mientras se escribe el formulario usa `lib/finanzas/calculo.ts` con aritmetica entera (`BigInt` en milesimas y centimos). Es solo orientativa: lo que vale es lo que calcula el servidor.
- Formato en pantalla: funcion propia que separa miles con punto y decimales con coma a partir del texto.

### 6.4 Operaciones

Todas las actions siguen la forma de Conejo: guardia → validar → model dentro de `conSesionFinanzas` → evento → `revalidatePath` → `EstadoFormulario`.

En la columna «Quien», `admin` significa **operador**: rol `admin` o cargo `administracion` (seccion 2.2).

| Operacion | Quien | Notas |
|---|---|---|
| Crear y editar presupuesto | admin | Solo en `borrador` |
| Enviar presupuesto | admin | Pasa a `enviado`; desde ahi el cliente lo ve |
| Aprobar o rechazar presupuesto | cliente | Llama a la funcion SQL |
| Registrar aprobacion a nombre del cliente | admin | Para quien no tiene cuenta; deja evento |
| Generar proforma desde presupuesto aprobado | admin | Copia renglones |
| Emitir y anular proforma | admin | |
| Emitir factura | admin | Ver abajo |
| Anular factura | admin | Motivo obligatorio; no se reactiva |
| Marcar factura como impresa | admin | |
| Reportar pago | cliente | Queda `por_confirmar` |
| Confirmar pago | admin | Fija el monto aplicado en la moneda de la factura |
| Rechazar pago | admin | Motivo obligatorio |
| Subir y confirmar retencion | cliente / admin | |
| Editar ajustes | admin | Emisor, talonario, medios de pago |

**Emitir factura**, en una sola transaccion:

1. `finanzas.siguiente_numero('FACTURA-A')`.
2. Insertar la factura con los importes de la proforma, la retencion esperada si la empresa es agente de retencion, y los snapshots del emisor (desde `finanzas.ajustes`) y de la empresa.
3. Insertar los renglones.
4. Registrar el numero de control.
5. Escribir el evento.

Si algo falla, el numero no se consume. `fecha_emision` se calcula en SQL como `(now() AT TIME ZONE 'America/Caracas')::date`, porque Neon trabaja en UTC.

### 6.5 Validacion

Validadores nuevos en `src/lib/validaciones.ts`, con la forma `Validacion<T>` existente: `validarPresupuesto` (cabecera y arreglo de renglones), `validarProforma`, `validarEmisionFactura`, `validarAnulacion`, `validarPago`, `validarConfirmacionPago`, `validarRetencion`, `validarAjustesTalonario`. Los importes se validan como texto con expresion regular, sin pasar por `number`.

Los formularios de documentos tienen renglones dinamicos: usan `useCampos` para no perder lo escrito cuando la validacion falla.

---

## 7. Configuracion

El paquete guardaba la configuracion en archivos JSON. En Vercel, cambiar un archivo exige un despliegue, y calibrar el talonario es un proceso de prueba y error. Propongo repartirla asi:

| Dato | Donde | Por que |
|---|---|---|
| Estados, monedas, tramos de antiguedad | `src/lib/finanzas/catalogo.ts` | Criterio fijo, como el catalogo de hooks |
| Datos del emisor (razon social, RIF, domicilio) | `finanzas.ajustes` | Cambian poco, pero no deben requerir despliegue |
| Porcentaje de IVA, serie, prefijos de numeracion | `finanzas.ajustes` | Idem |
| **Coordenadas del talonario** | `finanzas.ajustes` | Se ajustan imprimiendo y midiendo; el paquete ya pedia poder hacerlo «sin tocar codigo» |
| **Medios de pago y datos para pagar** | `finanzas.ajustes` | El propio paquete prohibe tener datos bancarios en el repositorio |

`finanzas.ajustes` es una tabla `clave` + `valor JSONB`, sembrada con los valores de `config/emisor.json` y `config/pagos.json`, con una pantalla de ajustes para el administrador. Los clientes leen solo los medios de pago, mediante una politica especifica.

---

## 8. Lo que se resuelve sin tareas programadas

| Necesidad | En el paquete | En Conejo |
|---|---|---|
| Proforma recurrente mensual | Un trabajo diario deja el borrador listo y avisa | La portada de Finanzas lista las proformas recurrentes cuya `proxima_emision` ya llego, con un boton «Generar borrador». El administrador sigue revisando antes de emitir |
| Presupuesto vencido | Sin definir | Estado derivado al leer (seccion 4.4, ajuste 5) |
| Avisos por correo | Cola con reintentos | Contadores en la portada del administrador y en la del cliente |

Si mas adelante se quiere automatizar, Vercel ofrece tareas programadas, pero exigen una ruta API, que hoy Conejo no tiene.

---

## 9. Factura impresa (abierta) y archivos (decidido)

### 9.1 Como se genera la factura para el talonario

La factura es texto colocado en coordenadas exactas sobre papel preimpreso.

| Opcion | Dependencias | Ventajas | Inconvenientes |
|---|---|---|---|
| **A. Imprimir desde el navegador** | Ninguna | Reutiliza la plantilla del paquete casi tal cual: una page que pinta cada campo en `position: absolute` con milimetros y `@page { size: …; margin: 0 }`. Incluye la hoja de calibracion y el modo guia | Depende de que quien imprime use escala 100 % y sin encabezados. No queda un PDF archivado salvo que se guarde a mano |
| B. Libreria de PDF en JavaScript puro | Una (por ejemplo `pdf-lib`) | PDF identico siempre, archivable | Excepcion al contrato. Servir el PDF exige una ruta API, patron que Conejo no tiene |
| C. Chromium en el servidor | Varias, pesadas | Fiel al paquete | Poco viable en funciones de Vercel |

**Recomiendo A.** Como los datos de la factura quedan congelados en la base, la hoja se puede volver a pintar identica cuando se quiera; archivar el PDF deja de ser imprescindible. Presupuestos y proformas, que son digitales, tambien salen como pages imprimibles con «Guardar como PDF».

La page de impresion no debe llevar el sidebar: o vive fuera del layout de `dashboard/`, con su propia guardia y su regla en `proxy.ts`, o el layout se oculta con `@media print`.

**Pendiente en cualquier opcion:** la plantilla del paquete no imprime numero de control, numero de factura, monto exento ni retencion, y admite 7 renglones como maximo. Que campos lleva la hoja lo decide el contador con el talonario delante.

### 9.2 Donde se guardan los comprobantes

El cliente adjunta un comprobante al reportar un pago o una retencion. Vercel no tiene disco.

| Opcion | Dependencias | Ventajas | Inconvenientes |
|---|---|---|---|
| A. En PostgreSQL (`BYTEA` en una tabla de `finanzas`) | Ninguna | El RLS protege el archivo igual que el pago. Entra en los respaldos de la base | Aumenta el tamaño de la base. Limite practico de unos 3 MB por archivo. Mostrarlo exige una ruta API |
| B. Vercel Blob | Ninguna si se usa su API por `fetch`; una si se usa su paquete | Pensado para esto | Los archivos privados necesitan enlaces firmados. Otro servicio que configurar |
| C. Google Drive | Ninguna: el token de la cuenta de servicio se puede firmar con `jose`, que ya esta, y llamar a la API por `fetch` | Es lo que pedia el paquete; el estudio ya usa Drive | La integracion mas larga de escribir. Credencial de servicio en Vercel |
| D. Sin archivos en la primera version | Ninguna | Cero trabajo | El administrador confirma pagos solo con la referencia |

**Decidido: opcion C, Google Drive.** Lo que sigue es como se hace.

#### Autenticacion: cliente OAuth, no cuenta de servicio

El paquete pedia una cuenta de servicio. Se usa en su lugar un **cliente OAuth** creado en GCP, con la API de Drive habilitada, y no es una preferencia: una cuenta de servicio no tiene cuota de almacenamiento propia, asi que solo puede guardar archivos dentro de una unidad compartida de Google Workspace. Con OAuth los archivos pertenecen a la cuenta de Google que autoriza y ocupan su espacio, que es lo que se quiere.

| Pieza | Detalle |
|---|---|
| Alcance | `https://www.googleapis.com/auth/drive.file`. La app solo ve lo que ella misma crea; no puede leer el resto del Drive de esa cuenta |
| Autorizacion | Una sola vez, en el navegador, con la cuenta donde vivirán los comprobantes. Devuelve un *refresh token* que se guarda como variable de entorno |
| En cada operacion | La app cambia el refresh token por un token de acceso de una hora (`POST https://oauth2.googleapis.com/token`) y llama a la API de Drive por `fetch` |
| Dependencias | **Ninguna.** Todo es HTTP. No hace falta `googleapis` ni firmar nada con `jose` |

**Requisito en GCP: publicar la pantalla de consentimiento.** Mientras la aplicacion OAuth este en estado «Testing», Google caduca los refresh tokens a los 7 dias y los comprobantes dejarian de subir sin aviso. Hay que pasarla a «In production». `drive.file` no es un alcance sensible, asi que no exige verificacion de Google.

#### Carpeta

`ConejoApp/Comprobantes`, en la raiz del Drive de la cuenta que autoriza. **La crea la aplicacion, no una persona:** con el alcance `drive.file`, una carpeta hecha a mano desde la web de Drive seria invisible para la app. El id de `Comprobantes` se guarda en una variable de entorno para no buscarla en cada subida.

Dentro, una subcarpeta por empresa y nombres que se entienden sin abrir el archivo:

```
ConejoApp/
  Comprobantes/
    <empresa_id> - <nombre de la empresa>/
      pago-<id>-<fecha>.<ext>
      retencion-<id>-<fecha>.<ext>
```

El nombre original del archivo se descarta, igual que hacia la subida de foto de perfil: el tipo se decide por la firma de los primeros bytes (PDF, JPG, PNG, WEBP), nunca por la extension ni por el `Content-Type` que declara el navegador, y el rechazo por tamaño ocurre antes de leer el archivo.

#### Cambio de cuenta

Hoy se autoriza con el Drive personal del responsable. Es provisional: la cuenta definitiva sera una compartida del estudio. Cambiar de cuenta no toca codigo, pero tiene tres consecuencias que conviene conocer antes:

- **Se repite la autorizacion.** Se vacian `DRIVE_REFRESH_TOKEN` y `DRIVE_CARPETA_COMPROBANTES_ID` en el `.env`, se ejecuta `npm run drive:probar` entrando con la cuenta nueva, y se copian los dos valores resultantes a Vercel.
- **La carpeta se crea de nuevo** en el Drive de la cuenta nueva, con otro id.
- **Los archivos ya subidos no se mueven solos.** Los `comprobante_drive_id` guardados seguirian apuntando a archivos de la cuenta anterior, que la autorizacion nueva no puede leer. Por eso el cambio debe hacerse **antes de recibir comprobantes reales**; despues exigiria mover los archivos y actualizar los ids.

El cliente OAuth de GCP no cambia: es el mismo para cualquier cuenta que autorice.

#### Variables de entorno

| Variable | Contenido | Donde |
|---|---|---|
| `DRIVE_CLIENT_ID` | Id del cliente OAuth | `.env` y Vercel |
| `SECRET_DRIVE_KEY1` | Secreto del cliente OAuth | `.env` y Vercel, marcado *Sensitive*. **Nunca en el repositorio** |
| `DRIVE_REFRESH_TOKEN` | Lo que devuelve la autorizacion | `.env` y Vercel, *Sensitive* |
| `DRIVE_CARPETA_COMPROBANTES_ID` | Id de `ConejoApp/Comprobantes` | `.env` y Vercel |

#### Lo que ya existe en Conejo App

- `scripts/driveProbar.mjs` y `npm run drive:probar`. Se ejecuta en el host. La primera vez pide la autorizacion en el navegador y guarda el refresh token en el `.env`; despues crea `ConejoApp/Comprobantes`, guarda su id, sube un archivo de prueba, lo lee de vuelta y lo borra.
- Las cuatro variables estan documentadas en `.env.example`.
- **Estado: probado el 2026-10-13 y funciona.** Se autorizo con el Drive personal del responsable; el script creo `ConejoApp/Comprobantes`, subio un archivo, lo leyo de vuelta con el contenido intacto y lo borro. Una segunda ejecucion, ya sin navegador, renovo el acceso con el refresh token y repitio la subida: es el mismo camino que usara la aplicacion. Las cuatro variables estan en el `.env` local; **faltan en Vercel**.

#### Lo que falta construir (fase 7)

| Pieza | Que hace |
|---|---|
| `src/lib/drive.ts` | Infraestructura, como `db.ts`: token de acceso (cacheado en memoria hasta que caduque), `subirArchivo`, `leerArchivo`, `carpetaDeEmpresa`. Sin logica de negocio |
| Columnas `comprobante_drive_id` en `finanzas.pagos` y `finanzas.retenciones` | Ya estaban en el modelo del paquete. Guardan el id del archivo, no un enlace |
| Subida | En la Server Action de reportar pago o retencion. Primero se sube a Drive, despues se inserta la fila; si la insercion falla queda un archivo huerfano, que es preferible a una fila que apunta a nada |
| Descarga | **Primera ruta API de la app** (`route.ts`). Los archivos son privados de la cuenta de Google: ni el cliente ni el operador pueden abrirlos con un enlace de Drive. La ruta comprueba la guardia, consulta el pago dentro de `conSesionFinanzas` —si el RLS no devuelve la fila, responde 404— y transmite el archivo |

**El RLS no protege el archivo, protege la fila.** Con Drive la seguridad del comprobante depende de que nadie llegue al archivo sin pasar por la ruta de descarga; por eso el id de Drive nunca se envia al navegador.

Dos efectos colaterales:

- Subir archivos por Server Action obliga a subir el limite de tamaño del cuerpo en la configuracion de Next (por defecto 1 MB).
- La ruta de descarga es el primer `route.ts` del proyecto, y hay que añadirla a lo que el proxy deja pasar con sesion.

---

## 10. Interfaz

### 10.1 Navegacion

Dos entradas nuevas en `MODULOS` (`src/lib/navegacion.ts`):

| Modulo | Ruta | Visible para | Hijos |
|---|---|---|---|
| **Finanzas** | `/dashboard/finanzas` | `cargos: ["administracion"]`, sin `roles`. El admin entra porque `puedeVer` le salta el filtro de cargo, y un cliente queda fuera porque no tiene cargo: el mismo patron que usa Hooks con `redes` | Presupuestos, Proformas, Facturas, Pagos, Cobranza, Ajustes |
| **Administracion** | `/dashboard/administracion` | Clientes con `puedeVerFinanzas` | — |

**Cambio necesario en el registro de modulos.** Hoy `puedeVer` filtra solo por `roles` y `cargos`. «Administracion» depende de una casilla del usuario, que ninguno de los dos cubre. Hay que tocar tres cosas en `src/lib/navegacion.ts`:

1. Un criterio nuevo en el tipo `Modulo`, por ejemplo `permiso?: "finanzas"`.
2. El tipo `ActorNavegacion`, que hoy es `Pick<Sesion, "rol" | "cargo"> | Pick<UsuarioCompleto, "rol" | "cargoSlug">`, necesita un campo opcional `puedeVerFinanzas`. El token no lo lleva: quien llegue como `Sesion` simplemente no vera el modulo.
3. `puedeVer` evalua el criterio. El layout del dashboard ya le pasa el usuario fresco (`src/app/dashboard/layout.tsx:24-25`), asi que el menu reflejara la casilla sin esperar a que caduque la sesion.

En `src/proxy.ts`: `/dashboard/finanzas` se añade a `RUTAS_POR_CARGO` con `["administracion"]`, junto a la entrada de Hooks. El proxy ya deja pasar al admin en esa lista. Para `/dashboard/administracion` no existe hoy una lista de rutas por tipo de usuario; o se añade una `RUTAS_SOLO_CLIENTE` que mire `sesion.tipo`, o se deja sin regla de proxy y la protege solo la guardia de la page, que es la barrera que de verdad cuenta segun el propio comentario del archivo.

### 10.2 Pantallas del administrador

Ninguna tiene maqueta en el paquete; se construyen con los patrones de Conejo.

| Ruta | Patron | Contenido |
|---|---|---|
| `/dashboard/finanzas` | `Wrapper` + tarjetas | Contadores: pagos por confirmar, saldo por cobrar, retenciones abiertas, proformas recurrentes pendientes |
| `…/presupuestos` | `Listado` | Filtros por empresa y estado. Paneles `ver` y `estado` |
| `…/presupuestos/nuevo`, `…/[id]` | Page propia | Editor con renglones dinamicos y totales en vivo. Como el «canvas» de hooks, no cabe en un panel lateral |
| `…/proformas` (+ editor) | Igual | Mas la marca de recurrente |
| `…/facturas` | `Listado` | Estado de cobro calculado, enlace a la hoja de impresion. Paneles `ver`, `emitir`, `anular` |
| `…/facturas/[id]/imprimir` | Page de impresion | Hoja en mm, modo guia, hoja de calibracion |
| `…/pagos` | `Listado` | Cola «por confirmar». Paneles `confirmar`, `rechazar` |
| `…/cobranza` | `Listado` | Saldos por empresa y por antiguedad |
| `…/ajustes` | Formularios | Emisor, talonario, medios de pago |

Cada ruta lleva su `loading.tsx` con la geometria de su page. Los nombres de panel nuevos (`emitir`, `anular`, `confirmar`, `rechazar`) se añaden a `PANELES` en `src/lib/parametros.ts`.

### 10.3 Pantalla del cliente

Es la unica con maqueta (`design/capturas/administracion-cliente.png`). Se reconstruye asi:

| Elemento de la maqueta | En Conejo |
|---|---|
| Tres indicadores (saldo, pagos por confirmar, proximo vencimiento) | Tarjetas dentro de `Wrapper` |
| Pestañas Presupuestos, Proformas, Facturas, Pagos y retenciones | Parametro de URL saneado por `leerEstadoListado` |
| Tabla de documentos con estado y accion | `Listado` con `Estado` y `BotonEnlace` |
| Formulario «Reportar un pago» | `PanelLateral` abierto con `?panel=nuevo` |
| «Aprobar» presupuesto | `ModalConfirmacion` |
| Bloque «Retenciones» | `PanelLateral` |
| Barra superior con logo del cliente | No aplica: se usa el armazon de Conejo |

### 10.4 Diseño

La marca coincide: el morado, el vino, el azul noche y el dorado de la maqueta son los mismos seis colores base de Conejo. La diferencia esta en como se usan:

- La maqueta escribe colores literales; **en Conejo ningun componente lo hace**. Todo va con los tokens semanticos (`bg-superficie`, `text-suave`, `bg-acento`…).
- La maqueta solo existe en tema claro. Las pantallas nuevas deben funcionar en los tres estados de tema; el dorado solo sobre fondo oscuro.
- No se usan `design/tokens.json` ni `design/tailwind.preset.cjs`: Conejo configura Tailwind 4 desde `globals.css`.
- **Excepcion:** la hoja de impresion de la factura si usa valores literales (negro sobre blanco, Arial, milimetros) y debe ignorar el tema.

---

## 11. Pruebas

Conejo no usa libreria de pruebas: son scripts propios.

| Bateria | Tipo | Que cubre |
|---|---|---|
| `db/pruebas/finanzasCalculo.mts` | Sin base, como `auditor.mts` | Tabla de casos de IVA, exentos, cantidades decimales, redondeo, retencion al 75 % y al 100 %, neto a cobrar |
| `db/pruebas/finanzasRls.mts` | Contra la base, como `conejo_app` | Traduccion de las aserciones financieras de `prisma/sql/tests/pruebas_db.sql`: aislamiento por rol, reporte de pagos, cobro, inmutabilidad, presupuesto en linea |
| Concurrencia de numeracion | Contra la base | 20 emisiones simultaneas dan 20 numeros consecutivos; una emision fallida no consume numero. El paquete nunca lo probo |
| `db/pruebas/modelos.mts` | Existente | Se amplia con los models nuevos; limpia lo que crea, salvo facturas, que no se pueden borrar: esas pruebas corren dentro de una transaccion con `ROLLBACK` |

Mas `typecheck` y `lint` limpios, como en cualquier modulo.

---

## 12. Plan por fases

Cada fase termina en algo utilizable.

| Fase | Entrega | Bloqueada por |
|---|---|---|
| **0. Preparacion** | Comprobar `BYPASSRLS` en Neon y que el agrupador acepta el rol nuevo (seccion 16.3). Drive ya esta autorizado y probado (2026-10-13) | — |
| **1. Rol de base de datos** | Rol `conejo_app` en Docker y Neon, permisos, dos cadenas de conexion. La app actual funciona igual que antes | — (opcion A decidida) |
| **2. Esquema** | Columnas en `empresas` y `clientes`, esquema `finanzas` completo, vista, funciones, politicas. `finanzasRls.mts` en verde | Visto bueno a los ajustes de 4.4 |
| **3. Cimientos de codigo** | `conSesionFinanzas`, tipos, calculo puro con sus pruebas, ajustes, guardia nueva, criterio `permiso` en navegacion, campos fiscales en Empresas y casilla en Usuarios | — |
| **4. Presupuestos** | Editor, listado, envio, aprobacion del cliente, vista del cliente con sus presupuestos | — |
| **5. Proformas** | Desde presupuesto aprobado, recurrente manual | — |
| **6. Facturas** | Emision, anulacion, impresion sobre talonario, calibracion | **Moneda y tasa, validacion del contador, hoja del talonario**, y decision 9.1 |
| **7. Pagos y retenciones** | Reporte del cliente con comprobante en Drive, ruta de descarga, confirmacion, estado de cuenta | **Medios de pago**. Drive autorizado y pantalla de consentimiento publicada |
| **8. Cobranza** | Antiguedad de saldos, portada con contadores | — |
| **9. Produccion** | SQL regenerado y pegado en Neon, variables en Vercel, prueba de humo con un cliente real | — |

**Las fases 1 a 5 se pueden construir ya.** La 6 y la 7 dependen de decisiones del negocio que nadie ha tomado.

---

## 13. Riesgos

| Riesgo | Efecto | Mitigacion |
|---|---|---|
| El rol de produccion tiene `BYPASSRLS` y no se cambia | RLS decorativo | Fase 0: comprobarlo antes de escribir una sola politica |
| Cambiar el usuario de conexion rompe algo de la app actual | Caida de modulos existentes | Fase 1 aislada, con `modelos.mts` completo corriendo como el rol nuevo antes de desplegar |
| Migrar pegando SQL en Neon con facturas ya emitidas | Un `ALTER` mal planteado sobre tablas inmutables | Cerrar el modelo (seccion 4.4) antes de emitir la primera factura real |
| Sin 2FA para quien emite facturas | Una cuenta de administrador comprometida puede emitir y anular | Fuera del alcance; conviene planificarlo |
| Impresion desde el navegador con escala distinta de 100 % | Campos desplazados en el talonario | Modo guia y hoja de calibracion; instrucciones en la propia pantalla |
| Sin avisos por correo | El cliente no se entera de un presupuesto nuevo; el administrador, de un pago reportado | Contadores en portada; avisar por los canales habituales del estudio |
| Reglas fiscales sin validar | Facturas no conformes | No construir IGTF ni ISLR hasta que el contador responda |
| La pantalla de consentimiento OAuth se queda en «Testing» | El refresh token caduca a los 7 dias y los comprobantes dejan de subir | Publicarla antes de la fase 7; `drive:probar` sirve de comprobacion |
| Se revoca el acceso de la app en la cuenta de Google, o se cambia su contraseña | Mismo efecto: las subidas fallan | La action devuelve un error claro y no inserta el pago; se vuelve a autorizar con `drive:probar` |
| El secreto del cliente OAuth se filtra | Con el refresh token permite leer y borrar los comprobantes | Solo en `.env` y Vercel. Si se expone, se regenera en GCP |
| Los comprobantes viven de momento en el Drive personal del responsable | Si esa cuenta se cierra o cambia, se pierden | Provisional y asumido. Pasar a la cuenta compartida antes de recibir comprobantes reales (seccion 9.2, «Cambio de cuenta») |
| Sesion de 8 horas con datos del momento del login | Un cliente al que se le quita la casilla la conserva en el token | La guardia y el RLS leen de la base, no del token |

---

## 14. Fuera del alcance

**Del paquete, por tu decision:** proyectos, piezas, bateria de fases, revision del cliente, briefs, boveda de marca, tablero interno.

**Del paquete, por incompatibilidad con Conejo:** 2FA, correo, tiempo real, tareas programadas. De Google Drive entra solo el guardado de comprobantes; los PDF de presupuestos, proformas y facturas no se archivan alli.

**Nunca estuvieron en el paquete:** proveedores y cuentas por pagar, notas de credito y debito, descuentos, varias alicuotas de IVA, anticipos y saldos a favor, libro de ventas, facturacion electronica, pasarela de pago, obtencion automatica de la tasa de cambio, contabilidad.

---

## 15. Decisiones que necesito de ti o del negocio

### Tecnicas (tuyas)

| # | Decision | Estado |
|---|---|---|
| 1 | RLS: opcion A o B (seccion 5.2) | **Cerrada el 2026-10-13: opcion A** |
| 2 | Los seis ajustes al modelo (seccion 4.4) | **Abierta.** Recomiendo aceptarlos todos |
| 3 | Quien opera finanzas | **Cerrada el 2026-10-13: rol `admin` y cargo `administracion`** |
| 4 | Factura impresa (seccion 9.1) | **Cerrada el 2026-10-13: PDF generado con libreria** (opcion B), para que salga siempre igual |
| 5 | Comprobantes (seccion 9.2) | **Cerrada el 2026-10-13: Google Drive, carpeta `ConejoApp/Comprobantes`** |
| 6 | ¿Se aceptan rutas API (`route.ts`)? | **Consecuencia de la 5, a confirmar.** Con los comprobantes en Drive hace falta una, para la descarga |

La decision 5 queda completa: el cliente OAuth esta creado y configurado, y la cuenta es, de momento, el Drive personal del responsable. Queda pendiente pedir la **cuenta compartida del estudio** y repetir la autorizacion con ella.

### Del negocio (heredadas del paquete, siguen abiertas)

| # | Decision | Bloquea |
|---|---|---|
| D-03 | ¿Se factura en dolares con conversion o directo en bolivares? ¿Que fuente de tasa? | Facturas |
| D-04 | Medios de pago reales y sus datos | Pagos |
| D-05 | Validacion del contador: campos obligatorios, vigencia del talonario, IGTF, ISLR, numero de control | Facturas |
| D-10 | Hoja escaneada del talonario | Impresion |
| S-05 | ¿Aprobar un presupuesto exige solo la casilla de finanzas? | Presupuestos (hay valor por defecto) |
| S-13 | Tramos de antiguedad: 0–30, 31–60, 61–90, mas de 90 dias | Cobranza (hay valor por defecto) |

---

## 16. Validacion contra el codigo de Conejo App

Hecha el 2026-10-09 sobre `sombreroConejoApp`, rama `main`, commit `8ae8b67`, arbol de trabajo limpio. Solo lectura.

### 16.1 Los ocho supuestos

| # | Supuesto | Resultado | Evidencia |
|---|---|---|---|
| 1 | Los identificadores de `usuarios` y `empresas` son enteros | **Confirmado.** `SERIAL`; las claves foraneas son `INTEGER` | `db/schema.sql:76`, `95`, `166-167` |
| 2 | Las tablas estan en el esquema `public` | **Confirmado.** Ningun nombre va calificado y no hay `CREATE SCHEMA` | `db/schema.sql` completo |
| 3 | `DATABASE_URL` usa el rol dueño | **Confirmado, y peor de lo supuesto en local:** el usuario `conejo` es el `POSTGRES_USER` del contenedor, o sea superusuario | `.env.example` (bloque «Base de datos»), `docker-compose.yml:25` |
| 4 | `empresas.direccion` es una direccion general | **Confirmado.** Columna `TEXT` sin mas semantica. La tabla no tiene razon social ni datos de retencion | `db/schema.sql:75-87` |
| 5 | `transaccion()` usa una sola conexion | **Confirmado.** Toma un cliente del pool, `BEGIN`, ejecuta, `COMMIT`, y lo libera | `src/lib/db.ts:292-320` |
| 6 | El seed aplica `schema.sql` de una vez | **Confirmado.** `cliente.query(esquema)` sin parametros: protocolo simple, admite varias sentencias y bloques `DO` | `db/seed.mts:39-40` |
| 7 | `modulosDe` recibe el usuario fresco | **Confirmado en el layout**, pero el tipo admite tambien la sesion del token | `src/app/dashboard/layout.tsx:24-25`, `src/lib/navegacion.ts:103-105` |
| 8 | Un cliente pertenece a una sola empresa | **Confirmado.** `clientes.usuario_id` es `UNIQUE` | `db/schema.sql:166` |

Ninguno resulto falso. El documento no cambia de rumbo.

### 16.2 Lo que el codigo revelo y el informe no decia

| # | Hallazgo | Efecto en este documento |
|---|---|---|
| 1 | `requerirAdmin()` decide con el token, no con la base | Finanzas necesita una guardia propia con datos frescos. Corregido en la seccion 6.2 |
| 2 | El cargo `administracion` se describe como «Administracion y facturacion» | Finanzas se abrio a ese cargo (decision del 2026-10-13). Seccion 2.2 |
| 3 | `seed.mts` se conecta con `DATABASE_URL`; `generarSql.mts` no se conecta | Solo el seed cambia de variable. Seccion 5.3 |
| 4 | El contenedor `db` no monta scripts de inicializacion y el volumen ya existe | El rol nuevo se activa a mano la primera vez. Seccion 5.3 |
| 5 | `ActorNavegacion` es una union de la sesion y el usuario fresco | El criterio `permiso` requiere tocar ese tipo. Seccion 10.1 |
| 6 | No existe ninguna lista de rutas por tipo de usuario en el proxy | La ruta del cliente necesita una lista nueva o queda solo con la guardia. Seccion 10.1 |
| 7 | `schema.sql` usa `CREATE OR REPLACE TRIGGER` y bloques `DO $nombre$` | El SQL portado puede seguir exactamente ese estilo. PostgreSQL 17 lo admite todo |
| 8 | Las migraciones consultan `information_schema.columns` filtrando solo por nombre de tabla | Sin riesgo mientras ninguna tabla de `finanzas` se llame igual que una de `public`. Las propuestas no chocan |
| 9 | `CLAUDE.md:32`: «De momento no usaremos mas librerias» | Confirma la restriccion. Todo lo propuesto se sostiene con las siete dependencias actuales |
| 10 | No hay ningun `route.ts` en `src/` | Confirmado. La primera ruta API llegaria solo si se guardan o sirven archivos |

### 16.3 Lo que sigue sin poder validarse desde aqui

| Punto | Por que | Como cerrarlo |
|---|---|---|
| Si el rol de produccion en Neon tiene `BYPASSRLS` | Es estado de la base de produccion, no del codigo | Ejecutar en el editor de Neon la consulta de la seccion 5.1 |
| Si el agrupador de Neon acepta un rol creado por SQL | Idem | Probar una conexion con `conejo_app` por el host `-pooler` tras crearlo |
| Limite de tamaño del cuerpo de una Server Action en Next 16 | No consulte la documentacion local de la version | Leer `node_modules/next/dist/docs/` antes de la fase 7, como pide `AGENTS.md` |
