import { Effect, type Tracer } from "effect"

export const span =
  (boundary: string, source: string, options?: Tracer.SpanOptions | undefined) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.withSpan(effect, boundary, {
      ...options,
      attributes: { __source: source, ...options?.attributes },
    })
