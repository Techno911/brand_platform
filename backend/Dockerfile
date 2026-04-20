# Multi-stage build для NestJS backend BP.
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production=false --no-audit --no-fund --loglevel=error

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
COPY prompts ./prompts
COPY knowledge ./knowledge
COPY golden-set ./golden-set
COPY scripts ./scripts
COPY migrations ./migrations

RUN ./node_modules/.bin/nest build && ls dist/main.js || exit 1

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/package.json ./
COPY --from=build /app/package-lock.json* ./
RUN npm install --production --no-audit --no-fund --loglevel=error && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/prompts ./prompts
COPY --from=build /app/knowledge ./knowledge
COPY --from=build /app/golden-set ./golden-set
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/migrations ./migrations

RUN addgroup -S bp && adduser -S -G bp bp
USER bp

EXPOSE 3000
CMD ["node", "dist/main.js"]
