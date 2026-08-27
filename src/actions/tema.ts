"use server";

import { comoTema } from "@/lib/validaciones";
import { guardarTemaEnCookie } from "@/lib/tema";
import { obtenerSesion } from "@/lib/sesion";
import * as usuarios from "@/models/usuarios";
import type { Tema } from "@/types";

/**
 * Guarda la preferencia de tema.
 *
 * Funciona tambien sin sesion iniciada: en el login se guarda solo la cookie,
 * y al entrar se persiste ademas en la cuenta.
 */
export async function cambiarTema(valor: Tema): Promise<void> {
  const tema = comoTema(valor) ?? "sistema";

  await guardarTemaEnCookie(tema);

  const sesion = await obtenerSesion();
  if (sesion) {
    await usuarios.actualizarTema(sesion.usuarioId, tema);
  }
}
