let counter = 0

/** Deterministic-enough id generator for mock data and client-side records. */
export function createId(prefix: string): string {
  counter += 1
  const random = Math.random().toString(36).slice(2, 8)
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${random}`
}
