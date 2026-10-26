FROM node:22-alpine

WORKDIR /workspace
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
COPY src ./src
COPY vite.config.ts tsconfig.json tsconfig.build.json ./
RUN pnpm install --frozen-lockfile && pnpm build

COPY examples/grafana-loki/vite.config.ts ./examples/grafana-loki/vite.config.ts
COPY examples/grafana-loki/app ./examples/grafana-loki/app

EXPOSE 8080
CMD ["pnpm", "exec", "vite", "--config", "examples/grafana-loki/vite.config.ts"]