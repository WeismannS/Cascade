import { tracer, initTracer } from "./instrumentation"
import { SpanStatusCode } from "@opentelemetry/api"
import { Kafka } from "kafkajs";
import { SQL } from "bun";
import "dotenv/config"
import { parseArgs } from "util";
function commandLineArgs(args: string[]) {
    const { values } = parseArgs({
        args: args,
        options: {
            shardId: {
                type: "string",
                short: "s",
            }
        },
        strict: true,
        allowPositionals: true,
    });
    if (!values.shardId) {
        throw new Error("Shard ID is required")
    }
    return values.shardId
}

function createClient() {
    const client = new SQL(process.env.DATABASE_URL!)
    return client
}

async function initConsumer(kafka: Kafka, shardId: string) {
    const consumer = kafka.consumer({
        groupId: `sql-executor-${shardId}`

    })
    await consumer.connect()
    await consumer.subscribe({
        topic: "sql-topic",
        fromBeginning: false,
    })
    return consumer
}


const shardId = commandLineArgs(process.argv)
initTracer(shardId)
console.log(`Starting SQL executor for shard ID: ${shardId}`)
const consumer = await initConsumer(new Kafka({
    clientId: "sql-executor",
    brokers: [`${process.env.BROKER_URL ?? "localhost:9092"}`],
}), shardId)

const client = createClient()

await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }) => {
        const sql = message.value!.toString()

        await tracer.startActiveSpan("process-message", async (span) => {
            span.setAttribute("kafka.topic", topic)
            span.setAttribute("kafka.partition", partition)
            span.setAttribute("kafka.offset", message.offset)

            try {
                const upperSql = sql.toUpperCase().trim()
                if (upperSql.startsWith('BEGIN')) {
                    const statements = sql
                        .split(';')
                        .map(s => s.trim())
                        .filter(s => s.length > 0 && !s.toUpperCase().match(/^(BEGIN|COMMIT)$/))

                    await tracer.startActiveSpan("db.transaction", async (txSpan) => {
                        await client.begin(async (tx) => {
                            await tx.unsafe("SET LOCAL synchronous_commit = off")
                            for (const stmt of statements) {
                                await tx.unsafe(stmt)
                            }
                        })
                        txSpan.end()
                    })
                } else {
                    await tracer.startActiveSpan("db.query", async (querySpan) => {
                        querySpan.setAttribute("db.statement", sql)
                        await client.unsafe(sql)
                        querySpan.end()
                    })
                }
                await consumer.commitOffsets([
                    { topic, partition, offset: (Number(message.offset) + 1).toString() }
                ]);
                console.log(`Executed SQL: ${sql}`)
                span.setStatus({ code: SpanStatusCode.OK })
            } catch (e) {
                console.error(`Failed to execute SQL: ${sql}`, e)
                span.setStatus({ code: SpanStatusCode.ERROR, message: String(e) })
            } finally {
                span.end()
            }
        })
    }
})

process.on("SIGINT", async () => {
    console.log("Shutting down SQL executor...")
    await consumer.disconnect()
    await client.close()
    process.exit(0)
})
process.on("SIGTERM", async () => {
    console.log("Shutting down SQL executor...")
    await consumer.disconnect()
    await client.close()
    process.exit(0)
})