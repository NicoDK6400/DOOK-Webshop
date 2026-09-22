FROM node:20-bookworm-slim
WORKDIR /app

# better-sqlite3 downloads a prebuilt binary for most platforms; these let it
# fall back to compiling from source when none matches the build target.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/data/dook.sqlite
ENV MEDIA_PATH=/data/media

EXPOSE 3000
VOLUME ["/data"]

CMD ["node", "dist/server/serve.mjs"]
