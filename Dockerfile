FROM node:22-bookworm-slim
WORKDIR /app

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
