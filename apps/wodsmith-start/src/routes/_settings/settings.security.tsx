'use server'

import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { UAParser } from 'ua-parser-js'
import { getDb } from '~/db/index.server'
import type { PassKeyCredential, ParsedUserAgent } from '~/db/schema.server'
import { passKeyCredentialTable } from '~/db/schema.server'
import { getSessionFromCookie } from '~/utils/auth.server'
import { PasskeysList } from '~/components/settings/passkey'

export const Route = createFileRoute('/_settings/settings/security')({
	component: SecurityPage,
})

interface ParsedPasskey extends Omit<PassKeyCredential, 'userAgent'> {
	userAgent: string | null
	parsedUserAgent: ParsedUserAgent
}

async function SecurityPage() {
	const session = await getSessionFromCookie()

	if (!session) {
		return <div>Not authenticated</div>
	}

	const db = getDb()
	const passkeys = await db
		.select()
		.from(passKeyCredentialTable)
		.where(eq(passKeyCredentialTable.userId, session.user.id))

	// Parse user agent for each passkey
	const passkeysWithParsedUA = passkeys.map(
		(passkey: PassKeyCredential): ParsedPasskey => {
			const userAgent = passkey.userAgent ?? null
			const result = new UAParser(userAgent ?? '').getResult()
			const passkeyWithParsedUA = {
				...passkey,
				userAgent: userAgent ?? null,
				parsedUserAgent: {
					ua: userAgent ?? '',
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
