import { createServerFn } from "@tanstack/react-start"
import { desc, eq } from "drizzle-orm"
import { z } from "zod"
import { env, getDb } from "@/db"
import { externalWorkoutImportsTable } from "@/db/schema"
import { CROSSFIT_TRACK_ID, sourceDateSchema } from "@/lib/crossfit/source"
import { getPublishedCrossFitDays } from "@/server/crossfit-import"
import { requireAdmin } from "@/utils/auth"

export const getCrossFitTrackDaysFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ trackId: z.string() }))
  .handler(({ data }) => getPublishedCrossFitDays(getDb(), data.trackId))

export const getCrossFitImportsFn = createServerFn({ method: "GET" }).handler(
  async () => {
    await requireAdmin()
    const rows = await getDb()
      .select()
      .from(externalWorkoutImportsTable)
      .where(eq(externalWorkoutImportsTable.trackId, CROSSFIT_TRACK_ID))
      .orderBy(desc(externalWorkoutImportsTable.sourceDate))
      .limit(60)
    return rows.map(({ normalized, ...row }) => ({
      ...row,
      normalizedJson: JSON.stringify(normalized),
    }))
  },
)

export const getCrossFitRunStatusFn = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({ id: z.string().regex(/^crossfit-[a-z0-9-]{10,100}$/) }),
  )
  .handler(async ({ data }) => {
    await requireAdmin()
    const instance = await env.CROSSFIT_DAILY_IMPORT_WORKFLOW.get(data.id)
    const result = await instance.status()
    return {
      status: result.status,
      output: JSON.stringify(result.output ?? null),
      error: result.error?.message ?? null,
    }
  })

export const runCrossFitImportFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      sourceDate: sourceDateSchema,
      mode: z.enum(["dry-run", "publish"]),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin()
    const instance = await env.CROSSFIT_DAILY_IMPORT_WORKFLOW.create({
      id: `crossfit-${data.sourceDate}-${crypto.randomUUID()}`,
      params: data,
    })
    return { id: instance.id }
  })
