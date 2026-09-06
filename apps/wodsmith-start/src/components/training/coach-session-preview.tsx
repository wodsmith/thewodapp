import type { TrainingBlockKind, TrainingContent } from "@/lib/training/types"

export const coachBlockLabels: Record<TrainingBlockKind, string> = {
  check: "Optional check-off",
  load: "Load",
  time: "Finish time",
  reps: "Total reps",
  note: "Coaching note",
}

const scoreLabels: Record<TrainingBlockKind, string> = {
  check: "Mark complete · optional",
  load: "Log load · athlete chooses lb or kg",
  time: "Log time · minutes and seconds",
  reps: "Log total reps",
  note: "No result required",
}

export function CoachSessionPreview({
  content,
  gymName,
  trackName,
  dateLabel,
  timezone,
}: {
  content: TrainingContent
  gymName: string
  trackName: string
  dateLabel: string
  timezone: string
}) {
  return (
    <aside
      className="min-w-0 border-t border-border bg-muted/20 p-5 lg:border-l lg:border-t-0 lg:p-6"
      aria-label="Athlete preview"
    >
      <h3 className="text-lg font-semibold">Athlete preview</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Draft preview. Athletes keep seeing the last published version until you
        publish these changes.
      </p>
      <div className="mt-6 border-t border-border pt-5">
        <p className="text-sm font-medium">
          {gymName} · {trackName}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {dateLabel} · {timezone}
        </p>
        <h4 className="mt-5 break-words text-2xl font-semibold tracking-tight">
          {content.title || "Untitled session"}
        </h4>
        {content.coachNote && (
          <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {content.coachNote}
          </p>
        )}
        {content.isRestDay ? (
          <div className="mt-6 border-t border-border py-5">
            <p className="font-medium">Planned rest day</p>
            <p className="mt-2 text-sm text-muted-foreground">
              No result required. Rest is part of your programming.
            </p>
          </div>
        ) : content.blocks.length ? (
          <div className="mt-5 divide-y divide-border border-t border-border">
            {content.blocks.map((block) => (
              <section key={block.id} className="py-5">
                <p className="text-xs text-muted-foreground">
                  {coachBlockLabels[block.kind]}
                </p>
                <h5 className="mt-1 break-words text-lg font-semibold">
                  {block.title || "Untitled section"}
                </h5>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm">
                  {block.prescription || "Add a prescription."}
                </p>
                {block.scalingGuidance && (
                  <details className="mt-3 text-sm">
                    <summary className="min-h-11 cursor-pointer content-center rounded-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      Scaling options
                    </summary>
                    <p className="whitespace-pre-wrap break-words pb-3 text-muted-foreground">
                      {block.scalingGuidance}
                    </p>
                  </details>
                )}
                {block.coachGuidance && (
                  <details className="mt-1 text-sm">
                    <summary className="min-h-11 cursor-pointer content-center rounded-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      Coach’s guidance
                    </summary>
                    <p className="whitespace-pre-wrap break-words pb-3 text-muted-foreground">
                      {block.coachGuidance}
                    </p>
                  </details>
                )}
                <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">
                  {scoreLabels[block.kind]}
                </p>
              </section>
            ))}
          </div>
        ) : (
          <p className="mt-6 border-t border-border pt-5 text-sm text-muted-foreground">
            Add a section to build this training day.
          </p>
        )}
      </div>
    </aside>
  )
}
