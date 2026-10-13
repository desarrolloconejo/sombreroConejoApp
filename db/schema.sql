-- ===========================================================================
-- Esquema de la Fase 1: autenticacion, autorizacion y perfil de usuario.
--
-- El archivo es idempotente: se puede ejecutar cuantas veces haga falta sin
-- destruir datos. Todo se crea con IF NOT EXISTS o con OR REPLACE.
--
-- Los correos se guardan tal cual los escribe el usuario, pero la unicidad y
-- las busquedas se hacen sobre lower(email). Asi no hace falta la extension
-- citext y el comportamiento queda explicito en cada consulta.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- La vista se suelta al principio y se vuelve a crear al final, en la misma
-- ejecucion.
--
-- Hacen falta las dos cosas: una vista bloquea cualquier ALTER sobre las
-- columnas de las que depende, y CREATE OR REPLACE VIEW tampoco admite anadir
-- ni renombrar columnas. Soltarla primero deja via libre a las migraciones.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS vw_usuarios_completos;


-- ---------------------------------------------------------------------------
-- roles: admin, trabajador y cliente
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id          SMALLSERIAL PRIMARY KEY,
  nombre      TEXT        NOT NULL UNIQUE,
  descripcion TEXT,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------------------
-- cargos: el area de la agencia a la que pertenece un trabajador.
--
-- NO es un texto descriptivo: de el depende QUE CONTENIDO ve esa persona.
-- Por eso es un conjunto cerrado con llave foranea, y no una columna libre.
--
-- Es el segundo eje de autorizacion, independiente del rol:
--   rol    -> que PUEDE HACER  (admin crea usuarios, trabajador no)
--   cargo  -> que VE           (redes ve lo de redes, tecnologia lo suyo)
--
-- Las filas viven aqui, con el esquema, y no en el seed, porque la logica de
-- la aplicacion depende de que existan: se comportan como un enumerado.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cargos (
  id          SMALLSERIAL PRIMARY KEY,
  slug        TEXT        NOT NULL UNIQUE,
  nombre      TEXT        NOT NULL,
  descripcion TEXT,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT cargos_slug_formato CHECK (slug ~ '^[a-z][a-z0-9_]*$')
);

INSERT INTO cargos (slug, nombre, descripcion) VALUES
  ('direccion',      'Direccion',      'Direccion de la agencia'),
  ('cuentas',        'Cuentas',        'Atencion y seguimiento de clientes'),
  ('redes',          'Redes',          'Gestion de redes sociales'),
  ('diseno',         'Diseno',         'Diseno grafico y audiovisual'),
  ('produccion',     'Produccion',     'Produccion audiovisual y de piezas'),
  ('tecnologia',     'Tecnologia',     'Desarrollo y soporte tecnico'),
  ('administracion', 'Administracion', 'Administracion y facturacion')
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------------
-- empresas: a que empresa pertenece cada cliente.
--
-- Igual que el cargo, determina QUE CONTENIDO ve el cliente: quien pertenece
-- a una empresa no ve lo de otra. Una empresa puede tener varias personas de
-- contacto, pero cada persona pertenece a una sola empresa.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS empresas (
  id             SERIAL      PRIMARY KEY,
  nombre         TEXT        NOT NULL,
  rif            TEXT        UNIQUE,
  telefono       TEXT,
  direccion      TEXT,
  logo_url       TEXT,
  activo         BOOLEAN     NOT NULL DEFAULT TRUE,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT empresas_nombre_no_vacio CHECK (length(btrim(nombre)) > 0)
);


