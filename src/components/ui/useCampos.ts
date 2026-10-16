"use client";

import { useState, type ChangeEvent } from "react";

/**
 * Mantiene lo escrito en un formulario cuando la validacion lo devuelve.
 *
 * EL PROBLEMA QUE RESUELVE
 * ------------------------
 * Con `<form action={...}>`, React 19 vacia los campos no controlados en
 * cuanto la action termina — tanto si guardo como si no. En la practica eso
 * significaba que rellenar ocho campos, olvidar uno y pulsar guardar borraba
 * los ocho: el mensaje decia cual faltaba, pero para entonces ya no quedaba
 * nada que completar.
 *
 * La solucion no es un truco: es que el valor viva en React y no en el DOM.
 * Un campo controlado se vuelve a pintar con lo que hay en el estado, y el
 * vaciado de React deja de tener efecto. Es lo que ya hacia el canvas de hooks
 * a mano; esto lo hace comodo de repetir.
 *
 * COMO SE USA
 * -----------
 *   const { campo, valores } = useCampos({ nombre: usuario.nombre, correo: "" });
 *   <Campo id="alta-nombre" etiqueta="Nombre" {...campo("nombre")} />
 *
 * `campo(...)` pone `name`, `value` y `onChange`, asi que la clave del objeto
 * inicial ES el nombre con el que el dato llega a la action. Si hay que
 * enviarlo con otro nombre, se pasa `name` despues del spread.
 *
 * Para un `CampoFecha`, `fecha(...)` da lo mismo con sus nombres:
 * `<CampoFecha id="x" etiqueta="Inicio" {...fecha("inicio")} />`.
 *
 * Lo que NO necesita esto: los `Selector`, las casillas y los grupos de radio
 * del proyecto ya guardan su valor en estado de React y sobreviven solos.
 */
export function useCampos<C extends Record<string, string>>(iniciales: C) {
  const [valores, setValores] = useState<C>(iniciales);

  function campo<K extends keyof C & string>(nombre: K) {
    return {
      name: nombre,
      value: valores[nombre],
      onChange: (
        evento: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => {
        setValores((previos) => ({ ...previos, [nombre]: evento.target.value }));
      },
    };
  }

  /** Lo mismo para un CampoFecha: `nombre`, `valor` y `onCambio`. */
  function fecha<K extends keyof C & string>(nombre: K) {
    return {
      nombre,
      valor: valores[nombre],
      onCambio: (valor: string) => setValores((previos) => ({ ...previos, [nombre]: valor })),
    };
  }

  return { valores, campo, fecha, setValores };
}
