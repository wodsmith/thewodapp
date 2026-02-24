import { render } from "@react-email/render"
import { SITE_DOMAIN } from "@/constants"
import {
	getEmailFrom,
	getEmailFromName,
	getEmailReplyTo,
	getResendApiKey,
	getSiteUrl,
	isEmailTestMode,
	isProduction,
} from "@/lib/env"
import { OrganizerRequestApprovedEmail } from "@/react-email/organizer/request-approved"
import { OrganizerRequestRejectedEmail } from "@/react-email/organizer/request-rejected"
import { ResetPasswordEmail } from "@/react-email/reset-password"
import { TeamInviteEmail } from "@/react-email/team-invite"
import { VerifyEmail } from "@/react-email/verify-email"

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

/**
 * Determines if email should actually be sent.
 * Returns true in production or when EMAIL_TEST_MODE is enabled.
 */
function shouldSendEmail(): boolean {
	return isProduction() || isEmailTestMode()
}

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

	if (!shouldSendEmail()) {
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

	const resendApiKey = getResendApiKey()
	if (!resendApiKey) {
		console.error("[Email] RESEND_API_KEY not configured", {
			recipientCount: recipients.length,
			subject,
			emailType,
		})
		return
	}

	// Default email sender config (fallback for development)
	// Uses mail.wodsmith.com subdomain which is verified in Resend
	const emailFrom = getEmailFrom()
	const emailFromName = getEmailFromName()
	const emailReplyTo = getEmailReplyTo()

	try {
		const html = await render(template)

		const response = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${resendApiKey}`,
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
	const siteUrl = getSiteUrl()
	const resetUrl = `${siteUrl}/reset-password?token=${resetToken}`

	// In dev mode, console.warn shows the URL for easy testing
	if (!shouldSendEmail()) {
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
	const siteUrl = getSiteUrl()
	const verificationUrl = `${siteUrl}/verify-email?token=${verificationToken}`

	// In dev mode, console.warn shows the URL for easy testing
	if (!shouldSendEmail()) {
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
	const siteUrl = getSiteUrl()
	const inviteUrl = `${siteUrl}/team-invite?token=${encodeURIComponent(invitationToken)}`

	// In dev mode, console.warn shows the URL for easy testing
	if (!shouldSendEmail()) {
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

/**
 * Sends a competition team invitation email.
 * Used when a captain invites teammates during registration.
 * Uses the unified sendEmail function for consistent logging and error handling.
 */
export async function sendCompetitionTeamInviteEmail({
	email,
	invitationToken,
	teamName,
	competitionName,
	divisionName,
	inviterName,
}: {
	email: string
	invitationToken: string
	teamName: string
	competitionName: string
	divisionName: string
	inviterName: string
}): Promise<void> {
	const siteUrl = getSiteUrl()
	const inviteUrl = `${siteUrl}/compete/invite/${encodeURIComponent(invitationToken)}`

	// In dev mode, console.warn shows the URL for easy testing
	if (!shouldSendEmail()) {
		console.warn("\n\n\nCompetition team invitation url: ", inviteUrl)
	}

	await sendEmail({
		to: email,
		subject: `Join ${teamName} for ${competitionName}`,
		template: TeamInviteEmail({
			inviteLink: inviteUrl,
			recipientEmail: email,
			teamName: `${teamName} (${divisionName})`,
			inviterName,
		}),
		tags: [{ name: "type", value: "competition-team-invitation" }],
	})
}

/**
 * Sends an organizer request approval email.
 * Uses the unified sendEmail function for consistent logging and error handling.
 */
export async function sendOrganizerApprovalEmail({
	email,
	recipientName,
	teamName,
	teamSlug,
	adminNotes,
}: {
	email: string
	recipientName: string
	teamName: string
	teamSlug: string
	adminNotes?: string
}): Promise<void> {
	const siteUrl = getSiteUrl()
	const dashboardUrl = `${siteUrl}/${teamSlug}/compete/organizer`

	// In dev mode, console.warn shows the URL for easy testing
	if (!shouldSendEmail()) {
		console.warn("\n\n\nOrganizer dashboard url: ", dashboardUrl)
	}

	await sendEmail({
		to: email,
		subject: `Your organizer application has been approved - ${SITE_DOMAIN}`,
		template: OrganizerRequestApprovedEmail({
			teamName,
			recipientName,
			dashboardLink: dashboardUrl,
			adminNotes,
		}),
		tags: [{ name: "type", value: "organizer-approval" }],
	})
}

/**
 * Sends an organizer request rejection email.
 * Uses the unified sendEmail function for consistent logging and error handling.
 */
export async function sendOrganizerRejectionEmail({
	email,
	recipientName,
	teamName,
	adminNotes,
}: {
	email: string
	recipientName: string
	teamName: string
	adminNotes?: string
}): Promise<void> {
	const supportEmail = getEmailReplyTo()

	await sendEmail({
		to: email,
		subject: `Update on your organizer application - ${SITE_DOMAIN}`,
		template: OrganizerRequestRejectedEmail({
			teamName,
			recipientName,
			adminNotes,
			supportEmail,
		}),
		tags: [{ name: "type", value: "organizer-rejection" }],
	})
}
