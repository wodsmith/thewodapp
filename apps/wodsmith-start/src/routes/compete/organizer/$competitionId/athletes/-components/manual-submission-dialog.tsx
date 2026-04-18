import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createOrganizerVideoSubmissionFn } from "@/server-fns/organizer-athlete-fns"
import { type AthleteDetailMember, memberDisplayName } from "./types"

interface ManualSubmissionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  registrationId: string
  competitionId: string
  trackWorkoutId: string
  members: AthleteDetailMember[]
  teamSize: number
  existingSubmissionIndexes: number[]
}

export function ManualSubmissionDialog({
  open,
  onOpenChange,
  registrationId,
  competitionId,
  trackWorkoutId,
  members,
  teamSize,
  existingSubmissionIndexes,
}: ManualSubmissionDialogProps) {
  const router = useRouter()
  const create = useServerFn(createOrganizerVideoSubmissionFn)

  const activeMembers = members.filter((m) => m.isActive)
  const captain = activeMembers.find((m) => m.isCaptain) ?? activeMembers[0]
  const nextIndex = (() => {
    for (let i = 0; i < Math.max(teamSize, 1); i++) {
      if (!existingSubmissionIndexes.includes(i)) return i
    }
    return existingSubmissionIndexes.length
  })()

  const [userId, setUserId] = useState<string>(captain?.userId ?? "")
  const [videoUrl, setVideoUrl] = useState("")
  const [score, setScore] = useState("")
  const [notes, setNotes] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setUserId(captain?.userId ?? "")
    setVideoUrl("")
    setScore("")
    setNotes("")
    setError(null)
  }

  const handleSubmit = async () => {
    setError(null)
    if (!userId) {
      setError("Select which member this submission is for")
      return
    }
    if (!videoUrl.trim()) {
      setError("Video URL is required")
      return
    }
    try {
      // basic URL sanity check
      new URL(videoUrl.trim())
    } catch {
      setError("Enter a valid video URL (including https://)")
      return
    }
    setIsSaving(true)
    try {
      await create({
        data: {
          registrationId,
          competitionId,
          trackWorkoutId,
          userId,
          videoUrl: videoUrl.trim(),
          videoIndex: nextIndex,
          notes: notes.trim() || undefined,
          score: score.trim() || undefined,
          scoreStatus: score.trim() ? "scored" : undefined,
        },
      })
      toast.success("Submission added")
      reset()
      onOpenChange(false)
      router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add submission")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add submission manually</DialogTitle>
          <DialogDescription>
            Create a video submission on the athlete's behalf. Video slot{" "}
            {nextIndex + 1} of {teamSize}. Scoring only applies to the captain
            slot (video 1).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {teamSize > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="manual-member">Member</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger id="manual-member">
                  <SelectValue placeholder="Select member" />
                </SelectTrigger>
                <SelectContent>
                  {activeMembers.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {memberDisplayName(m)}
                      {m.isCaptain && " (Captain)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="manual-url">Video URL</Label>
            <Input
              id="manual-url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://youtube.com/..."
              disabled={isSaving}
            />
          </div>
          {nextIndex === 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="manual-score">Score (optional)</Label>
              <Input
                id="manual-score"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="e.g. 4:32 or 180 reps"
                disabled={isSaving}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to enter the score later from the event card.
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="manual-notes">Notes (optional)</Label>
            <Textarea
              id="manual-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSaving}
              rows={2}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? "Saving..." : "Create submission"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
