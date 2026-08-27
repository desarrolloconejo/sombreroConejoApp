# Especificación funcional — Módulo de creación de hooks

Documento de traspaso. Describe **todo** lo que hace Conejo Copy Check en torno
a la creación de hooks de vídeo corto, tarjeta por tarjeta, con el texto literal
de cada una, para poder reimplementarlo como una funcionalidad dentro de otra
aplicación (perfil: creadoras de contenido).

Todo el texto entre comillas o en bloque es **literal de la aplicación**. Donde
algo es dinámico se marca con `{llaves}`.

---

## 1. Qué es en una frase

Una herramienta que obliga a **decidir el hook antes de grabar** y a **auditarlo
con un algoritmo determinista** antes de producir. No hay ningún modelo de
lenguaje: la puntuación son nueve controles sobre listas de expresiones, y por
eso es reproducible y explicable.

El flujo completo es:

> elegir cliente → definir objetivo → escribir tensión y prueba → construir hook
> e Insert-Titulo → **auditar** → guardar ficha → registrar el resultado real
> cuando la pieza se publica.

**Vocabulario propio que hay que conservar:**

| Término                 | Significado                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Hook hablado**        | La frase que se dice en voz. Máximo 12 palabras (estándar).                                                   |
| **Insert-Titulo**       | El texto en pantalla. Máximo 6 palabras. **Nunca** es transcripción de la voz: lleva solo el núcleo.          |
| **Territorio**          | La _intención_ del hook. Siete: A–G.                                                                          |
| **Mecanismo**           | _Cómo_ se demuestra. Ocho: comparación, número, pregunta, dato, prueba visual, antes/después, coste, persona. |
| **Ficha de producción** | El documento de texto plano que sale del Canvas y que edición ejecuta sin interpretar.                        |
| **Fallo duro**          | Un control que, si salta, tapa la nota en 69 (o 25) por muy alta que sea la suma.                             |
| **Cementerio**          | La lista de recursos prohibidos.                                                                              |

---

## 2. Estructura de la pantalla

Es **una sola página larga** con navegación por anclas, no un enrutador con
vistas. La barra lateral separa explícitamente las dos naturalezas de las
tarjetas —y esa separación es la clave de tu pregunta:

```
TRABAJO                    MANUAL
  Hoy        #hoy            Fundamento  #fundamento
  Canvas     #canvas         Territorios #territorios
  Auditor    #auditor        Biblioteca  #biblioteca
  Historial  #historial      Visual      #visual
  Reglas     #reglas         Cementerio  #cementerio
                             Números     #numeros
                             Protocolo   #protocolo
                             Fuentes     #fuentes
```

El comentario que justifica ese orden, en el propio código:

> _"The sidebar splits by what the destination is for: the five surfaces used to
> produce a piece, and the manual consulted while producing it. That is the
> order the product itself argues for — decide first, consult second."_

**Las cinco superficies de TRABAJO están siempre abiertas.** Las ocho de MANUAL
están **plegadas por defecto** y cada una tiene un botón que alterna entre
`Ver explicación` y `Ocultar explicación`. Cuando está plegada, ni siquiera se
ve el párrafo de bajada del encabezado. Esa es la decisión de producto central:
_el manual no puede retrasar la primera decisión_.

Al pie de la barra lateral, siempre visible, va el medidor del filtro de
calidad:

- Etiqueta: `FILTRO DE CALIDAD` · contador `{n}/9` · barra de progreso
- Si n = 9: «Las nueve marcadas. Puede pasar a producción.»
- Si no: «Faltan {9-n} para pasar a producción.»

**Cabecera fija** (arriba a la derecha): píldora `Umbral de paso: 70` y botón
`Abrir canvas →`. A la izquierda, el rótulo `Redacción · edición · cuentas`.

### Numeración de los bloques

Cada bloque lleva un código correlativo visible sobre el título:

| Código                    | Bloque                                           | Naturaleza                  |
| ------------------------- | ------------------------------------------------ | --------------------------- |
| `00 / Mesa de producción` | Hoy                                              | **Trabajo**                 |
| _(sin número)_            | Guía rápida de objetivo                          | Mixta (documenta y actúa)   |
| _(sin número)_            | La Ventana / manual de hooks                     | Documentación + gráfico     |
| `01 / Fundamento`         | El estándar de la agencia                        | Documentación               |
| `02 / Preproducción`      | Hook Canvas                                      | **Trabajo**                 |
| `03 / Decisión`           | Elegir territorio antes que fórmula              | Documentación reactiva      |
| `04 / Biblioteca`         | 42 aperturas para adaptar, no copiar             | Documentación + trabajo     |
| `05 / Edición`            | Los primeros segundos en pantalla                | Documentación               |
| `06 / Control previo`     | Auditor de hooks                                 | **Trabajo**                 |
| `07 / Prohibido`          | Cementerio                                       | Documentación               |
| `08 / Medición`           | Números de referencia                            | Documentación + calculadora |
| `09 / Historial`          | La evidencia también se guarda                   | **Trabajo**                 |
| `10 / Reglas`             | El estándar puede hablar el idioma de cada marca | **Trabajo**                 |
| `11 / Operación`          | Protocolo de prueba                              | Documentación               |
| `12 / Fuentes`            | De dónde sale esto                               | Documentación               |

---

## 3. Bloque `00` — Mesa de producción _(trabajo)_

Panel oscuro, ancho completo, borde superior claro. Es lo primero que se ve.

**Rótulo:** `00 / MESA DE PRODUCCIÓN` **Titular:** «Empieza por la pieza, no por
el manual.» **Bajada:**

> «Elige la cuenta y el objetivo de esta entrega. El Canvas abre el flujo de
> escritura; el manual queda disponible para resolver dudas, no para retrasar la
> primera decisión.»

**Dos campos:**

- 🏢 `Cliente de esta entrega` — desplegable. Opciones: `Selecciona una cuenta`,
  la lista de clientes con formato `{nombre} · {sector}`, y
  `＋ Añadir cliente nuevo`. Además, un botón `+` pegado al desplegable, dentro
  de la misma silueta de campo.
- 🎯 `Objetivo de la pieza` — desplegable con `Selecciona un objetivo` y los
  seis objetivos.

**Dos botones:** `✏ Abrir ficha de producción` (lleva al Canvas) y
`+ Nueva pieza` (vacía el formulario, desmarca las nueve comprobaciones y baja
al Canvas).

**Tres contadores clicables a la derecha** (cada uno es un botón que salta a su
sección):

| Rótulo         | Cifra                                                             | Pie                                                                |
| -------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| `PENDIENTES`   | nº de fichas sin resultado                                        | «fichas sin resultado real»                                        |
| `BORRADORES`   | nº de fichas en estado _draft_                                    | «para retomar o revisar»                                           |
| `REGLA ACTIVA` | nombre de la regla, o «Estándar de agencia», o «Elige un cliente» | `{cliente} · {sector}` o «La regla aparece al seleccionar cuenta.» |

Sin sesión iniciada las cifras muestran `—`.

---

## 4. Guía rápida de objetivo _(mixta, plegable)_

Tarjeta blanca. Está **plegada** por defecto; botón `Ver guía` / `Ocultar guía`.

**Rótulo:** `GUÍA RÁPIDA DE OBJETIVO` **Titular:** «Elige por el resultado, no
por el formato.» **Regla práctica** (siempre visible, junto al botón):

> **Regla práctica:** Comunidad construye relación; Consideración facilita una
> decisión; Acción pide un paso concreto.

Al desplegar salen **tres tarjetas clicables**. Pulsar una selecciona ese
objetivo en todo el resto de la app. La seleccionada se marca con un anillo y la
etiqueta `Seleccionado ✓`. Cada una lleva un círculo numerado `01`, `02`, `03` y
al pie `Seleccionar este objetivo →`.

**Tarjeta 01 — Comunidad**

- «Quiero que la gente se sienta parte de esta marca.»
- Identificación, conversación y cercanía.
- _Ejemplo de hook:_ «Si también hueles el café antes de abrir la bolsa, esto es
  para ti.»

**Tarjeta 02 — Consideración**

- «Quiero ayudar a alguien a decidir si esto le conviene.»
- Dudas resueltas, opciones comparadas y menos incertidumbre.
- _Ejemplo de hook:_ «La comparación que hacemos antes de recomendar una silla
  ergonómica.»

**Tarjeta 03 — Acción**

- «Quiero que la persona dé el siguiente paso ahora.»
- Una visita, consulta, compra, descarga o formulario.
- _Ejemplo de hook:_ «Así empieza una cocina a medida: primero resolvemos esto.»

> Nota: hay **seis** objetivos en el sistema (Alcance, Guardados, Compartidos,
> Comunidad, Consideración, Acción) pero esta guía solo explica tres —los tres
> que cuesta distinguir. Los otros tres se eligen directamente en el
> desplegable.

---

## 5. La Ventana _(documentación + gráfico)_

Banda granate a ancho completo con arcos decorativos. Plegada por defecto; botón
`Ver introducción` / `Ocultar introducción`.

**Rótulo:** `LA VENTANA / MANUAL DE HOOKS` **Titular:** «Un hook es una decisión
completa.» **Texto al desplegar:**

> «Guion, primer fotograma, Insert-Titulo, prueba y montaje trabajan en la misma
> ventana de atención. Este manual reúne el proceso para producirlos y el
> criterio para revisarlos.»

### Gráfico: Mapa de retención · 0–3 s

Es un **SVG dibujado a mano, no una librería de gráficos**, y es importante
conservarlo tal cual porque es la única pieza visual conceptual de la app.

- Cabecera del gráfico: `MAPA DE RETENCIÓN · 0–3 S`
- Advertencia debajo: «Lectura de estructura; no representa datos reales.»
- Píldora arriba a la derecha: `FOCO: 1.er segundo`

