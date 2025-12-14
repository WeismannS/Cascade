import { trace, metrics } from "@opentelemetry/api"
import { NodeTracerProvider, SimpleSpanProcessor} from "@opentelemetry/sdk-trace-node"
import { MeterProvider} from "@opentelemetry/sdk-metrics"
import {OTLPTraceExporter} from "@opentelemetry/exporter-trace-otlp-http"
import { resourceFromAttributes } from "@opentelemetry/resources"
import { HostMetrics } from "@opentelemetry/host-metrics"
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
            url : "http://jaeger:4318/v1/traces",
        }))],
    })
    provider.register()

    const meterProvider = new MeterProvider({
        resource,
        readers: [new PrometheusExporter({
            
        })],
    })
    metrics.setGlobalMeterProvider(meterProvider)
    trace.setGlobalTracerProvider(provider)
    const host = new HostMetrics({ meterProvider,metricGroups : ['process.cpu', 'process.memory'] });
    host.start()
    tracer = trace.getTracer(service_name)
    console.log(`OpenTelemetry instrumentation started for service_name`)
}

export { tracer, metrics }

