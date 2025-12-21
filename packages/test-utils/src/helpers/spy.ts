import { vi, type Mock } from "vitest"

/**
 * Create a typed spy function with optional implementation.
 * Wrapper around vi.fn() for convenience.
 * 
 * @example
 * ```ts
 * const onSubmit = createSpy<(data: FormData) => void>()
 * onSubmit({ name: "test" })
 * expect(onSubmit).toHaveBeenCalledWith({ name: "test" })
 * ```
 */
export function createSpy<T extends (...args: unknown[]) => unknown>(
  implementation?: T
): Mock<T> {
  return implementation ? vi.fn(implementation) : vi.fn()
}

/**
 * Create a spy that resolves with the given value.
 * Useful for mocking async functions.
 * 
 * @example
 * ```ts
 * const getUser = createAsyncSpy({ id: "1", name: "Test" })
 * const user = await getUser()
 * expect(user).toEqual({ id: "1", name: "Test" })
 * ```
 */
export function createAsyncSpy<T>(resolveValue: T): Mock<() => Promise<T>> {
  return vi.fn().mockResolvedValue(resolveValue)
}

/**
 * Create a spy that rejects with the given error.
 * 
 * @example
 * ```ts
 * const failingFetch = createRejectingSpy(new Error("Network error"))
 * await expect(failingFetch()).rejects.toThrow("Network error")
 * ```
 */
export function createRejectingSpy<T = unknown>(
  error: Error
): Mock<() => Promise<T>> {
  return vi.fn().mockRejectedValue(error)
}