**Especificación exacta del SVG** (`viewBox="0 0 360 166"`, `role="img"`,
`aria-label="Curva conceptual de retención con hitos de apertura"`):

```svg
<defs>
  <linearGradient id="retentionFill" x1="0" x2="0" y1="0" y2="1">
    <stop offset="0" stop-color="#8fa8ba" stop-opacity=".55"/>
    <stop offset="1" stop-color="#8fa8ba" stop-opacity="0"/>
  </linearGradient>
</defs>

<!-- Relleno bajo la curva -->
<path d="M22 28 C54 30 73 38 102 64 S158 91 193 101 S260 116 338 129 L338 142 L22 142 Z"
      fill="url(#retentionFill)"/>

<!-- La curva -->
<path d="M22 28 C54 30 73 38 102 64 S158 91 193 101 S260 116 338 129"
      fill="none" stroke="#d7e8ef" stroke-width="4" stroke-linecap="round"/>

<!-- Eje inferior -->
<line x1="22" y1="142" x2="338" y2="142" stroke="#ffffff" stroke-opacity=".25"/>

<!-- Dos guías verticales punteadas en los hitos -->
<line x1="102" y1="48" x2="102" y2="142" stroke="#8fa8ba" stroke-dasharray="4 5"/>
<line x1="193" y1="78" x2="193" y2="142" stroke="#8fa8ba" stroke-dasharray="4 5"/>

<!-- Tres puntos sobre la curva -->
<circle cx="22"  cy="28"  r="5" fill="#ffffff"/>
<circle cx="102" cy="64"  r="5" fill="#8fa8ba"/>
<circle cx="193" cy="101" r="5" fill="#8fa8ba"/>

<!-- Etiquetas -->
<text x="22"  y="160" fill="#c8d8e1" font-size="11">0,0 s · escena</text>
<text x="77"  y="45"  fill="#d7e8ef" font-size="11">0,7 s · Insert-Titulo</text>
<text x="175" y="76"  fill="#d7e8ef" font-size="11">1,7 s · prueba</text>
<text x="280" y="160" fill="#c8d8e1" font-size="11">3,0 s · valor</text>
```

**Tres cajitas debajo del gráfico:**

|                   |                           |
| ----------------- | ------------------------- |
| **Escena**        | Orientar sin explicación. |
| **Insert-Titulo** | Nombrar el núcleo.        |
| **Prueba**        | Confirmar la promesa.     |

---

## 6. Bloque `01` — Fundamento _(documentación, plegable)_

**Rótulo:** `01 / FUNDAMENTO` · **Titular:** «El estándar de la agencia»
**Bajada:**

> «Un hook abre atención cuando nombra una tensión real y gana confianza cuando
> entrega una respuesta concreta. Esta es la secuencia para revisar la apertura
> antes de producir.»

### 6.1 Tres tarjetas de fundamento

Tarjetas blancas con filete superior azul. Texto **literal y completo**:

**`01 / CAPTAR ATENCIÓN` — «La retención es el primer filtro.»**

> Un hook no garantiza el éxito por sí mismo, pero consigue que la audiencia se
> quede el tiempo suficiente para recibir el valor del contenido.

**`02 / GENERAR COMPARTIDOS` — «Compartir confirma que la pieza importa.»**

> Retener no basta: cuando alguien piensa «esto le puede servir a otra persona»,
> el contenido gana alcance y relevancia.

**`03 / DAR CONTEXTO` — «La decisión empieza antes de escuchar.»**

> El primer plano, el Insert-Titulo y la primera línea deben dejar claro de
> inmediato qué está ocurriendo y por qué vale la pena seguir viendo.

### 6.2 Cinco principios

Panel blanco. Rótulo `CINCO PRINCIPIOS`, titular «De la intención a la señal.»,
y a la derecha: «Úsalos como control, no como fórmula.»

Cada principio es una tarjeta gris con tres líneas: nombre, pregunta y señal. La
quinta ocupa dos columnas.

| Principio      | Pregunta                                 | Señal                                   |
| -------------- | ---------------------------------------- | --------------------------------------- |
| **Relevancia** | ¿Para quién es y qué vive ahora?         | Señal: Esto me pasa.                    |
| **Claridad**   | ¿Qué verá o resolverá esta pieza?        | Señal: Se entiende en una lectura.      |
| **Evidencia**  | ¿Qué prueba real aparecerá en pantalla?  | Señal: Hay demostración o resultado.    |
| **Voz propia** | ¿Podría decirlo cualquier otra marca?    | Señal: La escena es de este cliente.    |
| **Recompensa** | ¿Cuándo llega la primera señal de valor? | Señal: Ocurre antes del segundo cuatro. |

### 6.3 Las tres capas

Panel azul marino a la derecha. Rótulo `LAS TRES CAPAS`, titular «Cada una debe
sostener la promesa.»

- **01 · Visual** — La imagen orienta incluso cuando el sonido está apagado.
- **02 · Insert-Titulo** — Condensa el núcleo en seis palabras o menos, sin
  transcribir la voz.
- **03 · Voz** — Declara la promesa sin saludo, contexto sobrante ni
  presentación.

Y una caja destacada al pie:

> **Test de las dos privaciones.** Mira la pieza sin sonido y escúchala sin
> mirar pantalla. Cada capa debe explicar de qué va y dar motivo para seguir.

---

## 7. Bloque `02` — Hook Canvas _(trabajo — el corazón)_

**Rótulo:** `02 / PREPRODUCCIÓN` · **Titular:** «Hook Canvas» **Bajada:**

> «Completa la decisión antes de redactar. Al final genera una ficha que edición
> puede ejecutar sin interpretar la idea.»

Dos columnas: el formulario a la izquierda, la **ficha de producción en vivo** a
la derecha (pegajosa al hacer scroll, porque el formulario es mucho más alto).

### 7.1 Contexto — seis campos

Cada campo tiene una etiqueta a la izquierda y una **pista a la derecha** en
gris pequeño. La pista es parte del diseño y hay que conservarla.

| Campo               | Pista                             | Control                 | Placeholder                                           |
| ------------------- | --------------------------------- | ----------------------- | ----------------------------------------------------- |
| Cliente             | «Necesario para guardar.»         | desplegable + botón `+` | «Selecciona un cliente»                               |
| Objetivo            | «Métrica: {métrica del objetivo}» | desplegable             | «Elegir…»                                             |
| Audiencia y momento | «Persona concreta y contexto.»    | textarea                | «Piel sensible, comparando rutinas»                   |
| Tensión o deseo     | «La decisión o fricción.»         | textarea                | «Quiero una rutina simple sin probar diez productos.» |
| Verdad de marca     | «Una convicción demostrable.»     | textarea                | «Fórmula sin fragancia con ingredientes mínimos.»     |
| Prueba disponible   | «Sin prueba hay eslogan.»         | textarea                | «Textura, aplicación, resultado, proceso…»            |

### 7.2 Apertura y pago — seis campos

Separador con icono de bocadillo y este encabezado:

**Apertura y pago**

> Las capas se revisan como una decisión, no como campos aislados.

| Campo                    | Pista                             | Control                      | Placeholder                                                    |
| ------------------------ | --------------------------------- | ---------------------------- | -------------------------------------------------------------- |
| Hook hablado             | `{n}/12 palabras` (contador vivo) | textarea grande              | «Tres pasos en vez de diez, para piel que se irrita con todo.» |
| Insert-Titulo            | `{n}/6 palabras` (contador vivo)  | input + **previsualización** | «Tres pasos, no diez»                                          |
| Primer fotograma         | «Debe comunicar en silencio.»     | input                        | «Tocador lleno que se reduce a tres productos»                 |
| Pago de la promesa       | «Primera señal de valor.»         | input                        | «Segundo 4: los tres pasos y para qué sirve cada uno»          |
| CTA congruente           | «Proporcional al valor.»          | input                        | «Guárdalo para revisar tu rutina esta noche»                   |
| Riesgo o claim a validar | «No sale sin visto bueno.»        | input                        | «Validar una comparación o claim de salud»                     |

**Previsualización «Vista en mudo»:** debajo del campo Insert-Titulo hay una
caja oscura con el rótulo `VISTA EN MUDO` y, en grande, el texto que se está
escribiendo. Cuando está vacío pone: «El núcleo aparece aquí.» Es la forma de
recordar que el Insert-Titulo tiene que funcionar solo.

### 7.3 Barra de acciones

`⚡ Ir al auditor` · `↺ Vaciar canvas` · `⧉ Copiar ficha` · `▤ CSV` · `▤ PDF`

- **CSV**: una fila por línea de la ficha, entrecomillado, descarga con nombre
  `ficha-copy-AAAA-MM-DD.csv`.
- **PDF**: abre una ventana emergente de 820×900 con la ficha en monoespaciada y
  dispara `window.print()`. Si el navegador bloquea la ventana: «Permite
  ventanas emergentes para exportar PDF.»
- **Copiar ficha**: al portapapeles. «Ficha copiada al portapapeles.» / «No se
  pudo copiar la ficha.»

### 7.4 La ficha de producción (columna derecha)

Rótulo `FICHA PARA EDICIÓN`. Se regenera en cada pulsación de tecla. **Cada
línea se recorta con puntos suspensivos** (no se envuelve) para que la tarjeta
no crezca con lo que se escriba; el texto completo va en el `title` y en un
modal.

Debajo: botón `✔ Guardar en historial` y enlace `⤢ Ver ficha completa`, que abre
un modal titulado **«Ficha de producción»** con la descripción:

> «El texto completo, sin recortes. Cópialo tal cual para edición.»

**Formato exacto de la ficha.** Las etiquetas se rellenan con espacios hasta 23
caracteres; un campo vacío imprime `—`:

