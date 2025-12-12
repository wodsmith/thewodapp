"use server"

import { createServerFn } from "@tanstack/react-start"

/**
 * Stub passkey server functions for TanStack Start migration.
 * TODO: Implement actual WebAuthn passkey functionality.
 */

/**
 * Generate authentication options for passkey login
 * Creates a challenge for the authenticator to sign
 */
export const generateAuthenticationOptionsAction = createServerFn("POST", async (input: { email: string }) => {
	// TODO: Implement WebAuthn authentication options generation
	console.log("Authentication options requested for:", input.email)
	return {
		success: false,
		error: "Passkey authentication not yet implemented",
		options: null,
	}
})

/**
 * Verify passkey authentication
 * Verifies the signed challenge and creates session
 */
export const verifyAuthenticationAction = createServerFn("POST", async (input: { email: string; credential: unknown }) => {
	// TODO: Implement WebAuthn authentication verification
	console.log("Passkey auth verification for:", input.email)
	return {
		success: false,
		error: "Passkey authentication not yet implemented",
	}
})

/**
 * Start passkey registration process
 * Generates challenge for credential creation
 */
export const startPasskeyRegistrationAction = createServerFn("POST", async (input: { email: string; firstName: string; lastName: string }) => {
	// TODO: Implement WebAuthn registration start
	console.log("Passkey registration started for:", input.email)
	return {
		success: false,
		error: "Passkey registration not yet implemented",
		options: null,
	}
})

/**
 * Complete passkey registration
 * Verifies credential and stores it for user
 */
export const completePasskeyRegistrationAction = createServerFn("POST", async (input: { email: string; credential: unknown; firstName: string; lastName: string }) => {
	// TODO: Implement WebAuthn registration verification
	console.log("Passkey registration completed for:", input.email)
	return {
		success: false,
		error: "Passkey registration not yet implemented",
	}
})
