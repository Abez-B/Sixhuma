FROM node:22-alpine AS builder

WORKDIR /app
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY sixhuma-core ./sixhuma-core
COPY sixhuma-svelte ./sixhuma-svelte

RUN pnpm install --frozen-lockfile
RUN pnpm -r --filter sixhuma-core --filter sixhuma-svelte run build

FROM nginx:alpine AS runner

COPY --from=builder /app/sixhuma-svelte/build /usr/share/nginx/html
COPY sixhuma-svelte/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
