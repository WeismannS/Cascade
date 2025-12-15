import { trace, metrics } from "@opentelemetry/api"
import { NodeTracerProvider, SimpleSpanProcessor, BatchSpanProcessor } from "@opentelemetry/sdk-trace-node"
import { MeterProvider } from "@opentelemetry/sdk-metrics"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { resourceFromAttributes } from "@opentelemetry/resources"
import { HostMetrics } from "@opentelemetry/host-metrics"
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions"
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus"

export interface InstrumentationConfig {
    serviceName: string
    jaegerUrl?: string
    useBatchProcessor?: boolean
}

let tracer: ReturnType<typeof trace.getTracer>
let meter: ReturnType<typeof metrics.getMeter>

export function initInstrumentation(config: InstrumentationConfig) {
    const {
        serviceName,
        jaegerUrl = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://jaeger:4318/v1/traces",
        useBatchProcessor = process.env.NODE_ENV === "production"
    } = config

    const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
    })

    const exporter = new OTLPTraceExporter({ url: jaegerUrl })

    const spanProcessor = useBatchProcessor
        ? new BatchSpanProcessor(exporter)
        : new SimpleSpanProcessor(exporter)

    const provider = new NodeTracerProvider({
        resource,
        spanProcessors: [spanProcessor],
    })
    provider.register()

    const meterProvider = new MeterProvider({
        resource,
        readers: [new PrometheusExporter({})],
    })

    metrics.setGlobalMeterProvider(meterProvider)
    trace.setGlobalTracerProvider(provider)

    const host = new HostMetrics({
        meterProvider,
        metricGroups: ['process.cpu', 'process.memory']
    })
    host.start()

    tracer = trace.getTracer(serviceName)
    meter = metrics.getMeter(serviceName)

    console.log(`OpenTelemetry instrumentation started for ${serviceName}`)

    return { tracer, meter }
}

export { tracer, meter, trace, metrics }
