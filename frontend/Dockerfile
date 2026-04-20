# Multi-stage build для фронта + финальный nginx для статики и proxy_pass на backend.
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production=false --no-audit --no-fund --loglevel=error

COPY tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src

RUN ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build && ls dist/index.html || exit 1

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