-- ---------------------------------------------------------------------------
-- usuarios: credenciales y datos personales. No guarda el rol: eso depende de
-- si la persona es trabajador o cliente.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id             SERIAL      PRIMARY KEY,
  nombre         TEXT        NOT NULL,
  apellido       TEXT        NOT NULL,
  email          TEXT        NOT NULL,
  password_hash  TEXT        NOT NULL,
  telefono       TEXT,
  foto_url       TEXT,
  tema           TEXT        NOT NULL DEFAULT 'sistema',
  activo         BOOLEAN     NOT NULL DEFAULT TRUE,
  ultimo_acceso  TIMESTAMPTZ,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT usuarios_nombre_no_vacio   CHECK (length(btrim(nombre)) > 0),
  CONSTRAINT usuarios_apellido_no_vacio CHECK (length(btrim(apellido)) > 0),
  CONSTRAINT usuarios_tema_valido       CHECK (tema IN ('sistema', 'claro', 'oscuro')),
  -- Validacion minima de forma. La validacion real vive en la capa de actions.
  CONSTRAINT usuarios_email_formato     CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'),
  -- Un hash de bcrypt siempre empieza por $2 y mide 60 caracteres: impide que
  -- por error se guarde una contrasena en texto plano.
  CONSTRAINT usuarios_password_hasheada CHECK (password_hash ~ '^[$]2[aby][$]')
);

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_unico ON usuarios (lower(email));
CREATE INDEX IF NOT EXISTS usuarios_activo_idx ON usuarios (activo);

-- ---------------------------------------------------------------------------
-- Acceso: bloqueo por intentos fallidos y cambio obligatorio de contrasena.
--
-- Van como ALTER y no dentro del CREATE TABLE para que lleguen tambien a una
-- base que ya existe. Las tres traen un valor por defecto que no cambia nada
-- para las cuentas actuales: nadie queda bloqueado ni obligado a cambiar su
-- contrasena por el hecho de aplicar esto.
--
--   debe_cambiar_clave  la contrasena la puso otra persona (alta o
--                       restablecimiento) y hay que elegir una propia antes
--                       de poder hacer nada.
--   intentos_fallidos   fallos seguidos desde el ultimo acierto.
--   bloqueado_hasta     hasta cuando no se admite ningun intento.
-- ---------------------------------------------------------------------------
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS debe_cambiar_clave BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS intentos_fallidos  SMALLINT    NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bloqueado_hasta    TIMESTAMPTZ;

DO $acceso$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_intentos_no_negativos'
  ) THEN
    ALTER TABLE usuarios
      ADD CONSTRAINT usuarios_intentos_no_negativos CHECK (intentos_fallidos >= 0);
  END IF;
END
$acceso$;


-- ---------------------------------------------------------------------------
-- trabajadores: personal de la empresa. Aqui vive el rol.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trabajadores (
  id            SERIAL      PRIMARY KEY,
  usuario_id    INTEGER     NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  rol_id        SMALLINT    NOT NULL        REFERENCES roles(id)    ON DELETE RESTRICT,
  cargo_id      SMALLINT    NOT NULL        REFERENCES cargos(id)   ON DELETE RESTRICT,
  fecha_ingreso DATE,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- La migracion va ANTES de los indices: uno de ellos es sobre cargo_id, y en
-- una base que venia del esquema anterior esa columna aun no existe.
-- Migracion para bases que ya existian con el cargo como texto libre.
-- Es idempotente: en una base nueva la tabla ya nace con cargo_id y estas
-- sentencias no encuentran nada que cambiar.
DO $migracion$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trabajadores' AND column_name = 'cargo'
  ) THEN
    ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS cargo_id SMALLINT REFERENCES cargos(id);
    -- El texto anterior no se puede traducir de forma fiable, asi que las
    -- filas existentes quedan en administracion y el seed las corrige.
    UPDATE trabajadores
       SET cargo_id = (SELECT id FROM cargos WHERE slug = 'administracion')
     WHERE cargo_id IS NULL;
    ALTER TABLE trabajadores ALTER COLUMN cargo_id SET NOT NULL;
    ALTER TABLE trabajadores DROP COLUMN cargo;
  END IF;
END
$migracion$;

CREATE INDEX IF NOT EXISTS trabajadores_rol_idx ON trabajadores (rol_id);
CREATE INDEX IF NOT EXISTS trabajadores_cargo_idx ON trabajadores (cargo_id);


