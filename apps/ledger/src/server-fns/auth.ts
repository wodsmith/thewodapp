import { createServerFn } from "@tanstack/react-start"
import { env } from "cloudflare:workers"
import { getCookie, getRequestHeader, setCookie } from "@tanstack/react-start/server"
import { z } from "zod"

const SESSION_COOKIE = "ledger_session"

const MAX_LOGIN_ATTEMPTS = 5
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>()

function checkRateLimit(ip: string): boolean {
	const now = Date.now()
	const entry = loginAttempts.get(ip)
	if (!entry || now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
		loginAttempts.set(ip, { count: 1, firstAttempt: now })
		return true
	}
	if (entry.count >= MAX_LOGIN_ATTEMPTS) {
		return false
	}
	entry.count++
	return true
}

function resetRateLimit(ip: string): void {
	loginAttempts.delete(ip)
}

async function sha256(input: string): Promise<Uint8Array> {
	const encoded = new TextEncoder().encode(input)
	const digest = await crypto.subtle.digest("SHA-256", encoded)
	return new Uint8Array(digest)
}

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
	const [digestA, digestB] = await Promise.all([sha256(a), sha256(b)])
	return crypto.subtle.timingSafeEqual(digestA, digestB)
}

function getSigningKey(): string {
	const key = env.LEDGER_AUTH_PASSWORD
	if (!key) {
		throw new Error("LEDGER_AUTH_PASSWORD not configured")
	}
	return key
}

async function signToken(token: string): Promise<string> {
	const key = getSigningKey()
	const encoder = new TextEncoder()
	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		encoder.encode(key),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	)
	const signature = await crypto.subtle.sign(
		"HMAC",
		cryptoKey,
		encoder.encode(token),
	)
	const sigHex = Array.from(new Uint8Array(signature))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")
	return `${token}.${sigHex}`
}

async function verifyToken(cookie: string): Promise<boolean> {
	const dotIndex = cookie.lastIndexOf(".")
	if (dotIndex === -1) return false

	const token = cookie.slice(0, dotIndex)
	const expected = await signToken(token)

	return timingSafeEqual(cookie, expected)
}

export const checkAuthFn = createServerFn().handler(async () => {
	const cookie = await getCookie(SESSION_COOKIE)
	if (!cookie) return false
	return verifyToken(cookie)
})

export async function requireAuth() {
	const cookie = await getCookie(SESSION_COOKIE)
	if (!cookie || !(await verifyToken(cookie))) {
		throw new Error("Unauthorized")
	}
}

export const loginFn = createServerFn()
	.validator(z.object({ password: z.string() }))
	.handler(async ({ data }) => {
		const clientIp = await getRequestHeader("CF-Connecting-IP") || "unknown"
		if (!checkRateLimit(clientIp)) {
			return { success: false, error: "Too many login attempts. Try again later." } as const
		}

		const correctPassword = env.LEDGER_AUTH_PASSWORD
		if (!correctPassword) {
			throw new Error("LEDGER_AUTH_PASSWORD not configured")
		}

		const match = await timingSafeEqual(data.password, correctPassword)
		if (!match) {
			return { success: false, error: "Invalid password" } as const
		}

		// Generate a random session token and HMAC-sign it
		const token = crypto.randomUUID()
		const signed = await signToken(token)

		await setCookie(SESSION_COOKIE, signed, {
			httpOnly: true,
			secure: true,
			sameSite: "lax",
			path: "/",
			maxAge: 60 * 60 * 24 * 30, // 30 days
		})

		resetRateLimit(clientIp)
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
