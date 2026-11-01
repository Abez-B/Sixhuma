FROM node:22-alpine AS builder

WORKDIR /app
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY sixhuma-core ./sixhuma-core
COPY sixhuma-api ./sixhuma-api

RUN pnpm install --frozen-lockfile
RUN pnpm -r --filter sixhuma-core --filter sixhuma-api run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data

COPY --from=builder /app/sixhuma-api/dist ./dist
COPY --from=builder /app/sixhuma-api/package.json ./package.json

EXPOSE 3000
CMD ["node", "./dist/index.mjs"]
