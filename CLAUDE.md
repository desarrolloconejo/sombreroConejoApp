# Conejo App

Necesito crear una aplicacion web con nextjs, la aplicacion es para la empresa
de marketing el conejo del sombrero, esta app va orientada a sus clientes y
trabajadores, esta app va enfocada en centralizar y automatizar procesos que la
empresa realiza en su dia a dia, ese es el objetivo de esta app, para lograrlo
usaremos una infraestructura de comunicacion de cliente servidor, este proyecto
sera un monolito, usando el patron mvc lo mas parecido a como nextjs permite
trabajarlo, con actions, models, components y pages. la app respetara el uso de
csr y ssr, ssr para las pages y los componentes necesarios o que lo ameriten
seran en csr, con props inyectadas en las pages segun lo que necesiten, este
proyecto busca la alta cohesion y el bajo acoplamiento. la app esta pensada para
trabajarla sobre modulos, es decir idenfitificar y definir funcioanlidades y
plasmarlas en modulos segun corresponda. al momento de trabajar iras haciendo
commits de todos los cambios que hagas, el commit debe ser descriptivo y debe
solamente describir los cambios realizados en ese commit, nada mas, solo usa el
idioma español. iras documentando lo hecho en AGENTS.md (contexto para modelos) y en el README.md
ira la informacion relevante para el desarrollador

# Tecnologias

- NextJS (version 16)
- TailwindCSS
- TypeScript
- PostgreSQL
- Docker
- Git/GitHub
- Claude
- LucideReact
- jose

De momento no usaremos mas librerias, frameworks o otras tecnologias, enfocate
en estos

# Principios

- Bajo acoplamiento y alta cohesion
- Inyeccion de datos en las pages
- Responsabilidad Unica

# Patron MVC en NextJS

- Modelos: Seran la capa que interactue contra la bd, aca se plasmaran las
  consultas y transacciones segun la entidad
- Actions: llamaran a las funciones de los modelos para crear la logica
  necesaria
- Components: Aca estaran los componentes con el contenido que iran y necesitan
  cada page (en components lo ideal seria usar un wrapper y luego llamar al
  content)
- Page: sera la encarga de llamar e inyectar props a los componentes llamados

# Base de Datos

La base de datos sera postgresql, esta contendra las relaciones y entidades
necesarias para proveer y satisfacer los llamados del monolito, el proyecto
contara con un seed.ts este tendra la insercion de tablas y datos necesarios
para que la app pueda correr en cuantos minutos desde el primer momento

# Requerimientos de entorno con Docker

El proyecto correra con docker compose, levantando los servicios esenciales que
seran la app y su bd, adicionalmente otor servicio pgadmin expuesto para
gestionar la bd con interfaz, para el servicio de la app debe ser un bind
volume, de forma que el proyecto pueda actualizarse al momento de hacer cambios,
de forma que no se trabajara con el servidor web de node si no con docker.

Dentro del compose debes definir el ambiente de prod y dev en funcion de una
variable de entorno en el .env

Ese compose es el entorno de DESARROLLO. Lo de abajo es lo que hay en
produccion.

# Despliegue

La aplicacion se despliega en **Vercel**, bajo el subdominio `app.` del dominio
de la landing, con la base de datos en **Neon** (Ohio, us-east-2).

Tres cosas que hay que tener presentes antes de tocar nada de esto:

- **Vercel no usa el Dockerfile.** Detecta Next.js y lo compila con su propio
  proceso. El `docker/Dockerfile` y el perfil `prod` del compose se conservan
  para el dia que la aplicacion se mude a un VPS, que es el plan a medio plazo.
- **El disco de una funcion de Vercel es de solo lectura** salvo `/tmp`, y
  `public/` se hornea en el build. Por eso la subida de foto de perfil esta
  apagada: su codigo esta comentado, no borrado, y vuelve sin cambios el dia
  del VPS. No escribas archivos al disco en codigo de servidor.
- **ProtonVPN bloquea el puerto 5432 de salida**, asi que la maquina de
  desarrollo no alcanza Neon. Desarrollo va contra el PostgreSQL de Docker, y
  la base de produccion se siembra generando un `.sql` con
  `npm run sql:produccion` y pegandolo en el editor del panel de Neon. Si
  cambias el esquema, hay que repetir ese pegado.

Las credenciales no se publican en el README ni en ningun documento del
repositorio: se le piden al responsable.

# Autenticacion y Autorizacion

