import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers"
import * as Sentry from "@sentry/cloudflare"
import { z } from "zod"
import { getDb } from "@/db"
import {
  CrossFitSourceError,
  fetchCrossFitSource,
  sourceDateSchema,
} from "@/lib/crossfit/source"
import { getSentryOptions } from "@/lib/sentry/server"
import { convertCrossFitSource } from "@/server/crossfit-converter"
import {
  beginCrossFitImport,
  failCrossFitImport,
  getCrossFitImport,
  publishCrossFitImport,
  snapshotCrossFitImport,
} from "@/server/crossfit-import"

export const crossFitImportParamsSchema = z.object({
  sourceDate: sourceDateSchema,
  mode: z.enum(["dry-run", "publish"]),
})
export type CrossFitImportParams = z.infer<typeof crossFitImportParamsSchema>

// @lat: [[crossfit-import#CrossFit Daily Import#Durable Execution]]
export class CrossFitDailyImportWorkflowBase extends WorkflowEntrypoint<
  Env,
  CrossFitImportParams
> {
  async run(event: WorkflowEvent<CrossFitImportParams>, step: WorkflowStep) {
    const params = crossFitImportParamsSchema.parse(event.payload)
    const publish = params.mode === "publish"
    if (publish) {
      const previous = await step.do("initialize", async () => {
        const entry = await beginCrossFitImport(
          getDb(),
          params.sourceDate,
          event.instanceId,
        )
        return entry ? { id: entry.id, status: entry.status } : null
      })
      if (previous?.status === "published")
        return { status: "already-published", id: previous.id }
    }
    let phase = "fetch"
    try {
      const deadline = event.timestamp.getTime() + 2 * 60 * 60 * 1000
      let source: Awaited<ReturnType<typeof fetchCrossFitSource>> | undefined
      for (let attempt = 0; attempt < 9; attempt++) {
        const fetched = await step.do(
          `fetch-${attempt}`,
          {
            retries: { limit: 0, delay: "1 second", backoff: "constant" },
            timeout: "45 seconds",
          },
          async () => {
            try {
              return {
                ok: true as const,
                source: await fetchCrossFitSource(params.sourceDate),
              }
            } catch (error) {
              return {
                ok: false as const,
                message:
                  error instanceof Error
                    ? error.message
                    : "CrossFit fetch failed",
                retryable:
                  !(error instanceof CrossFitSourceError) || error.retryable,
                retryAfterSeconds:
                  error instanceof CrossFitSourceError
                    ? error.retryAfterSeconds
                    : 0,
                attemptedAt: Date.now(),
              }
            }
          },
        )
        if (fetched.ok) {
          source = fetched.source
          break
        }
        const delay = Math.max(15 * 60, fetched.retryAfterSeconds)
        if (
          !fetched.retryable ||
          attempt === 8 ||
          fetched.attemptedAt + delay * 1000 > deadline
        )
          throw new Error(fetched.message)
        await step.sleep(`wait-for-source-${attempt}`, delay * 1000)
      }
      if (!source) throw new Error("CrossFit source unavailable")
      const snapshot = source
      if (publish)
        await step.do("snapshot", () =>
          snapshotCrossFitImport(getDb(), snapshot),
        )
      phase = "conversion"
      const conversion = await step.do(
        "convert",
        {
          retries: { limit: 1, delay: "30 seconds", backoff: "constant" },
          timeout: "90 seconds",
        },
        () => convertCrossFitSource(snapshot, this.env),
      )
      if (!publish)
        return {
          status: "dry-run",
          date: params.sourceDate,
          source: snapshot,
          ...conversion,
        }
      phase = "publication"
      const result = await step.do("publish", () =>
        publishCrossFitImport(
          getDb(),
          snapshot,
          conversion.normalized,
          conversion.model,
        ),
      )
      console.info(
        JSON.stringify({
          action: "crossfit.import",
          status: "published",
          date: params.sourceDate,
          workflowId: event.instanceId,
          tokens: conversion.tokens,
          model: conversion.model,
          ...result,
        }),
      )
      return { status: "published", ...result }
    } catch (error) {
      if (publish)
        await step.do("record-failure", () =>
          failCrossFitImport(
            getDb(),
            params.sourceDate,
            phase === "conversion" ? "needs_review" : "failed",
            error instanceof Error ? error.message : "Import failed",
          ),
        )
      console.error(
        JSON.stringify({
          action: "crossfit.import",
          status: "failed",
          date: params.sourceDate,
          phase,
          workflowId: event.instanceId,
        }),
      )
      throw error
    }
  }
}

export const CrossFitDailyImportWorkflow = Sentry.instrumentWorkflowWithSentry(
  (env: Env) => getSentryOptions(env),
  CrossFitDailyImportWorkflowBase,
)

export async function checkCrossFitImportHealth(date: string) {
  const entry = await getCrossFitImport(getDb(), date)
  if (entry?.status !== "published")
    throw new Error(
      `CrossFit import for ${date} has not published (${entry?.status ?? "missing"})`,
    )
}
