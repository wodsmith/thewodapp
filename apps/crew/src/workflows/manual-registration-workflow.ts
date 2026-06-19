/**
 * Manual Registration Workflow
 *
 * Cloudflare Workflow that sends confirmation emails for manual registrations
 * created by organizers, with waiver info and placeholder user guidance.
 *
 * Steps:
 * 1. send-confirmation-email: Email notification with waiver/placeholder info (retries independently)
 *
 * In local dev (where Workflows aren't available), the server function
 * calls processManualRegistrationInline() which runs the same logic synchronously.
 */

import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers"
import { WorkflowEntrypoint } from "cloudflare:workers"
import * as Sentry from "@sentry/cloudflare"
import { and, count, eq } from "drizzle-orm"
import { getDb } from "@/db"
import { waiverSignaturesTable, waiversTable } from "@/db/schema"
import { logInfo, logWarning } from "@/lib/logging/posthog-otel-logger"
import { getSentryOptions } from "@/lib/sentry/server"
import { sendRegistrationConfirmationEmail } from "@/server/registration"

export interface ManualRegistrationNotifyParams {
  userId: string
  registrationId: string
  competitionId: string
  isPaid: boolean
  amountPaidCents?: number
  isPlaceholderUser: boolean
  claimToken?: string
}

// =========================================================================
// Standalone processing functions (used by both Workflow and inline fallback)
// =========================================================================

async function sendConfirmationEmail(
  params: ManualRegistrationNotifyParams,
): Promise<void> {
  const db = getDb()

  // Query pending waiver count
  const totalWaivers = await db
    .select({ count: count() })
    .from(waiversTable)
    .where(
      and(
        eq(waiversTable.competitionId, params.competitionId),
        eq(waiversTable.required, true),
      ),
    )

  const signedWaivers = await db
    .select({ count: count() })
    .from(waiverSignaturesTable)
    .innerJoin(
      waiversTable,
      eq(waiverSignaturesTable.waiverId, waiversTable.id),
    )
    .where(
      and(
        eq(waiversTable.competitionId, params.competitionId),
        eq(waiversTable.required, true),
        eq(waiverSignaturesTable.userId, params.userId),
      ),
    )

  const totalCount = Number(totalWaivers[0]?.count ?? 0)
  const signedCount = Number(signedWaivers[0]?.count ?? 0)
  const pendingWaiverCount = Math.max(0, totalCount - signedCount)

  // sendRegistrationConfirmationEmail throws on error (enables workflow retry)
  await sendRegistrationConfirmationEmail({
    userId: params.userId,
    registrationId: params.registrationId,
    competitionId: params.competitionId,
    isPaid: params.isPaid,
    amountPaidCents: params.amountPaidCents,
    pendingWaiverCount,
    isPlaceholderUser: params.isPlaceholderUser,
    claimToken: params.claimToken,
  })
}

// =========================================================================
// Cloudflare Workflow class (production — durable execution with retries)
// =========================================================================

// @lat: [[registration#Manual Registration Workflow]]
class ManualRegistrationWorkflowBase extends WorkflowEntrypoint<
  Env,
  ManualRegistrationNotifyParams
> {
  async run(
    event: WorkflowEvent<ManualRegistrationNotifyParams>,
    step: WorkflowStep,
  ) {
    const params = event.payload

    try {
      await step.do(
        "send-confirmation-email",
        {
          retries: {
            limit: 3,
            delay: "2 seconds",
            backoff: "exponential",
          },
        },
        async () => {
          await sendConfirmationEmail(params)
        },
      )
    } catch (emailErr) {
      logWarning({
        message: "[Workflow] Manual registration email failed after retries",
        error: emailErr,
        attributes: {
          registrationId: params.registrationId,
          competitionId: params.competitionId,
          userId: params.userId,
        },
      })
    }
  }
}

export const ManualRegistrationWorkflow = Sentry.instrumentWorkflowWithSentry(
  (env: Env) => getSentryOptions(env),
  ManualRegistrationWorkflowBase,
)

// =========================================================================
// Inline processing (local dev fallback — no durable execution)
// =========================================================================

/**
 * Process manual registration notification synchronously without Cloudflare Workflows.
 * Used in local dev where the MANUAL_REGISTRATION_WORKFLOW binding isn't available.
 */
export async function processManualRegistrationInline(
  params: ManualRegistrationNotifyParams,
): Promise<void> {
  try {
    await sendConfirmationEmail(params)
    logInfo({
      message: "[Inline ManualRegistration] Confirmation email sent",
      attributes: {
        registrationId: params.registrationId,
        competitionId: params.competitionId,
        userId: params.userId,
      },
    })
  } catch (err) {
    logWarning({
      message: "[Inline ManualRegistration] Email notification failed",
      error: err,
      attributes: {
        registrationId: params.registrationId,
        competitionId: params.competitionId,
        userId: params.userId,
      },
    })
  }
}
