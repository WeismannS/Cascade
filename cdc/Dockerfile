FROM oven/bun:latest

COPY package.json ./
COPY bun.lock ./
COPY . ./

RUN bun install

CMD ["bun","run","ingest.ts"]
