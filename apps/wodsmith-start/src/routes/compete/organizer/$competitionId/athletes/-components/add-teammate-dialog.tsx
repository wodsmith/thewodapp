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
import { addTeammateToRegistrationFn } from "@/server-fns/organizer-athlete-fns"

interface AddTeammateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  registrationId: string
  competitionId: string
  existingEmails: string[]
}

export function AddTeammateDialog({
  open,
  onOpenChange,
  registrationId,
  competitionId,
  existingEmails,
}: AddTeammateDialogProps) {
  const router = useRouter()
  const addTeammate = useServerFn(addTeammateToRegistrationFn)

  const [email, setEmail] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setEmail("")
    setFirstName("")
    setLastName("")
    setError(null)
  }

  const handleSubmit = async () => {
    setError(null)
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      setError("Email is required")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address")
      return
    }
    if (existingEmails.includes(trimmed)) {
      setError("That email is already a member or invited")
      return
    }
    setIsSaving(true)
    try {
      await addTeammate({
        data: {
          registrationId,
          competitionId,
          email: trimmed,
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
        },
      })
      toast.success("Teammate invited")
      reset()
      onOpenChange(false)
      router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite teammate")
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
          <DialogTitle>Add Teammate</DialogTitle>
          <DialogDescription>
            Sends an invitation email. The teammate completes registration —
            questions, waivers — themselves.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="teammate-email">Email</Label>
            <Input
              id="teammate-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              disabled={isSaving}
              autoFocus
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="teammate-first">First name (optional)</Label>
              <Input
                id="teammate-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="teammate-last">Last name (optional)</Label>
              <Input
                id="teammate-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={isSaving}
              />
            </div>
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
            {isSaving ? "Inviting..." : "Send Invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
