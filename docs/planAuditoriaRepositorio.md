# Plan de auditoria y actualizacion del repositorio

Fecha: 2026-10-13. Estado: **analisis hecho** (`docs/informeAuditoria.md`);
arreglos y actualizaciones pendientes de aprobar.

Decidido el 2026-10-13: la duracion de la sesion y las cuentas del seed en
produccion **no se arreglan aqui**; las trata `docs/planIntegracionPortal.md`
(secciones 5, 5.1, 10.1 y 11). Los puertos del compose ya estan limitados a la
propia maquina.

Revisar que cada libreria y cada API de plataforma se usa como dice su
documentacion vigente, que nada sensible queda expuesto, y dejar las
dependencias al dia. Se apoya en el MCP de **Context7** para consultar la
documentacion actual en lugar de fiarse de la memoria del asistente.

Es independiente de `docs/planIntegracionPortal.md`. Conviene ejecutarlo
**antes** de la etapa 1 de ese plan: la etapa 1 reescribe sesiones y conexion a
la base, y es mejor hacerlo sobre un repositorio ya revisado.

## Reglas del trabajo

| Regla | Detalle |
| --- | --- |
| Context7 es la fuente para librerias | Antes de opinar sobre un uso, se consulta la documentacion de **la version instalada** |
| Para Next 16 manda la copia local | `node_modules/next/dist/docs/`. Context7 complementa, no sustituye (`AGENTS.md`) |
| Primero el informe, despues los cambios | La pasada de analisis no toca codigo. Cada hallazgo se clasifica y se aprueba antes de arreglarlo |
| Un hallazgo, una evidencia | Archivo y linea, lo que dice la documentacion, y el riesgo concreto |
| Sin dependencias nuevas | Si un arreglo «pide» una libreria, se anota como decision, no se instala |
| Una rama por bloque | `chore/auditoria-…`; a `main` con `lint`, `typecheck` y pruebas en verde |

Context7 queda disponible tras reiniciar la sesion del asistente y aprobar el
servidor declarado en `.mcp.json`.

## Fase 1 — Uso correcto de cada libreria

Para cada una: resolver su identificador en Context7, pedir la documentacion de
la version instalada y contrastar con el codigo.

| Libreria | Instalada | Ultima | Donde se usa | Que se comprueba |
| --- | --- | --- | --- | --- |
| `next` | 16.3.2 | 16.4.0 | Todo `src/app`, `src/proxy.ts`, actions | `proxy.ts` y su `matcher`; `cookies()`, `searchParams` y `params` asincronos; `PageProps` y `LayoutProps`; Server Actions con `useActionState`; `redirect` fuera de `try`; `revalidatePath`; `loading.tsx` y limites de error; `next/font`; `next/image`; cabeceras en `next.config.ts` |
| `react`, `react-dom` | 19.2.8 | 19.3.0 | Componentes | `useActionState`, `cache`, ajuste de estado durante el render, `inert`, formularios y el vaciado tras una action |
| `jose` | 6.2.10 | 6.2.12 | `src/lib/jwt.ts` | Algoritmo fijado al verificar, emisor y audiencia, caducidad, forma de la clave |
| `pg` | 8.23.0 | 8.23.1 | `src/lib/db.ts`, seed | Opciones del pool, `sslmode`, manejo de errores, transacciones y liberacion del cliente |
| `bcryptjs` | 3.0.3 | 3.0.3 | `src/lib/password.ts` | Coste, limite de 72 bytes, comparacion en tiempo constante |
| `lucide-react` | 1.34.0 | 1.56.0 | Iconos | Importacion por nombre, iconos renombrados o retirados entre versiones |
| `tailwindcss` | 4 | 4 | `globals.css` | `@theme`, `@utility`, `@custom-variant`, capa `base` |
| `@playwright/test` | 1.64 | — | `tests/` | Configuracion por proyectos, reintentos, selectores accesibles |
| `eslint`, `eslint-config-next` | 9 / 16.3.2 | 10 / 16.4.0 | Lint | Configuracion plana; si la 10 es compatible con la configuracion de Next |
| `typescript` | 5.9.3 | 7.0.2 | Todo | Solo se evalua: una mayor nueva no se adopta en esta pasada |

Las versiones «ultima» son las que devolvio `npm outdated` el 2026-10-13.

## Fase 2 — Que nada sensible quede expuesto

Inventario de partida, tomado del codigo ese mismo dia.

### Variables de entorno

| Variable | Se lee en | Sensible |
| --- | --- | --- |
| `DATABASE_URL` | `src/lib/db.ts`, `db/seed.mts` | Si |
| `JWT_SECRET` | `src/lib/jwt.ts` | Si |
| `SECRET_DRIVE_KEY1`, `DRIVE_REFRESH_TOKEN` | `scripts/driveProbar.mjs` | Si |
| `DRIVE_CLIENT_ID`, `DRIVE_CARPETA_COMPROBANTES_ID` | `scripts/driveProbar.mjs` | No, pero no se publican |
| `JWT_EXPIRACION`, `COOKIE_SESION`, `NODE_ENV` | `src/lib` , `src/proxy.ts` | No |
| `APP_URL`, `APP_PORT`, `CI` | `playwright.config.ts` | No |

