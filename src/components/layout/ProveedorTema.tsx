"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { cambiarTema } from "@/actions/tema";
import type { Tema } from "@/types";

/**
 * Estado del tema del lado del cliente.
 *
 * El servidor ya pinto el `data-tema` correcto en el html leyendo la cookie,
 * asi que al cargar no hay nada que corregir. Este proveedor solo existe para
 * que el conmutador pueda cambiarlo sin recargar la pagina.
 *
 * El cambio se aplica al documento de inmediato y la persistencia va detras
 * en una transicion: si la peticion tarda, la interfaz ya respondio.
 */

type ContextoTema = {
  tema: Tema;
  elegir: (tema: Tema) => void;
  alternar: () => void;
  guardando: boolean;
};

const Contexto = createContext<ContextoTema | null>(null);

function aplicarAlDocumento(tema: Tema): void {
  const html = document.documentElement;

  if (tema === "sistema") {
    html.removeAttribute("data-tema");
  } else {
    html.setAttribute("data-tema", tema);
  }
}

/** Que tema se esta viendo ahora mismo, resolviendo "sistema". */
function temaVisible(tema: Tema): "claro" | "oscuro" {
  if (tema !== "sistema") return tema;

  const oscuroEnDispositivo =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  return oscuroEnDispositivo ? "oscuro" : "claro";
}

export function ProveedorTema({
  inicial,
  children,
}: {
  inicial: Tema;
  children: ReactNode;
}) {
  const [tema, setTema] = useState<Tema>(inicial);
  const [guardando, iniciarTransicion] = useTransition();

  const elegir = useCallback((nuevo: Tema) => {
    setTema(nuevo);
    aplicarAlDocumento(nuevo);
    iniciarTransicion(() => {
      void cambiarTema(nuevo);
    });
  }, []);

  const alternar = useCallback(() => {
    elegir(temaVisible(tema) === "claro" ? "oscuro" : "claro");
  }, [tema, elegir]);

  return (
    <Contexto.Provider value={{ tema, elegir, alternar, guardando }}>
      {children}
    </Contexto.Provider>
  );
}

export function useTema(): ContextoTema {
  const contexto = useContext(Contexto);

  if (!contexto) {
    throw new Error("useTema debe usarse dentro de ProveedorTema");
  }

  return contexto;
}
