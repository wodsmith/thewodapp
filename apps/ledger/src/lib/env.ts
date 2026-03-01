import { createServerOnlyFn } from "@tanstack/react-start"
import { env } from "cloudflare:workers"

export const getSessionSecret = createServerOnlyFn((): string => {
	const key = env.LEDGER_SESSION_SECRET
	if (!key) {
		throw new Error("LEDGER_SESSION_SECRET not configured")
	}
	return key
})

export const getAuthPassword = createServerOnlyFn((): string => {
	const password = env.LEDGER_AUTH_PASSWORD
	if (!password) {
		throw new Error("LEDGER_AUTH_PASSWORD not configured")
	}
	return password
})

export const getR2Bucket = createServerOnlyFn(() => {
	return env.R2_BUCKET
})

export const getOpenAIKey = createServerOnlyFn((): string => {
	const key = env.OPENAI_API_KEY
	if (!key) {
		throw new Error("OPENAI_API_KEY not configured")
	}
	return key
})
