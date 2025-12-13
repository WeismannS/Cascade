import { Wal2JsonPlugin, LogicalReplicationService, type Wal2Json } from "pg-logical-replication"
import { WalSQLSerializer } from "./WalSQLSerializer"
import { Kafka } from 'kafkajs'
import "dotenv/config"

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
    const sql = WalSQLSerializer.transactionToSQLScript(log);
    try {
        await producer.send({
            topic: "sql-topic",
            messages: [{ value: sql }]
        });
        console.log(`[${lsn}] Replicated transaction with ${log.change.length} changes.`);
    } catch (e) {
        console.error(`[${lsn}] Failed to send to Kafka, stopping replication:`, e);
        await service.stop();
        process.exit(1);
    }
})

await producer.connect()
await service.subscribe(plugin, process.env.REPLICATION_SLOT_NAME ?? "slot1")