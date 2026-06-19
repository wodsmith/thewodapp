import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  Check,
  Mail,
  Pencil,
  Plus,
  RefreshCcw,
  UserPlus,
  X,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { AffiliateCombobox } from "@/components/registration/affiliate-combobox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  cancelPendingTeamInviteFn,
  resendTeamInviteAsOrganizerFn,
  updatePendingInviteAffiliateAsOrganizerFn,
} from "@/server-fns/organizer-athlete-fns"
import type { AthleteDetailPendingInvite } from "./types"

interface InviteSlotProps {
  variant: "invite"
  invite: AthleteDetailPendingInvite
  registrationId: string
  competitionId: string
  formatDate: (d: Date | string | null | undefined) => string
}

interface EmptySlotProps {
  variant: "empty"
  onAdd: () => void
  disabled?: boolean
}

type RosterSlotCardProps = InviteSlotProps | EmptySlotProps

export function RosterSlotCard(props: RosterSlotCardProps) {
  if (props.variant === "invite") return <InviteSlot {...props} />
  return <EmptySlot {...props} />
}

function InviteSlot({
  invite,
  registrationId,
  competitionId,
  formatDate,
}: InviteSlotProps) {
  const router = useRouter()
  const cancelInvite = useServerFn(cancelPendingTeamInviteFn)
  const refreshInvite = useServerFn(resendTeamInviteAsOrganizerFn)
  const updateAffiliate = useServerFn(updatePendingInviteAffiliateAsOrganizerFn)
  const [busy, setBusy] = useState(false)
  const [editingAffiliate, setEditingAffiliate] = useState(false)
  const [affiliateInput, setAffiliateInput] = useState(
    invite.affiliateName ?? "",
  )
  const [savingAffiliate, setSavingAffiliate] = useState(false)

  const isAccepted = invite.status === "accepted"
  const initial = (
    invite.guestName?.[0] ??
    invite.email[0] ??
    "?"
  ).toUpperCase()

  const handleCancel = async () => {
    setBusy(true)
    try {
      await cancelInvite({
        data: { invitationId: invite.id, competitionId, registrationId },
      })
      toast.success("Invite cancelled")
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel invite",
      )
    } finally {
      setBusy(false)
    }
  }

  const handleResend = async () => {
    setBusy(true)
    try {
      await refreshInvite({
        data: { invitationId: invite.id, registrationId, competitionId },
      })
      toast.success("Invite resent")
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to resend invite",
      )
    } finally {
      setBusy(false)
    }
  }

  const handleSaveAffiliate = async () => {
    const trimmed = affiliateInput.trim()
    if (trimmed === (invite.affiliateName ?? "")) {
      setEditingAffiliate(false)
      return
    }
    setSavingAffiliate(true)
    try {
      await updateAffiliate({
        data: {
          invitationId: invite.id,
          registrationId,
          competitionId,
          affiliateName: trimmed || null,
        },
      })
      toast.success("Affiliate saved — applies when teammate completes sign-up")
      setEditingAffiliate(false)
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save affiliate",
      )
    } finally {
      setSavingAffiliate(false)
    }
  }

  const displayAffiliate = invite.affiliateName || "Independent"

  return (
    <Card className="border-dashed bg-muted/20">
      <CardContent className="p-6 flex flex-col gap-4 h-full">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-11 w-11 shrink-0 rounded-full border-2 border-dashed border-border flex items-center justify-center bg-background text-sm font-semibold text-muted-foreground">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate text-foreground/90">
              {invite.guestName || invite.email}
            </div>
            <div className="mt-1">
              {isAccepted ? (
                <Badge
                  variant="outline"
                  className="text-xs bg-green-50 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                  title="They filled out the registration form. Now they need to create an account before joining the team."
                >
                  Awaiting sign-up
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-xs bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
                  title="Invitation email has been sent — waiting for the teammate to open the link."
                >
                  Awaiting response
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          {invite.guestName && (
            <div className="flex gap-3">
              <span className="text-muted-foreground w-20 shrink-0">Email</span>
              <span className="truncate flex items-center gap-1.5">
                <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                {invite.email}
              </span>
            </div>
          )}
          <div className="flex gap-3">
            <span className="text-muted-foreground w-20 shrink-0">Sent</span>
            <span className="text-muted-foreground">
              {formatDate(invite.createdAt)}
            </span>
          </div>
          {invite.expiresAt && (
            <div className="flex gap-3">
              <span className="text-muted-foreground w-20 shrink-0">
                Expires
              </span>
              <span className="text-muted-foreground">
                {formatDate(invite.expiresAt)}
              </span>
            </div>
          )}
          <div className="flex items-start gap-3">
            <span className="text-muted-foreground w-20 shrink-0 pt-1">
              Affiliate
            </span>
            <div className="min-w-0 flex-1">
              {editingAffiliate ? (
                <div className="space-y-2">
                  <AffiliateCombobox
                    value={affiliateInput}
                    onChange={setAffiliateInput}
                    placeholder="Search or enter affiliate..."
                    disabled={savingAffiliate}
                  />
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      onClick={handleSaveAffiliate}
                      disabled={savingAffiliate}
                      className="h-7"
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      {savingAffiliate ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setAffiliateInput(invite.affiliateName ?? "")
                        setEditingAffiliate(false)
                      }}
                      disabled={savingAffiliate}
                      className="h-7"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingAffiliate(true)}
                  className="group inline-flex items-center gap-1.5 text-left -ml-1 px-1 rounded hover:bg-muted/60"
                >
                  <span
                    className={
                      invite.affiliateName ? "" : "text-muted-foreground italic"
                    }
                  >
                    {displayAffiliate}
                  </span>
                  <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mt-auto pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResend}
            disabled={busy}
            className="h-8"
          >
            <RefreshCcw className="h-3.5 w-3.5 mr-1.5" />
            Resend
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={busy}
            className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <X className="h-3.5 w-3.5 mr-1.5" />
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptySlot({ onAdd, disabled }: EmptySlotProps) {
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={disabled}
      className="group relative flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/10 p-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-muted/10"
    >
      <div className="h-11 w-11 rounded-full border-2 border-dashed border-border flex items-center justify-center bg-background text-muted-foreground group-hover:border-primary/50 group-hover:text-primary transition-colors">
        <Plus className="h-5 w-5" />
      </div>
      <div className="space-y-0.5">
        <div className="text-sm font-medium text-foreground/90">Open slot</div>
        <div className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
          <UserPlus className="h-3 w-3" />
          Add teammate
        </div>
      </div>
    </button>
  )
}
