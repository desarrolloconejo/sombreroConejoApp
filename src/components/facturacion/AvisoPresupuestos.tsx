import Link from "next/link";
import { ArrowRight, FileSpreadsheet } from "lucide-react";

import { RUTA_FACTURACION, rutaMiPresupuesto } from "@/lib/finanzas/rutas";
import type { Presupuesto } from "@/types";

/**
 * El aviso del inicio del cliente con permiso de finanzas: presupuestos que
 * esperan su aprobacion. Mismo aspecto que el de las piezas por revisar: son
 * las dos cosas que solo puede desbloquear el cliente.
 *
 * Con uno, lleva directo a el; con varios, a Facturacion, que los lista.
 */
export function AvisoPresupuestos({ presupuestos }: { presupuestos: Pick<Presupuesto, "id" | "titulo">[] }) {
  const pendientes = presupuestos.length;
  if (pendientes === 0) return null;

  return (
    <Link
      href={pendientes === 1 ? rutaMiPresupuesto(presupuestos[0].id) : RUTA_FACTURACION}
      className="surge suave group flex items-center gap-4 rounded-[15px] bg-navy px-5 py-4 text-white shadow-[var(--sombra)] hover:-translate-y-0.5"
    >
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-full bg-gold text-navy [&>svg]:size-5"
      >
        <FileSpreadsheet />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-gold">
          {pendientes === 1
            ? "1 presupuesto espera tu aprobacion"
            : `${pendientes} presupuestos esperan tu aprobacion`}
        </span>
        <span className="block text-[12.5px] text-white/75">
          {pendientes === 1
            ? `«${presupuestos[0].titulo}». Revisalo y apruebalo, o cuentanos que cambiarias.`
            : "Revisalos y apruebalos, o cuentanos que cambiarias."}
        </span>
      </span>
      <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-gold" />
    </Link>
  );
}
