import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import { UAParser } from "ua-parser-js"
import { getDb } from "~/db/index.server"
import { passKeyCredentialTable } from "~/db/schema.server"
import { getSessionFromCookie } from "~/utils/auth.server"

import type { PassKeyCredential, ParsedUserAgent } from "~/db/schema.server"

interface ParsedPasskey extends Omit<PassKeyCredential, "userAgent"> {
	userAgent: string | null
	parsedUserAgent: ParsedUserAgent
}

export const getCurrentUserPasskeysFn = createServerFn("GET", async () => {
	const session = await getSessionFromCookie()
	if (!session) {
		return {
			isAuthenticated: false,
			passkeys: [] as ParsedPasskey[],
			currentPasskeyId: null as string | null,
			email: null as string | null,
		}
	}

	const db = getDb()
	const passkeys = await db
		.select()
		.from(passKeyCredentialTable)
		.where(eq(passKeyCredentialTable.userId, session.user.id))

	const passkeysWithParsedUA = passkeys.map((passkey): ParsedPasskey => {
		const userAgent = passkey.userAgent ?? null
		const result = new UAParser(userAgent ?? "").getResult()
		return {
			...passkey,
			userAgent,
			parsedUserAgent: {
				ua: userAgent ?? "",
				browser: {
					name: result.browser.name,
					version: result.browser.version,
					major: result.browser.major,
				},
				device: {
					model: result.device.model,
					type: result.device.type,
					vendor: result.device.vendor,
				},
				engine: {
					name: result.engine.name,
					version: result.engine.version,
				},
				os: {
					name: result.os.name,
					version: result.os.version,
				},
			},
		}
	})

	return {
		isAuthenticated: true,
		passkeys: passkeysWithParsedUA,
		currentPasskeyId: session.passkeyCredentialId ?? null,
		email: session.user.email,
	}
})


