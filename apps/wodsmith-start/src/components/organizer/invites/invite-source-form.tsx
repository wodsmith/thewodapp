"use client"

/**
 * Invite Source Form — create / edit a single source.
 *
 * Three kinds:
 *   - "competition": single-comp source. Requires sourceCompetitionId
 *     and globalSpots ("top N qualifies per division").
 *   - "series": series grouping. Requires sourceGroupId. No globalSpots
 *     — per-division override on the source-detail page is the only
 *     knob, so each division gets an explicit absolute total or
 *     contributes nothing.
 *   - "series_global": series-aggregate leaderboard. Requires
 *     sourceGroupId and globalSpots ("top N from the series global
 *     leaderboard per division"). Modeled distinct from "series" so
 *     each tier is its own bucket.
 *
 * The form-level validator mirrors the server-side helper: exactly one
 * of sourceCompetitionId / sourceGroupId, matched against `kind`.
 */

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  COMPETITION_INVITE_SOURCE_KIND,
  type CompetitionInviteSource,
} from "@/db/schemas/competition-invites"

export const inviteSourceFormSchema = z
  .object({
    kind: z.enum([
      COMPETITION_INVITE_SOURCE_KIND.COMPETITION,
      COMPETITION_INVITE_SOURCE_KIND.SERIES,
      COMPETITION_INVITE_SOURCE_KIND.SERIES_GLOBAL,
    ]),
    sourceCompetitionId: z.string().optional(),
    sourceGroupId: z.string().optional(),
    globalSpots: z.number().int().positive().optional(),
    notes: z.string().max(2000).optional(),
  })
  .superRefine((val, ctx) => {
    const hasComp = !!val.sourceCompetitionId
    const hasGroup = !!val.sourceGroupId
    if (hasComp === hasGroup) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pick exactly one source — a competition or a series",
        path: ["sourceCompetitionId"],
      })
    }
    if (val.kind === "competition" && !hasComp) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Single-competition source needs a competition",
        path: ["sourceCompetitionId"],
      })
    }
    if ((val.kind === "series" || val.kind === "series_global") && !hasGroup) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Series source needs a series",
        path: ["sourceGroupId"],
      })
    }
    // globalSpots required for "competition" and "series_global"; not
    // collected for "series" (per-division override is the only knob).
    if (val.kind !== "series" && !val.globalSpots) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Set the top-N qualifying spots per division",
        path: ["globalSpots"],
      })
    }
  })

export type InviteSourceFormValues = {
  kind: "competition" | "series" | "series_global"
  sourceCompetitionId?: string
  sourceGroupId?: string
  globalSpots?: number
  notes?: string
}

interface InviteSourceFormProps {
  defaultValues?: Partial<CompetitionInviteSource>
  competitionOptions: Array<{ id: string; name: string }>
  seriesOptions: Array<{ id: string; name: string }>
  onSubmit: (values: InviteSourceFormValues) => Promise<void> | void
  onCancel?: () => void
  submitLabel?: string
}

export function InviteSourceForm({
  defaultValues,
  competitionOptions,
  seriesOptions,
  onSubmit,
  onCancel,
  submitLabel = "Save source",
}: InviteSourceFormProps) {
  const form = useForm<InviteSourceFormValues, unknown, InviteSourceFormValues>({
    resolver: standardSchemaResolver(inviteSourceFormSchema),
    defaultValues: {
      kind:
        (defaultValues?.kind as InviteSourceFormValues["kind"]) ?? "competition",
      sourceCompetitionId: defaultValues?.sourceCompetitionId ?? undefined,
      sourceGroupId: defaultValues?.sourceGroupId ?? undefined,
      globalSpots: defaultValues?.globalSpots ?? undefined,
      notes: defaultValues?.notes ?? undefined,
    },
  })
  const kind = form.watch("kind")

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(async (v) => {
          await onSubmit(v)
        })}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="kind"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Source kind</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="competition">Single competition</SelectItem>
                  <SelectItem value="series">Series</SelectItem>
                  <SelectItem value="series_global">
                    Series global leaderboard
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {kind === "competition" ? (
          <FormField
            control={form.control}
            name="sourceCompetitionId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Source competition</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value ?? undefined}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a competition" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {competitionOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <FormField
            control={form.control}
            name="sourceGroupId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Series</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value ?? undefined}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a series" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {seriesOptions.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {kind !== "series" ? (
        <FormField
          control={form.control}
          name="globalSpots"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {kind === "series_global"
                  ? "Top N from the series global leaderboard per division"
                  : "Top N qualifies per division"}
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? undefined : Number(e.target.value),
                    )
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        ) : null}

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          {onCancel ? (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  )
}
