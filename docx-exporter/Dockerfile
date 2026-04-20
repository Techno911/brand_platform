# Multi-stage build для изолированного docx-exporter.
# Финальный образ read-only, только /tmp — tmpfs (монтируется docker compose).
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production=false --no-audit --no-fund --loglevel=error
COPY tsconfig.json ./
COPY src ./src
RUN ./node_modules/.bin/tsc && ls dist/server.js || exit 1

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/package-lock.json* ./
RUN npm install --production --no-audit --no-fund --loglevel=error && npm cache clean --force
COPY --from=build /app/dist ./dist

# Пользователь без прав на запись куда-либо кроме /tmp
RUN addgroup -S bp && adduser -S -G bp bp
USER bp

EXPOSE 4000
CMD ["node", "dist/server.js"]
