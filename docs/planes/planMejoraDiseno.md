# Plan de mejora del diseno

Fecha: 2026-10-13. Estado: **pendiente de ejecutar**.

Subir el nivel de la interfaz usando las skills de diseno instaladas, y
sustituir el menu movil de hamburguesa por una barra inferior con hoja de
navegacion.

Es independiente de `docs/planes/planIntegracionPortal.md`, con un punto de contacto:
la navegacion movil de aqui es la que usaran todos los modulos nuevos.

## Lo que no cambia

Las skills aconsejan; el contrato del proyecto manda.

| Regla | Consecuencia |
| --- | --- |
| Los seis colores de marca y sus tokens | Ningun color literal. Lo nuevo se resuelve con los tokens que hay, o anadiendo un token |
| Una tipografia, Poppins | No se anaden familias |
| Tres estados de tema | Todo se disena y se prueba en claro y en oscuro. Variante `dark-tema:`, no `dark:` |
| Sin librerias | Ni de componentes, ni de animacion, ni de iconos. Animacion con CSS y las utilidades de `globals.css` |
| Iconos de `lucide-react` | No se dibujan SVG a mano |
| Hover en eje vertical, no en escala | Lo pide el contrato |
| Renderizado en servidor | No se convierte en cliente lo que hoy es de servidor por una animacion |

## Las skills y para que se usa cada una

| Skill | Se usa para |
| --- | --- |
| `impeccable` | El hilo conductor. `init` para fijar el contexto de marca; `audit` y `critique` para diagnosticar; `layout`, `typeset`, `clarify`, `distill` para ordenar; `harden` para estados y casos limite; `adapt` para movil; `polish` para cerrar |
| `emil-design-eng` | Criterio de detalle en componentes: estados, foco, transiciones, sensacion al tocar |
| `mobile-native` | Todo lo de la fase 2: areas seguras, altura real de pantalla, toques, teclado |
| `animate` | Construir cada animacion nueva, empezando por si debe existir |
| `find-animation-opportunities` | Encontrar donde falta movimiento, y descartar donde sobra |
| `review-animations`, `improve-animations` | Revisar el movimiento que ya hay (`surge`, `suave`, `desliza`, `despliega`, `hueso`) |
| `animation-performance` | Que nada pierda fotogramas, sobre todo la hoja movil |
| `break-ui` | Someter cada pantalla a datos extremos: nombres largos, listas vacias, cifras enormes |
| `design-taste-frontend` | Solo donde aplica: login y lo que ve el cliente. Ella misma declara no estar pensada para paneles |

## Fase 1 — Diagnostico

Sin tocar codigo.

| Paso | Skill | Sale |
| --- | --- | --- |
| Fijar el contexto de marca y de producto | `impeccable init` | El archivo de contexto que usan los demas comandos |
| Auditoria tecnica: accesibilidad, contraste, responsive, rendimiento | `impeccable audit` | Hallazgos por pantalla |
| Critica de diseno: jerarquia, ritmo, densidad, claridad | `impeccable critique` | Hallazgos por pantalla |
| Inventario del movimiento actual | `improve-animations` | Que se queda, que se corrige, que se quita |
| Prueba de resistencia | `break-ui` | Que se rompe con datos reales feos |

Pantallas: login, inicio, Mi perfil, Usuarios, Empresas y las siete de Hooks,
cada una en claro y oscuro, a 360, 768 y 1440 px.

Entregable: `docs/informeDiseno.md`, con capturas de antes y una lista
priorizada. **Nada de la fase 3 se ejecuta sin aprobar esa lista.**

## Fase 2 — Navegacion movil nueva

Se hace entera aunque la fase 1 no este cerrada: es una decision ya tomada.

### De que se parte

Por debajo de `lg` hay una cabecera con boton de hamburguesa que abre un cajon
lateral (`src/components/layout/HeaderMovil.tsx`). Funciona, pero esconde toda
la navegacion detras de un toque en la esquina mas lejana del pulgar.

### A que se llega

