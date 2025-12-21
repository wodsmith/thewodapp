/**
 * Async delay helper for testing timing-related behavior.
 * 
 * @example
 * ```ts
 * await delay(100) // Wait 100ms
 * expect(component).toBeVisible()
 * ```
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Immediately flush all pending promises.
 * Useful for testing async state updates.
 * 
 * @example
 * ```ts
 * triggerAsyncAction()
 * await flushPromises()
 * expect(state).toBe("updated")
 * ```
 */
export function flushPromises(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}
