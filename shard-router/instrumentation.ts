import { initInstrumentation, tracer as sharedTracer, meter, trace, metrics } from "../shared/instrumentation"

let tracer: ReturnType<typeof trace.getTracer>

export function initTracer(serviceName: string) {
    const result = initInstrumentation({ serviceName })
    tracer = result.tracer
}

export { tracer, meter, metrics }