La referencia es la app de un banco: barra fija abajo con accesos directos y una
lista completa agrupada por secciones. **Se toma la estructura, no el estilo**,
y con dos correcciones decididas:

- **Sin boton central.** La barra no lleva la marca en medio.
- **La barra no es el menu.** Una barra inferior sirve para cuatro o cinco
  destinos y se rompe en cuanto el menu crece, y este va a crecer: con el portal
  un administrador tendra mas de veinte entradas. Por eso la barra lleva solo
  atajos, y **el menu completo vive en una hoja** que se abre desde su ultimo
  hueco.

```
┌─────────────────────────────┐
│ Titulo            🔍   🔔   │  cabecera fina
├─────────────────────────────┤
│                             │
│         contenido           │
│                             │
├─────────────────────────────┤
│  ⌂       ▦       ✓      ☰   │  barra inferior
│ Inicio   …       …     Menu │
└─────────────────────────────┘

Al tocar «Menu» sube la hoja, a casi toda la pantalla:

┌─────────────────────────────┐
│ Menu                     ✕  │
│ 🔍 Buscar                   │
│ TRABAJO                     │
│  ▦  Tablero                 │
│  ▤  Proyectos               │
│  ✉  Briefs                  │
│ HERRAMIENTAS                │
│  ⚡ Hooks                 ›  │
│ FINANZAS                    │
│  …                       ↕  │  se desplaza
├─────────────────────────────┤
│ ☺ Carla Mendez   Mi perfil  │  pie fijo
│ ⎋ Cerrar sesion             │
└─────────────────────────────┘
```

### Piezas

| Pieza | Como |
| --- | --- |
| **Barra inferior** | Fija, **cuatro huecos como maximo**. El ultimo es siempre «Menu»; el primero, Inicio. Los del medio son atajos |
| **Atajos** | Uno o dos, segun quien entra. Salen del registro de modulos, no de una tabla escrita en el componente |
| **Hoja de navegacion** | El menu entero: todos los modulos visibles para esa persona, agrupados por las secciones del menu. Sustituye al cajon |
| **Pensada para menus largos** | Ocupa casi toda la pantalla, su lista se desplaza con la cabecera y el pie fijos, y trae un buscador arriba que filtra mientras se escribe |
| **Submodulos** | Un modulo con hijos (Hooks, Finanzas) se despliega dentro de la hoja, como hoy en el cajon. Llega abierto el de la pantalla en la que se esta |
| **Donde estoy** | La hoja abre con el modulo actual marcado y a la vista, sin tener que buscarlo |
| **Cabecera movil** | Se queda con el titulo de la pantalla, el buscador y la campana. Pierde la hamburguesa |
| **Mi perfil y cerrar sesion** | En el pie fijo de la hoja, junto a la ficha de quien entra |
| **Escritorio** | Sin cambios: el sidebar sigue igual desde `lg` |

### Los atajos, segun quien entra

| Quien entra | Atajos |
| --- | --- |
| Admin | Tablero |
| Cuentas | Tablero, Briefs |
| Administracion | Finanzas |
| Produccion, diseno | Mi trabajo |
| Redes | Mi trabajo, Hooks |
| Cliente | Mis proyectos, Mis briefs |

Mientras los modulos del portal no existan, se usa lo que hay: hoy, Hooks para
redes y Usuarios para el admin. Si a alguien no le corresponde ningun atajo, la
barra queda en Inicio y Menu.

Cada modulo declara en `src/lib/navegacion.ts` su prioridad para la barra, y la
barra toma los primeros visibles. Asi un modulo nuevo puede entrar sin tocar el
componente, y **el menu puede crecer lo que haga falta sin que la barra cambie**.

**Si al probarla la barra no convence**, la salida ya esta contemplada: se quita
y queda solo el boton «Menu» en la cabecera abriendo la misma hoja. La hoja es
la pieza que importa; la barra son atajos encima de ella.

### Detalles que deciden si se siente bien

