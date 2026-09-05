import { useId } from "react"
import { Input } from "@/components/ui/input"

export interface RoundCapValue {
  status: "scored" | "cap"
  secondaryScore: string
}

/** CAP is a performance fact, independent of the entered finishing time. */
export function RoundCapFields({
  roundNumber,
  value,
  onChange,
  onBlur,
  disabled,
}: {
  roundNumber: number
  value: RoundCapValue
  onChange: (value: RoundCapValue) => void
  onBlur?: () => void
  disabled?: boolean
}) {
  const repsId = useId()
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          onBlur={onBlur}
          checked={value.status === "cap"}
          disabled={disabled}
          aria-label={`Round ${roundNumber} capped`}
          onChange={(event) =>
            onChange({
              status: event.target.checked ? "cap" : "scored",
              secondaryScore: event.target.checked ? value.secondaryScore : "",
            })
          }
        />
        Capped
      </label>
      {value.status === "cap" && (
        <label htmlFor={repsId} className="flex items-center gap-2 text-sm">
          Reps completed
          <Input
            id={repsId}
            onBlur={onBlur}
            type="number"
            min="0"
            step="1"
            className="w-24"
            disabled={disabled}
            aria-label={`Round ${roundNumber} reps completed`}
            value={value.secondaryScore}
            onChange={(event) =>
              onChange({ ...value, secondaryScore: event.target.value })
            }
          />
        </label>
      )}
    </div>
  )
}
