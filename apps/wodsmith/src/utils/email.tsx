import "server-only"

import { render } from "@react-email/render"
import { SITE_DOMAIN, SITE_URL } from "@/constants"
import { logError, logInfo } from "@/lib/logging/posthog-otel-logger"
import { ResetPasswordEmail } from "@/react-email/reset-password"
import { TeamInviteEmail } from "@/react-email/team-invite"
import { VerifyEmail } from "@/react-email/verify-email"
import isProd from "./is-prod"

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
 * - All email events are logged to PostHog
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
		logInfo({
			message: "[Email] Skipped (dev mode)",
			attributes: { to: recipients.join(","), subject, emailType },
		})
		return
	}

	if (!process.env.RESEND_API_KEY) {
		logError({
			message: "[Email] RESEND_API_KEY not configured",
			attributes: { to: recipients.join(","), subject, emailType },
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

		logInfo({
			message: "[Email] Sent successfully",
			attributes: {
				to: recipients.join(","),
				subject,
				emailType,
				resendId: result.id,
			},
		})
	} catch (err) {
		logError({
			message: "[Email] Failed to send",
			error: err,
			attributes: {
				to: recipients.join(","),
				subject,
				emailType,
			},
		})
		// Don't re-throw - email failures shouldn't break primary actions
	}
}

// ============================================================================
// Legacy Support (Brevo)
// ============================================================================

interface BrevoEmailOptions {
	to: { email: string; name?: string }[]
	subject: string
	replyTo?: string
	htmlContent: string
	textContent?: string
	templateId?: number
	params?: Record<string, string>
	tags?: string[]
}

interface ResendEmailOptions {
	to: string[]
	subject: string
	html: string
	from?: string
	replyTo?: string
	text?: string
	tags?: { name: string; value: string }[]
}

type EmailProvider = "resend" | "brevo" | null

async function getEmailProvider(): Promise<EmailProvider> {
	if (process.env.RESEND_API_KEY) {
		return "resend"
	}

	if (process.env.BREVO_API_KEY) {
		return "brevo"
	}

	return null
}

async function sendResendEmail({
	to,
	subject,
	html,
	from,
	replyTo: originalReplyTo,
	text,
	tags,
}: ResendEmailOptions) {
	if (!isProd) {
		return
	}

	if (!process.env.RESEND_API_KEY) {
		throw new Error("RESEND_API_KEY is not set")
	}

	const replyTo = originalReplyTo ?? process.env.EMAIL_REPLY_TO

	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
			"Content-Type": "application/json",
		} as const,
		body: JSON.stringify({
			from:
				from ?? `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
			to,
			subject,
			html,
			text,
			...(replyTo ? { reply_to: replyTo } : {}),
			tags,
		}),
	})

	if (!response.ok) {
		const error = await response.json()
		throw new Error(`Failed to send email via Resend: ${JSON.stringify(error)}`)
	}

	return response.json()
}

async function sendBrevoEmail({
	to,
	subject,
	replyTo: originalReplyTo,
	htmlContent,
	textContent,
	templateId,
	params,
	tags,
}: BrevoEmailOptions) {
	if (!isProd) {
		return
	}

	if (!process.env.BREVO_API_KEY) {
		throw new Error("BREVO_API_KEY is not set")
	}

	const replyTo = originalReplyTo ?? process.env.EMAIL_REPLY_TO

	const response = await fetch("https://api.brevo.com/v3/smtp/email", {
		method: "POST",
		headers: {
			accept: "application/json",
			"content-type": "application/json",
			"api-key": process.env.BREVO_API_KEY,
		} as const,
		body: JSON.stringify({
			sender: {
				name: process.env.EMAIL_FROM_NAME,
				email: process.env.EMAIL_FROM,
			},
			to,
			htmlContent,
			textContent,
			subject,
			templateId,
			params,
			tags,
			...(replyTo
				? {
						replyTo: {
							email: replyTo,
						},
					}
				: {}),
		}),
	})

	if (!response.ok) {
		const error = await response.json()
		throw new Error(`Failed to send email via Brevo: ${JSON.stringify(error)}`)
	}

	return response.json()
}

// ============================================================================
// Existing Email Functions (using legacy multi-provider approach)
// ============================================================================

export async function sendPasswordResetEmail({
	email,
	resetToken,
	username,
}: {
	email: string
	resetToken: string
	username: string
}) {
	const resetUrl = `${SITE_URL}/reset-password?token=${resetToken}`

	if (!isProd) {
		console.warn("\n\n\nPassword reset url: ", resetUrl)

		return
	}

	const html = await render(
		ResetPasswordEmail({ resetLink: resetUrl, username }),
	)
	const provider = await getEmailProvider()

	if (!provider && isProd) {
		throw new Error(
			"No email provider configured. Set either RESEND_API_KEY or BREVO_API_KEY in your environment.",
		)
	}

	if (provider === "resend") {
		await sendResendEmail({
			to: [email],
			subject: `Reset your password for ${SITE_DOMAIN}`,
			html,
			tags: [{ name: "type", value: "password-reset" }],
		})
	} else {
		await sendBrevoEmail({
			to: [{ email, name: username }],
			subject: `Reset your password for ${SITE_DOMAIN}`,
			htmlContent: html,
			tags: ["password-reset"],
		})
	}
}

export async function sendVerificationEmail({
	email,
	verificationToken,
	username,
}: {
	email: string
	verificationToken: string
	username: string
}) {
	const verificationUrl = `${SITE_URL}/verify-email?token=${verificationToken}`

	if (!isProd) {
		console.warn("\n\n\nVerification url: ", verificationUrl)

		return
	}

	const html = await render(
		VerifyEmail({ verificationLink: verificationUrl, username }),
	)
	const provider = await getEmailProvider()

	if (!provider && isProd) {
		throw new Error(
			"No email provider configured. Set either RESEND_API_KEY or BREVO_API_KEY in your environment.",
		)
	}

	if (provider === "resend") {
		await sendResendEmail({
			to: [email],
			subject: `Verify your email for ${SITE_DOMAIN}`,
			html,
			tags: [{ name: "type", value: "email-verification" }],
		})
	} else {
		await sendBrevoEmail({
			to: [{ email, name: username }],
			subject: `Verify your email for ${SITE_DOMAIN}`,
			htmlContent: html,
			tags: ["email-verification"],
		})
	}
}

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
}) {
	const inviteUrl = `${SITE_URL}/team-invite?token=${encodeURIComponent(invitationToken)}`

	if (!isProd) {
		console.warn("\n\n\nTeam invitation url: ", inviteUrl)
		return
	}

	const html = await render(
		TeamInviteEmail({
			inviteLink: inviteUrl,
			recipientEmail: email,
			teamName,
			inviterName,
		}),
	)

	const provider = await getEmailProvider()

	if (!provider && isProd) {
		throw new Error(
			"No email provider configured. Set either RESEND_API_KEY or BREVO_API_KEY in your environment.",
		)
	}

	if (provider === "resend") {
		await sendResendEmail({
			to: [email],
			subject: `You've been invited to join a team on ${SITE_DOMAIN}`,
			html,
			tags: [{ name: "type", value: "team-invitation" }],
		})
	} else {
		await sendBrevoEmail({
			to: [{ email }],
			subject: `You've been invited to join a team on ${SITE_DOMAIN}`,
			htmlContent: html,
			tags: ["team-invitation"],
		})
	}
}
