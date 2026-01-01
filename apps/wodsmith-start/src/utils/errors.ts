/**
 * Custom error class for application errors.
 * Replaces ZSAError from @repo/zsa for wodsmith-start.
 */

export const ERROR_CODES = {
	ERROR: "ERROR",
	NOT_AUTHORIZED: "NOT_AUTHORIZED",
	FORBIDDEN: "FORBIDDEN",
	NOT_FOUND: "NOT_FOUND",
	CONFLICT: "CONFLICT",
	INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
	PRECONDITION_FAILED: "PRECONDITION_FAILED",
	PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
	UNPROCESSABLE_CONTENT: "UNPROCESSABLE_CONTENT",
	TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
	INSUFFICIENT_CREDITS: "INSUFFICIENT_CREDITS",
	PAYMENT_REQUIRED: "PAYMENT_REQUIRED",
} as const

export type ErrorCode = keyof typeof ERROR_CODES

export class AppError extends Error {
	public readonly data: unknown
	public readonly code: ErrorCode

	constructor(code: ErrorCode = ERROR_CODES.ERROR, data?: unknown) {
		super()
		this.data = data
		this.code = code

		if (data instanceof Error) {
			this.message = data.message
			this.stack = data.stack
			this.name = data.name
			this.cause = data.cause
		}

		if (!this.message && typeof this.data === "string") {
			this.message = this.data
		}
	}
}
