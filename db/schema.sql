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
  e.activo                                   AS empresa_activa
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
  (u.bloqueado_hasta IS NOT NULL AND u.bloqueado_hasta > now()) AS bloqueado
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
