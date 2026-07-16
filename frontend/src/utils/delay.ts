/** Simulated network latency for mock services, so loading states are visible. */
export function delay(ms = 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
