/**
 * Generate a password hash for E2E test user
 * Run with: pnpm tsx scripts/generate-test-password-hash.ts
 *
 * This uses the same PBKDF2 algorithm as the app's password-hasher.ts
 */

const TEST_PASSWORD = "TestPassword123!"

// Use a fixed salt for reproducible test hashes
// This is the hex-encoded 16-byte salt
const FIXED_SALT_HEX = "e2e0test0salt00000000000000000000"

async function hashPassword(password: string, saltHex: string): Promise<string> {
	const encoder = new TextEncoder()

	// Convert hex salt to Uint8Array
	const saltBytes = saltHex.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []
	const salt = new Uint8Array(saltBytes)

	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		encoder.encode(password),
		{ name: "PBKDF2" },
		false,
		["deriveBits", "deriveKey"],
	)

	const key = await crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt: salt as BufferSource,
			iterations: 100000,
			hash: "SHA-256",
		},
		keyMaterial,
		{ name: "AES-GCM", length: 256 },
		true,
		["encrypt", "decrypt"],
	)

	const exportedKey = await crypto.subtle.exportKey("raw", key)
	const hashBuffer = new Uint8Array(exportedKey)

	const hashHex = Array.from(hashBuffer)
		.map((b: number) => b.toString(16).padStart(2, "0"))
		.join("")

	return `${saltHex}:${hashHex}`
}

async function main() {
	const hash = await hashPassword(TEST_PASSWORD, FIXED_SALT_HEX)
	console.log("Test Password:", TEST_PASSWORD)
	console.log("Password Hash:", hash)
	console.log("\nUse this hash in seed-e2e.sql for the test user's passwordHash field")
}

main()
