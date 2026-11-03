FROM node:24-bookworm-slim AS deps
ENV CI=true
RUN npm install --global pnpm@11.22.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter "@nightpaws/server..."

FROM deps AS runtime
ENV NODE_ENV=production
COPY packages/shared packages/shared
COPY apps/server apps/server
WORKDIR /app/apps/server
USER node
EXPOSE 8787
CMD ["node", "--import", "tsx", "src/index.ts"]