-- ---------------------------------------------------------------------------
-- clientes: personas de las empresas a las que atendemos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
  id         SERIAL      PRIMARY KEY,
  usuario_id INTEGER     NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_id INTEGER     NOT NULL        REFERENCES empresas(id) ON DELETE RESTRICT,
  cargo      TEXT,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clientes_empresa_idx ON clientes (empresa_id);


-- ---------------------------------------------------------------------------
-- El sector de la empresa.
--
-- Lo pide la resolucion de regla del modulo de hooks: se busca una regla del
-- cliente, luego una de su sector, y si no hay ninguna el estandar de la casa.
-- Sin esta columna el escalon del medio no existe.
--
-- Va como migracion y no dentro del CREATE TABLE porque la tabla ya existe en
-- las bases de la fase 1. Es idempotente: en una base nueva la columna se
-- anade igual y no hay nada que convertir.
-- ---------------------------------------------------------------------------
DO $sector$
BEGIN
  ALTER TABLE empresas ADD COLUMN IF NOT EXISTS sector TEXT;
END
$sector$;

CREATE INDEX IF NOT EXISTS empresas_sector_idx ON empresas (sector);

-- ---------------------------------------------------------------------------
-- Donde esta la empresa en internet.
--
-- Van como COLUMNAS FIJAS y no como una tabla puente de "enlaces". La lista de
-- plataformas es corta y estable, y lo que se guarda es un enlace POR
-- plataforma, no una coleccion de enlaces sueltos: con una tabla aparte habria
-- que hacer un JOIN y decidir un orden para pintar cinco campos que siempre
-- son los mismos cinco. Es el mismo criterio que las etiquetas de una
-- referencia: menos maquinaria de la que el problema pide.
--
-- Se guardan como URL completa. Un handle suelto —"@lacuenta"— no se puede
-- abrir, y adivinar el dominio para completarlo es inventarse un dato.
-- ---------------------------------------------------------------------------
DO $redes$
BEGIN
  ALTER TABLE empresas ADD COLUMN IF NOT EXISTS sitio_web TEXT;
  ALTER TABLE empresas ADD COLUMN IF NOT EXISTS instagram TEXT;
  ALTER TABLE empresas ADD COLUMN IF NOT EXISTS tiktok    TEXT;
  ALTER TABLE empresas ADD COLUMN IF NOT EXISTS facebook  TEXT;
  ALTER TABLE empresas ADD COLUMN IF NOT EXISTS youtube   TEXT;
  ALTER TABLE empresas ADD COLUMN IF NOT EXISTS linkedin  TEXT;
END
$redes$;

-- El listado del modulo filtra por estado y ordena por nombre, y hasta ahora
-- ninguna de las dos columnas tenia indice: la tabla se leia entera. El de
-- nombre va sobre `lower(...)` porque asi es como se compara y se ordena.
CREATE INDEX IF NOT EXISTS empresas_activo_idx ON empresas (activo);
CREATE INDEX IF NOT EXISTS empresas_nombre_idx ON empresas (lower(nombre));

