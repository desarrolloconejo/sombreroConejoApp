"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Clock } from "lucide-react";

import { cerrarSesion } from "@/actions/auth";
import { renovarSesion } from "@/actions/sesion";
import { Boton } from "@/components/ui";

/**
 * Mantiene viva la sesion mientras la persona trabaja, y pregunta cuando no.
 *
 * El acceso dura media hora. Dos minutos antes de que caduque pasan dos cosas
 * distintas segun lo que haya hecho la persona:
 *
 * - Si ha tocado algo hace poco, se renueva sin avisar. No hay navegacion: la
 *   pantalla, el scroll y lo escrito en un formulario se quedan como estaban.
 * - Si lleva un rato sin actividad, sale un aviso con cuenta atras. Renovar
 *   una sesion que nadie esta usando es justo lo que hay que evitar.
 *
 * Y haga lo que haga, cuando la sesion llega a su tope termina.
 *
 * EL RELOJ
 * --------
 * No se fia de un temporizador. Un `setTimeout` de veinte minutos no corre con
 * la pestana en segundo plano ni con el equipo suspendido, asi que al volver
 * diria que queda tiempo cuando ya no queda. Cada comprobacion recalcula
 * contra la hora de caducidad, y ademas se comprueba al volver a la pestana.
 */

/** Con cuanta antelacion se actua, antes de que caduque el acceso. */
const ANTELACION = 2 * 60 * 1000;

/** Cada cuanto se mira el reloj. */
const INTERVALO = 15 * 1000;

/**
 * A donde se va cuando la sesion termino.
 *
 * Se navega con `location.replace` y no con el router: es una carga completa,
 * que tira todo el estado de la pagina, y saca del historial una pantalla a la
 * que «atras» ya no puede volver.
 */
const LOGIN_CADUCADA = "/login?motivo=caducada";

/** "1:05" para la cuenta atras. Nunca baja de cero. */
function comoCuenta(milisegundos: number): string {
  const segundos = Math.max(0, Math.ceil(milisegundos / 1000));

  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;
}

