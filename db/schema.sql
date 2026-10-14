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
-- El rol de la aplicacion se crea lo primero: mas abajo se le dan permisos y
-- se escriben politicas a su nombre, y para eso tiene que existir. Que puede
-- hacer esta al final del archivo, en ROL DE LA APLICACION.
-- ---------------------------------------------------------------------------
DO $rol$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'conejo_app') THEN
    CREATE ROLE conejo_app NOLOGIN NOBYPASSRLS;
  END IF;
END
$rol$;


-- ---------------------------------------------------------------------------
-- La vista se suelta al principio y se vuelve a crear al final, en la misma
-- ejecucion.
--
-- Hacen falta las dos cosas: una vista bloquea cualquier ALTER sobre las
-- columnas de las que depende, y CREATE OR REPLACE VIEW tampoco admite anadir
-- ni renombrar columnas. Soltarla primero deja via libre a las migraciones.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS vw_usuarios_completos;
DROP VIEW IF EXISTS vw_usuarios_acceso;


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
-- ---------------------------------------------------------------------------
-- clientes.puede_aprobar: quien de la empresa decide en la fase 5.
--
-- Nace en falso para todos: aprobar compromete a la empresa, y lo concede el
-- administrador persona por persona (C1: si nadie lo tiene, nadie aprueba, y
-- el ejecutivo ve el aviso).
-- ---------------------------------------------------------------------------
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS puede_aprobar BOOLEAN NOT NULL DEFAULT FALSE;

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
-- Verificacion en dos pasos. Tras la contrasena, quien lo tenga activado
-- escribe un codigo de seis digitos de su app de codigos.
--
-- El secreto NO va en claro: va cifrado con una clave que vive en una variable
-- de entorno (TOTP_CLAVE). Quien lea la tabla no puede generar codigos.
--
--   totp_secreto       el secreto compartido con la app, cifrado. Existe desde
--                      que se empieza a activar.
--   totp_activado_en   cuando se confirmo con un codigo. Nulo = sin activar,
--                      aunque haya secreto: la activacion quedo a medias.
--   totp_ultimo_paso   el intervalo de 30 segundos del ultimo codigo aceptado.
--                      Un codigo no vale dos veces, ni dentro de su ventana.
--   dos_pasos_omitido  la persona dijo que prefiere no usarlos.
--
-- LOS DOS PASOS SE PIDEN POR DEFECTO. `dos_pasos_omitido` nace en falso para
-- todo el mundo, tambien para las cuentas que ya existen: al entrar, quien no
-- los tenga activados vera la pantalla para configurarlos, y ahi mismo puede
-- decir que no. Sin esta columna no habria forma de distinguir «aun no se lo
-- hemos preguntado» de «ya dijo que no», y se le preguntaria en cada entrada.
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS totp_secreto      TEXT,
  ADD COLUMN IF NOT EXISTS totp_activado_en  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS totp_ultimo_paso  BIGINT,
  ADD COLUMN IF NOT EXISTS dos_pasos_omitido BOOLEAN NOT NULL DEFAULT FALSE;

DO $dospasos$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_totp_activado_con_secreto'
  ) THEN
    ALTER TABLE usuarios
      ADD CONSTRAINT usuarios_totp_activado_con_secreto
      CHECK (totp_activado_en IS NULL OR totp_secreto IS NOT NULL);
  END IF;
END
$dospasos$;