```
FICHA DE PRODUCCIÓN — HOOK
───────────────────────────────────────

OBJETIVO:              {objetivo}
MÉTRICA PRINCIPAL:     {métrica derivada del objetivo}
PLATAFORMA:            {plataforma}
AUDIENCIA Y MOMENTO:   {audiencia}

TENSIÓN O DESEO:       {tensión}
VERDAD DE MARCA:       {verdad}
PRUEBA DISPONIBLE:     {prueba}

── APERTURA ──────────────────────────

HOOK HABLADO:          {hablado} [{n} palabras]
INSERT-TITULO:         {insert} [{n} palabras]
PRIMER FOTOGRAMA:      {fotograma}
PAGO DE PROMESA:       {pago}
CTA:                   {cta}

── CONTROL ───────────────────────────

RIESGO / CLAIM:        {riesgo}
AUDITOR:               {score}/100 · APROBADO|REESCRIBIR   (o "Pendiente de auditar")
```

**Guardado:** exige cliente. Si no lo hay: «Selecciona o añade un cliente antes
de guardar.» y se abre el modal de alta rápida. Al guardar: «Ficha guardada en
el historial.» El objetivo, si está vacío, se guarda como `Guardados`, y el
score como `0` si no se ha auditado. Estado inicial: `draft`.

---

## 8. Bloque `03` — Territorios _(documentación reactiva)_

**Rótulo:** `03 / DECISIÓN` · **Titular:** «Elegir territorio antes que fórmula»
**Bajada:** «El objetivo selecciona una intención y una evidencia. La frase
llega después.»

Es **la única tarjeta de manual que reacciona al trabajo**: lee el objetivo
elegido en el Canvas y muestra qué implica.

Panel granate a la izquierda:

- Rótulo `OBJETIVO SELECCIONADO`
- Titular: el objetivo, o «Elige un objetivo en el Canvas»
- Párrafo: la nota del objetivo

Tres mini-tarjetas a la derecha: `TERRITORIO`, `MEJOR EVIDENCIA`,
`MÉTRICA DE TEST`.

### Tabla completa objetivo → territorio, métrica, evidencia y nota

| Objetivo          | Territorio                              | Métrica principal       | Mejor evidencia                                                  | Nota                                                                         |
| ----------------- | --------------------------------------- | ----------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Alcance**       | A · Curiosidad útil + G · Contradicción | Retención a 3 s         | Comparación, detalle inesperado, dato propio.                    | Sin conflicto ni hueco de información no hay motivo para parar.              |
| **Guardados**     | E · Guía guardable + B · Demostración   | Guardados por alcance   | Checklist, proceso claro, demostración por etapas.               | El Insert-Titulo debe funcionar si alguien pausa.                            |
| **Compartidos**   | D · Identidad + G · Contradicción       | Compartidos por alcance | Situación reconocible, tesis defendible o contraste compartible. | La audiencia comparte lo que le ayuda a nombrar algo o a abrir conversación. |
| **Comunidad**     | D · Identidad + C · Historia y oficio   | Comentarios por alcance | Voz humana, situación reconocible, comentario real.              | Cuanto más estrecha la identidad, más fuerte el efecto.                      |
| **Consideración** | F · Objeciones + B · Demostración       | Clics por alcance       | Producto en contexto, antes y después, explicación honesta.      | Decir para quién no es también convierte.                                    |
| **Acción**        | F · Objeciones + B · Demostración       | Coste por resultado     | Uso real, beneficio explicado y CTA.                             | Todo claim pasa por validación antes de publicar.                            |

> Si el objetivo está vacío o no reconocido, **cae por defecto en «Guardados»**.

---

## 9. Bloque `04` — Biblioteca _(documentación + trabajo)_

**Rótulo:** `04 / BIBLIOTECA` · **Titular:** «42 aperturas para adaptar, no
copiar» **Bajada:**

> «El territorio define la intención; el mecanismo define cómo se demuestra.
> Filtra ambos y utiliza los corchetes para adaptar la fórmula a la verdad del
> cliente.»

Contiene **dos cosas distintas**, separadas por una línea.

### 9.1 Referencias de tendencia _(trabajo — banco propio del equipo)_

Panel azul claro dentro de la biblioteca.

**Rótulo:** `REFERENCIAS DE TENDENCIA` **Titular:** «Guarda lo que vale la pena
adaptar.» **Bajada:**

> «Registra un hook observado y el motivo por el que funciona. Se conserva como
> referencia del equipo, no como texto para copiar.»

**Formulario de alta:**

| Campo            | Pista                               | Placeholder                                                           |
| ---------------- | ----------------------------------- | --------------------------------------------------------------------- |
| Hook observado   | «La apertura que quieres conservar» | «La frase, pregunta o escena de apertura…»                            |
| Por qué funciona | «Tensión, prueba o montaje»         | «Ej.: abre con contraste y muestra la prueba antes del segundo tres.» |
| Insert-Titulo    | «Opcional»                          | «El núcleo breve que aparece en pantalla»                             |
| Plataforma       | «Origen»                            | TikTok · Instagram Reels · YouTube Shorts · Otra                      |
| Territorio       | «Intención»                         | los siete territorios                                                 |
| Fuente           | «Enlace opcional»                   | «https://…»                                                           |
| Etiquetas        | «Separadas por comas»               | «antes/después, precio, tutorial»                                     |

Botón `+ Guardar referencia` y, al lado, esta advertencia permanente:

> «Conserva el mecanismo, pero reescribe las palabras para cada cliente.»

**Validación:** exige hook («Escribe el hook observado.») y motivo («Explica por
qué funciona esta referencia.»). Al guardar: «Referencia de tendencia guardada.»

**Listado — `BANCO DEL EQUIPO · {n} referencias`.** Filtros de plataforma
(«Todas las plataformas») y territorio («Todos los territorios»), más un
buscador: «Buscar por hook, etiqueta, plataforma o aprendizaje…» —busca a la vez
en hook, Insert-Titulo, lectura, etiquetas, plataforma y territorio.

Cada referencia se muestra como: plataforma · territorio, el hook
entrecomillado, la píldora oscura con el Insert-Titulo, «**Lectura:** {motivo}»,
las etiquetas con almohadilla, el enlace `Abrir fuente`, y un botón
`Usar como punto de partida →` que **vuelca el hook y el Insert-Titulo en el
Canvas** y sube hasta allí.

Vacío: «Aún no hay referencias guardadas. Añade un hook que esté funcionando y
registra qué mecanismo vale la pena adaptar.»

### 9.2 Las 42 aperturas _(documentación filtrable)_

**Filtro de territorio.** Rótulo `TERRITORIO · ELIGE UNO`, píldoras: `Todos`, y
luego:

|       |                   |
| ----- | ----------------- |
| **A** | Curiosidad útil   |
| **B** | Demostración      |
| **C** | Historia y oficio |
| **D** | Identidad         |
| **E** | Guía guardable    |
| **F** | Objeciones        |
| **G** | Contradicción     |

**Filtro de mecanismo.** Rótulo `MECANISMO · PUEDE HABER VARIOS`, píldoras:
`Cualquiera`, Comparación, Número, Pregunta, Dato, Prueba visual, Antes /
después, Coste, Persona.

**Buscador:** «Buscar proceso, precio, silla…» —busca en plantilla, ejemplo,
Insert-Titulo, dirección de edición y «úsalo cuando». Debajo, el contador:
`{n} apertura` / `{n} aperturas`.

**Anatomía de cada tarjeta de apertura** (filete azul a la izquierda, dos
columnas):

- _Columna izquierda:_ la línea `{Letra} · {Territorio}` seguida de las píldoras
  de mecanismo; la **plantilla** en grande —con los `[corchetes]` **resaltados
  sobre fondo azul claro**, que es lo que hay que sustituir—; el rótulo
  `EJEMPLO HABLADO` y el ejemplo entre comillas tipográficas; y la píldora
  oscura con el Insert-Titulo.
- _Columna derecha_ (caja azul): `DIRECCIÓN PARA EDICIÓN`, el texto;
  `ÚSALO CUANDO`, el texto; y el botón `Usar como punto de partida →`, que
  **copia ejemplo e Insert-Titulo al Canvas** y sube.

El contenido íntegro de las 42 está en el **anexo A** al final de este
documento.

---

## 10. Bloque `05` — Visual _(documentación)_

**Rótulo:** `05 / EDICIÓN` · **Titular:** «Los primeros segundos en pantalla»
**Bajada:**

> «La edición hace legible la idea; no compite con ella. El primer fotograma
> debe comunicar incluso con el sonido apagado.»

### Tabla «Diez patrones visuales»

| Patrón                   | Aplicación                                                  |
| ------------------------ | ----------------------------------------------------------- |
| Antes / después          | Mismo ángulo de cámara en ambos estados.                    |
| Pantalla dividida        | Dos métodos o productos en paralelo desde el fotograma uno. |
| Macro o detalle          | Textura, costura, ingrediente, cifra o gesto.               |
| Mano en acción           | Preparar, ajustar, mezclar, reparar o probar.               |
| Objeto fuera de contexto | Situación inesperada pero relevante.                        |
| Pregunta física          | Tarjeta, pizarra, comentario o búsqueda visible.            |
| Dato visual              | Cifra señalada sobre documento o pantalla real.             |
| Reacción primero         | Persona ve el resultado antes de la explicación.            |
| Tres pasos               | Texto breve por etapa y demostración.                       |
| Sonido táctil            | Corte, hervor, papel o herramienta como apoyo.              |

### Tabla «Reloj de la apertura»

| Momento | Función                              |
| ------- | ------------------------------------ |
| 0–1 s   | Orientar con imagen e Insert-Titulo. |
| 1–4 s   | Confirmar prueba o escena relevante. |
| 4–12 s  | Explicar, comparar o demostrar.      |
| Cierre  | Conclusión y CTA proporcional.       |

### Ajuste por plataforma _(reactivo)_

