import https from "node:https";
import tls from "node:tls";

import { leerTasasDeBcv, type Lectura } from "@/lib/finanzas/tasaBcv";
import type { LecturaDeTasas, ModoExterno } from "@/types";

import { CERTIFICADO_INTERMEDIO_BCV } from "./certificados/bcvIntermedio";
import { modoDe } from "./modo";
import lecturaSimulada from "./simulados/tasaCambio.bcv.json";

/**
 * El adaptador de la tasa de cambio. La aplicacion pide «las tasas de hoy» y
 * no sabe si vienen de la pagina del BCV o de un archivo.
 *
 * Solo LEE: no guarda nada. Decidir si la lectura se da por buena y escribirla
 * es cosa de `src/lib/finanzas/actualizarTasas.ts`.
 */

const PAGINA_DEL_BCV = "https://www.bcv.org.ve/";

/** Cuanto se espera a la pagina antes de dar la lectura por perdida. */
const ESPERA = 15_000;

/**
 * La pagina pesa unos 150 kB. Un tope bastante por encima evita que una
 * respuesta sin fin llene la memoria de la funcion.
 */
const TAMANO_MAXIMO = 2 * 1024 * 1024;

/** La tasa arranca en modo real: la pagina se puede leer sin cuenta alguna. */
export function modoDeTasa(): ModoExterno {
  return modoDe("TASA_MODO", "real");
}

/**
 * Trae el HTML de la pagina del BCV.
 *
 * Usa `node:https` y no `fetch` por una sola razon: hay que darle a la
 * peticion el certificado intermedio que el servidor no envia, y eso se hace
 * con la opcion `ca`. Va JUNTO a las raices de Node, no en su lugar: la
 * verificacion sigue completa. Ver `certificados/bcvIntermedio.ts`.
 */
function pedirPagina(): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const peticion = https.get(
      PAGINA_DEL_BCV,
      {
        ca: [...tls.rootCertificates, CERTIFICADO_INTERMEDIO_BCV],
        timeout: ESPERA,
        headers: {
          // Sin un agente reconocible el servidor corta la conexion.
          "User-Agent": "Mozilla/5.0 (compatible; ConejoApp)",
          Accept: "text/html",
        },
      },
      (respuesta) => {
        if (respuesta.statusCode !== 200) {
          respuesta.resume();
          rechazar(new Error(`El BCV respondio ${respuesta.statusCode}`));
          return;
        }

        let html = "";
        let recibido = 0;

        respuesta.setEncoding("utf8");
        respuesta.on("data", (trozo: string) => {
          recibido += trozo.length;

          if (recibido > TAMANO_MAXIMO) {
            peticion.destroy(new Error("La respuesta del BCV es demasiado grande"));
            return;
          }

          html += trozo;
        });
        respuesta.on("end", () => resolver(html));
        respuesta.on("error", rechazar);
      },
    );

    peticion.on("timeout", () => {
      peticion.destroy(new Error("El BCV no respondio a tiempo"));
    });
    peticion.on("error", rechazar);
  });
}

/**
 * Las tasas que publica la fuente ahora mismo.
 *
 * NUNCA LANZA: devuelve la lectura o el motivo. Quien llama es una tarea
 * programada, y lo que tiene que hacer con un fallo es contarlo, no morir.
 */
export async function consultarTasas(): Promise<Lectura> {
  if (modoDeTasa() === "simulado") {
    return { ok: true, lectura: lecturaSimulada as LecturaDeTasas };
  }

  try {
    return leerTasasDeBcv(await pedirPagina());
  } catch (error) {
    const codigo = (error as { code?: string }).code;

    return {
      ok: false,
      motivo:
        codigo === "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
          ? "El certificado del BCV ya no se puede verificar: puede que haya cambiado de autoridad"
          : error instanceof Error
            ? error.message
            : "No se pudo leer la pagina del BCV",
    };
  }
}
