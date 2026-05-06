import { useServerFn } from "@tanstack/react-start"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { WaiverViewer } from "@/components/compete/waiver-viewer"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import type { Waiver } from "@/db/schemas/waivers"
import {
  signWaiverAtCheckInFn,
  type CheckInTeammate,
} from "@/server-fns/check-in-fns"

interface CheckInWaiverDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  competitionId: string
  registrationId: string
  athlete: CheckInTeammate
  waiver: Waiver
  onSigned: (signedAt: string) => void
}

/**
 * Modal where the athlete (handed the iPad by the volunteer) reviews and
 * accepts a waiver. The signature is recorded under the athlete's userId,
 * not the volunteer's.
 */
export function CheckInWaiverDialog({
  open,
  onOpenChange,
  competitionId,
  registrationId,
  athlete,
  waiver,
  onSigned,
}: CheckInWaiverDialogProps) {
  const sign = useServerFn(signWaiverAtCheckInFn)
  const [agreed, setAgreed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const athleteName =
    `${athlete.firstName ?? ""} ${athlete.lastName ?? ""}`.trim() ||
    athlete.email ||
    "this athlete"

  const handleAccept = async () => {
    setIsSubmitting(true)
    try {
      const result = await sign({
        data: {
          competitionId,
          registrationId,
          athleteUserId: athlete.userId,
          waiverId: waiver.id,
        },
      })
      toast.success(`${athleteName} signed ${waiver.title}`)
      onSigned(result.signedAt)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sign waiver")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{waiver.title}</DialogTitle>
          <DialogDescription>
            Hand the iPad to <strong>{athleteName}</strong> to review and sign.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto rounded border bg-muted/10 p-4">
          <WaiverViewer
            content={waiver.content}
            className="prose prose-sm max-w-none dark:prose-invert"
          />
        </div>

        <div className="flex items-start gap-3 rounded-lg bg-muted/20 p-4">
          <Checkbox
            id="checkin-waiver-agree"
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(checked === true)}
            className="mt-0.5"
          />
          <Label
            htmlFor="checkin-waiver-agree"
            className="cursor-pointer text-sm font-medium leading-snug"
          >
            I, {athleteName}, have read and agree to this waiver.
          </Label>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleAccept} disabled={!agreed || isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing…
              </>
            ) : (
              "Accept & Sign"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
