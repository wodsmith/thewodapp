import "server-only"

import { render } from "@react-email/render"
import { SITE_DOMAIN, SITE_URL } from "@/constants"
import { logError, logInfo } from "@/lib/logging/posthog-otel-logger"
import { ResetPasswordEmail } from "@/react-email/reset-password"
import { TeamInviteEmail } from "@/react-email/team-invite"
import { VerifyEmail } from "@/react-email/verify-email"
import isProd from "./is-prod"

/**
 * Mask email for logging - redacts PII while preserving debuggability
 * e.g., "user@example.com" -> "u***@e***.com"
 */
function maskEmail(email: string): string {
	const [local, domain] = email.split("@")
	if (!domain) return "***@***"
	const [domainName, ...tld] = domain.split(".")
	const maskedLocal = local ? `${local[0]}***` : "***"
	const maskedDomain = domainName ? `${domainName[0]}***` : "***"
	return `${maskedLocal}@${maskedDomain}.${tld.join(".") || "***"}`
}

/**
 * Mask multiple emails for logging
 */
function maskEmails(emails: string[]): string[] {
	return emails.map(maskEmail)
}

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
}: ResendEmailOptions): Promise<boolean> {
	const emailType = tags?.find((t) => t.name === "type")?.value ?? "unknown"

	if (!isProd) {
		logInfo({
			message: "Email send skipped (test mode)",
			attributes: {
				provider: "resend",
				emailType,
				recipientCount: to.length,
				subject,
			},
		})
		return true
	}

	if (!process.env.RESEND_API_KEY) {
		logError({
			message: "Email send failed: RESEND_API_KEY not configured",
			attributes: {
				provider: "resend",
				emailType,
				recipientCount: to.length,
				maskedRecipients: maskEmails(to),
				subject,
			},
		})
		return false
	}

	const replyTo = originalReplyTo ?? process.env.EMAIL_REPLY_TO

	try {
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
			logError({
				message: "Email send failed via Resend",
				attributes: {
					provider: "resend",
					emailType,
					recipientCount: to.length,
					maskedRecipients: maskEmails(to),
					subject,
					statusCode: response.status,
					errorResponse: JSON.stringify(error),
				},
			})
			return false
		}

		logInfo({
			message: "Email sent successfully",
			attributes: {
				provider: "resend",
				emailType,
				recipientCount: to.length,
				maskedRecipients: maskEmails(to),
				subject,
			},
		})
		return true
	} catch (error) {
		logError({
			message: "Email send failed via Resend",
			attributes: {
				provider: "resend",
				emailType,
				recipientCount: to.length,
				maskedRecipients: maskEmails(to),
				subject,
			},
			error,
		})
		return false
	}
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
}: BrevoEmailOptions): Promise<boolean> {
	const emailType = tags?.[0] ?? "unknown"
	const emails = to.map((r) => r.email)

	if (!isProd) {
		logInfo({
			message: "Email send skipped (test mode)",
			attributes: {
				provider: "brevo",
				emailType,
				recipientCount: to.length,
				subject,
			},
		})
		return true
	}

	if (!process.env.BREVO_API_KEY) {
		logError({
			message: "Email send failed: BREVO_API_KEY not configured",
			attributes: {
				provider: "brevo",
				emailType,
				recipientCount: to.length,
				maskedRecipients: maskEmails(emails),
				subject,
			},
		})
		return false
	}

	const replyTo = originalReplyTo ?? process.env.EMAIL_REPLY_TO

	try {
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
			logError({
				message: "Email send failed via Brevo",
				attributes: {
					provider: "brevo",
					emailType,
					recipientCount: to.length,
					maskedRecipients: maskEmails(emails),
					subject,
					statusCode: response.status,
					errorResponse: JSON.stringify(error),
				},
			})
			return false
		}

		logInfo({
			message: "Email sent successfully",
			attributes: {
				provider: "brevo",
				emailType,
				recipientCount: to.length,
				maskedRecipients: maskEmails(emails),
				subject,
			},
		})
		return true
	} catch (error) {
		logError({
			message: "Email send failed via Brevo",
			attributes: {
				provider: "brevo",
				emailType,
				recipientCount: to.length,
				maskedRecipients: maskEmails(emails),
				subject,
			},
			error,
		})
		return false
	}
}

