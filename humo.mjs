import { SignJWT } from "jose";
import { writeFileSync } from "node:fs";
const t = await new SignJWT({ email: "redes@conejo.test", nombre: "Carla", tipo: "trabajador", rol: "trabajador", cargo: "redes", empresaId: null })
  .setProtectedHeader({ alg: "HS256" }).setSubject(process.env.UID).setIssuedAt()
  .setIssuer("conejo-app").setAudience("conejo-app").setExpirationTime("8h")
  .sign(new TextEncoder().encode(process.env.JWT_SECRET));
writeFileSync("cookie-redes.txt", `localhost\tFALSE\t/\tFALSE\t0\tconejo_sesion\t${t}\n`);
