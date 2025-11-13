# Stage 1: Builder
FROM node:18-alpine as builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies (using npm install to pick up latest changes)
RUN npm install && \
    npm cache clean --force

# Stage 2: Runtime
FROM node:18-alpine

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    jq

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copy application code
COPY src ./src
COPY .env.example ./.env.example

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Create logs directory
RUN mkdir -p /app/logs && \
    chown -R nodejs:nodejs /app/logs

# Switch to non-root user
USER nodejs

# Health check
# Checks /health endpoint which doesn't require all services ready
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${APP_PORT:-4004}/health || exit 1

# Expose port (4004 for WebSocket)
EXPOSE 4004

# Use dumb-init to handle signals properly (SIGTERM, SIGINT)
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "src/server.js"]
