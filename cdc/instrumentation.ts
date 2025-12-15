import { initInstrumentation, tracer, meter, trace, metrics } from "../shared/instrumentation"

initInstrumentation({ serviceName: "cdc-kafka" })

export { tracer, meter, trace, metrics }


