# ---------------------------------------------------------------------------
# Imagen base comun a todas las etapas
# ---------------------------------------------------------------------------
FROM node:24-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1


# ---------------------------------------------------------------------------
# deps: dependencias completas (incluye las de desarrollo)
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci


# ---------------------------------------------------------------------------
# dev: servidor de desarrollo. El codigo NO se copia porque docker compose
# monta el proyecto como bind volume; asi los cambios se reflejan al instante.
# ---------------------------------------------------------------------------
FROM base AS dev
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "run", "dev"]


# ---------------------------------------------------------------------------
# builder: compila la aplicacion para produccion
# ---------------------------------------------------------------------------
FROM base AS builder
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build


# ---------------------------------------------------------------------------
# prod-deps: solo dependencias de ejecucion, sin las de desarrollo
# ---------------------------------------------------------------------------
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev


# ---------------------------------------------------------------------------
# prod: imagen final, ejecuta como usuario sin privilegios
# ---------------------------------------------------------------------------
FROM base AS prod
ENV NODE_ENV=production

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY package.json next.config.ts ./
# Solo el esquema. La semilla lleva cuentas de prueba con su contrasena y las
# baterias no pintan nada en una imagen de produccion.
COPY db/schema.sql ./db/schema.sql

# La app escribe las fotos de perfil dentro de public/uploads
RUN mkdir -p public/uploads/avatares && chown -R node:node /app/public

USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
