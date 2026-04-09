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
import { transferTeammateFn } from "@/server-fns/teammate-transfer-fns"

interface TransferTeammateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  registrationId: string
  targetId: string
  type: "member" | "invitation"
  currentIdentifier: string // name for members, email for invitations
}

export function TransferTeammateDialog({
  open,
  onOpenChange,
  registrationId,
  targetId,
  type,
  currentIdentifier,
}: TransferTeammateDialogProps) {
  const router = useRouter()
  const transferTeammate = useServerFn(transferTeammateFn)
  const [newEmail, setNewEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setNewEmail("")
    }
    onOpenChange(nextOpen)
  }

  const handleSubmit = async () => {
    if (!newEmail) return
    setIsSubmitting(true)
    try {
      await transferTeammate({
        data: {
          registrationId,
          type,
          targetId,
          newEmail,
        },
      })
      toast.success("Teammate transferred. An invitation has been sent to the new email.")
      handleClose(false)
      router.invalidate()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to transfer teammate")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer Teammate</DialogTitle>
          <DialogDescription>
            Replace <strong className="text-foreground">{currentIdentifier}</strong> with
            a different person. They will receive an invitation to join the team.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="new-teammate-email">New Teammate Email</Label>
            <Input
              id="new-teammate-email"
              type="email"
              placeholder="email@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            The current teammate will be removed and a new invitation will be sent to the provided email.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!newEmail || isSubmitting}>
            {isSubmitting ? "Transferring..." : "Transfer Teammate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