Caja oscura al pie. Rótulo: `AJUSTE POR PLATAFORMA · {plataforma elegida}`. El
texto cambia según la plataforma:

- **Instagram Reels** — «El Insert-Titulo y el primer fotograma cargan con el
  peso. Se pueden subir Reels de hasta 20 minutos, pero los de más de 3 minutos
  no se recomiendan a audiencias nuevas; para descubrimiento, 3 minutos es el
  techo real.»
- **TikTok** — «El sonido suele estar activado: usa un efecto o una entonación
  rota como interruptor de patrón y respeta márgenes de seguridad.»
- **YouTube Shorts** — «La decisión es aún más rápida y refleja. Optimiza el
  fotograma uno, no los tres segundos.»
- **Anuncio vertical** — «Se juzga con hook rate a los 2 o 3 segundos según
  plataforma. El ciclo de refresco es de una a dos semanas.»

---

## 11. Bloque `06` — Auditor de hooks _(trabajo — la pieza más valiosa)_

**Rótulo:** `06 / CONTROL PREVIO` · **Titular:** «Auditor de hooks» **Bajada:**
«Aplica nueve controles conocidos antes de grabar. Umbral de paso visible:
70/100.»

**Aviso rojo, siempre visible, antes de cualquier cosa** —conservarlo es una
decisión ética del producto, no adorno:

> **Esta puntuación todavía no está validada.** Los controles salen de
> investigación disponible y criterio de la casa, no de un modelo contrastado
> contra resultados. Úsala como lista de comprobación, no como oráculo.

**Formulario:**

- `Hook hablado` — pista: «{n} palabras · mínimo 4, recomendado 7–12».
  Placeholder: «Pega o escribe el hook que quieres revisar.»
- `Insert-Titulo (opcional)` — pista: «{n} palabras · máximo 6». Placeholder:
  «El núcleo de la promesa»
- Botones: `Auditar hook` y `Limpiar`.

Los campos son **los mismos** que en el Canvas: editar aquí edita allí. Y
**cualquier cambio en el hablado, el Insert-Titulo o la prueba invalida la
auditoría** (vuelve a estado no auditado).

### 11.1 Panel de resultado

**Antes de auditar** (estado neutro, panel oscuro):

- Rótulo `RESULTADO NEUTRAL`
- Titular: «Audita cuando tengas una promesa.»
- «El score y el veredicto aparecen solo después de pulsar «Auditar hook».
  Umbral de paso: 70.»

**Después de auditar:**

- Rótulo `RESULTADO · UMBRAL 70`
- Un **círculo con la nota** (borde azul si pasa, rojo si no) y una **barra de
  progreso** al `{score}%`, del mismo color.
- **Titular según tramo:**

| Nota  | Veredicto                     |
| ----- | ----------------------------- |
| ≥ 85  | «Listo para grabar»           |
| 70–84 | «Aprobado · pule avisos»      |
| 50–69 | «Reescribir antes de grabar»  |
| < 50  | «Descartar y empezar de cero» |

- Si la regla del cliente amplía los límites, aparece un aviso:
  > **Esta cuenta usa un límite ampliado.** «{regla}» permite voz ≤ {n} e
  > Insert-Titulo ≤ {n}; el estándar de agencia es 12/6.

- Y debajo, **la lista de controles**, cada uno con su símbolo (`✓`
  verde-neutro, `!` aviso, `×` fallo), su título —al que se le añade
  `· fallo duro` si lo es— y su explicación.

### 11.2 El algoritmo, exacto

Entrada: `hablado`, `insertTitulo`, `prueba`, y opcionalmente una `regla` de
cliente. La nota parte de 0 y suma. **Máximo 100.**

**Cortocircuito.** Si el hablado está vacío: nota `0`, un único control
`Campo vacío` (fallo duro): «Escribe el hook hablado antes de auditar.»

**Parámetros configurables por regla** (valores por defecto entre paréntesis):
`maxSpokenWords` (12), `maxOverlayWords` (6), `requireProof`, y tres listas de
términos que se **suman** a las de la casa.

| # | Control                    | Condición                           | Puntos  | Estado         |
| - | -------------------------- | ----------------------------------- | ------- | -------------- |
| 0 | **Demasiado corto**        | < 4 palabras                        | —       | **fallo duro** |
| 1 | **Longitud del hablado**   | ≤ máx (12)                          | **+16** | pass           |
|   |                            | ≤ máx+4 (16)                        | +10     | warn           |
|   |                            | ≤ máx+10 (22)                       | +4      | fail           |
|   |                            | más                                 | 0       | fail           |
| 2 | **Insert-Titulo**          | vacío                               | +4      | warn           |
|   |                            | idéntico al hablado                 | —       | **fallo duro** |
|   |                            | ≤ máx (6) palabras                  | **+12** | pass           |
|   |                            | más                                 | +4      | fail           |
| 3 | **Preámbulo**              | contiene un preámbulo               | —       | **fallo duro** |
|   |                            | ninguno                             | **+14** | pass           |
| 4 | **Fórmula del cementerio** | contiene una fórmula quemada        | —       | **fallo duro** |
|   |                            | ninguna                             | **+12** | pass           |
| 5 | **Especificidad**          | hay cifra y ninguna palabra vaga    | **+14** | pass           |
|   |                            | hay cifra pero también palabra vaga | +8      | warn           |
|   |                            | palabra vaga sin cifra              | 0       | fail           |
|   |                            | ni cifra ni palabra vaga            | +6      | warn           |
| 6 | **Tensión**                | contiene un término de tensión      | **+13** | pass           |
|   |                            | ninguno                             | 0       | fail           |
| 7 | **Dirección**              | apela en segunda persona            | **+9**  | pass           |
|   |                            | no apela                            | +3      | warn           |
| 8 | **Promesa**                | detecta sobrepromesa                | —       | **fallo duro** |
|   |                            | limpia                              | **+10** | pass           |
| 9 | **Prueba declarada**       | la regla la exige y está vacía      | —       | **fallo duro** |

**Tope máximo posible sumando todo:** 16+12+14+12+14+13+9+10 = **100**.

**Regla de los fallos duros —la clave del sistema:**

```
si hay algún fallo duro:
    nota = mín(nota, 69)          // nunca puede aprobar
    salvo si tiene menos de 4 palabras:
    nota = mín(nota, 25)
```

**Aprueba si `nota ≥ 70`.**

### 11.3 Los mensajes exactos de cada control

**Demasiado corto** (duro)

> «{n} palabra/palabras. Por debajo de 4 no hay promesa que evaluar, solo un
> fragmento.»

**Longitud del hablado**

- ✓ «{n} palabras. Dentro del rango de 7 a {máx} calibrado para castellano.»
- ! «{n} palabras. En el límite. Intenta bajar de {máx}.»
- × «{n} palabras. Se sale de la ventana. Corta la subordinada y quédate con la
  afirmación.»
- × «{n} palabras. Esto es el primer párrafo del guion, no un hook. Recorta a la
  mitad.»

**Insert-Titulo**

- ! «No has escrito Insert-Titulo. En Reels buena parte del consumo es en
  silencio: sin Insert-Titulo dependes del audio.»
- × (duro) «El Insert-Titulo es idéntico al hablado. Escribe solo el núcleo.»
- ✓ «{n} palabras. Entra completo en el fotograma uno y funciona en mudo.»
- × «{n} palabras. Pasa de {máx} y ocupará dos líneas. Reduce al núcleo.»

**Preámbulo detectado** (duro)

> «Empiezas con «{término}». Borra la primera frase entera y avísalo antes de
> rodar.»

**Sin preámbulo** ✓ → «La primera palabra ya trabaja.»

**Fórmula del cementerio** (duro)

> «Contiene «{término}». La audiencia lo reconoce como plantilla y acelera el
> scroll.»

**Sin fórmulas quemadas** ✓ → «No detecto recursos del cementerio.»

**Especificidad**

- ✓ «Hay cifra concreta y ninguna palabra vacía. Esto da credibilidad.»
- ! «Tienes cifra, pero también «{término}». Sustitúyela por el sustantivo
  real.»
- × ««{término}» no dice nada. Cámbialo por el sustantivo exacto o por un
  número.»
- ! «No hay cifra. No es obligatorio, pero una cifra concreta sube la
  credibilidad.»

**Tensión**

- ✓ «Hay conflicto, negación o hueco de información. El espectador tiene algo
  que resolver.»
- × «No detecto contradicción, hueco ni coste. Prueba el territorio G.»

**Dirección**

- ✓ «Hablas a alguien concreto. Filtrar audiencia sube la retención media.»
- ! «No apelas al espectador. Vale si el territorio es demostración o historia;
  en el resto, señálalo.»

**Promesa**

- × (duro) «Suena a sobrepromesa. Si el vídeo no la cumple, la salida temprana
  cuenta como señal negativa y es un riesgo de cliente.»
- ✓ «No detecto exageración. La promesa parece cumplible en el cuerpo del
  vídeo.»

**Prueba declarada** (duro)

> «La regla activa exige una prueba visible antes de producir. Declárala en el
> Canvas o desactiva la exigencia en Reglas.»

### 11.4 Las listas de detección, completas

Todo se compara **en minúsculas** y por **coincidencia de subcadena**
(`includes`), no por palabra completa —por eso hay raíces truncadas como
`equivoc` o `hundi`.

**PREÁMBULOS** (fallo duro)

```
hola · holaa · buenas · chicos · chicas · gente · bienvenid · muy buenas ·
hoy os voy · hoy te voy · hoy vamos · en este video · en este vídeo ·
antes de empezar · como estan · cómo estáis · qué tal · que tal · os habla ·
os traigo · en el vídeo de hoy
```

**FÓRMULAS QUEMADAS / CEMENTERIO** (fallo duro)

