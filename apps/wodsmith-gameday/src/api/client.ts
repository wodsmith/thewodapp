import { Effect, Schema } from "effect"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ""

class ApiError {
  readonly _tag = "ApiError" as const
  constructor(
    readonly status: number,
    readonly message: string,
  ) {}
}

class AuthError {
  readonly _tag = "AuthError" as const
  constructor(readonly status: number) {}
}

type FetchError = ApiError | AuthError

/**
 * Typed GET request with Effect Schema validation.
 */
export function apiGet<A, I>(
  path: string,
  schema: Schema.Schema<A, I>,
  token?: string,
): Effect.Effect<A, FetchError> {
  return Effect.tryPromise({
    try: async () => {
      const headers: Record<string, string> = {}
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const res = await fetch(`${API_BASE_URL}${path}`, { headers })

      if (res.status === 401) {
        throw new AuthError(401)
      }
      if (!res.ok) {
        const body = await res.text()
        throw new ApiError(res.status, body)
      }

      return res.json() as Promise<unknown>
    },
    catch: (error) => {
      if (error instanceof AuthError || error instanceof ApiError) {
        return error
      }
      return new ApiError(0, error instanceof Error ? error.message : "Network error")
    },
  }).pipe(
    Effect.flatMap((raw) =>
      Schema.decodeUnknown(schema)(raw).pipe(
        Effect.mapError(
          (parseError) => new ApiError(0, `Schema validation failed: ${parseError.message}`),
        ),
      ),
    ),
  )
}

/**
 * Typed POST request with Effect Schema validation.
 */
export function apiPost<A, I>(
  path: string,
  body: unknown,
  schema: Schema.Schema<A, I>,
  token?: string,
): Effect.Effect<A, FetchError> {
  return Effect.tryPromise({
    try: async () => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const res = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      })

      if (res.status === 401) {
        throw new AuthError(401)
      }
      if (!res.ok) {
        const data = await res.text()
        throw new ApiError(res.status, data)
      }

      return res.json() as Promise<unknown>
    },
    catch: (error) => {
      if (error instanceof AuthError || error instanceof ApiError) {
        return error
      }
      return new ApiError(0, error instanceof Error ? error.message : "Network error")
    },
  }).pipe(
    Effect.flatMap((raw) =>
      Schema.decodeUnknown(schema)(raw).pipe(
        Effect.mapError(
          (parseError) => new ApiError(0, `Schema validation failed: ${parseError.message}`),
        ),
      ),
    ),
  )
}
