# Server image for binary-learn-management
FROM node:18-bullseye-slim

WORKDIR /app

# Copy package manifest and prisma schema first so postinstall (prisma generate) can run
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma

# Install dependencies (postinstall will run prisma generate)
RUN corepack enable \
  && corepack prepare pnpm@10 --activate \
  && pnpm install --frozen-lockfile

# Copy app source
COPY . .

# Ensure entrypoint script is executable
RUN chmod +x /app/server/entrypoint.sh || true

ENV DATABASE_URL="file:/data/dev.db"
ENV PLATFORM_DATABASE_URL="file:/data/platform.db"
ENV TENANT_DATA_DIR="/data/tenants"
EXPOSE 4000

ENTRYPOINT ["/app/server/entrypoint.sh"]
