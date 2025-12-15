FROM oven/bun:latest

WORKDIR /app

COPY shared ./shared
WORKDIR /app/shared
RUN bun install

WORKDIR /app/cdc
COPY cdc/package.json cdc/bun.lock ./
RUN bun install
COPY cdc .

CMD ["bun", "run", "ingest.ts"]