/**
 * Send password reset email to user
 */
export async function sendPasswordResetEmail({
	email,
	resetToken,
	username,
}: {
	email: string
	resetToken: string
	username: string
}): Promise<boolean> {
	const resetUrl = `${SITE_URL}/reset-password?token=${resetToken}`

	if (!isProd) {
		console.warn("\n\n\nPassword reset url: ", resetUrl)
		logInfo({
			message: "Password reset email skipped (test mode)",
			attributes: {
				emailType: "password-reset",
				maskedRecipient: maskEmail(email),
			},
		})
		return true
	}

	const html = await render(
		ResetPasswordEmail({ resetLink: resetUrl, username }),
	)
	const provider = await getEmailProvider()

	if (!provider) {
		logError({
			message: "Email send failed: No email provider configured",
			attributes: {
				emailType: "password-reset",
				maskedRecipient: maskEmail(email),
			},
		})
		return false
	}

	if (provider === "resend") {
		return sendResendEmail({
			to: [email],
			subject: `Reset your password for ${SITE_DOMAIN}`,
			html,
			tags: [{ name: "type", value: "password-reset" }],
		})
	}
	return sendBrevoEmail({
		to: [{ email, name: username }],
		subject: `Reset your password for ${SITE_DOMAIN}`,
		htmlContent: html,
		tags: ["password-reset"],
	})
}

/**
 * Send email verification email to user
 */
export async function sendVerificationEmail({
	email,
	verificationToken,
	username,
}: {
	email: string
	verificationToken: string
	username: string
}): Promise<boolean> {
	const verificationUrl = `${SITE_URL}/verify-email?token=${verificationToken}`

	if (!isProd) {
		console.warn("\n\n\nVerification url: ", verificationUrl)
		logInfo({
			message: "Verification email skipped (test mode)",
			attributes: {
				emailType: "email-verification",
				maskedRecipient: maskEmail(email),
			},
		})
		return true
	}

	const html = await render(
		VerifyEmail({ verificationLink: verificationUrl, username }),
	)
	const provider = await getEmailProvider()

	if (!provider) {
		logError({
			message: "Email send failed: No email provider configured",
			attributes: {
				emailType: "email-verification",
				maskedRecipient: maskEmail(email),
			},
		})
		return false
	}

	if (provider === "resend") {
		return sendResendEmail({
			to: [email],
			subject: `Verify your email for ${SITE_DOMAIN}`,
			html,
			tags: [{ name: "type", value: "email-verification" }],
		})
	}
	return sendBrevoEmail({
		to: [{ email, name: username }],
		subject: `Verify your email for ${SITE_DOMAIN}`,
		htmlContent: html,
		tags: ["email-verification"],
	})
}

/**
 * Send team invitation email to user
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
}): Promise<boolean> {
	const inviteUrl = `${SITE_URL}/team-invite?token=${invitationToken}`

	if (!isProd) {
		console.warn("\n\n\nTeam invitation url: ", inviteUrl)
		logInfo({
			message: "Team invitation email skipped (test mode)",
			attributes: {
				emailType: "team-invitation",
				maskedRecipient: maskEmail(email),
				teamName,
			},
		})
		return true
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

	if (!provider) {
		logError({
			message: "Email send failed: No email provider configured",
			attributes: {
				emailType: "team-invitation",
				maskedRecipient: maskEmail(email),
				teamName,
			},
		})
		return false
	}

	if (provider === "resend") {
		return sendResendEmail({
			to: [email],
			subject: `You've been invited to join a team on ${SITE_DOMAIN}`,
			html,
			tags: [{ name: "type", value: "team-invitation" }],
		})
	}
	return sendBrevoEmail({
		to: [{ email }],
		subject: `You've been invited to join a team on ${SITE_DOMAIN}`,
		htmlContent: html,
		tags: ["team-invitation"],
	})
}