-- ---------------------------------------------------------------------------
-- sesiones: una fila por inicio de sesion.
--
-- El token de acceso (el JWT de la cookie) dura media hora y lleva el id de
-- su fila. Las guardias comprueban en cada peticion que la fila siga viva, y
-- eso es lo que permite cerrar una sesion desde el servidor: cambiar la
-- contrasena, desactivar una cuenta o detectar un token copiado la revocan, y
-- deja de valer en la siguiente peticion, no cuando caduque el JWT.
--
-- El motivo de revocacion es un conjunto cerrado. Su espejo esta en
-- `MotivoRevocacion` (src/types/sesion.ts): si se anade uno hay que tocar los
-- dos sitios.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sesiones (
  id                  BIGSERIAL   PRIMARY KEY,
  usuario_id          INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

  -- Del token de renovacion solo se guarda el hash: quien lea la tabla no
  -- puede hacerse pasar por nadie.
  token_hash          TEXT        NOT NULL,

  -- El token anterior a la ultima rotacion. Si alguien lo presenta pasado el
  -- margen, es que lo copiaron: se revoca la sesion entera.
  token_anterior_hash TEXT,
  rotada_en           TIMESTAMPTZ,

  navegador           TEXT,
  creada_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_uso          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Tope absoluto: aunque se renueve, la sesion termina aqui.
  caduca_en           TIMESTAMPTZ NOT NULL,

  revocada_en         TIMESTAMPTZ,
  motivo_revocacion   TEXT,

  CONSTRAINT sesiones_token_formato
    CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT sesiones_token_anterior_formato
    CHECK (token_anterior_hash IS NULL OR token_anterior_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT sesiones_motivo_valido
    CHECK (motivo_revocacion IS NULL OR motivo_revocacion IN (
      'salida', 'cerrada_por_usuario', 'clave_cambiada', 'clave_restablecida',
      'usuario_desactivado', 'empresa_desactivada', 'vinculo_cambiado',
      'token_reutilizado'
    )),
  CONSTRAINT sesiones_revocacion_completa
    CHECK ((revocada_en IS NULL) = (motivo_revocacion IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS sesiones_token_unico
  ON sesiones (token_hash);

CREATE INDEX IF NOT EXISTS sesiones_token_anterior_idx
  ON sesiones (token_anterior_hash)
  WHERE token_anterior_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS sesiones_usuario_vivas_idx
  ON sesiones (usuario_id)
  WHERE revocada_en IS NULL;


-- ===========================================================================
-- MODULO DE HOOKS
--
-- Cinco tablas. Todo el contenido es DEL EQUIPO: cualquier creadora ve y
-- edita lo de las demas, y por eso no hay ninguna columna que filtre por
-- usuario. creado_por guarda quien lo hizo, que sirve para atribuir y saber a
-- quien preguntar, no para restringir.
--
-- Los conjuntos cerrados (territorio, mecanismo, objetivo, plataforma,
-- estado) van como CHECK y no como tabla catalogo: la logica de la aplicacion
-- depende de que sean exactamente estos valores, igual que pasa con el tema
-- en usuarios. Su espejo en TypeScript esta en src/types/hooks.ts.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- aperturas_hook: las 42 formas de empezar.
--
-- Estan en la base y no en el codigo porque la agencia las gestiona: puede
-- corregir una redaccion, anadir la 43 y retirar la que deje de servir sin
-- desplegar. Se retiran con activa, nunca se borran: una apertura puede
-- estar citada en fichas antiguas.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aperturas_hook (
  id                SERIAL      PRIMARY KEY,
  numero            SMALLINT    NOT NULL UNIQUE,
  territorio        TEXT        NOT NULL,
  -- Un array y no una tabla puente: una apertura tiene uno o dos mecanismos
  -- y nunca se consulta 'todas las de mecanismo X' cruzando otra cosa.
  mecanismos        TEXT[]      NOT NULL DEFAULT '{}',
  plantilla         TEXT        NOT NULL,
  ejemplo           TEXT        NOT NULL,
  insert_titulo     TEXT        NOT NULL,
  direccion_edicion TEXT        NOT NULL,
  usala_cuando      TEXT        NOT NULL,
  activa            BOOLEAN     NOT NULL DEFAULT TRUE,
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT aperturas_territorio_valido CHECK (territorio IN ('a','b','c','d','e','f','g')),
  CONSTRAINT aperturas_plantilla_no_vacia CHECK (length(btrim(plantilla)) > 0)
);

CREATE INDEX IF NOT EXISTS aperturas_territorio_idx ON aperturas_hook (territorio);
CREATE INDEX IF NOT EXISTS aperturas_activa_idx ON aperturas_hook (activa);


-- ---------------------------------------------------------------------------
-- reglas_hook: como habla cada cuenta.
--
-- empresa_id y sector son los dos ejes de resolucion, y los dos son opcionales
-- a proposito: una regla de cliente lleva empresa_id, una de sector lleva
-- sector, y gana la del cliente. Las tres listas se SUMAN a las de la casa,
-- no las sustituyen.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reglas_hook (
  id                  SERIAL      PRIMARY KEY,
  etiqueta            TEXT        NOT NULL,
  empresa_id          INTEGER     REFERENCES empresas(id) ON DELETE CASCADE,
  sector              TEXT,
  max_palabras_voz    SMALLINT    NOT NULL DEFAULT 12,
  max_palabras_insert SMALLINT    NOT NULL DEFAULT 6,
  exigir_prueba       BOOLEAN     NOT NULL DEFAULT TRUE,
  preambulos          TEXT        NOT NULL DEFAULT '',
  formulas_gastadas   TEXT        NOT NULL DEFAULT '',
  terminos_tension    TEXT        NOT NULL DEFAULT '',
  creado_por          INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT reglas_etiqueta_no_vacia CHECK (length(btrim(etiqueta)) > 0),
  -- Los mismos limites que valida el formulario, tambien aqui: un INSERT que
  -- no pase por la action no puede dejar una regla imposible de cumplir.
  CONSTRAINT reglas_voz_en_rango CHECK (max_palabras_voz BETWEEN 3 AND 30),
  CONSTRAINT reglas_insert_en_rango CHECK (max_palabras_insert BETWEEN 2 AND 16),
  -- O es de cliente, o es de sector. Una regla sin ninguno de los dos no la
  -- alcanzaria nunca la resolucion.
  CONSTRAINT reglas_tiene_ambito CHECK (empresa_id IS NOT NULL OR sector IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS reglas_empresa_idx ON reglas_hook (empresa_id);
CREATE INDEX IF NOT EXISTS reglas_sector_idx ON reglas_hook (sector);


-- ---------------------------------------------------------------------------
-- fichas_hook: la decision completa de una pieza.
--
-- El estado son los tres hitos que dejan rastro, y de ellos sale el
-- porcentaje del recorrido que muestra la raiz: 33, 66 y 100.
--
-- Se guardan verdad_marca, pago_promesa y riesgo_claim, que la herramienta
-- original mostraba en la ficha pero no persistia. Son parte de la decision:
-- una ficha que al reabrirla ha perdido la verdad de marca hay que
-- reescribirla entera.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fichas_hook (
  id                SERIAL      PRIMARY KEY,
  empresa_id        INTEGER     NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  objetivo          TEXT        NOT NULL,
  plataforma        TEXT        NOT NULL,
  audiencia         TEXT,
  tension           TEXT,
  verdad_marca      TEXT,
  prueba            TEXT,
  hablado           TEXT        NOT NULL,
  insert_titulo     TEXT,
  primer_fotograma  TEXT,
  pago_promesa      TEXT,
  cta               TEXT,
  riesgo_claim      TEXT,
  nota_auditor      SMALLINT,
  metrica_principal TEXT,
  estado            TEXT        NOT NULL DEFAULT 'borrador',
  creado_por        INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fichas_objetivo_valido CHECK (
    objetivo IN ('alcance','guardados','compartidos','comunidad','consideracion','accion')
  ),
  CONSTRAINT fichas_plataforma_valida CHECK (
    plataforma IN ('reels','tiktok','shorts','anuncio')
  ),
  CONSTRAINT fichas_estado_valido CHECK (estado IN ('borrador','auditada','medida')),
  CONSTRAINT fichas_nota_en_rango CHECK (nota_auditor IS NULL OR nota_auditor BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS fichas_empresa_idx ON fichas_hook (empresa_id);
CREATE INDEX IF NOT EXISTS fichas_estado_idx ON fichas_hook (estado);
CREATE INDEX IF NOT EXISTS fichas_creado_por_idx ON fichas_hook (creado_por);


-- ---------------------------------------------------------------------------
-- resultados_hook: lo que paso de verdad. Uno a uno con la ficha.
--
-- ficha_id es UNICO, y de ahi sale que registrar dos veces la misma pieza
-- actualice en lugar de duplicar: el guardado es un INSERT ... ON CONFLICT
-- (ficha_id) DO UPDATE.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resultados_hook (
  id             SERIAL      PRIMARY KEY,
  ficha_id       INTEGER     NOT NULL UNIQUE REFERENCES fichas_hook(id) ON DELETE CASCADE,
  impresiones    INTEGER     NOT NULL DEFAULT 0,
  vistas_3s      INTEGER     NOT NULL DEFAULT 0,
  me_gusta       INTEGER     NOT NULL DEFAULT 0,
  compartidos    INTEGER     NOT NULL DEFAULT 0,
  clics          INTEGER     NOT NULL DEFAULT 0,
  guardados      INTEGER     NOT NULL DEFAULT 0,
  aprendizaje    TEXT,
  observado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT resultados_no_negativos CHECK (
    impresiones >= 0 AND vistas_3s >= 0 AND me_gusta >= 0
    AND compartidos >= 0 AND clics >= 0 AND guardados >= 0
  ),
  -- No se puede ver mas veces de las que se muestra. Una tasa por encima de
  -- 100 no es un dato raro, es un dato mal copiado.
  CONSTRAINT resultados_vistas_coherentes CHECK (vistas_3s <= impresiones)
);

-- ---------------------------------------------------------------------------
-- Migracion de las metricas de interaccion.
--
-- `me_gusta` no existia y `conversiones` si. El formulario, ademas, rotulaba
-- el campo de `guardados` con la metrica del objetivo de la ficha: con
-- objetivo "compartidos" ponia "Compartidos" y escribia en `guardados`, asi
-- que habia datos en la columna equivocada. Los rotulos ahora son fijos.
--
-- `conversiones` se retira porque nadie la pedia: la conversion se mide en la
-- plataforma de anuncios, no aqui.
-- ---------------------------------------------------------------------------
DO $metricas$
BEGIN
  ALTER TABLE resultados_hook ADD COLUMN IF NOT EXISTS me_gusta INTEGER NOT NULL DEFAULT 0;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resultados_hook' AND column_name = 'conversiones'
  ) THEN
    ALTER TABLE resultados_hook DROP CONSTRAINT IF EXISTS resultados_no_negativos;
    ALTER TABLE resultados_hook DROP COLUMN conversiones;
    ALTER TABLE resultados_hook ADD CONSTRAINT resultados_no_negativos CHECK (
      impresiones >= 0 AND vistas_3s >= 0 AND me_gusta >= 0
      AND compartidos >= 0 AND clics >= 0 AND guardados >= 0
    );
  END IF;
END
$metricas$;


-- ---------------------------------------------------------------------------
-- referencias_hook: el banco del equipo.
--
-- lectura es NOT NULL a proposito: guardar una referencia sin explicar por
-- que funciona deja un recorte suelto que dentro de un mes no le dice nada a
-- nadie. Es la unica regla de negocio que impone esta tabla.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referencias_hook (
  id            SERIAL      PRIMARY KEY,
  hablado       TEXT        NOT NULL,
  insert_titulo TEXT,
  plataforma    TEXT        NOT NULL,
  territorio    TEXT        NOT NULL,
  url_fuente    TEXT,
  lectura       TEXT        NOT NULL,
  etiquetas     TEXT        NOT NULL DEFAULT '',

  -- De que pieza propia salio, si salio de una.
  --
  -- Es NULL en las referencias de fuera, que son la mayoria: el banco nacio
  -- para guardar hooks ajenos. Cuando apunta a una ficha sirve para no volver
  -- a ofrecer "guardar como referencia" en el historial de algo que ya esta
  -- guardado.
  --
  -- ON DELETE SET NULL y no CASCADE: la lectura de por que funciono un hook
  -- vale por si sola, y borrar la ficha no debe llevarse el aprendizaje. La
  -- referencia se queda; solo pierde de donde vino.
  ficha_id      INTEGER     REFERENCES fichas_hook(id) ON DELETE SET NULL,

  creado_por    INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT referencias_hablado_no_vacio CHECK (length(btrim(hablado)) > 0),
  CONSTRAINT referencias_lectura_no_vacia CHECK (length(btrim(lectura)) > 0),
  CONSTRAINT referencias_territorio_valido CHECK (territorio IN ('a','b','c','d','e','f','g')),
  CONSTRAINT referencias_plataforma_valida CHECK (
    plataforma IN ('reels','tiktok','shorts','anuncio')
  )
);

CREATE INDEX IF NOT EXISTS referencias_territorio_idx ON referencias_hook (territorio);

-- ---------------------------------------------------------------------------
-- Migracion: ficha_id en referencias_hook.
--
-- Va aparte del CREATE TABLE porque las bases ya sembradas —la de produccion
-- entre ellas— no lo recrean. El bloque es idempotente: se puede ejecutar
-- tantas veces como haga falta.
-- ---------------------------------------------------------------------------
DO $referencias$
BEGIN
  ALTER TABLE referencias_hook
    ADD COLUMN IF NOT EXISTS ficha_id INTEGER REFERENCES fichas_hook(id) ON DELETE SET NULL;
END
$referencias$;

-- Se consulta siempre igual: "de esta ficha, hay referencia?".
CREATE INDEX IF NOT EXISTS referencias_ficha_idx
  ON referencias_hook (ficha_id) WHERE ficha_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- ediciones_ficha: quien ha tocado cada ficha, y cuando.
--
-- En el historial cualquiera puede editar la ficha de cualquiera, y hasta
-- ahora la ficha solo guardaba quien la creo y la fecha del ultimo cambio: no
-- habia forma de saber quien lo hizo, ni cuantas manos habian pasado.
--
-- Es un registro de SOLO ANADIR: nada lo actualiza ni lo borra. Reescribir un
-- historial de cambios lo convertiria en algo que no se puede creer, que es
-- justo lo contrario de para lo que sirve.
--
-- No guarda que campos cambiaron ni sus valores anteriores. Eso serviria para
-- deshacer, que es otra funcionalidad; aqui la pregunta es quien ha metido
-- mano, y para responderla basta con esto.
--
-- ON DELETE CASCADE: el registro habla de una ficha concreta y no significa
-- nada sin ella. Es al reves que el banco de referencias, donde lo que se
-- guarda —por que funciono un hook— vale por si solo.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ediciones_ficha (
  id         SERIAL      PRIMARY KEY,
  ficha_id   INTEGER     NOT NULL REFERENCES fichas_hook(id) ON DELETE CASCADE,
  usuario_id INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  accion     TEXT        NOT NULL,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ediciones_accion_valida CHECK (
    accion IN ('creada', 'editada', 'auditada', 'medida')
  )
);

-- Se consulta siempre igual: el historial de UNA ficha, de lo mas nuevo a lo
-- mas viejo.
CREATE INDEX IF NOT EXISTS ediciones_ficha_idx
  ON ediciones_ficha (ficha_id, creado_en DESC);

-- ---------------------------------------------------------------------------
-- Un usuario es trabajador o cliente, nunca ambos.
-- La restriccion cruza dos tablas, asi que no puede expresarse con un CHECK.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION verificar_usuario_exclusivo() RETURNS trigger AS $fn$
BEGIN
  IF TG_TABLE_NAME = 'trabajadores' THEN
    IF EXISTS (SELECT 1 FROM clientes WHERE usuario_id = NEW.usuario_id) THEN
      RAISE EXCEPTION 'El usuario % ya esta registrado como cliente', NEW.usuario_id
        USING ERRCODE = 'unique_violation';
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM trabajadores WHERE usuario_id = NEW.usuario_id) THEN
      RAISE EXCEPTION 'El usuario % ya esta registrado como trabajador', NEW.usuario_id
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trabajadores_exclusivo
  BEFORE INSERT OR UPDATE OF usuario_id ON trabajadores
  FOR EACH ROW EXECUTE FUNCTION verificar_usuario_exclusivo();

CREATE OR REPLACE TRIGGER clientes_exclusivo
  BEFORE INSERT OR UPDATE OF usuario_id ON clientes
  FOR EACH ROW EXECUTE FUNCTION verificar_usuario_exclusivo();


-- ---------------------------------------------------------------------------
-- actualizado_en se mantiene solo, sin depender de que la app lo recuerde
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION tocar_actualizado_en() RETURNS trigger AS $fn$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER usuarios_actualizado_en
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION tocar_actualizado_en();

CREATE OR REPLACE TRIGGER empresas_actualizado_en
  BEFORE UPDATE ON empresas
  FOR EACH ROW EXECUTE FUNCTION tocar_actualizado_en();

CREATE OR REPLACE TRIGGER aperturas_hook_actualizado_en
  BEFORE UPDATE ON aperturas_hook
  FOR EACH ROW EXECUTE FUNCTION tocar_actualizado_en();

CREATE OR REPLACE TRIGGER reglas_hook_actualizado_en
  BEFORE UPDATE ON reglas_hook
  FOR EACH ROW EXECUTE FUNCTION tocar_actualizado_en();

CREATE OR REPLACE TRIGGER fichas_hook_actualizado_en
  BEFORE UPDATE ON fichas_hook
  FOR EACH ROW EXECUTE FUNCTION tocar_actualizado_en();

CREATE OR REPLACE TRIGGER resultados_hook_actualizado_en
  BEFORE UPDATE ON resultados_hook
  FOR EACH ROW EXECUTE FUNCTION tocar_actualizado_en();


-- ---------------------------------------------------------------------------
-- Vista que resuelve en una sola consulta quien es la persona, de que tipo es,
-- que rol tiene y a que ambito pertenece. Es la que consume el login, el
-- perfil y el filtrado de contenido.
--
-- El rol de un cliente no sale de la tabla roles: se deriva de su presencia en
-- la tabla clientes, tal como define el modelo del proyecto.
--
-- Sobre las dos columnas de cargo:
--   cargo       es lo que se muestra. Para un trabajador, el nombre del cargo;
--               para un cliente, su puesto en su propia empresa, que es texto
--               descriptivo y no decide nada.
--   cargo_slug  es lo que decide. Solo lo tienen los trabajadores, y es contra
--               esto contra lo que se filtra el contenido. Nunca contra el
--               texto mostrado.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_usuarios_completos AS
SELECT
  u.id,
  u.nombre,
  u.apellido,
  u.email,
  u.password_hash,
  u.telefono,
  u.foto_url,
  u.tema,
  u.activo,
  u.ultimo_acceso,
  u.creado_en,
  u.actualizado_en,
  u.debe_cambiar_clave,
  u.bloqueado_hasta,
  CASE
    WHEN t.id IS NOT NULL THEN 'trabajador'
    WHEN c.id IS NOT NULL THEN 'cliente'
  END                                        AS tipo,
  CASE
    WHEN t.id IS NOT NULL THEN r.nombre
    WHEN c.id IS NOT NULL THEN 'cliente'
  END                                        AS rol,
  COALESCE(g.nombre, c.cargo)                AS cargo,
  g.slug                                     AS cargo_slug,
  t.cargo_id,
  t.fecha_ingreso,
  c.empresa_id,
  e.nombre                                   AS empresa_nombre,
  e.activo                                   AS empresa_activa
FROM usuarios u
LEFT JOIN trabajadores t ON t.usuario_id = u.id
LEFT JOIN roles        r ON r.id         = t.rol_id
LEFT JOIN cargos       g ON g.id         = t.cargo_id
LEFT JOIN clientes     c ON c.usuario_id = u.id
LEFT JOIN empresas     e ON e.id         = c.empresa_id;
