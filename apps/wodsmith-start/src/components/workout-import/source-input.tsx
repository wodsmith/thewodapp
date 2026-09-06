import { useEffect, useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  WORKOUT_IMPORT_IMAGE_TYPES,
  WORKOUT_IMPORT_MAX_IMAGE_BYTES,
  WORKOUT_IMPORT_MAX_TEXT,
} from "@/lib/workout-import"

export function validateImportImage(file: File): string | null {
  if (!(WORKOUT_IMPORT_IMAGE_TYPES as readonly string[]).includes(file.type))
    return "Choose one PNG, JPEG, or WebP image, or paste the workout text."
  if (file.size > WORKOUT_IMPORT_MAX_IMAGE_BYTES)
    return "This image is larger than 10 MiB. Choose a smaller image or paste the workout text."
  if (file.size === 0) return "This image is empty. Choose another image."
  return null
}

export function WorkoutImportSource({
  text,
  onTextChange,
  file,
  onFileChange,
  sourceUrl,
  disabled,
}: {
  text: string
  onTextChange: (value: string) => void
  file: File | null
  onFileChange: (file: File | null) => void
  sourceUrl?: string
  disabled: boolean
}) {
  const id = useId()
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string>()
  useEffect(() => {
    if (!file) {
      setPreview(undefined)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  const imageUrl = preview ?? sourceUrl
  return (
    <div className="min-w-0 space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${id}-text`}>Workout text or image instructions</Label>
        <Textarea
          id={`${id}-text`}
          rows={6}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          disabled={disabled}
          maxLength={WORKOUT_IMPORT_MAX_TEXT}
          aria-describedby={`${id}-help`}
          placeholder="Paste the workout here. With an image, you can add instructions such as ‘Use the scaled version.’"
        />
        <p id={`${id}-help`} className="text-sm text-muted-foreground">
          Up to 20,000 characters. Import one independently scored workout at a
          time.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-image`}>Workout screenshot</Label>
        <Input
          id={`${id}-image`}
          type="file"
          accept={WORKOUT_IMPORT_IMAGE_TYPES.join(",")}
          disabled={disabled}
          aria-describedby={`${id}-image-help`}
          onChange={(event) => {
            const selected = event.target.files?.[0]
            if (!selected) return
            const issue = validateImportImage(selected)
            setError(issue)
            if (!issue) onFileChange(selected)
            event.target.value = ""
          }}
        />
        <p id={`${id}-image-help`} className="text-sm text-muted-foreground">
          One PNG, JPEG, or WebP, up to 10 MiB. Text and images are sent for AI
          processing.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {imageUrl && (
        <div className="space-y-2">
          <img
            src={imageUrl}
            alt="Workout source for comparison with the draft"
            className="max-h-64 w-full rounded-md border object-contain"
          />
          {file && <p className="break-all text-sm">{file.name}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" asChild>
              <a href={imageUrl} target="_blank" rel="noreferrer">
                View full image
              </a>
            </Button>
            {imageUrl && (
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={() => {
                  onFileChange(null)
                  setError(null)
                }}
              >
                Remove image
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