-- ---------------------------------------------------------------------------
-- codigos_respaldo: la salida para quien no tiene el telefono a mano.
--
-- Se guarda el hash, no el codigo: se muestran una sola vez, al activar. Cada
-- uno sirve una vez; al usarlo se marca, no se borra, para que quede cuando.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS codigos_respaldo (
  id          BIGSERIAL   PRIMARY KEY,
  usuario_id  INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  codigo_hash TEXT        NOT NULL,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  usado_en    TIMESTAMPTZ,

  CONSTRAINT codigos_respaldo_hash_formato CHECK (codigo_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT codigos_respaldo_unico UNIQUE (usuario_id, codigo_hash)
);

CREATE INDEX IF NOT EXISTS codigos_respaldo_vivos_idx
  ON codigos_respaldo (usuario_id)
  WHERE usado_en IS NULL;

-- Con DELETE: al desactivar los dos pasos, o al volver a activarlos, los
-- codigos anteriores se retiran.
GRANT SELECT, INSERT, UPDATE, DELETE ON codigos_respaldo TO conejo_app;
GRANT USAGE, SELECT ON SEQUENCE codigos_respaldo_id_seq TO conejo_app;


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


-- ---------------------------------------------------------------------------
-- auditoria: quien hizo que, en toda la aplicacion.
--
-- La escriben las actions, en la MISMA transaccion que el cambio: si el cambio
-- se deshace, su linea tambien; si la linea no se puede escribir, el cambio no
-- ocurre.
--
-- `accion` es un conjunto cerrado, pero el CHECK solo fija su forma: cada
-- modulo anade las suyas y un CHECK con la lista obligaria a migrar la tabla
-- con cada modulo nuevo. La lista vive en `AccionAuditoria`
-- (src/types/auditoria.ts).
--
-- `ediciones_ficha` no se sustituye: es el historial que se muestra dentro de
-- una ficha de hook.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria (
  id          BIGSERIAL   PRIMARY KEY,

  -- Quien. Nulo cuando no hay nadie identificado: un intento de entrar con un
  -- correo que no existe. El rol y el cargo se COPIAN: dentro de un ano
  -- importa lo que esa persona era entonces, no lo que es ahora.
  actor_id    INTEGER     REFERENCES usuarios(id),
  actor_rol   TEXT,
  actor_cargo TEXT,

  -- Que. Siempre con la forma `entidad.hecho`.
  accion      TEXT        NOT NULL,

  -- Sobre que, y de que empresa.
  entidad     TEXT,
  entidad_id  BIGINT,
  empresa_id  INTEGER     REFERENCES empresas(id),

  -- Solo los campos que cambiaron. Nunca contrasenas ni tokens.
  antes       JSONB,
  despues     JSONB,

  ip          TEXT,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT auditoria_accion_formato CHECK (accion ~ '^[a-z_]+[.][a-z_]+$')
);

CREATE INDEX IF NOT EXISTS auditoria_fecha_idx   ON auditoria (creado_en DESC, id DESC);
CREATE INDEX IF NOT EXISTS auditoria_actor_idx   ON auditoria (actor_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS auditoria_entidad_idx ON auditoria (entidad, entidad_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS auditoria_empresa_idx ON auditoria (empresa_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS auditoria_accion_idx  ON auditoria (accion);

-- Solo se anade. Ni la aplicacion ni nadie con acceso a la base puede cambiar
-- o borrar una linea sin quitar antes estos triggers, y eso deja rastro.
CREATE OR REPLACE FUNCTION auditoria_solo_anadir() RETURNS trigger AS $fn$
BEGIN
  RAISE EXCEPTION 'La auditoria solo admite lineas nuevas: no se cambia ni se borra'
    USING ERRCODE = 'insufficient_privilege';
END;
$fn$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER auditoria_inmutable
  BEFORE UPDATE OR DELETE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION auditoria_solo_anadir();

CREATE OR REPLACE TRIGGER auditoria_sin_vaciar
  BEFORE TRUNCATE ON auditoria
  FOR EACH STATEMENT EXECUTE FUNCTION auditoria_solo_anadir();


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
--
-- No trae el hash de la contrasena: para eso esta vw_usuarios_acceso.
--
-- security_invoker hace que la vista se consulte con los permisos de quien
-- pregunta y no con los de su duena. Hoy no cambia nada; el dia que una tabla
-- tenga seguridad por fila, es lo que impide que la vista se la salte.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_usuarios_completos
WITH (security_invoker = true) AS
SELECT
  u.id,
  u.nombre,
  u.apellido,
  u.email,
  u.telefono,
  u.foto_url,
  u.tema,
  u.activo,
  u.ultimo_acceso,
  u.creado_en,
  u.actualizado_en,
  u.debe_cambiar_clave,
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
  e.activo                                   AS empresa_activa,
  c.puede_aprobar                            AS puede_aprobar
FROM usuarios u
LEFT JOIN trabajadores t ON t.usuario_id = u.id
LEFT JOIN roles        r ON r.id         = t.rol_id
LEFT JOIN cargos       g ON g.id         = t.cargo_id
LEFT JOIN clientes     c ON c.usuario_id = u.id
LEFT JOIN empresas     e ON e.id         = c.empresa_id;


-- ---------------------------------------------------------------------------
-- Lo unico que necesita el inicio de sesion, y nada mas.
--
-- El hash de la contrasena vive aqui y NO en vw_usuarios_completos, que es la
-- que consultan las pages y los listados: asi ningun modelo lo puede traer por
-- descuido al anadir una columna a una consulta.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_usuarios_acceso
WITH (security_invoker = true) AS
SELECT
  u.id,
  u.password_hash,
  (u.bloqueado_hasta IS NOT NULL AND u.bloqueado_hasta > now()) AS bloqueado,
  u.totp_secreto,
  (u.totp_activado_en IS NOT NULL) AS dos_pasos,
  u.totp_ultimo_paso
FROM usuarios u;


-- ===========================================================================
-- ROL DE LA APLICACION
--
-- La aplicacion NO se conecta como duena de la base. Se conecta como
-- `conejo_app`, que no puede cambiar el esquema, no se salta la seguridad por
-- fila y solo tiene los permisos de abajo.
--
-- El rol se crea al principio del archivo, sin contrasena y sin poder iniciar
-- sesion: este archivo va al repositorio y no puede llevar un secreto. La contrasena se pone aparte:
-- en desarrollo la pone el seed; en produccion, el responsable
-- (db/neon/05-rol-de-la-aplicacion.sql).
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- Lo que puede hacer el rol de la aplicacion.
--
-- La regla es dar lo justo: leer y escribir donde la aplicacion escribe, y
-- nada de lo que no hace nunca. Asi un fallo en el codigo —o una inyeccion—
-- no puede borrar una cuenta ni reescribir la auditoria aunque lo intente.
--
--   catalogos (roles, cargos)        solo lectura
--   personas, empresas y sesiones    sin DELETE: se desactivan o se revocan
--   auditoria                        solo INSERT y SELECT
--   hooks                            DELETE solo donde existe el borrado
--
-- Una tabla nueva nace con SELECT, INSERT y UPDATE para la aplicacion. Si
-- necesita DELETE, se le concede aqui de forma explicita.
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO conejo_app;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM conejo_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO conejo_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO conejo_app;

REVOKE INSERT, UPDATE ON roles, cargos FROM conejo_app;
REVOKE UPDATE ON auditoria FROM conejo_app;
GRANT DELETE ON fichas_hook, reglas_hook, referencias_hook TO conejo_app;
-- Los codigos de respaldo se retiran al desactivar los dos pasos.
GRANT DELETE ON codigos_respaldo TO conejo_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE ON TABLES TO conejo_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO conejo_app;


-- ===========================================================================
-- PORTAL Y FINANZAS
--
-- Las tablas de la integracion del portal viven en dos esquemas propios:
--
--   portal    proyectos, piezas, briefs, avisos, correos
--   finanzas  documentos, pagos, retenciones, tasas
--
-- Van aparte de `public` por dos motivos: los permisos y la seguridad por fila
-- se razonan por esquema, y no hay choques de nombres con lo que ya existe.
--
-- A partir de aqui las tablas llevan SEGURIDAD POR FILA. La aplicacion declara
-- quien hace cada peticion (`conSesion`, en src/lib/db.ts) y las politicas lo
-- leen: sin sesion declarada, cero filas.
-- ===========================================================================
CREATE SCHEMA IF NOT EXISTS portal;
CREATE SCHEMA IF NOT EXISTS finanzas;

GRANT USAGE ON SCHEMA portal, finanzas TO conejo_app;

-- Lo que se cree de aqui en adelante en estos esquemas nace con estos
-- permisos. Sin DELETE: en el portal las cosas se archivan o se anulan, y en
-- finanzas la aplicacion no borra nunca. Donde haga falta, se concede aparte.
ALTER DEFAULT PRIVILEGES IN SCHEMA portal
  GRANT SELECT, INSERT, UPDATE ON TABLES TO conejo_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA portal
  GRANT USAGE, SELECT ON SEQUENCES TO conejo_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA finanzas
  GRANT SELECT, INSERT, UPDATE ON TABLES TO conejo_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA finanzas
  GRANT USAGE, SELECT ON SEQUENCES TO conejo_app;

-- ---------------------------------------------------------------------------
-- Quien hace la peticion, visto desde la base.
--
-- La aplicacion lo declara al abrir cada transaccion (`conSesion`, en
-- src/lib/db.ts) y las politicas de seguridad por fila lo leen con estas
-- funciones. Sin sesion declarada devuelven NULL, y una politica que compara
-- contra NULL no deja pasar ninguna fila: lo seguro por defecto.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_usuario_id() RETURNS integer
  LANGUAGE sql STABLE
  AS $fn$ SELECT nullif(current_setting('app.usuario_id', true), '')::integer $fn$;

CREATE OR REPLACE FUNCTION app_rol() RETURNS text
  LANGUAGE sql STABLE
  AS $fn$ SELECT nullif(current_setting('app.rol', true), '') $fn$;

CREATE OR REPLACE FUNCTION app_cargo() RETURNS text
  LANGUAGE sql STABLE
  AS $fn$ SELECT nullif(current_setting('app.cargo', true), '') $fn$;

CREATE OR REPLACE FUNCTION app_empresa_id() RETURNS integer
  LANGUAGE sql STABLE
  AS $fn$ SELECT nullif(current_setting('app.empresa_id', true), '')::integer $fn$;

GRANT EXECUTE ON FUNCTION app_usuario_id(), app_rol(), app_cargo(), app_empresa_id()
  TO conejo_app;

-- ---------------------------------------------------------------------------
-- portal.correos_salida: cada correo que la aplicacion envia.
--
-- Es una bandeja de salida en el sentido estricto: la fila se escribe en la
-- MISMA transaccion que el cambio que provoca el correo, y la entrega ocurre
-- despues. Asi no existe un correo de «tu contrasena se restablecio» sin que
-- la contrasena se haya restablecido, ni al reves.
--
-- Con el correo en modo simulado es ademas lo que lo hace usable: nadie
-- recibe nada, y el administrador lee aqui el mensaje para entregarlo a mano.
--
-- NUNCA guarda contrasenas ni tokens. Los conjuntos cerrados tienen su espejo
-- en src/types/correo.ts.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.correos_salida (
  id               BIGSERIAL   PRIMARY KEY,

  para             TEXT        NOT NULL,
  para_usuario_id  INTEGER     REFERENCES usuarios(id),
  empresa_id       INTEGER     REFERENCES empresas(id),

  tipo             TEXT        NOT NULL,
  asunto           TEXT        NOT NULL,
  cuerpo           TEXT        NOT NULL,

  -- Con que modo se proceso, y como acabo.
  modo             TEXT        NOT NULL,
  estado           TEXT        NOT NULL,
  id_externo       TEXT,
  error            TEXT,
  intentos         SMALLINT    NOT NULL DEFAULT 0,

  -- Quien lo provoco. Nulo si lo origino el sistema.
  creado_por       INTEGER     REFERENCES usuarios(id),
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviado_en       TIMESTAMPTZ,

  -- Para el modo simulado: quien lo entrego a mano, y cuando.
  entregado_por    INTEGER     REFERENCES usuarios(id),
  entregado_en     TIMESTAMPTZ,

  CONSTRAINT correos_salida_tipo_formato
    CHECK (tipo ~ '^[a-z_]+$'),
  CONSTRAINT correos_salida_modo_valido
    CHECK (modo IN ('simulado', 'real')),
  CONSTRAINT correos_salida_estado_valido
    CHECK (estado IN ('simulado', 'pendiente', 'enviado', 'fallido')),
  CONSTRAINT correos_salida_para_no_vacio
    CHECK (length(btrim(para)) > 0),
  CONSTRAINT correos_salida_entrega_completa
    CHECK ((entregado_por IS NULL) = (entregado_en IS NULL))
);

CREATE INDEX IF NOT EXISTS correos_salida_fecha_idx
  ON portal.correos_salida (creado_en DESC, id DESC);
CREATE INDEX IF NOT EXISTS correos_salida_estado_idx
  ON portal.correos_salida (estado);

GRANT SELECT, INSERT, UPDATE ON portal.correos_salida TO conejo_app;
GRANT USAGE, SELECT ON SEQUENCE portal.correos_salida_id_seq TO conejo_app;

-- La bandeja la lee un administrador. Ademas, cada quien alcanza los correos
-- que el mismo provoco: sin eso, quien envia un correo no podria anotar
-- despues si la entrega salio bien, porque una fila que no se ve tampoco se
-- puede actualizar.
--
-- Escribir exige sesion declarada y que el correo vaya a nombre de quien la
-- declara: nadie puede dejar un correo como si lo hubiera provocado otro.
ALTER TABLE portal.correos_salida ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS correos_salida_lee_admin ON portal.correos_salida;
DROP POLICY IF EXISTS correos_salida_lee ON portal.correos_salida;
CREATE POLICY correos_salida_lee ON portal.correos_salida
  FOR SELECT TO conejo_app
  USING (app_rol() = 'admin' OR creado_por = app_usuario_id());

DROP POLICY IF EXISTS correos_salida_escribe_con_sesion ON portal.correos_salida;
DROP POLICY IF EXISTS correos_salida_escribe ON portal.correos_salida;
CREATE POLICY correos_salida_escribe ON portal.correos_salida
  FOR INSERT TO conejo_app
  WITH CHECK (creado_por = app_usuario_id());

DROP POLICY IF EXISTS correos_salida_actualiza_admin ON portal.correos_salida;
DROP POLICY IF EXISTS correos_salida_actualiza ON portal.correos_salida;
CREATE POLICY correos_salida_actualiza ON portal.correos_salida
  FOR UPDATE TO conejo_app
  USING (app_rol() = 'admin' OR creado_por = app_usuario_id())
  WITH CHECK (app_rol() = 'admin' OR creado_por = app_usuario_id());

-- ---------------------------------------------------------------------------
-- portal.notificaciones: los avisos de cada persona.
--
-- Una fila por aviso Y por destinatario: si algo se le avisa a tres
-- administradores son tres filas, porque cada uno lo lee cuando quiere.
--
-- Se escriben en la MISMA transaccion que el cambio que los provoca, igual que
-- la auditoria y los correos: no existe el aviso de algo que no ocurrio.
--
-- `href` es a donde lleva el aviso al pulsarlo. Solo admite rutas del panel:
-- un aviso no puede sacar a nadie de la aplicacion.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.notificaciones (
  id          BIGSERIAL   PRIMARY KEY,
  usuario_id  INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_id  INTEGER     REFERENCES empresas(id),

  tipo        TEXT        NOT NULL,
  titulo      TEXT        NOT NULL,
  cuerpo      TEXT,
  href        TEXT,

  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  leida_en    TIMESTAMPTZ,

  CONSTRAINT notificaciones_tipo_formato
    CHECK (tipo ~ '^[a-z_]+[.][a-z_]+$'),
  CONSTRAINT notificaciones_titulo_no_vacio
    CHECK (length(btrim(titulo)) > 0),
  CONSTRAINT notificaciones_href_interno
    CHECK (href IS NULL OR href ~ '^/dashboard(/|[?]|$)')
);

CREATE INDEX IF NOT EXISTS notificaciones_usuario_idx
  ON portal.notificaciones (usuario_id, creado_en DESC, id DESC);

-- El contador de la campana solo mira las que estan sin leer.
CREATE INDEX IF NOT EXISTS notificaciones_sin_leer_idx
  ON portal.notificaciones (usuario_id)
  WHERE leida_en IS NULL;

GRANT SELECT, INSERT, UPDATE ON portal.notificaciones TO conejo_app;
GRANT USAGE, SELECT ON SEQUENCE portal.notificaciones_id_seq TO conejo_app;

-- Cada quien ve y marca solo sus avisos; ni un administrador lee los de otro.
-- Avisar a otra persona si puede cualquiera con sesion declarada: es justo lo
-- que hace falta para que el trabajo de uno le llegue a quien lo espera.
-- Tambien la identidad `sistema`, que es la de las tareas programadas: cuando
-- una lee algo raro, se lo dice a los administradores.
ALTER TABLE portal.notificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notificaciones_lee ON portal.notificaciones;
CREATE POLICY notificaciones_lee ON portal.notificaciones
  FOR SELECT TO conejo_app
  USING (usuario_id = app_usuario_id());

DROP POLICY IF EXISTS notificaciones_escribe ON portal.notificaciones;
CREATE POLICY notificaciones_escribe ON portal.notificaciones
  FOR INSERT TO conejo_app
  WITH CHECK (app_usuario_id() IS NOT NULL OR app_rol() = 'sistema');

DROP POLICY IF EXISTS notificaciones_marca ON portal.notificaciones;
CREATE POLICY notificaciones_marca ON portal.notificaciones
  FOR UPDATE TO conejo_app
  USING (usuario_id = app_usuario_id())
  WITH CHECK (usuario_id = app_usuario_id());

-- ---------------------------------------------------------------------------
-- finanzas.tasas_cambio: una fila por fuente, moneda y fecha valor.
--
-- Es un HISTORICO: una tasa registrada no se pisa. Cuando una factura la usa,
-- ademas la copia, asi que lo que pase despues con esta tabla no la toca.
--
-- El valor es NUMERIC, no un numero de coma flotante: son bolivares por
-- unidad de moneda, con los ocho decimales que publica el BCV, y con ellos se
-- calcula dinero.
--
-- Los conjuntos cerrados tienen su espejo en src/types/tasa.ts.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finanzas.tasas_cambio (
  id              BIGSERIAL     PRIMARY KEY,

  fuente          TEXT          NOT NULL,
  moneda          TEXT          NOT NULL,
  fecha_valor     DATE          NOT NULL,
  valor           NUMERIC(20,8) NOT NULL,

  -- Como llego: la leyo la aplicacion de la pagina, o la escribio una persona.
  origen          TEXT          NOT NULL,
  registrada_por  INTEGER       REFERENCES usuarios(id),
  obtenida_en     TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT tasas_cambio_fuente_valida
    CHECK (fuente IN ('bcv')),
  CONSTRAINT tasas_cambio_moneda_formato
    CHECK (moneda ~ '^[A-Z]{3}$'),
  CONSTRAINT tasas_cambio_valor_positivo
    CHECK (valor > 0),
  CONSTRAINT tasas_cambio_origen_valido
    CHECK (origen IN ('automatica', 'manual')),
  -- Una tasa escrita a mano tiene que decir quien la escribio.
  CONSTRAINT tasas_cambio_manual_con_autor
    CHECK (origen <> 'manual' OR registrada_por IS NOT NULL),
  CONSTRAINT tasas_cambio_unica
    UNIQUE (fuente, moneda, fecha_valor)
);

CREATE INDEX IF NOT EXISTS tasas_cambio_recientes_idx
  ON finanzas.tasas_cambio (moneda, fecha_valor DESC);

GRANT SELECT, INSERT ON finanzas.tasas_cambio TO conejo_app;
REVOKE UPDATE ON finanzas.tasas_cambio FROM conejo_app;
GRANT USAGE, SELECT ON SEQUENCE finanzas.tasas_cambio_id_seq TO conejo_app;

-- La tasa del dia no es un secreto: la lee cualquiera con sesion, y tambien
-- la tarea programada. Escribirla, solo quien opera finanzas y esa tarea.
--
-- `sistema` es la identidad con la que la aplicacion actua cuando no hay
-- ninguna persona detras (`conSistema`, en src/lib/db.ts).
ALTER TABLE finanzas.tasas_cambio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tasas_cambio_lee ON finanzas.tasas_cambio;
CREATE POLICY tasas_cambio_lee ON finanzas.tasas_cambio
  FOR SELECT TO conejo_app
  USING (app_usuario_id() IS NOT NULL OR app_rol() = 'sistema');

DROP POLICY IF EXISTS tasas_cambio_escribe ON finanzas.tasas_cambio;
CREATE POLICY tasas_cambio_escribe ON finanzas.tasas_cambio
  FOR INSERT TO conejo_app
  WITH CHECK (
    app_rol() IN ('admin', 'sistema') OR app_cargo() = 'administracion'
  );

-- ===========================================================================
-- PROYECTOS, PIEZAS, FASES Y TAREAS
--
-- La bateria de cinco fases. Las reglas completas estan en
-- docs/reglasBateria.md; aqui solo lo que la base tiene que imponer por si
-- misma.
--
-- El avance NO se guarda: no hay columna de porcentaje ni de fase actual. Lo
-- calculan las vistas del final del bloque.
--
-- Los conjuntos cerrados tienen su espejo en src/types/portal.ts.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- portal.asignaciones: que ejecutivo atiende a que empresa.
--
-- Un ejecutivo (cargo `cuentas`) solo ve los proyectos de sus empresas, y eso
-- lo decide esta tabla. Una empresa puede tener varios ejecutivos (P6).
--
-- Es una relacion, no una persona ni una empresa: quitar una asignacion es
-- borrar su fila, y queda en la auditoria.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.asignaciones (
  id          SERIAL      PRIMARY KEY,
  usuario_id  INTEGER     NOT NULL REFERENCES usuarios(id),
  empresa_id  INTEGER     NOT NULL REFERENCES empresas(id),
  creado_por  INTEGER     REFERENCES usuarios(id),
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT asignaciones_unica UNIQUE (usuario_id, empresa_id)
);

CREATE INDEX IF NOT EXISTS asignaciones_empresa_idx
  ON portal.asignaciones (empresa_id);

-- ---------------------------------------------------------------------------
-- portal.proyectos: lo que pidio el cliente.
--
-- `servicio` es la entrada del catalogo de la que nacio (src/lib/portal/
-- catalogo.ts) y `tipo` la plantilla de fases que usa. Se guardan los dos:
-- el catalogo puede cambiar, y un proyecto ya armado no debe cambiar con el.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.proyectos (
  id                     SERIAL      PRIMARY KEY,
  empresa_id             INTEGER     NOT NULL REFERENCES empresas(id),
  ejecutivo_id           INTEGER     NOT NULL REFERENCES usuarios(id),

  servicio               TEXT        NOT NULL,
  tipo                   TEXT        NOT NULL,
  nombre                 TEXT        NOT NULL,
  descripcion            TEXT,

  estado                 TEXT        NOT NULL DEFAULT 'activo',
  fecha_inicio           DATE,
  fecha_estimada_cierre  DATE,
  cerrado_en             TIMESTAMPTZ,

  creado_por             INTEGER     REFERENCES usuarios(id),
  creado_en              TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT proyectos_servicio_formato CHECK (servicio ~ '^[a-z][a-z_]*$'),
  CONSTRAINT proyectos_tipo_valido      CHECK (tipo IN ('redes_sociales', 'especial')),
  CONSTRAINT proyectos_estado_valido
    CHECK (estado IN ('activo', 'pausado', 'cerrado', 'cancelado')),
  CONSTRAINT proyectos_nombre_no_vacio  CHECK (length(btrim(nombre)) > 0),
  CONSTRAINT proyectos_cierre_coherente
    CHECK ((estado = 'cerrado') = (cerrado_en IS NOT NULL)),
  CONSTRAINT proyectos_fechas_en_orden
    CHECK (fecha_inicio IS NULL OR fecha_estimada_cierre IS NULL
           OR fecha_estimada_cierre >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS proyectos_empresa_idx
  ON portal.proyectos (empresa_id, estado);
CREATE INDEX IF NOT EXISTS proyectos_ejecutivo_idx
  ON portal.proyectos (ejecutivo_id);

CREATE OR REPLACE TRIGGER proyectos_actualizado_en
  BEFORE UPDATE ON portal.proyectos
  FOR EACH ROW EXECUTE FUNCTION tocar_actualizado_en();

-- ---------------------------------------------------------------------------
-- portal.piezas: cada entregable que el cliente aprueba.
--
-- No se borran: se cancelan con motivo (P9), y una pieza cancelada deja de
-- contar para el avance.
--
-- `ronda` empieza en 1 y sube cada vez que el cliente pide una correccion.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.piezas (
  id                  SERIAL      PRIMARY KEY,
  proyecto_id         INTEGER     NOT NULL REFERENCES portal.proyectos(id),
  orden               SMALLINT    NOT NULL,
  tipo                TEXT        NOT NULL,
  titulo              TEXT        NOT NULL,
  responsable_id      INTEGER     REFERENCES usuarios(id),
  ronda               SMALLINT    NOT NULL DEFAULT 1,

  estado              TEXT        NOT NULL DEFAULT 'activa',
  motivo_cancelacion  TEXT,
  cancelada_en        TIMESTAMPTZ,
  cancelada_por       INTEGER     REFERENCES usuarios(id),

  creado_por          INTEGER     REFERENCES usuarios(id),
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT piezas_orden_unico   UNIQUE (proyecto_id, orden),
  CONSTRAINT piezas_orden_valido  CHECK (orden >= 1),
  CONSTRAINT piezas_ronda_valida  CHECK (ronda >= 1),
  CONSTRAINT piezas_tipo_valido
    CHECK (tipo IN ('post', 'carrusel', 'reel', 'historia', 'video', 'logo',
                    'entregable', 'otro')),
  CONSTRAINT piezas_titulo_no_vacio CHECK (length(btrim(titulo)) > 0),
  CONSTRAINT piezas_estado_valido CHECK (estado IN ('activa', 'cancelada')),
  CONSTRAINT piezas_cancelacion_completa
    CHECK ((estado = 'cancelada') = (
      cancelada_en IS NOT NULL AND cancelada_por IS NOT NULL
      AND motivo_cancelacion IS NOT NULL AND length(btrim(motivo_cancelacion)) > 0
    ))
);

CREATE INDEX IF NOT EXISTS piezas_responsable_idx
  ON portal.piezas (responsable_id);

CREATE OR REPLACE TRIGGER piezas_actualizado_en
  BEFORE UPDATE ON portal.piezas
  FOR EACH ROW EXECUTE FUNCTION tocar_actualizado_en();

-- ---------------------------------------------------------------------------
-- portal.pieza_contenido: el copy de la pieza, en tabla aparte.
--
-- La seguridad por fila decide por fila, no por columna. Separado, la base
-- misma le niega el copy al cliente hasta que la pieza llega a la fase 5.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.pieza_contenido (
  pieza_id        INTEGER     PRIMARY KEY REFERENCES portal.piezas(id),
  copy            TEXT        NOT NULL DEFAULT '',
  actualizado_por INTEGER     REFERENCES usuarios(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER pieza_contenido_actualizado_en
  BEFORE UPDATE ON portal.pieza_contenido
  FOR EACH ROW EXECUTE FUNCTION tocar_actualizado_en();

-- ---------------------------------------------------------------------------
-- portal.pieza_fases: cinco filas por pieza, una por fase.
--
-- La fase en curso es siempre la primera no completada, y solo hay una: lo
-- impone el indice unico parcial de abajo.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.pieza_fases (
  id                SERIAL      PRIMARY KEY,
  pieza_id          INTEGER     NOT NULL REFERENCES portal.piezas(id),
  fase              SMALLINT    NOT NULL,
  estado            TEXT        NOT NULL DEFAULT 'pendiente',
  fecha_estimada    DATE,
  responsable_id    INTEGER     REFERENCES usuarios(id),

  completada_en     TIMESTAMPTZ,
  completada_por    INTEGER     REFERENCES usuarios(id),
  ronda_completada  SMALLINT,

  actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pieza_fases_unica        UNIQUE (pieza_id, fase),
  CONSTRAINT pieza_fases_rango        CHECK (fase BETWEEN 1 AND 5),
  CONSTRAINT pieza_fases_estado_valido
    CHECK (estado IN ('pendiente', 'en_curso', 'completada')),
  CONSTRAINT pieza_fases_completada_coherente
    CHECK ((estado = 'completada') = (completada_en IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS pieza_fases_una_en_curso
  ON portal.pieza_fases (pieza_id)
  WHERE estado = 'en_curso';

CREATE INDEX IF NOT EXISTS pieza_fases_responsable_idx
  ON portal.pieza_fases (responsable_id);

CREATE OR REPLACE TRIGGER pieza_fases_actualizado_en
  BEFORE UPDATE ON portal.pieza_fases
  FOR EACH ROW EXECUTE FUNCTION tocar_actualizado_en();

-- ---------------------------------------------------------------------------
-- portal.tareas: el trabajo interno dentro de una fase.
--
-- Solo cuelgan de las fases de trabajo, la 1 y la 3: la llave foranea va a
-- la pareja (pieza, fase) y el CHECK cierra cuales. El cliente nunca las ve.
--
-- `herramienta` es la entrada del registro de src/lib/herramientas.ts que
-- ayuda a cumplirla, si la hay.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.tareas (
  id              SERIAL      PRIMARY KEY,
  pieza_id        INTEGER     NOT NULL,
  fase            SMALLINT    NOT NULL,
  orden           SMALLINT    NOT NULL DEFAULT 1,
  titulo          TEXT        NOT NULL,
  responsable_id  INTEGER     REFERENCES usuarios(id),
  herramienta     TEXT,
  fecha_estimada  DATE,

  estado          TEXT        NOT NULL DEFAULT 'pendiente',
  lista_en        TIMESTAMPTZ,
  lista_por       INTEGER     REFERENCES usuarios(id),

  creado_por      INTEGER     REFERENCES usuarios(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT tareas_fase_de_la_pieza
    FOREIGN KEY (pieza_id, fase) REFERENCES portal.pieza_fases (pieza_id, fase),
  CONSTRAINT tareas_fase_de_trabajo   CHECK (fase IN (1, 3)),
  CONSTRAINT tareas_titulo_no_vacio   CHECK (length(btrim(titulo)) > 0),
  CONSTRAINT tareas_herramienta_formato
    CHECK (herramienta IS NULL OR herramienta ~ '^[a-z][a-z_]*$'),
  CONSTRAINT tareas_estado_valido     CHECK (estado IN ('pendiente', 'lista')),
  CONSTRAINT tareas_lista_coherente
    CHECK ((estado = 'lista') = (lista_en IS NOT NULL AND lista_por IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS tareas_pieza_idx
  ON portal.tareas (pieza_id, fase, orden);
CREATE INDEX IF NOT EXISTS tareas_responsable_idx
  ON portal.tareas (responsable_id, estado);

CREATE OR REPLACE TRIGGER tareas_actualizado_en
  BEFORE UPDATE ON portal.tareas
  FOR EACH ROW EXECUTE FUNCTION tocar_actualizado_en();

-- ---------------------------------------------------------------------------
-- portal.comentarios_pieza: la conversacion interna sobre una pieza.
--
-- Solo se anaden: la aplicacion no tiene politica para cambiarlos. El cliente
-- no los ve nunca.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.comentarios_pieza (
  id         SERIAL      PRIMARY KEY,
  pieza_id   INTEGER     NOT NULL REFERENCES portal.piezas(id),
  autor_id   INTEGER     NOT NULL REFERENCES usuarios(id),
  texto      TEXT        NOT NULL,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT comentarios_pieza_texto_no_vacio CHECK (length(btrim(texto)) > 0)
);

CREATE INDEX IF NOT EXISTS comentarios_pieza_idx
  ON portal.comentarios_pieza (pieza_id, creado_en);

-- ---------------------------------------------------------------------------
-- Permisos. Sin DELETE salvo en asignaciones (quitar una) y tareas (quitar
-- una pendiente que el ejecutivo no quiere): lo demas se cancela o se cierra.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON
  portal.asignaciones, portal.proyectos, portal.piezas, portal.pieza_contenido,
  portal.pieza_fases, portal.tareas, portal.comentarios_pieza
  TO conejo_app;
GRANT DELETE ON portal.asignaciones, portal.tareas TO conejo_app;
GRANT USAGE, SELECT ON
  SEQUENCE portal.asignaciones_id_seq, portal.proyectos_id_seq,
           portal.piezas_id_seq, portal.pieza_fases_id_seq,
           portal.tareas_id_seq, portal.comentarios_pieza_id_seq
  TO conejo_app;

-- ---------------------------------------------------------------------------
-- Quien puede que, como funciones.
--
-- Las politicas de abajo se cruzan entre tablas: ver una pieza depende de su
-- proyecto, de sus fases y de sus tareas. Escrito directamente en cada
-- politica, una consulta pasaria por las politicas de la otra tabla y
-- terminaria en recursion. Estas funciones son SECURITY DEFINER: leen como
-- duena, sin politicas de por medio, y solo responden si o no.
--
-- No confian en nada que no venga de la sesion declarada (`conSesion`).
-- ---------------------------------------------------------------------------

-- Gestiona la empresa: el admin, o un ejecutivo asignado a ella.
CREATE OR REPLACE FUNCTION portal.gestiona_empresa(p_empresa integer)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT CASE
      WHEN app_rol() = 'admin' THEN true
      WHEN app_rol() = 'trabajador' AND app_cargo() = 'cuentas' THEN EXISTS (
        SELECT 1 FROM portal.asignaciones a
        WHERE a.usuario_id = app_usuario_id() AND a.empresa_id = p_empresa
      )
      ELSE false
    END
  $fn$;

CREATE OR REPLACE FUNCTION portal.gestiona_pieza(p_pieza integer)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT COALESCE((
      SELECT portal.gestiona_empresa(pr.empresa_id)
      FROM portal.piezas p
      JOIN portal.proyectos pr ON pr.id = p.proyecto_id
      WHERE p.id = p_pieza
    ), false)
  $fn$;

-- Tiene trabajo en la pieza: responsable de ella, de una fase o de una tarea.
CREATE OR REPLACE FUNCTION portal.trabaja_en_pieza(p_pieza integer)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT app_rol() IN ('admin', 'trabajador') AND app_usuario_id() IS NOT NULL AND (
      EXISTS (SELECT 1 FROM portal.piezas p
              WHERE p.id = p_pieza AND p.responsable_id = app_usuario_id())
      OR EXISTS (SELECT 1 FROM portal.pieza_fases f
                 WHERE f.pieza_id = p_pieza AND f.responsable_id = app_usuario_id())
      OR EXISTS (SELECT 1 FROM portal.tareas t
                 WHERE t.pieza_id = p_pieza AND t.responsable_id = app_usuario_id())
    )
  $fn$;

CREATE OR REPLACE FUNCTION portal.trabaja_en_proyecto(p_proyecto integer)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT EXISTS (
      SELECT 1 FROM portal.piezas p
      WHERE p.proyecto_id = p_proyecto AND portal.trabaja_en_pieza(p.id)
    )
  $fn$;

-- Lo que ve el cliente de su empresa: los proyectos y sus piezas activas.
CREATE OR REPLACE FUNCTION portal.cliente_ve_pieza(p_pieza integer)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT app_rol() = 'cliente' AND EXISTS (
      SELECT 1 FROM portal.piezas p
      JOIN portal.proyectos pr ON pr.id = p.proyecto_id
      WHERE p.id = p_pieza
        AND p.estado = 'activa'
        AND pr.empresa_id = app_empresa_id()
    )
  $fn$;

-- La pieza ya esta frente al cliente: fase 5 en curso, o aprobada.
CREATE OR REPLACE FUNCTION portal.pieza_en_revision(p_pieza integer)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT EXISTS (
      SELECT 1 FROM portal.pieza_fases f
      WHERE f.pieza_id = p_pieza AND f.fase = 5
        AND f.estado IN ('en_curso', 'completada')
    )
  $fn$;

REVOKE ALL ON FUNCTION
  portal.gestiona_empresa(integer), portal.gestiona_pieza(integer),
  portal.trabaja_en_pieza(integer), portal.trabaja_en_proyecto(integer),
  portal.cliente_ve_pieza(integer), portal.pieza_en_revision(integer)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  portal.gestiona_empresa(integer), portal.gestiona_pieza(integer),
  portal.trabaja_en_pieza(integer), portal.trabaja_en_proyecto(integer),
  portal.cliente_ve_pieza(integer), portal.pieza_en_revision(integer)
  TO conejo_app;

-- ---------------------------------------------------------------------------
-- Seguridad por fila.
-- ---------------------------------------------------------------------------
ALTER TABLE portal.asignaciones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.proyectos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.piezas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.pieza_contenido   ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.pieza_fases       ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.tareas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.comentarios_pieza ENABLE ROW LEVEL SECURITY;

-- Asignaciones: las lee el admin, cada ejecutivo las suyas y las de las
-- empresas que atiende (para saber con quien la comparte). Las toca el admin.
DROP POLICY IF EXISTS asignaciones_lee ON portal.asignaciones;
CREATE POLICY asignaciones_lee ON portal.asignaciones
  FOR SELECT TO conejo_app
  USING (
    app_rol() = 'admin'
    OR usuario_id = app_usuario_id()
    OR portal.gestiona_empresa(empresa_id)
  );

DROP POLICY IF EXISTS asignaciones_escribe ON portal.asignaciones;
CREATE POLICY asignaciones_escribe ON portal.asignaciones
  FOR INSERT TO conejo_app
  WITH CHECK (app_rol() = 'admin' AND creado_por = app_usuario_id());

DROP POLICY IF EXISTS asignaciones_quita ON portal.asignaciones;
CREATE POLICY asignaciones_quita ON portal.asignaciones
  FOR DELETE TO conejo_app
  USING (app_rol() = 'admin');

-- Proyectos.
DROP POLICY IF EXISTS proyectos_lee ON portal.proyectos;
CREATE POLICY proyectos_lee ON portal.proyectos
  FOR SELECT TO conejo_app
  USING (
    portal.gestiona_empresa(empresa_id)
    OR (app_rol() = 'cliente' AND empresa_id = app_empresa_id())
    OR portal.trabaja_en_proyecto(id)
  );

DROP POLICY IF EXISTS proyectos_crea ON portal.proyectos;
CREATE POLICY proyectos_crea ON portal.proyectos
  FOR INSERT TO conejo_app
  WITH CHECK (portal.gestiona_empresa(empresa_id) AND creado_por = app_usuario_id());

DROP POLICY IF EXISTS proyectos_edita ON portal.proyectos;
CREATE POLICY proyectos_edita ON portal.proyectos
  FOR UPDATE TO conejo_app
  USING (portal.gestiona_empresa(empresa_id))
  WITH CHECK (portal.gestiona_empresa(empresa_id));

-- Piezas.
DROP POLICY IF EXISTS piezas_lee ON portal.piezas;
CREATE POLICY piezas_lee ON portal.piezas
  FOR SELECT TO conejo_app
  USING (
    portal.gestiona_pieza(id)
    OR portal.trabaja_en_pieza(id)
    OR portal.cliente_ve_pieza(id)
  );

DROP POLICY IF EXISTS piezas_crea ON portal.piezas;
CREATE POLICY piezas_crea ON portal.piezas
  FOR INSERT TO conejo_app
  WITH CHECK (EXISTS (
    SELECT 1 FROM portal.proyectos pr
    WHERE pr.id = proyecto_id AND portal.gestiona_empresa(pr.empresa_id)
  ));

DROP POLICY IF EXISTS piezas_edita ON portal.piezas;
CREATE POLICY piezas_edita ON portal.piezas
  FOR UPDATE TO conejo_app
  USING (portal.gestiona_pieza(id))
  WITH CHECK (portal.gestiona_pieza(id));

-- Copy: el equipo de la pieza siempre; el cliente, desde la fase 5.
DROP POLICY IF EXISTS pieza_contenido_lee ON portal.pieza_contenido;
CREATE POLICY pieza_contenido_lee ON portal.pieza_contenido
  FOR SELECT TO conejo_app
  USING (
    portal.gestiona_pieza(pieza_id)
    OR portal.trabaja_en_pieza(pieza_id)
    OR (portal.cliente_ve_pieza(pieza_id) AND portal.pieza_en_revision(pieza_id))
  );

DROP POLICY IF EXISTS pieza_contenido_escribe ON portal.pieza_contenido;
CREATE POLICY pieza_contenido_escribe ON portal.pieza_contenido
  FOR INSERT TO conejo_app
  WITH CHECK (portal.gestiona_pieza(pieza_id) OR portal.trabaja_en_pieza(pieza_id));

DROP POLICY IF EXISTS pieza_contenido_edita ON portal.pieza_contenido;
CREATE POLICY pieza_contenido_edita ON portal.pieza_contenido
  FOR UPDATE TO conejo_app
  USING (portal.gestiona_pieza(pieza_id) OR portal.trabaja_en_pieza(pieza_id))
  WITH CHECK (portal.gestiona_pieza(pieza_id) OR portal.trabaja_en_pieza(pieza_id));

-- Fases: las ve quien ve la pieza; las mueve quien la gestiona.
DROP POLICY IF EXISTS pieza_fases_lee ON portal.pieza_fases;
CREATE POLICY pieza_fases_lee ON portal.pieza_fases
  FOR SELECT TO conejo_app
  USING (
    portal.gestiona_pieza(pieza_id)
    OR portal.trabaja_en_pieza(pieza_id)
    OR portal.cliente_ve_pieza(pieza_id)
  );

DROP POLICY IF EXISTS pieza_fases_crea ON portal.pieza_fases;
CREATE POLICY pieza_fases_crea ON portal.pieza_fases
  FOR INSERT TO conejo_app
  WITH CHECK (portal.gestiona_pieza(pieza_id));

DROP POLICY IF EXISTS pieza_fases_mueve ON portal.pieza_fases;
CREATE POLICY pieza_fases_mueve ON portal.pieza_fases
  FOR UPDATE TO conejo_app
  USING (portal.gestiona_pieza(pieza_id))
  WITH CHECK (portal.gestiona_pieza(pieza_id));

-- Tareas: nunca el cliente. Quien la tiene asignada puede marcarla, pero no
-- pasarsela a otra persona: el WITH CHECK le exige seguir siendo responsable.
DROP POLICY IF EXISTS tareas_lee ON portal.tareas;
CREATE POLICY tareas_lee ON portal.tareas
  FOR SELECT TO conejo_app
  USING (
    app_rol() IN ('admin', 'trabajador')
    AND (portal.gestiona_pieza(pieza_id) OR portal.trabaja_en_pieza(pieza_id))
  );

DROP POLICY IF EXISTS tareas_crea ON portal.tareas;
CREATE POLICY tareas_crea ON portal.tareas
  FOR INSERT TO conejo_app
  WITH CHECK (portal.gestiona_pieza(pieza_id) AND creado_por = app_usuario_id());

DROP POLICY IF EXISTS tareas_gestiona ON portal.tareas;
CREATE POLICY tareas_gestiona ON portal.tareas
  FOR UPDATE TO conejo_app
  USING (portal.gestiona_pieza(pieza_id))
  WITH CHECK (portal.gestiona_pieza(pieza_id));

DROP POLICY IF EXISTS tareas_marca_la_suya ON portal.tareas;
CREATE POLICY tareas_marca_la_suya ON portal.tareas
  FOR UPDATE TO conejo_app
  USING (responsable_id = app_usuario_id())
  WITH CHECK (responsable_id = app_usuario_id());

DROP POLICY IF EXISTS tareas_quita ON portal.tareas;
CREATE POLICY tareas_quita ON portal.tareas
  FOR DELETE TO conejo_app
  USING (portal.gestiona_pieza(pieza_id) AND estado = 'pendiente');

-- Comentarios: el equipo de la pieza, a su nombre. Sin politica de cambio.
DROP POLICY IF EXISTS comentarios_pieza_lee ON portal.comentarios_pieza;
CREATE POLICY comentarios_pieza_lee ON portal.comentarios_pieza
  FOR SELECT TO conejo_app
  USING (
    app_rol() IN ('admin', 'trabajador')
    AND (portal.gestiona_pieza(pieza_id) OR portal.trabaja_en_pieza(pieza_id))
  );

DROP POLICY IF EXISTS comentarios_pieza_escribe ON portal.comentarios_pieza;
CREATE POLICY comentarios_pieza_escribe ON portal.comentarios_pieza
  FOR INSERT TO conejo_app
  WITH CHECK (
    autor_id = app_usuario_id()
    AND app_rol() IN ('admin', 'trabajador')
    AND (portal.gestiona_pieza(pieza_id) OR portal.trabaja_en_pieza(pieza_id))
  );

-- ---------------------------------------------------------------------------
-- El avance, calculado. security_invoker: la vista se consulta con las
-- politicas de quien pregunta, no con las de su duena.
--
-- Las cuatro alertas usan la fecha de la fase en curso y el dia de Caracas.
-- Una pieza cancelada no tiene alertas y no cuenta para el proyecto.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW portal.v_progreso_pieza
  WITH (security_invoker = true) AS
WITH base AS (
  SELECT p.id AS pieza_id,
         p.proyecto_id,
         p.ronda,
         p.estado,
         count(*) FILTER (WHERE f.estado = 'completada')::int      AS fases_completadas,
         min(f.fase) FILTER (WHERE f.estado <> 'completada')::int  AS fase_actual
  FROM portal.piezas p
  JOIN portal.pieza_fases f ON f.pieza_id = p.id
  GROUP BY p.id, p.proyecto_id, p.ronda, p.estado
),
hoy AS (SELECT (now() AT TIME ZONE 'America/Caracas')::date AS dia)
SELECT b.pieza_id,
       b.proyecto_id,
       b.ronda,
       b.estado,
       b.fases_completadas,
       b.fases_completadas * 20                                   AS porcentaje,
       b.fase_actual,
       b.fase_actual IS NULL                                      AS aprobada,
       f.fecha_estimada                                           AS fecha_estimada_actual,
       f.responsable_id                                           AS responsable_actual_id,
       (b.estado = 'activa' AND COALESCE(b.fase_actual = 5, false)) AS esperando_cliente,
       (b.estado = 'activa' AND b.ronda > 1 AND b.fase_actual IS NOT NULL)
                                                                  AS en_correccion,
       (b.estado = 'activa' AND COALESCE(f.fecha_estimada < hoy.dia, false))
                                                                  AS atrasada,
       (b.estado = 'activa' AND COALESCE(f.fecha_estimada BETWEEN hoy.dia AND hoy.dia + 2, false))
                                                                  AS por_vencer
FROM base b
CROSS JOIN hoy
LEFT JOIN portal.pieza_fases f ON f.pieza_id = b.pieza_id AND f.fase = b.fase_actual;

CREATE OR REPLACE VIEW portal.v_progreso_proyecto
  WITH (security_invoker = true) AS
SELECT pr.id                                                      AS proyecto_id,
       count(DISTINCT pi.id)::int                                 AS total_piezas,
       (count(*) FILTER (WHERE f.estado = 'completada'))::int     AS fases_completadas,
       CASE WHEN count(DISTINCT pi.id) = 0 THEN 0
            ELSE round(100.0 * count(*) FILTER (WHERE f.estado = 'completada')
                       / (5 * count(DISTINCT pi.id)), 2)
       END                                                        AS porcentaje,
       (count(DISTINCT pi.id) FILTER (WHERE f.fase = 5 AND f.estado = 'completada'))::int
                                                                  AS piezas_aprobadas
FROM portal.proyectos pr
LEFT JOIN portal.piezas pi
       ON pi.proyecto_id = pr.id AND pi.estado = 'activa'
LEFT JOIN portal.pieza_fases f ON f.pieza_id = pi.id
GROUP BY pr.id;

GRANT SELECT ON portal.v_progreso_pieza, portal.v_progreso_proyecto TO conejo_app;

-- ---------------------------------------------------------------------------
-- Hooks como herramienta: la ficha que cumple una tarea.
--
-- Una tarea «Escribir el hook» abre el canvas, y la ficha que se escribe desde
-- ahi queda ligada a ella. Cuando la ficha aprueba la auditoria, la tarea se
-- da por lista.
--
-- Opcional: el modulo de hooks se sigue usando suelto, sin tarea. Si la tarea
-- se quita (solo se puede mientras esta pendiente), la ficha se queda, sin
-- tarea.
-- ---------------------------------------------------------------------------
ALTER TABLE fichas_hook
  ADD COLUMN IF NOT EXISTS tarea_id INTEGER REFERENCES portal.tareas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS fichas_hook_tarea_idx
  ON fichas_hook (tarea_id)
  WHERE tarea_id IS NOT NULL;

-- ===========================================================================
-- REVISION DEL CLIENTE: VERSIONES, DECISIONES Y PERMISO DE APROBAR
--
-- La fase 5 la decide el cliente: aprueba la pieza o pide una correccion. Lo
-- que ve para decidir es la version que el ejecutivo marco como enviada.
-- Las reglas estan en docs/reglasBateria.md.
-- ===========================================================================

-- clientes.puede_aprobar va junto a la tabla clientes: la vista de usuarios lo
-- necesita, y se crea antes que este bloque.

-- ---------------------------------------------------------------------------
-- portal.archivos_simulados: donde guarda el adaptador de archivos en modo
-- simulado (src/lib/externos/archivos.ts).
--
-- En modo real los archivos van a Google Drive y esta tabla no se usa. Con
-- limite pequeno a proposito: es para desarrollo y pruebas, no un almacen.
-- Nadie la lee directamente: solo el adaptador, y solo para entregar una
-- version a quien ya se comprobo que puede verla.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.archivos_simulados (
  id          SERIAL      PRIMARY KEY,
  nombre      TEXT        NOT NULL,
  mime        TEXT        NOT NULL,
  tamano      INTEGER     NOT NULL,
  contenido   BYTEA       NOT NULL,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT archivos_simulados_tamano CHECK (tamano > 0 AND tamano <= 4194304)
);

-- ---------------------------------------------------------------------------
-- portal.versiones: lo que se produce para una pieza.
--
-- Un archivo (guardado por el adaptador: `archivo_id` es su identificador en
-- Drive o en la tabla simulada) o un enlace externo de la lista blanca. Nunca
-- los dos.
--
-- El cliente solo ve la version marcada como enviada, y solo con la pieza en
-- la fase 5 o aprobada. Los borradores no salen nunca del equipo.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.versiones (
  id                SERIAL      PRIMARY KEY,
  pieza_id          INTEGER     NOT NULL REFERENCES portal.piezas(id),
  numero            SMALLINT    NOT NULL,
  ronda             SMALLINT    NOT NULL,
  fase              SMALLINT    NOT NULL,

  origen            TEXT        NOT NULL,
  archivo_id        TEXT,
  enlace            TEXT,
  nombre            TEXT        NOT NULL,
  mime              TEXT,
  tamano            INTEGER,

  subida_por        INTEGER     NOT NULL REFERENCES usuarios(id),
  creada_en         TIMESTAMPTZ NOT NULL DEFAULT now(),

  enviada_en        TIMESTAMPTZ,
  enviada_por       INTEGER     REFERENCES usuarios(id),

  CONSTRAINT versiones_numero_unico   UNIQUE (pieza_id, numero),
  CONSTRAINT versiones_numero_valido  CHECK (numero >= 1),
  CONSTRAINT versiones_ronda_valida   CHECK (ronda >= 1),
  CONSTRAINT versiones_fase_valida    CHECK (fase BETWEEN 1 AND 5),
  CONSTRAINT versiones_origen_valido  CHECK (origen IN ('archivo', 'enlace')),
  CONSTRAINT versiones_origen_coherente
    CHECK ((origen = 'archivo' AND archivo_id IS NOT NULL AND enlace IS NULL)
        OR (origen = 'enlace' AND enlace IS NOT NULL AND archivo_id IS NULL)),
  CONSTRAINT versiones_enlace_https   CHECK (enlace IS NULL OR enlace ~ '^https://'),
  CONSTRAINT versiones_envio_completo
    CHECK ((enviada_en IS NULL) = (enviada_por IS NULL))
);

-- Una sola version enviada por pieza y ronda: la que el cliente revisa.
CREATE UNIQUE INDEX IF NOT EXISTS versiones_una_enviada_por_ronda
  ON portal.versiones (pieza_id, ronda)
  WHERE enviada_en IS NOT NULL;

-- ---------------------------------------------------------------------------
-- portal.revisiones: la decision del cliente en la fase 5, una por ronda.
--
-- Solo se anaden. La correccion guarda que fases reabrio; el ejecutivo puede
-- ajustarlas mientras no se haya completado ninguna fase de la ronda nueva, y
-- entonces queda quien las ajusto.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.revisiones (
  id                SERIAL      PRIMARY KEY,
  pieza_id          INTEGER     NOT NULL REFERENCES portal.piezas(id),
  ronda             SMALLINT    NOT NULL,
  decision          TEXT        NOT NULL,
  tipo_correccion   TEXT,
  comentario        TEXT,
  fases_reabiertas  SMALLINT[]  NOT NULL DEFAULT '{}',
  version_id        INTEGER     REFERENCES portal.versiones(id),

  autor_id          INTEGER     NOT NULL REFERENCES usuarios(id),
  creada_en         TIMESTAMPTZ NOT NULL DEFAULT now(),

  ajustada_por      INTEGER     REFERENCES usuarios(id),
  ajustada_en       TIMESTAMPTZ,

  CONSTRAINT revisiones_una_por_ronda UNIQUE (pieza_id, ronda),
  CONSTRAINT revisiones_decision_valida CHECK (decision IN ('aprobada', 'correccion')),
  CONSTRAINT revisiones_tipo_valido
    CHECK (tipo_correccion IS NULL OR tipo_correccion IN ('redaccion', 'diseno', 'ambas')),
  CONSTRAINT revisiones_correccion_completa
    CHECK ((decision = 'aprobada' AND tipo_correccion IS NULL AND cardinality(fases_reabiertas) = 0)
        OR (decision = 'correccion' AND tipo_correccion IS NOT NULL
            AND comentario IS NOT NULL AND length(btrim(comentario)) > 0
            AND cardinality(fases_reabiertas) > 0)),
  CONSTRAINT revisiones_fases_validas CHECK (fases_reabiertas <@ ARRAY[1, 2, 3, 4, 5]::smallint[]),
  CONSTRAINT revisiones_ajuste_completo CHECK ((ajustada_por IS NULL) = (ajustada_en IS NULL))
);

-- ---------------------------------------------------------------------------
-- Permisos. Los archivos simulados no llevan politicas por fila: solo los lee
-- el adaptador, por id, desde la ruta de entrega, despues de que la version
-- haya pasado las politicas de `versiones`. Sin DELETE: no se borran.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON portal.versiones, portal.revisiones TO conejo_app;
GRANT USAGE, SELECT ON SEQUENCE portal.versiones_id_seq, portal.revisiones_id_seq TO conejo_app;
GRANT SELECT, INSERT ON portal.archivos_simulados TO conejo_app;
GRANT USAGE, SELECT ON SEQUENCE portal.archivos_simulados_id_seq TO conejo_app;

-- Si el cliente con sesion puede decidir sobre la pieza: es de su empresa,
-- tiene el permiso de aprobar y su cuenta sigue activa.
CREATE OR REPLACE FUNCTION portal.cliente_aprueba(p_pieza integer)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT portal.cliente_ve_pieza(p_pieza) AND EXISTS (
      SELECT 1 FROM clientes c
      JOIN usuarios u ON u.id = c.usuario_id
      WHERE c.usuario_id = app_usuario_id()
        AND c.empresa_id = app_empresa_id()
        AND c.puede_aprobar
        AND u.activo
    )
  $fn$;

REVOKE ALL ON FUNCTION portal.cliente_aprueba(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION portal.cliente_aprueba(integer) TO conejo_app;

ALTER TABLE portal.versiones  ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.revisiones ENABLE ROW LEVEL SECURITY;

-- La ronda en curso de una pieza. La politica de versiones la necesita para
-- que el cliente vea solo la version de la ronda que revisa, y la tabla de
-- piezas tiene su propia seguridad por fila: por eso es SECURITY DEFINER.
CREATE OR REPLACE FUNCTION portal.ronda_de_pieza(p_pieza integer)
  RETURNS smallint
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT ronda FROM portal.piezas WHERE id = p_pieza
  $fn$;

REVOKE ALL ON FUNCTION portal.ronda_de_pieza(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION portal.ronda_de_pieza(integer) TO conejo_app;

-- Versiones: el equipo de la pieza, todas; el cliente, solo la enviada de la
-- ronda en curso, y solo con la pieza frente a el. Las de rondas anteriores
-- ya fueron corregidas: no las vuelve a ver, ni las descarga.
DROP POLICY IF EXISTS versiones_lee ON portal.versiones;
CREATE POLICY versiones_lee ON portal.versiones
  FOR SELECT TO conejo_app
  USING (
    portal.gestiona_pieza(pieza_id)
    OR portal.trabaja_en_pieza(pieza_id)
    OR (enviada_en IS NOT NULL
        AND ronda = portal.ronda_de_pieza(pieza_id)
        AND portal.cliente_ve_pieza(pieza_id)
        AND portal.pieza_en_revision(pieza_id))
  );

DROP POLICY IF EXISTS versiones_sube ON portal.versiones;
CREATE POLICY versiones_sube ON portal.versiones
  FOR INSERT TO conejo_app
  WITH CHECK (
    subida_por = app_usuario_id()
    AND (portal.gestiona_pieza(pieza_id) OR portal.trabaja_en_pieza(pieza_id))
  );

-- Marcar la enviada es del ejecutivo.
DROP POLICY IF EXISTS versiones_envia ON portal.versiones;
CREATE POLICY versiones_envia ON portal.versiones
  FOR UPDATE TO conejo_app
  USING (portal.gestiona_pieza(pieza_id))
  WITH CHECK (portal.gestiona_pieza(pieza_id));

-- Revisiones: las lee quien ve la pieza. Las escribe el cliente con permiso
-- de aprobar, a su nombre; el ejecutivo solo ajusta la ruta.
DROP POLICY IF EXISTS revisiones_lee ON portal.revisiones;
CREATE POLICY revisiones_lee ON portal.revisiones
  FOR SELECT TO conejo_app
  USING (
    portal.gestiona_pieza(pieza_id)
    OR portal.trabaja_en_pieza(pieza_id)
    OR portal.cliente_ve_pieza(pieza_id)
  );

DROP POLICY IF EXISTS revisiones_decide ON portal.revisiones;
CREATE POLICY revisiones_decide ON portal.revisiones
  FOR INSERT TO conejo_app
  WITH CHECK (autor_id = app_usuario_id() AND portal.cliente_aprueba(pieza_id));

DROP POLICY IF EXISTS revisiones_ajusta ON portal.revisiones;
CREATE POLICY revisiones_ajusta ON portal.revisiones
  FOR UPDATE TO conejo_app
  USING (portal.gestiona_pieza(pieza_id))
  WITH CHECK (portal.gestiona_pieza(pieza_id) AND ajustada_por = app_usuario_id());

-- ---------------------------------------------------------------------------
-- La decision del cliente sobre las fases.
--
-- El cliente no tiene permiso para mover fases: la politica de pieza_fases es
-- del ejecutivo. Esta funcion es la UNICA via, y solo hace lo que la decision
-- pide: completar la fase 5, o reabrir las fases de la ruta y subir la ronda.
-- Comprueba ella misma que quien llama puede aprobar y que la pieza esta
-- esperandole, con la pieza bloqueada.
--
-- La ruta la calcula la aplicacion con el catalogo; aqui solo se exige que
-- sea creible: dentro de 1..5 y pasando siempre por los controles 4 y 5.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.decidir_fase_5(
  p_pieza integer,
  p_aprobar boolean,
  p_reabre smallint[]
)
  RETURNS smallint
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
  DECLARE
    v_ronda smallint;
    v_en_curso smallint;
  BEGIN
    IF NOT portal.cliente_aprueba(p_pieza) THEN
      RAISE EXCEPTION 'No autorizado' USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT ronda INTO v_ronda FROM portal.piezas
    WHERE id = p_pieza AND estado = 'activa'
    FOR UPDATE;

    SELECT fase INTO v_en_curso FROM portal.pieza_fases
    WHERE pieza_id = p_pieza AND estado = 'en_curso';

    IF v_ronda IS NULL OR v_en_curso IS DISTINCT FROM 5 THEN
      RAISE EXCEPTION 'La pieza no esta esperando una decision'
        USING ERRCODE = 'check_violation';
    END IF;

    IF p_aprobar THEN
      UPDATE portal.pieza_fases
      SET estado = 'completada', completada_en = now(),
          completada_por = app_usuario_id(), ronda_completada = v_ronda
      WHERE pieza_id = p_pieza AND fase = 5;

      RETURN v_ronda;
    END IF;

    IF p_reabre IS NULL OR cardinality(p_reabre) = 0
       OR NOT (p_reabre <@ ARRAY[1, 2, 3, 4, 5]::smallint[])
       OR NOT (ARRAY[4, 5]::smallint[] <@ p_reabre) THEN
      RAISE EXCEPTION 'Ruta de correccion no valida' USING ERRCODE = 'check_violation';
    END IF;

    -- La que estaba en curso (la 5) deja de estarlo antes de abrir otra: la
    -- base solo admite una fase en curso por pieza.
    UPDATE portal.pieza_fases
    SET estado = 'pendiente', completada_en = NULL, completada_por = NULL,
        ronda_completada = NULL
    WHERE pieza_id = p_pieza AND fase = ANY (p_reabre);

    UPDATE portal.pieza_fases
    SET estado = 'en_curso'
    WHERE pieza_id = p_pieza
      AND fase = (SELECT min(f) FROM unnest(p_reabre) AS f);

    -- Las tareas de las fases de trabajo reabiertas vuelven a estar por hacer.
    UPDATE portal.tareas
    SET estado = 'pendiente', lista_en = NULL, lista_por = NULL
    WHERE pieza_id = p_pieza AND fase = ANY (p_reabre) AND estado = 'lista';

    UPDATE portal.piezas SET ronda = ronda + 1 WHERE id = p_pieza;

    RETURN v_ronda + 1;
  END
  $fn$;

REVOKE ALL ON FUNCTION portal.decidir_fase_5(integer, boolean, smallint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION portal.decidir_fase_5(integer, boolean, smallint[]) TO conejo_app;