La app tendra autenticacion y autorizacion, la autenticacion sera por correo y
contraseña, y la autorizacion sera por roles, los roles seran admin, trabajador,
cliente. Esta sera manjeda con JWT haciendo uso del proxy.ts definido para
nextjs y haciendo uso de la libreria jose para el manejo de jwt, haciendo uso de
las cookies, para la bd en cuanto a autenticacion y autorizacion estara la tabla
usuarios, que guardara la informacion de ese usuario, existira tabla clientes y
trabajadores, aca usaras la llave foranea de la tabla usuarios para enlazar
estos usuarios segun su labor, si son clientes de nosotros o trabajdores, aca en
trabajadores definiras los roles tambien con tabla roles, y para clientes tendra
su tabla empresas, ahora de esta forma se puede validar si esa persona que
ingresa es trabajador o cliente y que hace o a quien pertenece para mostrar la
informacion necesaria

# Interfaz

La interfaz sera creada usando el comando /design de claude code, una vez
aprobada la interfaz, esta debe ser creada para soportar la mayoria de
navegadores y dispositivos, para la creacion de la interfaz debes hacer uso de
lucide react para los iconos y tailwindcss para los estilos, procura armonia en
el diseño responsive, y define los colores para temas oscuros y claros en
funcion del dispositivo, ademas de permitir al usuario poder cambiar entre ambos
temas, para la carga de las pages hacer uso respectivo de los loadings, que
cumplan con el diseño parecido a su pagina, busca las animaciones de entradas
para los componentes y para botones define un paleta de oscuros y al hover hacer
transition en y y no scale, y hover a colores claros

# Colores

Paleta de marca — los seis únicos, todo lo demás se deriva de aquí:

- --color-navy	#051a2a	Ink Black	el azul, color predominante
- --color-white	#ffffff	—	letra sobre azul
- --color-gold	#fae890	Light Gold	acento, sólo sobre azul
- --color-blackberry	#602249	Blackberry Cream	hover
- --color-violet	#321327	Midnight Violet	hover más profundo
- --color-black	#040404	—	letra sobre fondo claro

# Tipografia

Dos familias, y no son intercambiables.

- Poppins — --font-sans. Es la tipografía del sitio: cuerpo, nav, botones,
  etiquetas, breadcrumbs, tarjetas, formularios y todos los titulares grandes.
  El 95% del texto. Pesos 400/500/600/700/800.
- Fraunces — --font-display. Variable, eje opsz 9..144, pesos 600..900. El
  patrón es al revés de lo que parece:
  - línea pequeña → FRAUNCES (la voz)
  - titular grande → POPPINS (el volumen)

# Estructura

Toda la app estara dentro de src y respetar el uso de ts:

- app/ # las pages de la app
- components/ # los componentes de la app
- models/ # los modelos de la app
- actions/ # las actions de la app
- types/ # los types de la app

# Fase 1

## Autorizacion y Autenticacion

Para este primera fase se comenzara la parte del login, debe estar en la ruta
raiz /, o la ruta raiz siempre de redirigir a /login, solo cuando este
autenticado, en el caso de que este autenticado se redirigira a /dashboard, el
usuario con rol administrador sera el unico capaz de crear usuarios, las
contraseñas deben de estar encriptadas, y eso es lo que abarcara esta primera
fase ademas de la creacion del primer modulo que sera para todos, el modulo de
mi perfil, en este podras hacer cambios a tu perfil para los datos, subir una
foto, cambiar tu contraseña, cerrar sesion, o cambiar el tema y antes de empezar
a crear la interfaz debes con el comando dsegin generar distintas vistas para su
aprobacion y luego implementacion, debe estar el login, el dashboard inicial,
junto con si sidebar y header para mobile, ademas de contenido del home, que
sera wrapper donde estara el titulo y luego content que variara en funcion del
modulo en el que se encuentre el usuario, este content debe estar acompanado de
un breacrumb, ademas la vista debe de mostrar un loading mientras se cargan los
datos.

- Creacion de las tablas necesarias
- Creacion de los modelos
- Creacion de las actions
- Creacion de las pages
- Creacion de los componentes

@AGENTS.md

# Fase 2

## Modulo para creacion de hooks

Este modulo que representa la fase 2 , es un modulo o un conjunto de modulos que
permitiran la creacion de hooks para videos, ahora, este modulo debe ser para
los roles trabajadores con el cargo creadoras de contenido, la forma en como la
vas a incorporar en el sidebar es Hooks y sera un desplegable que liste los
submodulos necesarios para esa entidad hooks o ese proceso de creacion de hooks,
tienes la documentacion para la logica en docs/creacionHooks.md, esta logica era
como se hacia en la app vieja de forma que debes conservar el flujo como tal de
trabajo pero rediseñarlo completamente para que se vea como una app moderna,
ademas quiero que la documentacion sea para cada submodulo correspondiente, me
gustaria ver que dise;o se puede aplicar para esto en base a al documento que te
paso, tambien verifica que se creara a nivel de bd y codigo, luego que lo haya
hecho haras pruebas para verificar el funcioanmiento y guardado de esta nueva
incorporacion, recuerda seguir el contrato ya establecido

- Creacion de las tablas necesarias
- Creacion de los modelos
- Creacion de las actions
- Creacion de las pages
- Creacion de los componentes
