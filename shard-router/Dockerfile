FROM oven/bun:latest

COPY . ./

RUN bun install

ENV SHARD_ID=0

CMD ["sh", "-c", "bun run client.ts -s $SHARD_ID"]