```
espera al final · espérate al final · no vas a creer · no te vas a creer ·
te va a volar la cabeza · esto lo cambia todo · parte 1 · storytime ·
story time · sigue leyendo · mira hasta el final · increíble · increible ·
impresionante · esto es oro · el secreto que nadie
```

**PALABRAS VAGAS** (penalizan especificidad)

```
cosas · algo · mucho · muchos · muchas · varias · varios · mejores ·
tips · trucos · consejos
```

**TÉRMINOS DE TENSIÓN** (suman)

```
por qué · porque · porqué · razón · razon · error · equivoc · deja de ·
dejamos de · dejé de · antes de · nadie · nunca · ningún · ninguna ·
esto es lo que · en realidad · "sin " · no es · no son · no depende ·
no funciona · ya no · falla · fall · perdí · perdi · cuesta · cost ·
frena · fren · hundi · hunde · arruin · mata · empeor · en vez de ·
en lugar de · "pero " · aunque
```

**SEGUNDA PERSONA / DIRECCIÓN** (suman)

```
"tu " · "tus " · "te " · "ti " · tú · contigo · vos · usted · tuyo · tuya ·
si eres · si tienes · si llevas · si haces · si estás
```

**SOBREPROMESA** — expresión regular, fallo duro:

```regex
/(garantizad|100 ?%|siempre funciona|nunca falla|en 24 horas|de la noche a la mañana|millonari|resultados asegurados)/
```

**Detección de cifra:** `/\d/` sobre el texto original.

### 11.5 Filtro de calidad — las nueve comprobaciones _(trabajo)_

Panel blanco debajo del auditor. Es una **lista manual de nueve casillas**,
independiente del algoritmo. El contador aparece también en la barra lateral.

- Rótulo: `FILTRO DE CALIDAD ANTES DE PRODUCIR`
- Titular: «{n} de 9 comprobaciones»
- Veredicto a la derecha, en verde o rojo:
  - «Las nueve marcadas. Puede pasar a producción.»
  - «Faltan {9-n}. La pieza no sale a producción.»

**Las nueve, literales:**

1. La audiencia está definida con un momento o necesidad concreta.
2. La promesa se comprende de inmediato.
3. El contenido puede demostrar lo que el hook promete.
4. El primer fotograma aporta algo por sí mismo, en silencio.
5. La primera señal de valor aparece antes del segundo cuatro.
6. El Insert-Titulo tiene seis palabras o menos y no es transcripción.
7. El tono refleja a este cliente y no una plantilla general.
8. El CTA corresponde al nivel de confianza de la audiencia.
9. Los claims tienen validación de cliente, legal o especialista cuando aplica.

---

## 12. Bloque `07` — Cementerio _(documentación)_

**Rótulo:** `07 / PROHIBIDO` · **Titular:** «Cementerio» **Bajada:** «La primera
lista no admite excepción. La segunda exige una justificación escrita en la
ficha de producción.»

Dos tarjetas enfrentadas. La primera es **oscura**, la segunda blanca —la
jerarquía visual comunica el nivel de prohibición.

### Tarjeta oscura — rótulo `NO ADMITE EXCEPCIÓN` — «Prohibido sin excepción»

| Recurso                         | Por qué                                             |
| ------------------------------- | --------------------------------------------------- |
| «Hola chicos, bienvenidos»      | Retrasa el valor. Primera palabra = primera idea.   |
| «Insert-Titulo letra a letra»   | Consume la ventana antes de comunicar nada.         |
| «Insert-Titulo = transcripción» | El Insert-Titulo lleva el núcleo; la voz, la frase. |
| «Prometer más de lo que das»    | Promete exactamente lo que entregarás.              |

### Tarjeta blanca — rótulo `JUSTIFICACIÓN ESCRITA` — «Permitido solo con justificación»

| Recurso                 | Condición                                             |
| ----------------------- | ----------------------------------------------------- |
| «Espera al final»       | Solo si el final está insinuado y la espera es corta. |
| «No vas a creer»        | Nombra qué pasó y oculta el porqué.                   |
| «Corte rápido genérico» | Cada corte debe revelar contraste o prueba.           |
| «Repetir hook ganador»  | Repite mecanismo, no palabras.                        |
| «Producto en caja»      | Abre con uso, manos o problema.                       |
| «Marca de agua ajena»   | Reexporta limpio y readapta.                          |

---

## 13. Bloque `08` — Números de referencia _(documentación + calculadora)_

**Rótulo:** `08 / MEDICIÓN` · **Titular:** «Números de referencia» **Bajada:**
«Un hook no se discute en reunión, se lee en una métrica. Estas bandas son un
punto de partida, no una verdad de plataforma.»

### Tabla «Bandas orientativas»

| Métrica               | Banda sana                              | Lectura                                                    |
| --------------------- | --------------------------------------- | ---------------------------------------------------------- |
| Hook rate · Meta      | 25–30% base · 35–45% élite · <15% matar | Por debajo de 20%, cambia la apertura.                     |
| Hook rate · TikTok    | 30–40%                                  | La ventana de conteo es distinta: no compares plataformas. |
| Hold rate             | ≈25% o más                              | Buen hook y hold bajo: problema de cuerpo.                 |
| Retención 3s orgánica | 35–40% o más                            | Léela junto a la curva.                                    |
| Volumen mínimo        | 2.000 imp. / estable 5–10k              | Antes es ruido, no veredicto.                              |

**Aviso rojo debajo:**

> **Aviso sobre estas cifras.** Ninguna plataforma publica umbrales oficiales de
> hook rate. Las bandas provienen de proveedores de analítica con sesgo de
> cartera; después del primer mes, la referencia útil es el histórico de tu
> cuenta.

### Calculadora de hook rate _(trabajo)_

Caja oscura. Rótulo: `DIAGNÓSTICO DE HOOK RATE · META / TRÁFICO FRÍO`

Dos campos numéricos —`Impresiones` y `Reproducciones 3 s`— y un botón
`Calcular`. Fórmula: `vistas / max(1, impresiones) × 100`, mostrada con un
decimal.

**Veredictos por tramo:**

| Tasa    | Veredicto             | Explicación                                                               |
| ------- | --------------------- | ------------------------------------------------------------------------- |
| < 15 %  | **Matar**             | La apertura no está parando el scroll. Cambia fotograma y primer segundo. |
| 15–20 % | **Arreglar apertura** | Prueba tres aperturas nuevas sobre el mismo cuerpo.                       |
| 20–30 % | **Sano**              | Mira el hold rate: si cae, el problema ya no es el hook.                  |
| 30–35 % | **Bueno**             | Anota territorio y mecanismo: puede ser un estándar del cliente.          |
| ≥ 35 %  | **Élite**             | Genera variantes del mismo territorio antes de que fatigue.               |

**Prefijo condicional:** si las impresiones son menores de 2.000, el texto se
antepone con: «Con menos de 2.000 impresiones, la cifra puede ser ruido. »

Sin datos: la cifra es `—`, el veredicto «Faltan datos» y el texto «Introduce
impresiones y vistas a 3 segundos.»

---

## 14. Bloque `09` — Historial _(trabajo)_

**Rótulo:** `09 / HISTORIAL` · **Titular:** «La evidencia también se guarda»
**Bajada:** «Busca, filtra y registra resultados reales para convertir una ficha
en criterio de cuenta.»

**Filtros:** buscador «Buscar hook, Insert-Titulo, cliente o sector…»,
desplegable de cliente («Todos los clientes») y de estado («Todos los estados» /
Borrador / Publicado / Analizado). Botón `+ Cliente` que despliega un alta
rápida en línea.

**Cada ficha de la lista muestra:** píldora con el nombre del cliente, la
plataforma, el hook hablado, y la línea «Score {n} · {métrica principal}». A la
derecha, una caja con «{n} impresiones» o «Sin resultado», y el enlace
`Registrar →` / `Actualizar →`.

**Panel de resultados reales** (columna derecha, oscura):

- Rótulo `RESULTADOS REALES`
- Titular: «Selecciona una ficha» o, con una elegida, «Registra lo que pasó»
- Advertencia permanente:
  > «La lectura orgánica es direccional; no conviertas pequeñas diferencias en
  > certezas.»
- Seis campos numéricos: `Impresiones`, `Vistas 3 s`, `Guardados`,
  `Compartidos`, `Clics`, `Conversiones`.
- Un textarea: «Aprendizaje de la pieza»
- Botón `Guardar resultados` → «Resultados registrados.»

**Estados vacíos:**

- Sin sesión: «Inicia sesión para construir el historial.» / «Tus fichas,
  clientes y resultados quedarán asociados a tu usuario.» / botón
  `Iniciar sesión`
- Sin fichas: «Aún no hay fichas guardadas.» / «Guarda una ficha desde el Canvas
  para verla aquí y registrar el resultado real.»

### Modal de alta de cliente

Se abre desde cualquier `+` de cliente.

- Rótulo `CLIENTE NUEVO` · Titular «Añádelo sin salir de la ficha.»
- «Al guardarlo se incorpora a la cartera y queda seleccionado para esta
  producción.»
- Campos: `Nombre` («Obligatorio», placeholder «Nombre del cliente») y `Sector`
  («Opcional», placeholder «Por definir»).
- Botones `Cancelar` y `+ Añadir y seleccionar`.
- Sin nombre: «Escribe el nombre del cliente.»
- Si ya existía: se selecciona el existente y avisa «Ese cliente ya existía y
  quedó seleccionado.»
- Al crear: «Cliente añadido y seleccionado.» Sector vacío → se guarda «Por
  definir».

---

## 15. Bloque `10` — Reglas _(trabajo)_

**Rótulo:** `10 / REGLAS` · **Titular:** «El estándar puede hablar el idioma de
cada marca» **Bajada:**

> «Configura límites, preámbulos, fórmulas gastadas y términos de tensión por
> cliente o sector. El estándar de agencia es voz ≤ 12 e Insert-Titulo ≤ 6.»

