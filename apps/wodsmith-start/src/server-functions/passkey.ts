"use server"

import { createServerFn } from "@tanstack/react-start"

/**
 * Stub passkey server functions for TanStack Start migration.
 * TODO: Implement actual WebAuthn passkey functionality.
 */

/**
 * Start passkey registration process
 */
export const $startPasskeyRegistration = createServerFn({
	method: "POST",
}).handler(
	async ({
		data,
	}: {
		data: { email: string; firstName: string; lastName: string }
	}) => {
		// TODO: Implement WebAuthn registration start
		console.log("Passkey registration started for:", data.email)
		return {
			success: false,
			error: "Passkey registration not yet implemented",
			options: null,
		}
	}
)

/**
 * Verify passkey registration
 */
export const $verifyPasskeyRegistration = createServerFn({
	method: "POST",
}).handler(
	async ({
		data,
	}: {
		data: {
			email: string
			credential: unknown
			first_name: string
			last_name: string
		}
	}) => {
		// TODO: Implement WebAuthn registration verification
		console.log("Passkey verification for:", data.email)
		return {
			success: false,
			error: "Passkey verification not yet implemented",
		}
	}
)

/**
 * Start passkey authentication
 */
export const $startPasskeyAuth = createServerFn({
	method: "POST",
}).handler(async ({ data }: { data: { email: string } }) => {
	// TODO: Implement WebAuthn authentication start
	console.log("Passkey auth started for:", data.email)
	return {
		success: false,
		error: "Passkey authentication not yet implemented",
		options: null,
	}
})

/**
 * Verify passkey authentication
 */
export const $verifyPasskeyAuth = createServerFn({
	method: "POST",
}).handler(async ({ data }: { data: { email: string; credential: unknown } }) => {
	// TODO: Implement WebAuthn authentication verification
	console.log("Passkey auth verification for:", data.email)
	return {
		success: false,
		error: "Passkey authentication not yet implemented",
	}
})
