import Image from "next/image";

/**
 * Avatar de una persona: su foto, o sus iniciales cuando no la ha subido.
 *
 * El dorado sobre navy es la combinacion de marca legal, y es la que se usa
 * aqui: fondo navy con las letras doradas.
 */

const TAMANOS = {
  chico: { caja: "size-9", texto: "text-xs", px: 36 },
  normal: { caja: "size-11", texto: "text-sm", px: 44 },
  grande: { caja: "size-[84px]", texto: "text-3xl", px: 84 },
  enorme: { caja: "size-[108px]", texto: "text-4xl", px: 108 },
} as const;

export type TamanoAvatar = keyof typeof TAMANOS;

/** Iniciales a partir del nombre y el apellido. */
export function iniciales(nombre: string, apellido?: string | null): string {
  const primera = nombre.trim().charAt(0);
  const segunda = (apellido ?? "").trim().charAt(0);
  return (primera + segunda).toUpperCase() || "?";
}

export function Avatar({
  nombre,
  apellido,
  fotoUrl,
  tamano = "normal",
  className,
}: {
  nombre: string;
  apellido?: string | null;
  fotoUrl?: string | null;
  tamano?: TamanoAvatar;
  className?: string;
}) {
  const medida = TAMANOS[tamano];
  const letras = iniciales(nombre, apellido);
  const nombreCompleto = [nombre, apellido].filter(Boolean).join(" ");

  const contenedor = [
    medida.caja,
    "relative shrink-0 overflow-hidden rounded-full",
    "grid place-items-center bg-acento font-bold text-acento-contraste",
    medida.texto,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (fotoUrl) {
    return (
      <span className={contenedor}>
        <Image
          src={fotoUrl}
          alt={`Foto de ${nombreCompleto}`}
          width={medida.px}
          height={medida.px}
          // La foto la entrega una ruta de la aplicacion que exige sesion: el
          // optimizador de imagenes la pediria sin la cookie y recibiria 404.
          unoptimized={fotoUrl.startsWith("/api/")}
          className="size-full object-cover"
        />
      </span>
    );
  }

  return (
    <span className={contenedor} role="img" aria-label={`Iniciales de ${nombreCompleto}`}>
      <span aria-hidden="true">{letras}</span>
    </span>
  );
}
