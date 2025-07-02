#!/usr/bin/env node

// Generate password hashes using the same method as the project
// Usage: node scripts/generate-password-hash.js [password]

async function hashPassword(password, providedSalt) {
	const encoder = new TextEncoder()
	const salt = providedSalt || crypto.getRandomValues(new Uint8Array(16))

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
			salt: salt,
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
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")
	const saltHex = Array.from(salt)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")

	return `${saltHex}:${hashHex}`
}

async function main() {
	const password = process.argv[2] || 'password123'
	
	console.log('Generating password hash...')
	console.log('Password:', password)
	
	const hash = await hashPassword(password)
	console.log('Hash:', hash)
	
	console.log('\nReady to use in seed.sql!')
}

main().catch(console.error) 