export function GuardianSesion({
  accesoCaducaEn: accesoInicial,
  sesionCaducaEn: sesionInicial,
  inactividad,
}: {
  accesoCaducaEn: number;
  sesionCaducaEn: number;

  /** Milisegundos sin actividad a partir de los cuales se pregunta. */
  inactividad: number;
}) {
  const ruta = usePathname();

  // Las horas viven en refs y no en estado: cambian al renovar, y el reloj
  // tiene que leer siempre la ultima sin volver a montarse.
  const accesoCaducaEn = useRef(accesoInicial);
  const sesionCaducaEn = useRef(sesionInicial);
  const ultimaActividad = useRef(0);
  const renovando = useRef(false);

  // null = sin aviso. Un numero = milisegundos que faltan, ya calculados.
  const [restante, setRestante] = useState<number | null>(null);
  const [fallo, setFallo] = useState(false);

  const continuar = useRef<HTMLButtonElement>(null);

  const renovar = useCallback(async () => {
    if (renovando.current) return;
    renovando.current = true;

    try {
      const estado = await renovarSesion();

      if (!estado.ok) {
        window.location.replace(LOGIN_CADUCADA);
        return;
      }

      accesoCaducaEn.current = estado.accesoCaducaEn;
      sesionCaducaEn.current = estado.sesionCaducaEn;
      setRestante(null);
      setFallo(false);
    } catch {
      // Sin red, por ejemplo. No se echa a nadie por eso: se deja el aviso a
      // la vista para que pueda reintentar.
      setFallo(true);
      setRestante(Math.max(0, accesoCaducaEn.current - Date.now()));
    } finally {
      renovando.current = false;
    }
  }, []);

  const comprobar = useCallback(() => {
    const ahora = Date.now();

    if (ahora >= sesionCaducaEn.current) {
      window.location.replace(LOGIN_CADUCADA);
      return;
    }

    const falta = accesoCaducaEn.current - ahora;

    if (falta > ANTELACION) {
      setRestante(null);
      return;
    }

    const activa = ahora - ultimaActividad.current < inactividad;

    if (activa) {
      void renovar();
    } else {
      setRestante(Math.max(0, falta));
    }
  }, [inactividad, renovar]);

  // Navegar cuenta como actividad: es la senal mas clara de que hay alguien.
  useEffect(() => {
    ultimaActividad.current = Date.now();
  }, [ruta]);

  useEffect(() => {
    ultimaActividad.current = Date.now();

    function alActuar() {
      ultimaActividad.current = Date.now();
    }

    function alVolver() {
      if (document.visibilityState === "visible") comprobar();
    }

    // `pointerdown` y `keydown`, no `mousemove`: mover el raton por encima de
    // la ventana no es estar trabajando.
    window.addEventListener("pointerdown", alActuar, { passive: true });
    window.addEventListener("keydown", alActuar);
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", comprobar);

    const reloj = window.setInterval(comprobar, INTERVALO);

    return () => {
      window.removeEventListener("pointerdown", alActuar);
      window.removeEventListener("keydown", alActuar);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", comprobar);
      window.clearInterval(reloj);
    };
  }, [comprobar]);

  const visible = restante !== null;

  // Con el aviso a la vista la cuenta atras baja segundo a segundo, siempre
  // recalculada contra la hora de caducidad.
  useEffect(() => {
    if (!visible) return;

    continuar.current?.focus();

    const cuenta = window.setInterval(() => {
      if (Date.now() >= sesionCaducaEn.current) {
        window.location.replace(LOGIN_CADUCADA);
        return;
      }

      setRestante(Math.max(0, accesoCaducaEn.current - Date.now()));
    }, 1000);

    return () => window.clearInterval(cuenta);
  }, [visible]);

  if (restante === null) return null;

  const vencido = restante === 0;

  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-[60] bg-black/[0.45]" />

      <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto overscroll-contain p-4">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="sesion-titulo"
          aria-describedby="sesion-texto"
          className="surge w-full max-w-[430px] rounded-[17px] border border-borde bg-superficie p-6 shadow-[var(--sombra-alta)]"
        >
          <p className="mb-[5px] flex items-center gap-2 text-[12.5px] font-bold text-acento">
            <Clock aria-hidden="true" className="size-[14px]" />
            Sigues ahi?
          </p>

          <h2
            id="sesion-titulo"
            className="text-[22px] leading-tight font-extrabold tracking-[-0.025em]"
          >
            {vencido ? "Tu sesion esta en pausa" : "Tu sesion esta por vencer"}
          </h2>

          <p
            id="sesion-texto"
            className="mt-3 text-[13px] leading-relaxed text-suave"
          >
            {vencido
              ? "Llevas un rato sin actividad. Continua para seguir donde estabas: no se pierde nada de lo que tenias en pantalla."
              : "Llevas un rato sin actividad. Si no continuas, la sesion se pausa en "}
            {!vencido && (
              <b
                aria-live="off"
                className="font-semibold text-texto tabular-nums"
              >
                {comoCuenta(restante)}
              </b>
            )}
            {!vencido && "."}
          </p>

          {fallo && (
            <p role="alert" className="mt-3 text-[12.5px] font-medium text-acento">
              No se pudo renovar. Revisa tu conexion y vuelve a intentarlo.
            </p>
          )}

          <div className="mt-6 flex flex-wrap justify-end gap-2.5">
            {/* Salir es la misma action que el boton del perfil: revoca la
                sesion en la base, no solo borra las cookies. */}
            <form action={cerrarSesion}>
              <Boton type="submit" variante="fantasma">
                Salir
              </Boton>
            </form>

            <Boton ref={continuar} type="button" onClick={() => void renovar()}>
              Continuar
            </Boton>
          </div>
        </div>
      </div>
    </>
  );
}
