# ==============================================================================
# ChitFlow Frontend Production Dockerfile
# Multi-stage: Node 20 builder + lightweight Alpine Nginx web server
# ==============================================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies with frozen lockfile for build reproducibility
COPY package*.json ./
RUN npm ci

# Copy source code and build production bundle
COPY . .

ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# --- Stage 2: Production Nginx Server ---
FROM nginx:1.27-alpine AS runner

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
