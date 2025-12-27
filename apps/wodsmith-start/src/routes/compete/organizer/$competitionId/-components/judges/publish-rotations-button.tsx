'use client'

import {Send} from 'lucide-react'
import {useState} from 'react'
import {toast} from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {Button} from '@/components/ui/button'
import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import type {CoverageStats} from '@/lib/judge-rotation-utils'
import {publishRotationsFn} from '@/server-fns/judge-assignment-fns'
import {useSession} from '@/utils/auth-client'

interface PublishRotationsButtonProps {
  teamId: string
  trackWorkoutId: string
  rotationsCount: number
  coverage: CoverageStats
  hasActiveVersion: boolean
  nextVersionNumber: number
  onPublishSuccess?: () => void
  disabled?: boolean
}

/**
 * Button with confirmation dialog for publishing judge rotations.
 * Shows coverage summary and allows optional version notes.
 */
export function PublishRotationsButton({
  teamId,
  trackWorkoutId,
  rotationsCount,
  coverage,
  hasActiveVersion,
  nextVersionNumber,
  onPublishSuccess,
  disabled = false,
}: PublishRotationsButtonProps) {
  const [notes, setNotes] = useState('')
  const [open, setOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const session = useSession()

  const handlePublish = async () => {
    if (!session?.user?.id) {
      toast.error('You must be logged in to publish rotations')
      return
    }

    setIsPending(true)
    try {
      const result = await publishRotationsFn({
        data: {
          teamId,
          trackWorkoutId,
          publishedBy: session.user.id,
          notes: notes.trim() || undefined,
        },
      })

      if (result) {
        toast.success(`Version ${result.version} created successfully`)
        setOpen(false)
        setNotes('')
        onPublishSuccess?.()
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to publish rotations',
      )
    } finally {
      setIsPending(false)
    }
  }

  const isPerfect =
    coverage.coveragePercent === 100 && coverage.gaps.length === 0
  const hasGaps = coverage.gaps.length > 0

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button disabled={disabled || rotationsCount === 0}>
          <Send className="mr-2 h-4 w-4" />
          Publish Rotations
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {hasActiveVersion ? 'Publish New Version' : 'Publish Rotations'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {hasActiveVersion
              ? `This will create version ${nextVersionNumber} of the judge assignments.`
              : 'This will create the first version of judge assignments for this event.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* Coverage Summary */}
          <div className="space-y-2 rounded-lg border p-4">
            <h4 className="text-sm font-medium">Coverage Summary</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Rotations:</span>
                <span className="ml-2 font-medium tabular-nums">
                  {rotationsCount}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Coverage:</span>
                <span
                  className={`ml-2 font-medium tabular-nums ${
                    isPerfect
                      ? 'text-green-600'
                      : hasGaps
                        ? 'text-orange-600'
                        : 'text-blue-600'
                  }`}
                >
                  {coverage.coveragePercent}%
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Slots covered:</span>
                <span className="ml-2 font-medium tabular-nums">
                  {coverage.coveredSlots}/{coverage.totalSlots}
                </span>
              </div>
              {hasGaps && (
                <div>
                  <span className="text-muted-foreground">Gaps:</span>
                  <span className="ml-2 font-medium tabular-nums text-orange-600">
                    {coverage.gaps.length}
                  </span>
                </div>
              )}
              {coverage.overlaps.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Overlaps:</span>
                  <span className="ml-2 font-medium tabular-nums text-orange-600">
                    {coverage.overlaps.length}
                  </span>
                </div>
              )}
            </div>
            {hasGaps && (
              <p className="mt-2 text-xs text-orange-600">
                Warning: Not all slots have judge coverage
              </p>
            )}
          </div>

          {/* Optional Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Version Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="e.g., Updated rotation for final heat changes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handlePublish} disabled={isPending}>
            {isPending ? 'Publishing...' : 'Publish'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
