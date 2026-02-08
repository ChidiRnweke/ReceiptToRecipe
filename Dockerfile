# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
# Install all dependencies including dev for build, ignoring legacy peer deps for SDK
RUN npm ci --legacy-peer-deps

# Copy source
COPY . .

# Build application
RUN npm run build
RUN npm prune --production --legacy-peer-deps

# Stage 2: Runtime
FROM node:22-alpine

WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy migrations and scripts
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts ./scripts

# Copy OTel instrumentation entry point
COPY --from=builder /app/instrumentation.mjs ./instrumentation.mjs

# Expose port (default for adapter-node is 3000)
EXPOSE 3000

# Start with OTel instrumentation loaded before the app
CMD ["node", "--import", "./instrumentation.mjs", "build"]
