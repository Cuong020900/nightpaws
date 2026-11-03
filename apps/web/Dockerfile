FROM node:24-bookworm-slim AS build
ENV CI=true
RUN npm install --global pnpm@11.22.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @nightpaws/web build

FROM nginx:1.27-alpine
ENV NGINX_API_RATE=30r/s \
    NGINX_API_BURST=60 \
    NGINX_WS_CONNECTIONS_PER_IP=20 \
    NGINX_WS_RATE=2r/s \
    NGINX_WS_BURST=20
COPY apps/web/nginx/nginx.conf /etc/nginx/nginx.conf
COPY apps/web/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