**Panel izquierdo (granate) — `REGLAS ACTIVAS`.** Cada regla muestra su nombre y
la línea «Voz ≤ {n} · Insert-Titulo ≤ {n} · Prueba requerida|Prueba opcional».
Si supera el estándar aparece la insignia `Límite ampliado` y el texto:

> «Supera el estándar 12/6. El auditor respeta la regla, pero la desviación
> queda visible.»

Sin reglas: «Aún no hay reglas. La auditoría usa el estándar general de la
agencia.»

**Formulario derecho:**

| Campo                 | Pista                           | Valor por defecto                                                               |
| --------------------- | ------------------------------- | ------------------------------------------------------------------------------- |
| Nombre de la regla    | «Ej.: Estándar hospitality»     | vacío                                                                           |
| Cliente (opcional)    | «Tiene prioridad sobre sector.» | «Aplicar por sector»                                                            |
| Sector (opcional)     | «Si no hay regla de cliente.»   | vacío                                                                           |
| Voz                   | «Máximo» (3–30)                 | 12                                                                              |
| Insert-Titulo         | «Máximo» (2–16)                 | 6                                                                               |
| Preámbulos a detectar | «Separados por coma»            | `hola, buenas, chicos, chicas, bienvenid, gente, qué tal, os traigo, hoy vamos` |
| Fórmulas gastadas     | «Separadas por coma»            | `espera al final, no vas a creer, esto lo cambia todo, secreto`                 |
| Términos de tensión   | «Separados por coma»            | `error, deja de, no es, falla, frena, hundi, cuesta, pero`                      |
| Exigir prueba visible | casilla                         | activada                                                                        |

Texto de la casilla:

> **Exigir prueba visible** — «La auditoría marcará la pieza si el hook promete
> algo que no se demuestra en pantalla.»

Si se suben los límites por encima de 12/6, aparece en vivo:

> **Esta cuenta usa un límite ampliado.** La agencia trabaja por defecto con voz
> ≤ 12 e Insert-Titulo ≤ 6. La regla se respetará, pero quedará identificada en
> la revisión.

Botón `Guardar regla` → «Regla personalizada guardada.» Sin nombre: «Nombra la
regla.»

**Resolución de la regla activa** (importante): se busca primero una regla cuyo
`clientId` coincida con el cliente elegido; si no la hay, una cuyo `sector`
coincida con el del cliente; si tampoco, se usa el estándar de la casa (12/6,
prueba no exigida).

Estado sin sesión: «Inicia sesión para configurar reglas.» / «Cada regla se
guarda por usuario y puede aplicarse a una marca o sector.»

---

## 16. Bloque `11` — Protocolo de prueba _(documentación)_

**Rótulo:** `11 / OPERACIÓN` · **Titular:** «Protocolo de prueba» **Bajada:**
«Para una idea se producen tres aperturas que cambian un factor y se comparan
con una métrica decidida antes de publicar.»

**Tres tarjetas:**

1. **1. Fijar una métrica** — La misma métrica primaria para todas las
   variantes, definida antes de rodar.
2. **2. Cambiar un factor** — Enfoque, fotograma o evidencia; conserva
   comparable el cuerpo.
3. **3. Guardar el aprendizaje** — Ganadora, prometedora, inconclusa o
   descartada. El porqué importa más que el número.

**Tabla «Cuatro veredictos»**

| Veredicto   | Condición                                           |
| ----------- | --------------------------------------------------- |
| Ganadora    | Supera base con volumen y alcance comparable.       |
| Prometedora | Va arriba, pero aún falta margen o volumen.         |
| Inconclusa  | Alcance desigual o diferencias dentro del ruido.    |
| Descartada  | Por debajo de la línea base con volumen suficiente. |

**Tabla «Ciclo semanal»**

| Paso | Acción                                 |
| ---- | -------------------------------------- |
| 1    | Un concepto, cinco aperturas.          |
| 2    | Pasar por auditor y filtro de calidad. |
| 3    | Fijar métrica y margen.                |
| 4    | Grabar cuerpo una vez, aperturas tres. |
| 5    | Publicar en paralelo.                  |
| 6    | Leer a 72 h y con volumen mínimo.      |
| 7    | Registrar en el banco.                 |
| 8    | Rotar antes de que fatigue.            |

---

## 17. Bloque `12` — Fuentes _(documentación)_

**Rótulo:** `12 / FUENTES` · **Titular:** «De dónde sale esto» **Bajada:**
«Etiquetado por fiabilidad. Verifica cada cifra antes de usarla ante un cliente;
los formatos, límites y métricas cambian con frecuencia.»

Cada fuente lleva una **insignia de fiabilidad de color**: `Directa` (verde),
`Académica` (azul), `Vendor` (gris).

| Fiabilidad    | Título                                        | Texto                                                                                 |
| ------------- | --------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Directa**   | TikTok for Business — Creative best practices | Documentación oficial sobre propuesta de valor, hook inicial y márgenes de seguridad. |
| **Directa**   | Declaraciones públicas de Instagram           | Señales de ranking y prioridad a contenido humano y sin pulir.                        |
| **Académica** | Teoría del vacío informativo — Loewenstein    | Base del mecanismo de curiosidad: el hueco de información se busca cerrar.            |
| **Vendor**    | Informes de analítica creativa                | Origen de bandas de hook y hold rate; contienen sesgo de cartera.                     |

---

## 18. Modelo de datos

Cinco tablas más usuarios. Todo cuelga de `ownerId` — **cada usuario ve solo lo
suyo**.

**`clients`** — `id`, `ownerId`, `name` (120), `sector` (120), fechas.

**`auditRules`** — `id`, `ownerId`, `clientId` (nullable), `sector` (nullable),
`label` (120), `maxSpokenWords` (def. 12), `maxOverlayWords` (def. 6),
`requireProof` (def. true), `preambles`, `tiredPhrases`, `tensionTerms` (texto),
fechas.

**`copyRecords`** — `id`, `ownerId`, `clientId`, `objective` (40), `platform`
(40), `audience`, `tension`, `spoken`, `overlay`, `proof`, `firstFrame`, `cta`
(texto), `auditScore` (int), `primaryMetric` (80), `status` (`draft` |
`published` | `analyzed`), fechas.

> Ojo: `truth` (verdad de marca), `payoff` (pago de la promesa) y `risk` (riesgo
> o claim) **se muestran en la ficha pero no se persisten**. Si los quieres
> conservar, hay que añadirlos al esquema.

**`copyResults`** — `id`, `copyRecordId` (**único**, uno a uno), `impressions`,
`threeSecondViews`, `saves`, `shares`, `clicks`, `conversions` (int, def. 0),
`learning` (texto nullable), `observedAt`, `updatedAt`.

**`trendReferences`** — `id`, `ownerId`, `spoken` (texto), `insertTitle` (250,
nullable), `platform` (40), `territory` (60), `sourceUrl` (1000, nullable),
`insight` (texto), `tags` (500, def. ""), fechas.

## 19. API (tRPC) y validación

| Procedimiento                                                        | Tipo             | Acceso    |
| -------------------------------------------------------------------- | ---------------- | --------- |
| `clients.list` / `clients.create`                                    | query / mutation | protegido |
| `auditRules.list` / `auditRules.create`                              | query / mutation | protegido |
| `copyHistory.list` / `copyHistory.create` / `copyHistory.saveResult` | query / mutation | protegido |
| `trendReferences.list` / `trendReferences.create`                    | query / mutation | protegido |

**Mensajes de validación** (Zod, en castellano, van directos al aviso
emergente):

- Cliente: «El nombre del cliente necesita al menos 2 caracteres» · «El sector
  necesita al menos 2 caracteres»
- Regla: «Ponle nombre a la regla» · voz 3–30 · Insert-Titulo 2–16 · listas ≤
  1200 caracteres
- Ficha: «Elige un cliente antes de guardar» · «Elige un objetivo» · «Elige una
  plataforma» · «Describe la audiencia y el momento» · «Describe la tensión o el
  deseo» · «Escribe el hook hablado» · «Indica la métrica principal» · «El score
  va de 0 a 100»
- Referencia: «Escribe el hook de la referencia» · «Elige una plataforma» ·
  «Elige un territorio» · «El enlace no es una URL válida» · «Explica por qué
  funciona»

`saveResult` es un **upsert** contra `copyRecordId`, así que registrar dos veces
actualiza en vez de duplicar.

---

## 20. Paleta y tono visual

Por si quieres conservar la identidad de las tarjetas:

| Uso                                                    | Color                                             |
| ------------------------------------------------------ | ------------------------------------------------- |
| Fondo general                                          | `#f7f4f2`                                         |
| Texto principal                                        | `#051a2a`                                         |
| Azul de acento (rótulos, filetes, botones secundarios) | `#315166`                                         |
| Azul claro de fondo de cajas                           | `#e9f0f3`                                         |
| Granate de marca (barra lateral, paneles de decisión)  | `#321327` / `#602249`                             |
| Azul marino de paneles oscuros                         | `#051a2a`                                         |
| Azul pálido de rótulos sobre oscuro                    | `#8fa8ba`                                         |
| Rojo de avisos                                         | borde `#d77474`, fondo `#fff2f1`, texto `#7f2b2b` |
| Verde de veredicto positivo                            | `#35603c`                                         |
| Amarillo de la barra lateral                           | `#fae890`                                         |

Los rótulos pequeños en versalitas con mucho tracking (`.eyebrow`) son un rasgo
constante: aparecen en todas las tarjetas por encima del titular.

---

## 21. Notas para adaptarlo a un módulo de creadoras de contenido

Traducción directa de conceptos, por si ayuda al plan:

