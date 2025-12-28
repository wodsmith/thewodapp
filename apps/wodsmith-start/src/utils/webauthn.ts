import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransport,
  RegistrationResponseJSON,
} from '@simplewebauthn/types'
import {eq} from 'drizzle-orm'
import {SITE_DOMAIN, SITE_NAME, SITE_URL} from '@/constants'
import {getDb} from '@/db'
import {passKeyCredentialTable} from '@/db/schema'
import isProd from './is-prod'

const rpName = SITE_NAME
const rpID = isProd ? SITE_DOMAIN : 'localhost'
const origin = SITE_URL

export async function generatePasskeyRegistrationOptions(
  userId: string,
  email: string,
) {
  const db = getDb()
  const existingCredentials = await db.query.passKeyCredentialTable.findMany({
    where: eq(passKeyCredentialTable.userId, userId),
  })

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: Buffer.from(userId),
    userName: email,
    attestationType: 'none',
    excludeCredentials: existingCredentials.map((cred) => ({
      id: cred.credentialId,
      type: 'public-key',
      transports: cred.transports
        ? (JSON.parse(cred.transports) as AuthenticatorTransport[])
        : undefined,
    })),
  })

  return options
}

export async function verifyPasskeyRegistration({
  userId,
  response,
  challenge,
  userAgent,
  ipAddress,
}: {
  userId: string
  response: RegistrationResponseJSON
  challenge: string
  userAgent?: string | null
  ipAddress?: string | null
}) {
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  })

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Passkey registration failed')
  }

  // Extract credential info from registrationInfo
  // Note: API changed in simplewebauthn v10 - credential is now at top level
  const {credentialID, credentialPublicKey, aaguid} =
    verification.registrationInfo

  const db = getDb()
  await db.insert(passKeyCredentialTable).values({
    userId,
    credentialId: credentialID,
    credentialPublicKey: Buffer.from(credentialPublicKey).toString('base64url'),
    counter: 0, // Initial counter value for new registrations
    transports: response.response.transports
      ? JSON.stringify(response.response.transports)
      : null,
    aaguid: aaguid || null,
    userAgent,
    ipAddress,
  })

  return verification
}

export async function generatePasskeyAuthenticationOptions() {
  const db = getDb()
  const credentials = await db.query.passKeyCredentialTable.findMany()

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: credentials.map((cred) => ({
      id: cred.credentialId,
      type: 'public-key',
      transports: cred.transports
        ? (JSON.parse(cred.transports) as AuthenticatorTransport[])
        : undefined,
    })),
  })

  return options
}

export async function verifyPasskeyAuthentication(
  response: AuthenticationResponseJSON,
  challenge: string,
) {
  const credentialId = response.id

  const db = getDb()
  const credential = await db.query.passKeyCredentialTable.findFirst({
    where: eq(passKeyCredentialTable.credentialId, credentialId),
  })

  if (!credential) {
    throw new Error('Passkey not found')
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
    // Note: In simplewebauthn v10+, authenticator is passed instead of credential
    authenticator: {
      credentialID: credential.credentialId,
      credentialPublicKey: Buffer.from(
        credential.credentialPublicKey,
        'base64url',
      ),
      counter: credential.counter,
      transports: credential.transports
        ? JSON.parse(credential.transports)
        : undefined,
    },
  })

  if (!verification.verified) {
    throw new Error('Passkey authentication failed')
  }

  // Update the counter
  await db
    .update(passKeyCredentialTable)
    .set({counter: verification.authenticationInfo.newCounter})
    .where(eq(passKeyCredentialTable.credentialId, credential.credentialId))

  return {
    verification,
    credential,
  }
}
