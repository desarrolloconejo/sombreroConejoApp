# Reglas de la bateria de fases

Fecha: 2026-10-14. Es el extracto, dentro del repositorio, de las reglas de
proyectos, piezas y fases del paquete de especificacion original
(`appFacturas/docs/03-bateria-de-fases.md`, `config/fases.json` y
`prisma/sql/05_vistas.sql`), ya adaptado a Conejo App. Con esto la etapa 3 no
depende de esa carpeta.

Donde este documento y el paquete difieren, manda este documento; donde este
documento y `docs/planIntegracionPortal.md` difieren, manda el plan.

## El modelo

```
Proyecto                  lo que pidio el cliente, de una empresa
  └─ Pieza                un entregable que el cliente aprueba (N por proyecto)
       └─ 5 fases         la bateria; siempre cinco, siempre las mismas
            └─ Tareas     el trabajo interno, solo en las fases 1 y 3
```

- Un proyecto de **redes sociales** es una grilla de N piezas. Uno **especial**
  (desarrollo de producto y lo que venga de un brief) tiene una sola.
- Cada pieza nace con sus cinco filas de fase.
- **El avance no se guarda**: no hay columnas de porcentaje ni de fase actual.
  Se calcula en `portal.v_progreso_pieza` y `portal.v_progreso_proyecto`.

## Las dos plantillas

Viven en `src/lib/portal/catalogo.ts`.

| Fase | Redes sociales | Especial | Tipo |
| --- | --- | --- | --- |
| 1 | Redaccion de contenido | Validacion del brief | Trabajo: lleva tareas |
| 2 | Revision interna | Revision interna y asignacion | Control |
| 3 | Diseno, edicion y produccion | Produccion | Trabajo: lleva tareas |
| 4 | Aprobacion interna y envio al cliente | Aprobacion interna y envio al cliente | Control |
| 5 | Revision del cliente y aprobacion para publicar | Revision del cliente y aprobacion | La decide el cliente |

## Estados de una fase

`pendiente`, `en_curso` o `completada`.

- Al crear una pieza: fase 1 `en_curso`, las demas `pendiente`.
- **Solo hay una fase `en_curso` por pieza**, y es siempre la primera no
  completada. La base lo impone con un indice unico parcial.
- **Completar** la fase en curso: pasa a `completada` con fecha, autor y la
  ronda en que se completo; la siguiente pendiente pasa a `en_curso`.
- No se completa fuera de orden: solo la fase en curso.
- Una fase de trabajo (1 o 3) **con tareas** solo se completa cuando todas sus
  tareas estan listas. Sin tareas, se completa directamente.
- Las completa el **ejecutivo** (admin, o `cuentas` asignado a la empresa).
  Quien hace una tarea la marca lista; no completa fases.
- **La fase 5 no la completa el equipo**: es la decision del cliente (etapa 4).
- **Regresar** una fase: el ejecutivo reabre la ultima completada, que vuelve a
  `en_curso`; la que estaba en curso vuelve a `pendiente`. No se regresa una
  pieza aprobada.

## El avance

- Pieza: `fases completadas × 20`.
- Proyecto: `fases completadas ÷ (5 × N) × 100`, con N = piezas activas. Cada
  fase de cada pieza vale `20 ÷ N` del proyecto.
- Suma **al completar** la fase, no mientras esta en curso (decision D-01).
- Una pieza **cancelada** deja de contar (P9): ni en N ni en las fases.

Los dos ejemplos son pruebas obligatorias:

**A.** 10 piezas: 2 aprobadas (5 fases), 3 en fase 5 (4 completas), 3 en fase
3 (2 completas) y 2 en fase 2 (1 completa): `(10 + 12 + 6 + 2) ÷ 50 = 60 %`.

**B.** 10 piezas, todas en fase 5 (80 %). El cliente aprueba 7 y corrige 3:

| Piezas | Decision | Fases que conservan | Aporte |
| --- | --- | --- | --- |
| 7 | Aprobadas | 5 de 5 | 70 % |
| 1 | Correccion de redaccion | la 3 | 2 % |
| 1 | Correccion de diseno | la 1 y la 2 | 4 % |
| 1 | Redaccion y diseno | ninguna | 0 % |
| **10** | | | **76 %** |

## Correccion en la fase 5

Se construye en la etapa 4, pero la ruta ya esta en el catalogo y probada.

| Proyecto | Correccion | Reabre | Conserva |
| --- | --- | --- | --- |
| Redes sociales | Solo redaccion | 1, 2, 4, 5 | 3 |
| Redes sociales | Solo diseno o edicion | 3, 4, 5 | 1, 2 |
| Redes sociales | Redaccion y diseno | 1, 2, 3, 4, 5 | ninguna |
| Especial | Cualquiera | 3, 4, 5 | 1, 2 |

- Las fases 2 y 4 se repiten siempre que la ruta pasa por ellas.
- La menor fase reabierta pasa a `en_curso`; la ronda de la pieza sube en uno.
- El ejecutivo puede ajustar la ruta mientras no se haya completado ninguna
  fase de la ronda nueva.
- La ruta de solo diseno (S-02) y la de especiales (S-01) son supuestos del
  paquete sin confirmar. Sin limite de rondas (D-02) ni plazo para el cliente
  (D-08).

## Las cuatro alertas del tablero

Por pieza activa no aprobada, con la fecha de su fase en curso y el dia de
Caracas:

| Alerta | Cuando |
| --- | --- |
| Por vencer | La fecha estimada de la fase en curso vence en 0 a 2 dias |
| Atrasada | La fecha estimada de la fase en curso ya paso |
| Esperando al cliente | La fase en curso es la 5 |
| En correccion | La ronda es mayor que 1 |

## Quien ve que

| | Admin | Cuentas asignado | Quien tiene trabajo en la pieza | Cliente de la empresa |
| --- | --- | --- | --- | --- |
| Proyecto, piezas, fases y fechas | Si | Si | Si, solo esas piezas | Si |
| Copy (`pieza_contenido`) | Si | Si | Si | Solo con la pieza en fase 5 o aprobada |
| Tareas | Si | Si | Si | **Nunca** |
| Comentarios internos | Si | Si | Si | **Nunca** |
| Crear y mover proyectos, piezas, fases y tareas | Si | Si | No | No |
| Marcar su tarea como lista | — | — | Si | No |

«Tener trabajo en la pieza» es ser responsable de la pieza, de una de sus
fases o de una de sus tareas. Lo deciden las politicas de seguridad por fila:
la aplicacion no puede devolver lo que la base no deja leer.

## Fechas

El ejecutivo pone una fecha estimada a cada fase; el cliente las ve siempre.
La fecha de cierre del proyecto la fija el ejecutivo. Las tareas pueden llevar
la suya, que es la que ordena «Mi trabajo».
