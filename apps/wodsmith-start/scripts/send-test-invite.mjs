// One-off: create a competition_invites row + dispatch the email via Resend.
// Mirrors issueInvitesFn → broadcast-queue-consumer in a single pass so we
// can verify the send pipeline against a real inbox without spinning the
// queue. Run with: pnpm tsx scripts/send-test-invite.mjs (or `node`).

import { webcrypto } from "node:crypto"
import mysql from "mysql2/promise"

const TARGET_EMAIL = process.env.TARGET_EMAIL ?? "zac@wodsmith.com"
const TARGET_FIRST = "Zac"
const TARGET_LAST = "Jones"

const CHAMPIONSHIP_ID = "comp_inv_championship"
const CHAMPIONSHIP_SLUG = "2026-wodsmith-invitational"
const CHAMPIONSHIP_NAME = "2026 WODsmith Invitational"
const DIVISION_ID = "slvl_inv_champ_mrx"
const DIVISION_LABEL = "Men's RX"
const ORGANIZER_NAME = "WODsmith Test"

const APP_URL = process.env.APP_URL ?? "http://localhost:3000"
const RESEND_API_KEY = process.env.RESEND_API_KEY
const EMAIL_FROM = process.env.EMAIL_FROM ?? "team@mail.wodsmith.com"
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME ?? "WODsmith"

if (!RESEND_API_KEY) {
	console.error("Missing RESEND_API_KEY in env. Aborting.")
	process.exit(1)
}

// ---------------------------------------------------------------------------
// Token (matches src/lib/competition-invites/tokens.ts)
// ---------------------------------------------------------------------------
function base64urlNoPadding(bytes) {
	return Buffer.from(bytes).toString("base64url")
}

function generateToken() {
	const bytes = new Uint8Array(32)
	webcrypto.getRandomValues(bytes)
	return base64urlNoPadding(bytes)
}

// ---------------------------------------------------------------------------
// ULID-ish id (the codebase uses ULIDs; we just need a unique varchar)
// ---------------------------------------------------------------------------
function makeInviteId() {
	const ts = Date.now().toString(36).toUpperCase()
	const rnd = Buffer.from(webcrypto.getRandomValues(new Uint8Array(10)))
		.toString("hex")
		.toUpperCase()
	return `cinv_test_${ts}${rnd}`.slice(0, 60)
}

