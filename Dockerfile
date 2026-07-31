# --- Build stage: compile the Vite client bundle + esbuild the Express server ---
FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Runtime stage: slim image with ffmpeg baked in, production deps only ---
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public

# Cloud Run injects PORT (defaults to 8080); server.ts reads process.env.PORT.
EXPOSE 8080
CMD ["node", "dist/server.cjs"]