- **Cliente → la propia creadora, o la marca para la que produce.** Si en tu app
  la creadora trabaja solo para su cuenta, el selector de cliente puede
  desaparecer y `ownerId` hace de cliente. Pero pierdes el sistema de reglas por
  marca; si hay colaboraciones, conviene conservarlo.
- **Reglas por cliente → preajustes por cuenta o por campaña.** Es lo primero
  que se puede recortar de la v1 sin romper nada: el auditor funciona con el
  estándar 12/6.
- **Las cinco superficies de trabajo son el mínimo viable.** En orden de valor:
  Auditor > Canvas > Biblioteca > Historial > Reglas. El auditor solo ya es una
  funcionalidad completa: entra un texto, sale una nota explicada.
- **Las ocho de manual son contenido estático.** Se pueden servir desde un JSON
  o desde el CMS sin lógica ninguna. Nada de lo que hay en ellas consulta el
  servidor.
- **La biblioteca de 42 no está en base de datos**: es un array en el código
  fuente. Copiarla es copiar un fichero.
- **Lo único que necesita servidor** es: clientes, reglas, fichas, resultados y
  referencias de tendencia. Todo lo demás corre en el navegador.
- **Conserva los tres avisos de honestidad** (el del auditor, el de las cifras y
  el de la lectura orgánica). Son lo que distingue la herramienta de un
  generador de promesas, y quitarlos cambia el producto.

---

# Anexo A — Las 42 aperturas, íntegras

Formato de cada una: plantilla con `[corchetes]` a sustituir, mecanismos,
ejemplo hablado, Insert-Titulo sugerido, dirección para edición y criterio de
uso.

### Territorio A · Curiosidad útil (6 aperturas)

**1. Plantilla:** El detalle de [objeto/proceso] que cambia [resultado].

- Mecanismo: Dato, Prueba visual
- Ejemplo hablado: "El detalle de esta etiqueta que cambia cómo eliges café."
- Insert-Titulo: El detalle de la etiqueta
- Direccion para edicion: Macro del detalle, círculo o zoom. Insert-Titulo de
  tres a cinco palabras.
- Usalo cuando: Existe un detalle concreto que explica una decisión.

**2. Plantilla:** Probamos [A] y [B] para entender [pregunta].

- Mecanismo: Comparación, Prueba visual
- Ejemplo hablado: "Probamos dos formas de cocinar arroz para ver cuál queda más
  suelto."
- Insert-Titulo: Dos arroces, un ganador
- Direccion para edicion: Pantalla dividida desde el fotograma uno, sin
  introducción.
- Usalo cuando: Puedes mostrar una comparación justa.

**3. Plantilla:** [Cantidad] segundos para ver por qué [resultado].

- Mecanismo: Número, Prueba visual
- Ejemplo hablado: "15 segundos para ver por qué este corte da más volumen."
- Insert-Titulo: 15 segundos, más volumen
- Direccion para edicion: Cuenta regresiva ligera y demostración inmediata. Sin
  explicación previa.
- Usalo cuando: El mecanismo se puede revelar rápido.

**4. Plantilla:** Esto parecía [suposición], hasta que vimos [prueba].

- Mecanismo: Prueba visual
- Ejemplo hablado: "Parecía una crema normal, hasta que la vimos sobre piel
  seca."
- Insert-Titulo: Hasta que la vimos así
- Direccion para edicion: Inicio con la expectativa y corte seco hacia la prueba
  en el segundo 2.
- Usalo cuando: Hay una sorpresa verificable.

**5. Plantilla:** La diferencia entre [A] y [B] para decidir mejor.

- Mecanismo: Comparación
- Ejemplo hablado: "La diferencia entre café de origen y blend, en una taza."
- Insert-Titulo: Origen o blend
- Direccion para edicion: Dos objetos lado a lado con etiquetas limpias y
  legibles.
- Usalo cuando: El contenido aclara una confusión habitual.

**6. Plantilla:** Si [situación], mira esto antes de elegir [producto].

- Mecanismo: Persona, Comparación
- Ejemplo hablado: "Si estás renovando escritorio, mira esto antes de elegir
  silla."
- Insert-Titulo: Antes de elegir silla
- Direccion para edicion: Escena cotidiana del problema, transición al criterio
  de decisión.
- Usalo cuando: El producto responde a una decisión concreta.

### Territorio B · Demostración (6 aperturas)

**7. Plantilla:** Así se ve [resultado] cuando [método] se usa así.

- Mecanismo: Antes / después, Prueba visual
- Ejemplo hablado: "Así queda la cocina cuando cada utensilio tiene su zona."
- Insert-Titulo: Cada cosa, su zona
- Direccion para edicion: Antes y después con el mismo ángulo de cámara. Sin
  transición decorativa.
- Usalo cuando: La transformación es visualmente clara.

**8. Plantilla:** De [estado inicial] a [estado deseado] con [acción].

- Mecanismo: Antes / después, Prueba visual
- Ejemplo hablado: "De agenda caótica a semana clara en 10 minutos."
- Insert-Titulo: Caos a semana clara
- Direccion para edicion: El estado inicial dura un segundo. Entrar al proceso
  enseguida.
- Usalo cuando: La mejora requiere pasos simples y demostrables.

**9. Plantilla:** Ponemos a prueba [producto] en [situación real].

- Mecanismo: Prueba visual
- Ejemplo hablado: "Ponemos a prueba esta mochila en un viaje de dos días."
- Insert-Titulo: Dos días, una mochila
- Direccion para edicion: Contexto real de uso, texto mínimo, nada de estudio.
- Usalo cuando: El producto gana credibilidad en acción.

**10. Plantilla:** El paso que cambia [resultado] está aquí.

- Mecanismo: Prueba visual
- Ejemplo hablado: "El paso que cambia la textura de esta salsa está aquí."
- Insert-Titulo: Este paso lo cambia todo
- Direccion para edicion: Mano ejecutando el paso. Sonido limpio o textura
  sonora de apoyo.
- Usalo cuando: Hay un momento técnico decisivo.

**11. Plantilla:** Mismo objetivo, dos caminos: [A] y [B].

- Mecanismo: Comparación, Prueba visual
- Ejemplo hablado: "Mismo objetivo, dos desayunos: energía o pico de hambre."
- Insert-Titulo: Dos desayunos, dos mañanas
- Direccion para edicion: Dos rutas visuales paralelas y conclusión clara al
  final.
- Usalo cuando: La comparación educa sin dramatizar.

**12. Plantilla:** Lo que pasa cuando [acción] se hace con [detalle correcto].

- Mecanismo: Prueba visual, Dato
- Ejemplo hablado: "Lo que pasa cuando aplicas protector solar en la cantidad
  correcta."
- Insert-Titulo: La cantidad correcta
- Direccion para edicion: Demostración con medida visual. Cierre con el
  resultado.
- Usalo cuando: Corriges una práctica común con respeto.

### Territorio C · Historia y oficio (6 aperturas)

**13. Plantilla:** Lo que aprendimos al intentar [reto real].

- Mecanismo: Persona, Número
- Ejemplo hablado: "Lo que aprendimos sirviendo 300 desayunos en una mañana."
- Insert-Titulo: 300 desayunos, una mañana
- Direccion para edicion: Empieza por la escena más intensa y pasa a la lección.
- Usalo cuando: El equipo vivió algo que aporta contexto.

**14. Plantilla:** Esta parte de [oficio] casi nadie la ve.

- Mecanismo: Persona, Prueba visual
- Ejemplo hablado: "Esta parte de hacer pan casi nadie la ve."
- Insert-Titulo: La parte que no se ve
- Direccion para edicion: Manos, herramientas y detalle del proceso. Deja
  respirar el sonido.
- Usalo cuando: El detrás de escena muestra oficio y paciencia.

**15. Plantilla:** Cuando [persona] nos dijo [frase], entendimos que…

- Mecanismo: Persona
- Ejemplo hablado: "Cuando una clienta dijo «quiero sentirme yo misma»,
  cambiamos todo."
- Insert-Titulo: Quiero sentirme yo misma
- Direccion para edicion: Persona hablando a cámara. B-roll auténtico, no de
  archivo.
- Usalo cuando: Hay una conversación real que orienta a la marca.

**16. Plantilla:** El pequeño cambio que hizo más fácil [situación].

- Mecanismo: Persona, Antes / después
- Ejemplo hablado: "El cambio que hizo más fácil llegar a casa con dos bebés."
- Insert-Titulo: Llegar a casa con bebés
- Direccion para edicion: Escena cotidiana y solución integrada, no exhibida.
- Usalo cuando: La mejora se conecta con una rutina real.

**17. Plantilla:** De esta pregunta nació [producto o decisión].

- Mecanismo: Persona, Pregunta
- Ejemplo hablado: "De esta pregunta nació nuestra forma de empacar pedidos."
- Insert-Titulo: De una pregunta
- Direccion para edicion: Mostrar la pregunta escrita y el prototipo o
  resultado.
- Usalo cuando: Quieres explicar la convicción de marca.

**18. Plantilla:** La parte más satisfactoria de [oficio] empieza aquí.

- Mecanismo: Persona, Prueba visual
- Ejemplo hablado: "La parte más satisfactoria de restaurar una mesa empieza
  aquí."
- Insert-Titulo: Empieza aquí
- Direccion para edicion: Primer plano táctil. Que el gesto y el sonido lleven
  la escena.
- Usalo cuando: El valor está en el proceso y la transformación.

### Territorio D · Identidad (6 aperturas)

**19. Plantilla:** Para quienes [comportamiento reconocible].

- Mecanismo: Persona
- Ejemplo hablado: "Para quienes cocinan lento incluso en semanas ocupadas."
- Insert-Titulo: Cocinar lento, semana ocupada
- Direccion para edicion: Insert-Titulo directo sobre escena aspiracional pero
  cotidiana.
- Usalo cuando: La audiencia comparte una identidad clara.