No hay ninguna variable `NEXT_PUBLIC_*`: hoy nada del entorno viaja al
navegador a proposito. La auditoria comprueba que tampoco viaje por descuido.

### Lista de comprobacion

| # | Que se revisa | Punto de partida conocido |
| --- | --- | --- |
| 1 | Ningun componente de cliente importa `lib/db`, `lib/jwt`, `lib/sesion`, `lib/password` ni `models/` | Un rastreo rapido no encontro ninguno. Falta verificarlo sobre el bundle, no solo sobre los `import` |
| 2 | Frontera servidor/cliente protegida de forma activa | No se usa `server-only` (seria una dependencia); se evalua una alternativa propia o una regla de lint |
| 3 | Props que cruzan al cliente | Que ninguna page pase `passwordHash`, tokens ni filas completas. `vw_usuarios_completos` expone `password_hash` |
| 4 | Lo que devuelven las Server Actions | Solo `EstadoFormulario`. La contrasena provisional viaja una vez en `credencial`: confirmar que no se registra ni se cachea |
| 5 | Mensajes de error | Que un fallo de la base no llegue al navegador con SQL, rutas o nombres de tabla. Hay `console.error` en los tres limites de error |
| 6 | Registros del servidor | Que no se escriban contrasenas, tokens, cadenas de conexion ni datos personales |
| 7 | `.env.example` | Trae valores de desarrollo para la base y pgAdmin, y un secreto de sesion de ejemplo que la app aceptaria. Decidir que queda como valor y que como hueco |
| 8 | El seed | Imprime las contrasenas de las cuentas que crea (`db/seed.mts:241`), y estan en `db/datos/semilla.mts` |
| 9 | Historial de git | Buscar secretos en commits antiguos, no solo en el arbol actual |
| 10 | Archivos servidos | `public/` y el `matcher` del proxy: que nada privado quede bajo una ruta publica |
| 11 | Cabeceras | `next.config.ts` no define ninguna. Cabecera `X-Powered-By` |
| 12 | Cookies | Atributos de la de sesion y la de tema |
| 13 | Imagen de Docker | Que `.dockerignore` deje fuera `.env` y que la imagen `prod` no lleve secretos |
| 14 | Dependencias con avisos | `npm audit`, separando lo que afecta a ejecucion de lo que es solo de desarrollo |
| 15 | Skills y MCP de terceros | `.claude/skills` y `.mcp.json`: que hacen, que ejecutan y con que permisos |

Varios de estos puntos ya tienen arreglo previsto en la etapa 1 del plan del
portal (cabeceras, vista sin hash, secreto de ejemplo, cuentas de prueba). La
auditoria los confirma y descubre los que falten; no los duplica.

## Fase 3 — Actualizacion de dependencias

| Paso | Detalle |
| --- | --- |
| 1 | Parches y menores de ejecucion: `next`, `react`, `react-dom`, `jose`, `pg`, `lucide-react`. De uno en uno, leyendo en Context7 las notas de cada version |
| 2 | `eslint-config-next` a la misma version que `next` |
| 3 | Tipos (`@types/*`) |
| 4 | Mayores (`eslint` 10, `typescript` 7): solo evaluar e informar |
| 5 | Tras cada actualizacion: reconstruir con `docker compose up -d --build -V`, `lint`, `typecheck`, las cuatro baterias de pruebas y el build de produccion |

Las versiones de ejecucion siguen fijadas a un numero exacto, como hoy.

## Fase 4 — Codigo sin uso

Detectado al preparar este plan; se confirma antes de tocar nada.

| Que | Donde | Nota |
| --- | --- | --- |
| `sesionActual` | `src/actions/auth.ts` | Exportada y sin ninguna llamada |
| `buscarPorSlug` | `src/models/cargos.ts` | Sin ninguna llamada |
| `requerirEmpresa` | `src/lib/sesion.ts` | Sin uso **a proposito**: la necesita la vista del cliente. No se toca |
| Subida de foto | `src/actions/perfil.ts`, `TarjetaFoto.tsx` | Comentada, no borrada, hasta que haya donde guardar archivos. No se toca |

## Entregables

| Entregable | Contenido |
| --- | --- |
| `docs/informeAuditoria.md` | Hallazgos con evidencia, severidad y arreglo propuesto. Lo ya cubierto por el plan del portal se marca como tal |
| Ramas de arreglo | Una por bloque, cada una con sus pruebas |
| `README.md` y `AGENTS.md` | Actualizados si cambia algun comando, version o regla |

## Criterios de terminado

- Cada libreria de la fase 1 tiene veredicto: correcto, corregido o aplazado con motivo.
- Los quince puntos de la fase 2 tienen respuesta con evidencia.
- `npm audit` sin avisos altos en dependencias de ejecucion.
- `lint`, `typecheck`, las cuatro baterias y el build de produccion en verde.
- El informe no contiene ningun secreto ni valor de entorno.
