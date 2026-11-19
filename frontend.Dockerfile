# Frontend dev image (Vite)
FROM node:18-bullseye-slim

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
COPY scripts ./scripts

RUN corepack enable \
  && corepack prepare pnpm@10 --activate \
  && pnpm install --frozen-lockfile

COPY . .

ENV VITE_API_URL="http://localhost:4000"
EXPOSE 3001

# Start vite on 0.0.0.0 so host can access container
CMD ["./node_modules/.bin/vite", "--host", "0.0.0.0", "--port", "3001"]