| Tema | Regla | Skill |
| --- | --- | --- |
| Area segura | La barra respeta `env(safe-area-inset-bottom)`; el contenido reserva su alto para que nada quede debajo | `mobile-native` |
| Altura real | `dvh`, no `vh`: la barra del navegador no debe tapar la de la app | `mobile-native` |
| Teclado | Con un campo enfocado la barra se oculta, o tapa el formulario | `mobile-native` |
| Objetivos tactiles | Minimo 48 px, como hoy en el cajon | `mobile-native` |
| Activo | Se resuelve una vez sobre la lista entera, igual que ahora: gana el prefijo mas largo | — |
| La hoja | Animada con `transform`, nunca con `height`. Cierra con la X, con Escape, tocando fuera y al navegar | `animate`, `animation-performance` |
| Foco | Al abrir entra a la hoja y queda atrapado; al cerrar vuelve al boton «Menu». Cerrada, queda `inert` | — |
| Scroll | Con la hoja abierta el fondo no se desplaza | `mobile-native` |
| Movimiento reducido | Con `prefers-reduced-motion` la hoja aparece sin deslizarse | `animate` |
| Impresion | La barra no sale en las pages imprimibles | — |
| Etiquetas | Cada hueco lleva icono **y** texto, nunca el icono solo | `impeccable harden` |

### Archivos

| Archivo | Cambio |
| --- | --- |
| `src/components/layout/BarraMovil.tsx` | Nuevo |
| `src/components/layout/HojaNavegacion.tsx` | Nuevo. Hereda del cajon la trampa de foco y el `inert` |
| `src/components/layout/HeaderMovil.tsx` | Se reduce a la cabecera |
| `src/components/layout/ItemNavegacion.tsx` | Se reutiliza dentro de la hoja |
| `src/lib/navegacion.ts` | Prioridad para la barra y seccion de cada modulo |
| `src/app/dashboard/layout.tsx` | Monta la barra y reserva su espacio |
| `src/app/globals.css` | Utilidad de la hoja, si `desliza` no alcanza |
| `src/app/layout.tsx` | `viewport-fit=cover` para las areas seguras |
| Los `loading.tsx` | Sus esqueletos no cambian: la barra vive en el layout |

### Pruebas

| Prueba | Tipo |
| --- | --- |
| La barra existe por debajo de `lg` y no por encima | Integracion |
| Cada rol ve sus atajos, y nunca un modulo que no puede abrir | Integracion |
| Con el menu mas largo posible (admin), todo modulo se alcanza: desplazando y buscando | Integracion |
| La hoja abre, lista las secciones correctas y cierra con Escape devolviendo el foco | Integracion |
| Con la hoja cerrada ningun enlace suyo acepta el foco | Integracion |
| A 360 px no hay scroll horizontal ni contenido bajo la barra | Integracion |
| Seleccion de atajos a partir del registro | Unitaria |

Y una pasada en un telefono de verdad, que es lo unico que revela una barra
tapada por la del navegador.

## Fase 3 — Mejoras por pantalla

Sale de la lista aprobada en la fase 1. El orden previsto:

| Bloque | Skills | Alcance |
| --- | --- | --- |
| Sistema base | `impeccable typeset`, `layout` | Escala tipografica, espaciado y radios como tokens, donde hoy hay valores sueltos |
| Componentes base | `emil-design-eng`, `impeccable harden` | Boton, campo, selector, etiqueta, alerta: todos sus estados |
| Listado | `impeccable adapt`, `break-ui` | Tabla, tarjetas, filtros, paginacion, vacio |
| Paneles y modales | `animate`, `review-animations` | Entrada, salida, foco |
| Hooks | `impeccable clarify`, `distill` | Canvas, auditor, metricas |
| Login y vista del cliente | `design-taste-frontend`, `impeccable` | Es donde cabe mas intencion visual |
| Estados de carga y error | `impeccable harden` | Esqueletos, vacios, errores |
| Movimiento | `find-animation-opportunities`, `animation-performance` | Lo que falte, y que nada pierda fotogramas |
| Cierre | `impeccable polish` | Pasada final |

