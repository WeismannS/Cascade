import { trace, metrics } from "@opentelemetry/api"
import { NodeTracerProvider, SimpleSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-node"
import { MeterProvider, PeriodicExportingMetricReader, ConsoleMetricExporter } from "@opentelemetry/sdk-metrics"
import {OTLPTraceExporter} from "@opentelemetry/exporter-trace-otlp-http"
import {OTLPMetricExporter} from "@opentelemetry/exporter-metrics-otlp-http"
import { resourceFromAttributes } from "@opentelemetry/resources"
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions"

let tracer: ReturnType<typeof trace.getTracer>

export function initTracer(shardId: string) {
    const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: `sql-shard-${shardId}`,
    })

    const provider = new NodeTracerProvider({
        resource,
        spanProcessors: [new SimpleSpanProcessor(new OTLPTraceExporter())],
    })
    provider.register()

    const meterProvider = new MeterProvider({
        resource,
        readers: [new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter(),
            exportIntervalMillis: 10000,
        })],
    })
    metrics.setGlobalMeterProvider(meterProvider)

    const meter = metrics.getMeter(`sql-shard-${shardId}`)
    meter.createObservableGauge("process.memory.heap_used", {
        description: "Heap memory used in bytes",
        unit: "bytes",
    }).addCallback((observableResult) => {
        observableResult.observe(process.memoryUsage().heapUsed)
    })

    meter.createObservableGauge("process.memory.rss", {
        description: "Resident set size in bytes",
        unit: "bytes",
    }).addCallback((observableResult) => {
        observableResult.observe(process.memoryUsage().rss)
    })
    let lastCpuUsage = process.cpuUsage()
    let lastTime = Date.now()

    meter.createObservableGauge("process.cpu.usage", {
        description: "CPU usage percentage",
        unit: "percent",
    }).addCallback((observableResult) => {
        const currentCpuUsage = process.cpuUsage(lastCpuUsage)
        const currentTime = Date.now()
        const elapsedMs = currentTime - lastTime

        const cpuPercent = ((currentCpuUsage.user + currentCpuUsage.system) / 1000) / elapsedMs * 100
        observableResult.observe(cpuPercent)

        lastCpuUsage = process.cpuUsage()
        lastTime = currentTime
    })

    tracer = trace.getTracer(`sql-shard-${shardId}`)
    console.log(`OpenTelemetry instrumentation started for sql-shard-${shardId}`)
}

export { tracer }

