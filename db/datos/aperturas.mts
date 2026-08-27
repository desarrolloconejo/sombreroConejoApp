/**
 * Las 42 aperturas, tal como estan en docs/creacionHooks.md (anexo A).
 *
 * Solo son la SEMILLA. Una vez sembradas viven en la base y la agencia las
 * gestiona desde el modulo: puede corregir una redaccion, anadir la 43 y
 * retirar la que deje de servir sin tocar este archivo ni desplegar.
 *
 * Por eso el seed las inserta con ON CONFLICT (numero) DO NOTHING: volver a
 * ejecutarlo no pisa una redaccion que alguien haya mejorado.
 */

export type AperturaSemilla = {
  numero: number;
  territorio: "a" | "b" | "c" | "d" | "e" | "f" | "g";
  mecanismos: string[];
  plantilla: string;
  ejemplo: string;
  insertTitulo: string;
  direccionEdicion: string;
  usalaCuando: string;
};

export const APERTURAS: AperturaSemilla[] = [
  // ===================== A · Curiosidad util =====================
  {
    numero: 1,
    territorio: "a",
    mecanismos: ["dato", "prueba_visual"],
    plantilla: "El detalle de [objeto/proceso] que cambia [resultado].",
    ejemplo: "El detalle de esta etiqueta que cambia como eliges cafe.",
    insertTitulo: "El detalle de la etiqueta",
    direccionEdicion:
      "Macro del detalle, circulo o zoom. Insert-Titulo de tres a cinco palabras.",
    usalaCuando: "Existe un detalle concreto que explica una decision.",
  },
  {
    numero: 2,
    territorio: "a",
    mecanismos: ["comparacion", "prueba_visual"],
    plantilla: "Probamos [A] y [B] para entender [pregunta].",
    ejemplo:
      "Probamos dos formas de cocinar arroz para ver cual queda mas suelto.",
    insertTitulo: "Dos arroces, un ganador",
    direccionEdicion: "Pantalla dividida desde el fotograma uno, sin introduccion.",
    usalaCuando: "Puedes mostrar una comparacion justa.",
  },
  {
    numero: 3,
    territorio: "a",
    mecanismos: ["numero", "prueba_visual"],
    plantilla: "[Cantidad] segundos para ver por que [resultado].",
    ejemplo: "15 segundos para ver por que este corte da mas volumen.",
    insertTitulo: "15 segundos, mas volumen",
    direccionEdicion:
      "Cuenta regresiva ligera y demostracion inmediata. Sin explicacion previa.",
    usalaCuando: "El mecanismo se puede revelar rapido.",
  },
  {
    numero: 4,
    territorio: "a",
    mecanismos: ["prueba_visual"],
    plantilla: "Esto parecia [suposicion], hasta que vimos [prueba].",
    ejemplo: "Parecia una crema normal, hasta que la vimos sobre piel seca.",
    insertTitulo: "Hasta que la vimos asi",
    direccionEdicion:
      "Inicio con la expectativa y corte seco hacia la prueba en el segundo 2.",
    usalaCuando: "Hay una sorpresa verificable.",
  },
  {
    numero: 5,
    territorio: "a",
    mecanismos: ["comparacion"],
    plantilla: "La diferencia entre [A] y [B] para decidir mejor.",
    ejemplo: "La diferencia entre cafe de origen y blend, en una taza.",
    insertTitulo: "Origen o blend",
    direccionEdicion: "Dos objetos lado a lado con etiquetas limpias y legibles.",
    usalaCuando: "El contenido aclara una confusion habitual.",
  },
  {
    numero: 6,
    territorio: "a",
    mecanismos: ["persona", "comparacion"],
    plantilla: "Si [situacion], mira esto antes de elegir [producto].",
    ejemplo: "Si estas renovando escritorio, mira esto antes de elegir silla.",
    insertTitulo: "Antes de elegir silla",
    direccionEdicion:
      "Escena cotidiana del problema, transicion al criterio de decision.",
    usalaCuando: "El producto responde a una decision concreta.",
  },

  // ===================== B · Demostracion =====================
  {
    numero: 7,
    territorio: "b",
    mecanismos: ["antes_despues", "prueba_visual"],
    plantilla: "Asi se ve [resultado] cuando [metodo] se usa asi.",
    ejemplo: "Asi queda la cocina cuando cada utensilio tiene su zona.",
    insertTitulo: "Cada cosa, su zona",
    direccionEdicion:
      "Antes y despues con el mismo angulo de camara. Sin transicion decorativa.",
    usalaCuando: "La transformacion es visualmente clara.",
  },
  {
    numero: 8,
    territorio: "b",
    mecanismos: ["antes_despues", "prueba_visual"],
    plantilla: "De [estado inicial] a [estado deseado] con [accion].",
    ejemplo: "De agenda caotica a semana clara en 10 minutos.",
    insertTitulo: "Caos a semana clara",
    direccionEdicion:
      "El estado inicial dura un segundo. Entrar al proceso enseguida.",
    usalaCuando: "La mejora requiere pasos simples y demostrables.",
  },
  {
    numero: 9,
    territorio: "b",
    mecanismos: ["prueba_visual"],
    plantilla: "Ponemos a prueba [producto] en [situacion real].",
    ejemplo: "Ponemos a prueba esta mochila en un viaje de dos dias.",
    insertTitulo: "Dos dias, una mochila",
    direccionEdicion: "Contexto real de uso, texto minimo, nada de estudio.",
    usalaCuando: "El producto gana credibilidad en accion.",
  },
  {
    numero: 10,
    territorio: "b",
    mecanismos: ["prueba_visual"],
    plantilla: "El paso que cambia [resultado] esta aqui.",
    ejemplo: "El paso que cambia la textura de esta salsa esta aqui.",
    insertTitulo: "Este paso lo cambia todo",
    direccionEdicion:
      "Mano ejecutando el paso. Sonido limpio o textura sonora de apoyo.",
    usalaCuando: "Hay un momento tecnico decisivo.",
  },
  {
    numero: 11,
    territorio: "b",
    mecanismos: ["comparacion", "prueba_visual"],
    plantilla: "Mismo objetivo, dos caminos: [A] y [B].",
    ejemplo: "Mismo objetivo, dos desayunos: energia o pico de hambre.",
    insertTitulo: "Dos desayunos, dos mananas",
    direccionEdicion:
      "Dos rutas visuales paralelas y conclusion clara al final.",
    usalaCuando: "La comparacion educa sin dramatizar.",
  },
  {
    numero: 12,
    territorio: "b",
    mecanismos: ["prueba_visual", "dato"],
    plantilla: "Lo que pasa cuando [accion] se hace con [detalle correcto].",
    ejemplo:
      "Lo que pasa cuando aplicas protector solar en la cantidad correcta.",
    insertTitulo: "La cantidad correcta",
    direccionEdicion: "Demostracion con medida visual. Cierre con el resultado.",
    usalaCuando: "Corriges una practica comun con respeto.",
  },

  // ===================== C · Historia y oficio =====================
  {
    numero: 13,
    territorio: "c",
    mecanismos: ["persona", "numero"],
    plantilla: "Lo que aprendimos al intentar [reto real].",
    ejemplo: "Lo que aprendimos sirviendo 300 desayunos en una manana.",
    insertTitulo: "300 desayunos, una manana",
    direccionEdicion: "Empieza por la escena mas intensa y pasa a la leccion.",
    usalaCuando: "El equipo vivio algo que aporta contexto.",
  },
  {
    numero: 14,
    territorio: "c",
    mecanismos: ["persona", "prueba_visual"],
    plantilla: "Esta parte de [oficio] casi nadie la ve.",
    ejemplo: "Esta parte de hacer pan casi nadie la ve.",
    insertTitulo: "La parte que no se ve",
    direccionEdicion:
      "Manos, herramientas y detalle del proceso. Deja respirar el sonido.",
    usalaCuando: "El detras de escena muestra oficio y paciencia.",
  },
  {
    numero: 15,
    territorio: "c",
    mecanismos: ["persona"],
    plantilla: "Cuando [persona] nos dijo [frase], entendimos que...",
    ejemplo:
      "Cuando una clienta dijo «quiero sentirme yo misma», cambiamos todo.",
    insertTitulo: "Quiero sentirme yo misma",
    direccionEdicion: "Persona hablando a camara. B-roll autentico, no de archivo.",
    usalaCuando: "Hay una conversacion real que orienta a la marca.",
  },
  {
    numero: 16,
    territorio: "c",
    mecanismos: ["persona", "antes_despues"],
    plantilla: "El pequeno cambio que hizo mas facil [situacion].",
    ejemplo: "El cambio que hizo mas facil llegar a casa con dos bebes.",
    insertTitulo: "Llegar a casa con bebes",
    direccionEdicion: "Escena cotidiana y solucion integrada, no exhibida.",
    usalaCuando: "La mejora se conecta con una rutina real.",
  },
  {
    numero: 17,
    territorio: "c",
    mecanismos: ["persona", "pregunta"],
    plantilla: "De esta pregunta nacio [producto o decision].",
    ejemplo: "De esta pregunta nacio nuestra forma de empacar pedidos.",
    insertTitulo: "De una pregunta",
    direccionEdicion: "Mostrar la pregunta escrita y el prototipo o resultado.",
    usalaCuando: "Quieres explicar la conviccion de marca.",
  },
  {
    numero: 18,
    territorio: "c",
    mecanismos: ["persona", "prueba_visual"],
    plantilla: "La parte mas satisfactoria de [oficio] empieza aqui.",
    ejemplo: "La parte mas satisfactoria de restaurar una mesa empieza aqui.",
    insertTitulo: "Empieza aqui",
    direccionEdicion:
      "Primer plano tactil. Que el gesto y el sonido lleven la escena.",
    usalaCuando: "El valor esta en el proceso y la transformacion.",
  },

  // ===================== D · Identidad =====================
  {
    numero: 19,
    territorio: "d",
    mecanismos: ["persona"],
    plantilla: "Para quienes [comportamiento reconocible].",
    ejemplo: "Para quienes cocinan lento incluso en semanas ocupadas.",
    insertTitulo: "Cocinar lento, semana ocupada",
    direccionEdicion:
      "Insert-Titulo directo sobre escena aspiracional pero cotidiana.",
    usalaCuando: "La audiencia comparte una identidad clara.",
  },
  {
    numero: 20,
    territorio: "d",
    mecanismos: ["persona", "pregunta"],
    plantilla: "Si tu version de [situacion] se parece a esto...",
    ejemplo: "Si tu version de oficina ordenada se parece a esto...",
    insertTitulo: "Tu oficina es asi?",
    direccionEdicion: "Montaje breve de detalles reconocibles, ritmo rapido.",
    usalaCuando: "Invitas a identificarse sin excluir.",
  },
  {
    numero: 21,
    territorio: "d",
    mecanismos: ["persona"],
    plantilla: "El ritual de [momento] que entendemos quienes [grupo].",
    ejemplo: "El ritual del domingo que entendemos quienes recibimos amigos.",
    insertTitulo: "El ritual del domingo",
    direccionEdicion: "Musica calida y gestos naturales. Nada de plano publicitario.",
    usalaCuando: "La marca entra en una rutina significativa.",
  },
  {
    numero: 22,
    territorio: "d",
    mecanismos: ["persona"],
    plantilla: "La senal de que eres de [comunidad] es [detalle].",
    ejemplo: "Si hueles la bolsa antes de abrirla, esto es para ti.",
    insertTitulo: "Hueles la bolsa, verdad?",
    direccionEdicion: "Primer plano del gesto y remate visual rapido.",
    usalaCuando: "Hay una observacion ligera y genuina.",
  },
  {
    numero: 23,
    territorio: "d",
    mecanismos: ["persona"],
    plantilla: "Cuando [situacion], este es el tipo de [solucion] que buscas.",
    ejemplo: "Cuando el dia se alarga, esta es la cena que buscas.",
    insertTitulo: "Cuando el dia se alarga",
    direccionEdicion: "Contraste entre jornada intensa y solucion simple.",
    usalaCuando: "El producto acompana un momento emocional.",
  },
  {
    numero: 24,
    territorio: "d",
    mecanismos: ["persona"],
    plantilla: "Tu [actividad] puede parecerse mas a ti con [detalle].",
    ejemplo: "Tu escritorio puede parecerse mas a ti con un sistema simple.",
    insertTitulo: "Que se parezca a ti",
    direccionEdicion: "Elementos personales reales, no un montaje de catalogo.",
    usalaCuando: "Quieres activar expresion personal o pertenencia.",
  },

  // ===================== E · Guia guardable =====================
  {
    numero: 25,
    territorio: "e",
    mecanismos: ["numero", "comparacion"],
    plantilla: "Tres senales para elegir [opcion] segun [criterio].",
    ejemplo: "Tres senales para elegir planta segun la luz de tu casa.",
    insertTitulo: "Tres senales, una planta",
    direccionEdicion:
      "Lista de tres con ejemplo visual en cada una. Insert-Titulo por etapa.",
    usalaCuando: "La audiencia necesita decidir entre opciones.",
  },
  {
    numero: 26,
    territorio: "e",
    mecanismos: ["prueba_visual"],
    plantilla: "La forma mas simple de empezar [accion] es esta.",
    ejemplo: "La forma mas simple de empezar movilidad es esta.",
    insertTitulo: "Empieza por aqui",
    direccionEdicion: "Mostrar el primer paso completo antes de explicarlo.",
    usalaCuando: "El tema parece dificil y se puede simplificar.",
  },
  {
    numero: 27,
    territorio: "e",
    mecanismos: ["numero"],
    plantilla: "Guarda esto para la proxima vez que [situacion].",
    ejemplo: "Guarda esto para la proxima maleta de fin de semana.",
    insertTitulo: "Para tu proxima maleta",
    direccionEdicion:
      "Abrir con el resultado. Checklist en pantalla, legible al pausar.",
    usalaCuando: "La pieza se consulta y se reutiliza.",
  },
  {
    numero: 28,
    territorio: "e",
    mecanismos: ["prueba_visual"],
    plantilla: "Asi organizamos [proceso] cuando necesitamos [resultado].",
    ejemplo:
      "Asi organizamos una semana de contenidos cuando falla la consistencia.",
    insertTitulo: "Una semana en un tablero",
    direccionEdicion: "Captura de proceso, notas o tablero real, no maqueta.",
    usalaCuando: "El cliente puede mostrar metodo, no solo resultado.",
  },
  {
    numero: 29,
    territorio: "e",
    mecanismos: ["pregunta"],
    plantilla: "La pregunta que resuelve [problema] mas rapido.",
    ejemplo: "La pregunta que resuelve una compra de muebles mas rapido.",
    insertTitulo: "Haz esta pregunta",
    direccionEdicion:
      "Pregunta grande en pantalla y ejemplo de respuesta inmediato.",
    usalaCuando: "Un marco mental aclara la decision.",
  },
  {
    numero: 30,
    territorio: "e",
    mecanismos: ["numero", "comparacion"],
    plantilla: "Antes de [accion], revisa estos [cantidad] puntos.",
    ejemplo: "Antes de contratar un seguro, revisa estos cuatro puntos.",
    insertTitulo: "Cuatro puntos antes de firmar",
    direccionEdicion: "Cada punto con imagen, icono o documento real.",
    usalaCuando: "Ofreces una revision util y responsable.",
  },

  // ===================== F · Objeciones =====================
  {
    numero: 31,
    territorio: "f",
    mecanismos: ["pregunta", "comparacion"],
    plantilla: "Vale la pena [servicio] si [condicion]?",
    ejemplo: "Vale la pena una asesoria si recien empiezas a invertir?",
    insertTitulo: "Vale la pena si empiezas?",
    direccionEdicion:
      "Pregunta frontal. Respuesta por condiciones, nunca promesa universal.",
    usalaCuando: "La audiencia formula una objecion clara.",
  },
  {
    numero: 32,
    territorio: "f",
    mecanismos: ["prueba_visual"],
    plantilla: "Lo que incluye [solucion] en una situacion real.",
    ejemplo: "Lo que incluye una asesoria cuando tu negocio esta creciendo.",
    insertTitulo: "Que incluye de verdad",
    direccionEdicion:
      "Recorrido de inicio a fin con pantallas o entregables reales.",
    usalaCuando: "Conviene hacer tangible un servicio intangible.",
  },
  {
    numero: 33,
    territorio: "f",
    mecanismos: ["prueba_visual", "dato"],
    plantilla: "Elegimos [decision] para resolver [necesidad], por esto.",
    ejemplo: "Elegimos este material para el uso diario de una familia.",
    insertTitulo: "Por que este material",
    direccionEdicion: "Mostrar el material en uso y el criterio de eleccion.",
    usalaCuando: "La marca tiene una decision de producto explicable.",
  },
  {
    numero: 34,
    territorio: "f",
    mecanismos: ["persona", "comparacion"],
    plantilla: "Para [perfil], [solucion] funciona mejor cuando [condicion].",
    ejemplo: "Para piel mixta, esta rutina funciona mejor si se simplifica.",
    insertTitulo: "Piel mixta: menos es mas",
    direccionEdicion:
      "Aclarar a quien aplica e incluir el limite o la contraindicacion.",
    usalaCuando: "Necesitas segmentar con honestidad.",
  },
  {
    numero: 35,
    territorio: "f",
    mecanismos: ["comparacion", "dato"],
    plantilla: "La comparacion que hacemos antes de recomendar [opcion].",
    ejemplo: "Lo que comparamos antes de recomendar una silla ergonomica.",
    insertTitulo: "Antes de recomendarla",
    direccionEdicion: "Tabla breve o prueba de uso con criterios visibles.",
    usalaCuando: "La confianza depende de explicar el proceso.",
  },
  {
    numero: 36,
    territorio: "f",
    mecanismos: ["persona"],
    plantilla: "Empieza por [paso] si quieres llegar a [resultado].",
    ejemplo: "Empieza por una consulta si quieres una cocina a medida.",
    insertTitulo: "Empieza por la consulta",
    direccionEdicion: "Mostrar como empieza, quien acompana y que pasa despues.",
    usalaCuando: "El CTA necesita reducir friccion y dar seguridad.",
  },

  // ===================== G · Contradiccion =====================
  {
    numero: 37,
    territorio: "g",
    mecanismos: ["dato", "coste"],
    plantilla: "[Practica aceptada] es la razon de [problema que ya tienen].",
    ejemplo: "Publicar todos los dias esta hundiendo tu alcance.",
    insertTitulo: "Publicar a diario te frena",
    direccionEdicion:
      "El dato o la curva en pantalla en el segundo 2. La prueba antes de la explicacion.",
    usalaCuando: "Tienes datos propios que contradicen la creencia.",
  },
  {
    numero: 38,
    territorio: "g",
    mecanismos: ["comparacion", "prueba_visual"],
    plantilla: "[Resultado] no depende de [causa asumida].",
    ejemplo: "Que el pan suba no depende de la levadura.",
    insertTitulo: "No es la levadura",
    direccionEdicion:
      "Dos panes identicos en plano. La variable real se revela despues.",
    usalaCuando: "Puedes demostrar la causa real en el mismo video.",
  },
  {
    numero: 39,
    territorio: "g",
    mecanismos: ["dato", "numero", "antes_despues"],
    plantilla: "Dejamos de [practica del sector] y [resultado medible].",
    ejemplo: "Dejamos de usar plantillas y bajamos las revisiones a la mitad.",
    insertTitulo: "Sin plantillas, mitad de revisiones",
    direccionEdicion: "Cifra antes y despues sobre pantalla real de trabajo.",
    usalaCuando: "La agencia o el cliente tomaron la decision de verdad.",
  },
  {
    numero: 40,
    territorio: "g",
    mecanismos: ["comparacion", "prueba_visual"],
    plantilla: "Lo que se recomienda para [objetivo] falla si [condicion].",
    ejemplo: "Lo que se recomienda para piel grasa falla en clima humedo.",
    insertTitulo: "Falla en clima humedo",
    direccionEdicion:
      "Mostrar el fallo, no contarlo. Producto en la condicion adversa.",
    usalaCuando: "La excepcion es real y afecta a una parte de tu publico.",
  },
  {
    numero: 41,
    territorio: "g",
    mecanismos: ["comparacion", "coste"],
    plantilla: "[Cosa cara] no arregla [problema]. [Cosa concreta] si.",
    ejemplo:
      "Una camara mejor no arregla un video aburrido. El primer plano si.",
    insertTitulo: "No es la camara",
    direccionEdicion:
      "Mismo plano rodado con movil y con camara: la diferencia no esta ahi.",
    usalaCuando: "Quieres desmontar una excusa de compra habitual.",
  },
  {
    numero: 42,
    territorio: "g",
    mecanismos: ["dato", "comparacion"],
    plantilla: "Todos miden [metrica popular]. Nosotros miramos [metrica real].",
    ejemplo: "Todos miran seguidores. Nosotros miramos envios por alcance.",
    insertTitulo: "Seguidores no, envios",
    direccionEdicion: "Captura real de analitica con la cifra senalada a mano.",
    usalaCuando: "Tienes una tesis de medicion que puedes defender.",
  },
];
