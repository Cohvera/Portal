FROM node:22-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY . .
RUN pnpm install --no-frozen-lockfile
RUN pnpm db:generate
ENV NODE_ENV=production
EXPOSE 4000
CMD ["pnpm", "--filter", "@cohvera/api", "exec", "tsx", "src/main.ts"]
