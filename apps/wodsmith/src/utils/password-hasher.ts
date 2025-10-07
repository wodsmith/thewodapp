interface HashPasswordParams {
	password: string
	providedSalt?: Uint8Array
}

async function hashPassword({ password, providedSalt }: HashPasswordParams) {
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
	const saltHex = Array.from(salt)
		.map((b: number) => b.toString(16).padStart(2, "0"))
		.join("")

	return `${saltHex}:${hashHex}`
}

interface VerifyPasswordParams {
	storedHash: string
	passwordAttempt: string
}

async function verifyPassword({
	storedHash,
	passwordAttempt,
}: VerifyPasswordParams) {
	const parts = storedHash.split(":")
	const saltHex = parts[0]
	const originalHash = parts[1]

	if (!saltHex || !originalHash) {
		return false
	}

	const saltBytes =
		saltHex
			.match(/.{1,2}/g)
			?.map((byte: string) => Number.parseInt(byte, 16)) ?? []
	const salt = new Uint8Array(saltBytes)

	const attemptHashWithSalt = await hashPassword({
		password: passwordAttempt,
		providedSalt: salt,
	})
	const [, attemptHash] = attemptHashWithSalt.split(":")

	return attemptHash === originalHash
}

export { hashPassword, verifyPassword }
