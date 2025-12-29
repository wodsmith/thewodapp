import "server-only"

import { render } from "@react-email/render"
import { SITE_DOMAIN, SITE_URL } from "@/constants"
import { ResetPasswordEmail } from "@/react-email/reset-password"
import { TeamInviteEmail } from "@/react-email/team-invite"
import { VerifyEmail } from "@/react-email/verify-email"
import isProd from "./is-prod"

// ============================================================================
// PII Redaction Utilities
// ============================================================================

/**
 * Masks an email address for logging purposes.
 * Shows first 2 chars + domain, hides everything else.
 * e.g., "john.doe@example.com" -> "jo***@example.com"
 */
function maskEmail(email: string): string {
	const atIndex = email.indexOf("@")
	if (atIndex <= 0) return "***"

	const localPart = email.slice(0, atIndex)
	const domain = email.slice(atIndex)

	// Show first 2 chars of local part (or 1 if very short), mask the rest
	const visibleChars = Math.min(2, localPart.length)
	const maskedLocal = `${localPart.slice(0, visibleChars)}***`

	return maskedLocal + domain
}

/**
 * Masks multiple email addresses for safe logging.
 */
function maskEmails(emails: string[]): string {
	return emails.map(maskEmail).join(",")
}

// ============================================================================
// Types
// ============================================================================

export interface SendEmailOptions {
	to: string | string[]
	subject: string
	template: React.ReactElement
	tags?: { name: string; value: string }[]
	replyTo?: string
}

// ============================================================================
// Configuration
// ============================================================================

const isTestMode = process.env.EMAIL_TEST_MODE === "true"
const shouldSendEmail = isProd || isTestMode

// ============================================================================
// Generic Email Sender
// ============================================================================

/**
 * Generic email sender using Resend
 * - In production: sends via Resend API
 * - In development: logs to console (unless EMAIL_TEST_MODE=true)
 */
export async function sendEmail({
	to,
	subject,
	template,
	tags = [],
	replyTo,
}: SendEmailOptions): Promise<void> {
	const recipients = Array.isArray(to) ? to : [to]
	const emailType = tags.find((t) => t.name === "type")?.value ?? "unknown"

	if (!shouldSendEmail) {
		console.warn(
			`\n[Email Preview] To: ${recipients.join(", ")}\nSubject: ${subject}\nType: ${emailType}\n`,
		)
		console.log("[Email] Skipped (dev mode)", {
			recipientCount: recipients.length,
			subject,
			emailType,
		})
		return
	}

	if (!process.env.RESEND_API_KEY) {
		console.error("[Email] RESEND_API_KEY not configured", {
			recipientCount: recipients.length,
			subject,
			emailType,
		})
		return
	}

	// Default email sender config (fallback for development)
	// Uses mail.wodsmith.com subdomain which is verified in Resend
	const emailFrom = process.env.EMAIL_FROM || "team@mail.wodsmith.com"
	const emailFromName = process.env.EMAIL_FROM_NAME || "WODsmith"
	const emailReplyTo = process.env.EMAIL_REPLY_TO || "support@mail.wodsmith.com"

	try {
		const html = await render(template)

		const response = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				from: `${emailFromName} <${emailFrom}>`,
				to: recipients,
				subject,
				html,
				reply_to: replyTo ?? emailReplyTo,
				tags,
			}),
		})

		if (!response.ok) {
			const error = await response.json()
			throw new Error(`Resend API error: ${JSON.stringify(error)}`)
		}

		const result = (await response.json()) as { id: string }

		console.log("[Email] Sent successfully", {
			recipientCount: recipients.length,
			recipientMasked: maskEmails(recipients),
			subject,
			emailType,
			resendId: result.id,
		})
	} catch (err) {
		console.error("[Email] Failed to send", {
			error: err,
			recipientCount: recipients.length,
			recipientMasked: maskEmails(recipients),
			subject,
			emailType,
		})
		// Don't re-throw - email failures shouldn't break primary actions
	}
}

// ============================================================================
// Email Template Functions (delegates to sendEmail)
// ============================================================================

/**
 * Sends a password reset email.
 * Uses the unified sendEmail function for consistent logging and error handling.
 */
export async function sendPasswordResetEmail({
	email,
	resetToken,
	username,
}: {
	email: string
	resetToken: string
	username: string
}): Promise<void> {
	const resetUrl = `${SITE_URL}/reset-password?token=${resetToken}`

	// In dev mode, console.warn shows the URL for easy testing
	if (!shouldSendEmail) {
		console.warn("\n\n\nPassword reset url: ", resetUrl)
	}

	await sendEmail({
		to: email,
		subject: `Reset your password for ${SITE_DOMAIN}`,
		template: ResetPasswordEmail({ resetLink: resetUrl, username }),
		tags: [{ name: "type", value: "password-reset" }],
	})
}

/**
 * Sends an email verification email.
 * Uses the unified sendEmail function for consistent logging and error handling.
 */
export async function sendVerificationEmail({
	email,
	verificationToken,
	username,
}: {
	email: string
	verificationToken: string
	username: string
}): Promise<void> {
	const verificationUrl = `${SITE_URL}/verify-email?token=${verificationToken}`

	// In dev mode, console.warn shows the URL for easy testing
	if (!shouldSendEmail) {
		console.warn("\n\n\nVerification url: ", verificationUrl)
	}

	await sendEmail({
		to: email,
		subject: `Verify your email for ${SITE_DOMAIN}`,
		template: VerifyEmail({ verificationLink: verificationUrl, username }),
		tags: [{ name: "type", value: "email-verification" }],
	})
}

/**
 * Sends a team invitation email.
 * Uses the unified sendEmail function for consistent logging and error handling.
 */
export async function sendTeamInvitationEmail({
	email,
	invitationToken,
	teamName,
	inviterName,
}: {
	email: string
	invitationToken: string
	teamName: string
	inviterName: string
}): Promise<void> {
	const inviteUrl = `${SITE_URL}/team-invite?token=${encodeURIComponent(invitationToken)}`

	// In dev mode, console.warn shows the URL for easy testing
	if (!shouldSendEmail) {
		console.warn("\n\n\nTeam invitation url: ", inviteUrl)
	}

	await sendEmail({
		to: email,
		subject: `You've been invited to join a team on ${SITE_DOMAIN}`,
		template: TeamInviteEmail({
			inviteLink: inviteUrl,
			recipientEmail: email,
			teamName,
			inviterName,
		}),
		tags: [{ name: "type", value: "team-invitation" }],
	})
}
