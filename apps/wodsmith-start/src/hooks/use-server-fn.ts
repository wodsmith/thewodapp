"use client"

import { useServerFn } from "@tanstack/react-start"
import { useCallback, useState } from "react"

/**
 * Hook that wraps TanStack Start server functions with loading/error state.
 * Provides a similar API to ZSA's useServerAction for easier migration.
 *
 * @example
 * // Server function
 * export const myServerFn = createServerFn({ method: 'POST' })
 *   .validator(z.object({ id: z.string() }))
 *   .handler(async ({ data }) => { ... })
 *
 * // Component usage
 * const { execute, isPending, error, data } = useServerFnWithState(myServerFn)
 *
 * const handleClick = async () => {
 *   const [result, err] = await execute({ id: '123' })
 *   if (err) { ... }
 * }
 */
export function useServerFnWithState<
	TInput,
	TOutput,
	TFn extends (opts: { data: TInput }) => Promise<TOutput>,
>(serverFn: TFn) {
	const fn = useServerFn(serverFn)
	const [isPending, setIsPending] = useState(false)
	const [error, setError] = useState<Error | null>(null)
	const [data, setData] = useState<TOutput | null>(null)

	const execute = useCallback(
		async (input: TInput): Promise<readonly [TOutput | null, Error | null]> => {
			setIsPending(true)
			setError(null)
			try {
				const result = await fn({ data: input } as Parameters<TFn>[0])
				setData(result)
				return [result, null] as const
			} catch (e) {
				const err = e instanceof Error ? e : new Error(String(e))
				setError(err)
				return [null, err] as const
			} finally {
				setIsPending(false)
			}
		},
		[fn],
	)

	const reset = useCallback(() => {
		setData(null)
		setError(null)
		setIsPending(false)
	}, [])

	return { execute, isPending, error, data, reset }
}

/**
 * Simpler hook for mutations that don't need stored state.
 * Just provides loading state during execution.
 */
export function useServerFnMutation<
	TInput,
	TOutput,
	TFn extends (opts: { data: TInput }) => Promise<TOutput>,
>(serverFn: TFn) {
	const fn = useServerFn(serverFn)
	const [isPending, setIsPending] = useState(false)

	const mutate = useCallback(
		async (input: TInput): Promise<TOutput> => {
			setIsPending(true)
			try {
				return await fn({ data: input } as Parameters<TFn>[0])
			} finally {
				setIsPending(false)
			}
		},
		[fn],
	)

	return { mutate, isPending }
}