**20. Plantilla:** Si tu versión de [situación] se parece a esto…

- Mecanismo: Persona, Pregunta
- Ejemplo hablado: "Si tu versión de oficina ordenada se parece a esto…"
- Insert-Titulo: ¿Tu oficina es así?
- Direccion para edicion: Montaje breve de detalles reconocibles, ritmo rápido.
- Usalo cuando: Invitas a identificarse sin excluir.

**21. Plantilla:** El ritual de [momento] que entendemos quienes [grupo].

- Mecanismo: Persona
- Ejemplo hablado: "El ritual del domingo que entendemos quienes recibimos
  amigos."
- Insert-Titulo: El ritual del domingo
- Direccion para edicion: Música cálida y gestos naturales. Nada de plano
  publicitario.
- Usalo cuando: La marca entra en una rutina significativa.

**22. Plantilla:** La señal de que eres de [comunidad] es [detalle].

- Mecanismo: Persona
- Ejemplo hablado: "Si hueles la bolsa antes de abrirla, esto es para ti."
- Insert-Titulo: Hueles la bolsa, ¿verdad?
- Direccion para edicion: Primer plano del gesto y remate visual rápido.
- Usalo cuando: Hay una observación ligera y genuina.

**23. Plantilla:** Cuando [situación], este es el tipo de [solución] que buscas.

- Mecanismo: Persona
- Ejemplo hablado: "Cuando el día se alarga, esta es la cena que buscas."
- Insert-Titulo: Cuando el día se alarga
- Direccion para edicion: Contraste entre jornada intensa y solución simple.
- Usalo cuando: El producto acompaña un momento emocional.

**24. Plantilla:** Tu [actividad] puede parecerse más a ti con [detalle].

- Mecanismo: Persona
- Ejemplo hablado: "Tu escritorio puede parecerse más a ti con un sistema
  simple."
- Insert-Titulo: Que se parezca a ti
- Direccion para edicion: Elementos personales reales, no un montaje de
  catálogo.
- Usalo cuando: Quieres activar expresión personal o pertenencia.

### Territorio E · Guía guardable (6 aperturas)

**25. Plantilla:** Tres señales para elegir [opción] según [criterio].

- Mecanismo: Número, Comparación
- Ejemplo hablado: "Tres señales para elegir planta según la luz de tu casa."
- Insert-Titulo: Tres señales, una planta
- Direccion para edicion: Lista de tres con ejemplo visual en cada una.
  Insert-Titulo por etapa.
- Usalo cuando: La audiencia necesita decidir entre opciones.

**26. Plantilla:** La forma más simple de empezar [acción] es esta.

- Mecanismo: Prueba visual
- Ejemplo hablado: "La forma más simple de empezar movilidad es esta."
- Insert-Titulo: Empieza por aquí
- Direccion para edicion: Mostrar el primer paso completo antes de explicarlo.
- Usalo cuando: El tema parece difícil y se puede simplificar.

**27. Plantilla:** Guarda esto para la próxima vez que [situación].

- Mecanismo: Número
- Ejemplo hablado: "Guarda esto para la próxima maleta de fin de semana."
- Insert-Titulo: Para tu próxima maleta
- Direccion para edicion: Abrir con el resultado. Checklist en pantalla, legible
  al pausar.
- Usalo cuando: La pieza se consulta y se reutiliza.

**28. Plantilla:** Así organizamos [proceso] cuando necesitamos [resultado].

- Mecanismo: Prueba visual
- Ejemplo hablado: "Así organizamos una semana de contenidos cuando falla la
  consistencia."
- Insert-Titulo: Una semana en un tablero
- Direccion para edicion: Captura de proceso, notas o tablero real, no maqueta.
- Usalo cuando: El cliente puede mostrar método, no solo resultado.

**29. Plantilla:** La pregunta que resuelve [problema] más rápido.

- Mecanismo: Pregunta
- Ejemplo hablado: "La pregunta que resuelve una compra de muebles más rápido."
- Insert-Titulo: Haz esta pregunta
- Direccion para edicion: Pregunta grande en pantalla y ejemplo de respuesta
  inmediato.
- Usalo cuando: Un marco mental aclara la decisión.

**30. Plantilla:** Antes de [acción], revisa estos [cantidad] puntos.

- Mecanismo: Número, Comparación
- Ejemplo hablado: "Antes de contratar un seguro, revisa estos cuatro puntos."
- Insert-Titulo: Cuatro puntos antes de firmar
- Direccion para edicion: Cada punto con imagen, icono o documento real.
- Usalo cuando: Ofreces una revisión útil y responsable.

### Territorio F · Objeciones (6 aperturas)

**31. Plantilla:** ¿Vale la pena [servicio] si [condición]?

- Mecanismo: Pregunta, Comparación
- Ejemplo hablado: "¿Vale la pena una asesoría si recién empiezas a invertir?"
- Insert-Titulo: ¿Vale la pena si empiezas?
- Direccion para edicion: Pregunta frontal. Respuesta por condiciones, nunca
  promesa universal.
- Usalo cuando: La audiencia formula una objeción clara.

**32. Plantilla:** Lo que incluye [solución] en una situación real.

- Mecanismo: Prueba visual
- Ejemplo hablado: "Lo que incluye una asesoría cuando tu negocio está
  creciendo."
- Insert-Titulo: Qué incluye de verdad
- Direccion para edicion: Recorrido de inicio a fin con pantallas o entregables
  reales.
- Usalo cuando: Conviene hacer tangible un servicio intangible.

**33. Plantilla:** Elegimos [decisión] para resolver [necesidad], por esto.

- Mecanismo: Prueba visual, Dato
- Ejemplo hablado: "Elegimos este material para el uso diario de una familia."
- Insert-Titulo: Por qué este material
- Direccion para edicion: Mostrar el material en uso y el criterio de elección.
- Usalo cuando: La marca tiene una decisión de producto explicable.

**34. Plantilla:** Para [perfil], [solución] funciona mejor cuando [condición].

- Mecanismo: Persona, Comparación
- Ejemplo hablado: "Para piel mixta, esta rutina funciona mejor si se
  simplifica."
- Insert-Titulo: Piel mixta: menos es más
- Direccion para edicion: Aclarar a quién aplica e incluir el límite o la
  contraindicación.
- Usalo cuando: Necesitas segmentar con honestidad.

**35. Plantilla:** La comparación que hacemos antes de recomendar [opción].

- Mecanismo: Comparación, Dato
- Ejemplo hablado: "Lo que comparamos antes de recomendar una silla ergonómica."
- Insert-Titulo: Antes de recomendarla
- Direccion para edicion: Tabla breve o prueba de uso con criterios visibles.
- Usalo cuando: La confianza depende de explicar el proceso.

**36. Plantilla:** Empieza por [paso] si quieres llegar a [resultado].

- Mecanismo: Persona
- Ejemplo hablado: "Empieza por una consulta si quieres una cocina a medida."
- Insert-Titulo: Empieza por la consulta
- Direccion para edicion: Mostrar cómo empieza, quién acompaña y qué pasa
  después.
- Usalo cuando: El CTA necesita reducir fricción y dar seguridad.

### Territorio G · Contradicción (6 aperturas)

**37. Plantilla:** [Práctica aceptada] es la razón de [problema que ya tienen].

- Mecanismo: Dato, Coste
- Ejemplo hablado: "Publicar todos los días está hundiendo tu alcance."
- Insert-Titulo: Publicar a diario te frena
- Direccion para edicion: El dato o la curva en pantalla en el segundo 2. La
  prueba antes de la explicación.
- Usalo cuando: Tienes datos propios que contradicen la creencia.

**38. Plantilla:** [Resultado] no depende de [causa asumida].

- Mecanismo: Comparación, Prueba visual
- Ejemplo hablado: "Que el pan suba no depende de la levadura."
- Insert-Titulo: No es la levadura
- Direccion para edicion: Dos panes idénticos en plano. La variable real se
  revela después.
- Usalo cuando: Puedes demostrar la causa real en el mismo vídeo.

**39. Plantilla:** Dejamos de [práctica del sector] y [resultado medible].

- Mecanismo: Dato, Número, Antes / después
- Ejemplo hablado: "Dejamos de usar plantillas y bajamos las revisiones a la
  mitad."
- Insert-Titulo: Sin plantillas, mitad de revisiones
- Direccion para edicion: Cifra antes y después sobre pantalla real de trabajo.
- Usalo cuando: La agencia o el cliente tomaron la decisión de verdad.

**40. Plantilla:** Lo que se recomienda para [objetivo] falla si [condición].

- Mecanismo: Comparación, Prueba visual
- Ejemplo hablado: "Lo que se recomienda para piel grasa falla en clima húmedo."
- Insert-Titulo: Falla en clima húmedo
- Direccion para edicion: Mostrar el fallo, no contarlo. Producto en la
  condición adversa.
- Usalo cuando: La excepción es real y afecta a una parte de tu público.

**41. Plantilla:** [Cosa cara] no arregla [problema]. [Cosa concreta] sí.

- Mecanismo: Comparación, Coste
- Ejemplo hablado: "Una cámara mejor no arregla un vídeo aburrido. El primer
  plano sí."
- Insert-Titulo: No es la cámara
- Direccion para edicion: Mismo plano rodado con móvil y con cámara: la
  diferencia no está ahí.
- Usalo cuando: Quieres desmontar una excusa de compra habitual.

**42. Plantilla:** Todos miden [métrica popular]. Nosotros miramos [métrica
real].

- Mecanismo: Dato, Comparación
- Ejemplo hablado: "Todos miran seguidores. Nosotros miramos envíos por
  alcance."
- Insert-Titulo: Seguidores no, envíos
- Direccion para edicion: Captura real de analítica con la cifra señalada a
  mano.
- Usalo cuando: Tienes una tesis de medición que puedes defender.
