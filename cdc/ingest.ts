import "./instrumentation.ts"
import { Wal2JsonPlugin, LogicalReplicationService, type Wal2Json } from "pg-logical-replication"
import { WalSQLSerializer } from "./WalSQLSerializer"
import { Kafka } from 'kafkajs'
import { propagation, context, trace, metrics } from "@opentelemetry/api"
import "dotenv/config"

const tracer = trace.getTracer("cdc-kafka")
const meter = metrics.getMeter("cdc-kafka")
const logsProcessedCounter = meter.createCounter("wal-logs.processed", {
    description: "WAL logs processed from Postgres"
})
const kafka = new Kafka({
    clientId: "serializer",
    brokers: [`${process.env.BROKER_URL ?? "localhost:9092"}`],
})
const producer = kafka.producer({
    idempotent: true,
})

const plugin = new Wal2JsonPlugin({
    includeXids: true,
    includeTransaction: true,
});
const service = new LogicalReplicationService({
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT!),
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
}, {
    flowControl: { enabled: true },
})

service.on("data", async (lsn: string, log: Wal2Json.Output) => {
    if (!log.change.length)
        return
    logsProcessedCounter.add(1)
    await tracer.startActiveSpan("data.pipeline", async (span) => {
        span.setAttribute("lsn", lsn)
        const sqlStatements = WalSQLSerializer.transactionToSQL(log);
        const headers = {}
        propagation.inject(context.active(), headers)
        console.log(headers)
        try {
            await producer.send({
                topic: "sql-topic",
                messages: [{ value: JSON.stringify(sqlStatements), headers }]
            });
            console.log(`[${lsn}] Replicated transaction with ${log.change.length} changes.`);
        } catch (e) {
            console.error(`[${lsn}] Failed to send to Kafka, stopping replication:`, e);
            await service.stop();
            process.exit(1);
        }
        finally {
            span.end()
        }
    })
})

await producer.connect()
await service.subscribe(plugin, process.env.REPLICATION_SLOT_NAME ?? "slot1")