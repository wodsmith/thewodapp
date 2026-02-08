import { createServerFn } from "@tanstack/react-start"
import { env } from "cloudflare:workers"
import { getCookie, setCookie } from "@tanstack/react-start/server"
import { z } from "zod"

const SESSION_COOKIE = "ledger_session"
const SESSION_VALUE = "authenticated"

export const checkAuthFn = createServerFn().handler(async () => {
	const cookie = await getCookie(SESSION_COOKIE)
	return cookie === SESSION_VALUE
})

export const loginFn = createServerFn()
	.validator(z.object({ password: z.string() }))
	.handler(async ({ data }) => {
		const correctPassword = env.LEDGER_AUTH_PASSWORD
		if (!correctPassword) {
			throw new Error("LEDGER_AUTH_PASSWORD not configured")
		}

		if (data.password !== correctPassword) {
			return { success: false, error: "Invalid password" } as const
		}

		await setCookie(SESSION_COOKIE, SESSION_VALUE, {
			httpOnly: true,
			secure: true,
			sameSite: "lax",
			path: "/",
			maxAge: 60 * 60 * 24 * 30, // 30 days
		})

		return { success: true } as const
	})

export const logoutFn = createServerFn().handler(async () => {
	await setCookie(SESSION_COOKIE, "", {
		httpOnly: true,
		secure: true,
		sameSite: "lax",
		path: "/",
		maxAge: 0,
	})
})
