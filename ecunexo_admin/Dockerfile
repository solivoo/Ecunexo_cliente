# syntax=docker/dockerfile:1
# Build context = raíz del repo Ecunexo_cliente

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV CI=true
RUN corepack enable && corepack prepare pnpm@11.21.0 --activate

COPY ecunexo_admin/package.json ecunexo_admin/pnpm-lock.yaml ecunexo_admin/pnpm-workspace.yaml ./
COPY ecunexo_admin/scripts ./scripts
RUN pnpm install --frozen-lockfile

COPY ecunexo_admin/ ./
ARG VITE_API_BASE_URL=
ARG VITE_BILLING_API_BASE_URL=
ARG VITE_LOGNERD_ENABLE_CONSOLE=false
ARG VITE_LOGNERD_LEVEL=WARN
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_BILLING_API_BASE_URL=$VITE_BILLING_API_BASE_URL \
    VITE_LOGNERD_ENABLE_CONSOLE=$VITE_LOGNERD_ENABLE_CONSOLE \
    VITE_LOGNERD_LEVEL=$VITE_LOGNERD_LEVEL
RUN pnpm build

FROM nginx:1.27-alpine AS final
COPY ecunexo_admin/nginx-spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
