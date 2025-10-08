import "server-only"

import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { UAParser } from "ua-parser-js"
import { getDb } from "@/db"
import type { PassKeyCredential } from "@/db/schema"
import { passKeyCredentialTable } from "@/db/schema"
import type { ParsedUserAgent } from "@/types"
import { getSessionFromCookie } from "@/utils/auth"
import { PasskeysList } from "./passkey.client"

interface ParsedPasskey extends Omit<PassKeyCredential, "userAgent"> {
	userAgent: string | null
	parsedUserAgent: ParsedUserAgent
}

export default async function SecurityPage() {
	const session = await getSessionFromCookie()

	if (!session) {
		return redirect("/sign-in")
	}

	const db = getDb()
	const passkeys = await db
		.select()
		.from(passKeyCredentialTable)
		.where(eq(passKeyCredentialTable.userId, session.user.id))

	// Parse user agent for each passkey
	const passkeysWithParsedUA = passkeys.map(
		(passkey: PassKeyCredential): ParsedPasskey => {
			// Since userAgent is text() in the schema, it can be null or undefined
			// Convert undefined to null to match our Passkey interface
			const userAgent = passkey.userAgent ?? null
			const result = new UAParser(userAgent ?? "").getResult()
			const passkeyWithParsedUA = {
				...passkey,
				userAgent: userAgent ?? null,
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
			return passkeyWithParsedUA
		},
	)

	return (
		<div className="container max-w-4xl space-y-8">
			<PasskeysList
				passkeys={passkeysWithParsedUA}
				currentPasskeyId={session.passkeyCredentialId ?? null}
				email={session.user.email}
			/>
		</div>
	)
}
