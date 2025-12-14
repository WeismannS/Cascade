import { trace, metrics } from "@opentelemetry/api"
import { NodeTracerProvider, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-node"
import { MeterProvider} from "@opentelemetry/sdk-metrics"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { resourceFromAttributes } from "@opentelemetry/resources"
import { HostMetrics } from "@opentelemetry/host-metrics"
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions"
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus"

const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: "cdc-kafka",
})
const provider = new NodeTracerProvider({
    resource,
    spanProcessors: [
        new SimpleSpanProcessor(new OTLPTraceExporter({
            url: "http://jaeger:4318/v1/traces",
        })),
    ],
})
provider.register()

const meterProvider = new MeterProvider({
    resource,
    readers: [new PrometheusExporter({
            
    })],
})

metrics.setGlobalMeterProvider(meterProvider)
trace.setGlobalTracerProvider(provider)
const host = new HostMetrics({ meterProvider, metricGroups: ['process.cpu', 'process.memory'] });
host.start()
console.log(`OpenTelemetry instrumentation started for service_name`)


