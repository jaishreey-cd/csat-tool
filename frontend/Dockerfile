# ── Stage 1: Build React/Vite SPA ──────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Copy package manifests first for optimal caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy frontend source code
COPY . .

# Build-time environment arguments (relative /api by default for reverse proxy)
ARG VITE_API_URL=/api
ARG VITE_SSO_ENABLED=false
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SSO_ENABLED=$VITE_SSO_ENABLED

# Build production assets into /app/dist
RUN npm run build

# ── Stage 2: Production Nginx Server ────────────────────────────────────────
FROM nginx:alpine

# Remove default nginx html and site config
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static assets from Stage 1
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# Health check verifies Nginx is serving traffic
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1/nginx-health || exit 1

CMD ["nginx", "-g", "daemon off;"]