// ---------------------------------------------------------------------------
// Email (minimal HTML mirror of CompetitionInviteEmail)
// ---------------------------------------------------------------------------
function renderEmail({ claimUrl, declineUrl, athleteName }) {
	const subject = `You're invited to ${CHAMPIONSHIP_NAME}`
	const html = `<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e5e5;">
    <p style="color:#666;font-size:13px;margin:0 0 16px;">From <strong>${ORGANIZER_NAME}</strong> · ${CHAMPIONSHIP_NAME}</p>
    <h1 style="font-size:22px;margin:0 0 16px;color:#111;">${subject}</h1>
    <p style="color:#333;line-height:1.5;">Hi ${athleteName},</p>
    <p style="color:#333;line-height:1.5;">You've earned a spot at ${CHAMPIONSHIP_NAME}. This invitation is locked to your email — only you can claim it. Continue below to confirm your spot and complete registration.</p>
    <div style="background:#fafafa;border:1px solid #eee;border-radius:6px;padding:16px;margin:24px 0;">
      <p style="margin:0 0 4px;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Division</p>
      <p style="margin:0 0 12px;color:#111;font-weight:600;">${DIVISION_LABEL}</p>
      <p style="margin:0 0 4px;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Source</p>
      <p style="margin:0;color:#111;">Phase 2C send-pipeline test invite</p>
    </div>
    <div style="text-align:center;margin:32px 0;">
      <a href="${claimUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">Claim your spot</a>
    </div>
    <p style="color:#666;font-size:13px;text-align:center;margin:0;">Can't make it? <a href="${declineUrl}" style="color:#666;">Decline this invite</a></p>
  </div>
</body></html>`
	return { subject, html }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const db = await mysql.createConnection({
	host: "127.0.0.1",
	port: 3306,
	user: "root",
	database: "wodsmith-db",
	multipleStatements: false,
})

try {
	// Sanity check the championship + division exist.
	const [comp] = await db.query(
		"SELECT id, slug, name FROM competitions WHERE id = ? LIMIT 1",
		[CHAMPIONSHIP_ID],
	)
	if (!comp.length) throw new Error(`No championship ${CHAMPIONSHIP_ID}`)
	const [div] = await db.query(
		"SELECT id, label FROM scaling_levels WHERE id = ? LIMIT 1",
		[DIVISION_ID],
	)
	if (!div.length) throw new Error(`Scaling level ${DIVISION_ID} not found`)

	// If an active invite already exists for this email+division, revoke it
	// so the unique-active-invite index doesn't reject the insert.
	await db.query(
		`UPDATE competition_invites
		 SET status='revoked', revoked_at=NOW(), active_marker=NULL,
		     claim_token=NULL, updated_at=NOW()
		 WHERE championship_competition_id = ?
		   AND email = ?
		   AND championship_division_id = ?
		   AND active_marker = 'active'`,
		[CHAMPIONSHIP_ID, TARGET_EMAIL.toLowerCase(), DIVISION_ID],
	)

	const token = generateToken()
	const inviteId = makeInviteId()
	const claimUrl = `${APP_URL}/compete/${CHAMPIONSHIP_SLUG}/claim/${token}`
	const declineUrl = `${claimUrl}/decline`

	await db.query(
		`INSERT INTO competition_invites (
			created_at, updated_at, id,
			championship_competition_id, round_id, origin,
			source_id, source_competition_id, source_placement, source_placement_label,
			bespoke_reason, championship_division_id, email, user_id,
			invitee_first_name, invitee_last_name,
			claim_token, expires_at,
			send_attempt, status, email_delivery_status, active_marker
		) VALUES (
			NOW(), NOW(), ?,
			?, '', 'bespoke',
			NULL, NULL, NULL, 'Phase 2C send-pipeline test',
			'Phase 2C smoke test', ?, ?, NULL,
			?, ?,
			?, DATE_ADD(NOW(), INTERVAL 14 DAY),
			1, 'pending', 'queued', 'active'
		)`,
		[
			inviteId,
			CHAMPIONSHIP_ID,
			DIVISION_ID,
			TARGET_EMAIL.toLowerCase(),
			TARGET_FIRST,
			TARGET_LAST,
			token,
		],
	)

	console.log(`Inserted invite ${inviteId} (last4=${token.slice(-4)})`)

	const { subject, html } = renderEmail({
		claimUrl,
		declineUrl,
		athleteName: TARGET_FIRST,
	})

	const resendRes = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${RESEND_API_KEY}`,
			"Idempotency-Key": `invite-${inviteId}-1`,
		},
		body: JSON.stringify({
			from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
			to: TARGET_EMAIL,
			subject,
			html,
		}),
	})

	const resendBody = await resendRes.text()
	if (!resendRes.ok) {
		await db.query(
			`UPDATE competition_invites
			 SET email_delivery_status='failed', email_last_error=?, updated_at=NOW()
			 WHERE id = ?`,
			[resendBody.slice(0, 1000), inviteId],
		)
		throw new Error(`Resend ${resendRes.status}: ${resendBody}`)
	}

	await db.query(
		`UPDATE competition_invites
		 SET email_delivery_status='sent', updated_at=NOW()
		 WHERE id = ?`,
		[inviteId],
	)

	const parsed = JSON.parse(resendBody)
	console.log(`Resend ok. message_id=${parsed.id ?? "?"}`)
	console.log(`Claim URL: ${claimUrl}`)
} finally {
	await db.end()
}
