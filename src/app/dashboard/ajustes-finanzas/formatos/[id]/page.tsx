import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccionesFormato, EditorFormato } from "@/components/ajustesFinanzas";
import { SECCION_DOCUMENTO } from "@/components/finanzas";
import { Wrapper } from "@/components/layout/Wrapper";
import { conSesion } from "@/lib/db";
import { RUTA_AJUSTES_FINANZAS } from "@/lib/finanzas/rutas";
import { requerirFinanzas } from "@/lib/sesion";
import { comoIdentificador } from "@/lib/validaciones";
import * as ajustesModelo from "@/models/ajustesFinanzas";

export const metadata: Metadata = {
  title: "Formato de impresion",
};

/**
 * Un formato de impresion: el tamano de la hoja y donde va cada dato. Se
 * calibra imprimiendo su hoja de calibracion sobre el papel real, midiendo y
 * ajustando aqui.
 */
export default async function PaginaFormato(props: PageProps<"/dashboard/ajustes-finanzas/formatos/[id]">) {
  const usuario = await requerirFinanzas();

  const id = comoIdentificador((await props.params).id);
  if (id === null) notFound();

  const formato = await conSesion(usuario, (tx) => ajustesModelo.formato(id, tx));
  if (!formato) notFound();

  const migas = [
    { texto: "Conejo App", href: "/dashboard" },
    { texto: "Ajustes de finanzas", href: RUTA_AJUSTES_FINANZAS },
    { texto: formato.nombre },
  ];

  return (
    <Wrapper
      migas={migas}
      kicker={formato.habitual ? "Formato habitual" : "Formato de impresion"}
      titulo={formato.nombre}
      descripcion="Medidas en milimetros desde la esquina superior izquierda de la hoja."
      accion={<AccionesFormato id={formato.id} habitual={formato.habitual} activo={formato.activo} />}
    >
      <div className={`${SECCION_DOCUMENTO} surge [--retraso:0.06s]`}>
        <EditorFormato key={formato.id} formato={formato} />
      </div>
    </Wrapper>
  );
}
