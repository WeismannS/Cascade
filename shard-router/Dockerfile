FROM oven/bun:latest

WORKDIR /app

COPY shared ./shared
WORKDIR /app/shared
RUN bun install

WORKDIR /app/shard-router
COPY shard-router/package.json shard-router/bun.lock ./
RUN bun install
COPY shard-router .

ENV SHARD_ID=0

CMD ["sh", "-c", "bun run client.ts -s $SHARD_ID"]