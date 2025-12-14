import { trace, metrics } from "@opentelemetry/api"
import { NodeTracerProvider, SimpleSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-node"
import { MeterProvider, PeriodicExportingMetricReader, ConsoleMetricExporter } from "@opentelemetry/sdk-metrics"
import {OTLPTraceExporter} from "@opentelemetry/exporter-trace-otlp-http"
import {OTLPMetricExporter} from "@opentelemetry/exporter-metrics-otlp-http"
import { resourceFromAttributes } from "@opentelemetry/resources"
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions"
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus"
let tracer: ReturnType<typeof trace.getTracer>
let metric : ReturnType<typeof metrics.getMeter>
export function initTracer(service_name: string) {
    const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: service_name,
    })

    const provider = new NodeTracerProvider({
        resource,
        spanProcessors: [new SimpleSpanProcessor(new OTLPTraceExporter({
            url : "http://localhost:4318/v1/traces",

        }))],
    })
    provider.register()

    const meterProvider = new MeterProvider({
        resource,
        readers: [new PrometheusExporter({
            
        })],
    })
    metrics.setGlobalMeterProvider(meterProvider)

    const meter = metrics.getMeter(service_name)
    metric = meter
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

    tracer = trace.getTracer(service_name)
    console.log(`OpenTelemetry instrumentation started for service_name`)
}

export { tracer, metrics }

