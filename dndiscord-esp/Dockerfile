# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Build argument for API URL (set via Dokploy build args in production)
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

# Copy package.json only (ignore Windows-generated lockfile to resolve platform deps)
COPY package.json ./

# Install dependencies fresh for Alpine/linux-x64-musl
RUN npm install

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