Cada bloque es una rama. Los modulos del portal nacen ya con este nivel: no se
construyen para rediseñarlos despues.

## Decisiones

| Tema | Decision |
| --- | --- |
| Boton central con la marca | **No.** La barra no lleva boton central |
| Maquetas de `diseno/` | **Retiradas el 2026-10-27** por decision del responsable, antes de ejecutar este plan. Siguen en el historial de git (hasta el commit `1e2d6f4`) |

Siguen abiertas:

| # | Pregunta | Propuesta |
| --- | --- | --- |
| 1 | ¿La barra se esconde al bajar por la pagina y vuelve al subir? | No: fija siempre. Menos sorpresa |
| 2 | ¿El buscador global se queda en la cabecera movil, ademas del de la hoja? | Si |
| 3 | ¿Se activa el detector automatico de `impeccable` al editar? | No por ahora: primero ver que avisa |

## Revision del plan contra el codigo

Hecha el 2026-10-13. El plan es ejecutable; esto es lo que hay que resolver o
tener presente antes de empezar.

**Dos decisiones pendientes**

| # | Tema | Problema | Propuesta |
| --- | --- | --- | --- |
| 4 | Atajos de la barra | Una sola prioridad por modulo no reproduce la tabla de atajos: el admin ve todo, asi que recibiria los dos modulos mas prioritarios del registro, no «Tablero» solo | Prioridad por rol y cargo |
| 5 | Quien introduce `seccion` | **Resuelto.** La introdujo la etapa 1 del portal: cada modulo la declara y `porSecciones` la reparte. La hoja la reutiliza tal cual | — |

**Lo que el plan da por hecho y no existe**

| Tema | Como esta hoy |
| --- | --- |
| Cabecera movil con titulo y buscador | No los tiene: lleva hamburguesa, campana apagada y avatar. `BuscadorGlobal` solo se monta en escritorio. Es trabajo nuevo, falta `BuscadorGlobal.tsx` en la tabla de archivos y no se dice que pasa con el avatar |
| `review-animations` | Lleva `disable-model-invocation`: solo la lanza el responsable con `/review-animations` |
| Cargos de la tabla de atajos | `produccion` aun no existe; `direccion` y `tecnologia` existen y no tienen fila, asi que quedan en Inicio y Menu |
| Pages imprimibles | No hay ninguna ni estilos de impresion: la regla de la barra no se puede probar hasta la factura |
| Pruebas a 360 px | El proyecto `integracion` de Playwright solo usa escritorio: hace falta un proyecto movil o fijar el tamano en cada prueba |

**Detalles a anadir**

- Con `viewport-fit=cover` (`viewportFit: "cover"` en el `viewport` de
  `src/app/layout.tsx`) hay que respetar tambien las areas seguras superior y
  laterales, no solo la inferior.
- Al abrir la hoja el foco va al boton de cerrar, no al buscador: en un
  telefono, enfocar el buscador levanta el teclado y tapa media hoja.
- Ocultar la barra con un campo enfocado necesita JavaScript de cliente.
- Las capturas de la fase 1 son 72 (12 pantallas, 2 temas, 3 anchos): decidir
  donde se guardan y si entran al repositorio.
- `impeccable init` escribe un `PRODUCT.md` en la raiz: anadirlo a la tabla de
  documentos de `AGENTS.md`.
- `moduloActivo` (`src/lib/navegacion.ts`) esta sin uso y sirve para el titulo
  de la cabecera movil.
- Al terminar: actualizar los comentarios que nombran el cajon en
  `navegacion.ts` y en el layout del panel.

## Criterios de terminado

- La navegacion movil nueva esta en `main`, con sus pruebas, y el cajon ya no existe.
- Cada hallazgo aprobado de la fase 1 esta resuelto o aplazado con motivo.
- Todas las pantallas pasan a 360, 768 y 1440 px, en claro y en oscuro.
- Ningun color literal, ninguna libreria nueva.
- Contraste AA, foco visible y todo operable con teclado.
