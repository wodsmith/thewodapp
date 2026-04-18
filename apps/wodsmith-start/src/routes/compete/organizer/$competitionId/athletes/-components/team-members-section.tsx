import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Mail, RefreshCcw, Trash2, UserPlus, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  cancelPendingTeamInviteFn,
  removeTeammateFromRegistrationFn,
  resendTeamInviteAsOrganizerFn,
} from "@/server-fns/organizer-athlete-fns"
import { AddTeammateDialog } from "./add-teammate-dialog"
import {
  type AthleteDetailMember,
  type AthleteDetailPendingInvite,
  memberDisplayName,
  memberInitials,
} from "./types"

interface TeamMembersSectionProps {
  registrationId: string
  competitionId: string
  captainUserId: string
  teamSize: number
  members: AthleteDetailMember[]
  pendingInvites: AthleteDetailPendingInvite[]
  formatDate: (d: Date | string | null | undefined) => string
}

export function TeamMembersSection({
  registrationId,
  competitionId,
  captainUserId,
  teamSize,
  members,
  pendingInvites,
  formatDate,
}: TeamMembersSectionProps) {
  const router = useRouter()
  const removeTeammate = useServerFn(removeTeammateFromRegistrationFn)
  const cancelInvite = useServerFn(cancelPendingTeamInviteFn)
  const refreshInvite = useServerFn(resendTeamInviteAsOrganizerFn)

  const [removeTarget, setRemoveTarget] = useState<AthleteDetailMember | null>(
    null,
  )
  const [isRemoving, setIsRemoving] = useState(false)
  const [pendingInviteActions, setPendingInviteActions] = useState<
    Record<string, boolean>
  >({})
  const [showAddDialog, setShowAddDialog] = useState(false)

  const activeMembers = members.filter((m) => m.isActive)
  const currentCount = activeMembers.length + pendingInvites.length
  const canAddMore = currentCount < teamSize

  const handleRemove = async () => {
    if (!removeTarget) return
    setIsRemoving(true)
    try {
      await removeTeammate({
        data: {
          registrationId,
          competitionId,
          userId: removeTarget.userId,
        },
      })
      toast.success("Teammate removed")
      setRemoveTarget(null)
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove teammate",
      )
    } finally {
      setIsRemoving(false)
    }
  }

  const handleCancelInvite = async (invitationId: string) => {
    setPendingInviteActions((s) => ({ ...s, [invitationId]: true }))
    try {
      await cancelInvite({
        data: { invitationId, competitionId, registrationId },
      })
      toast.success("Invite cancelled")
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel invite",
      )
    } finally {
      setPendingInviteActions((s) => ({ ...s, [invitationId]: false }))
    }
  }

  const handleResendInvite = async (invitationId: string) => {
    setPendingInviteActions((s) => ({ ...s, [invitationId]: true }))
    try {
      await refreshInvite({
        data: { invitationId, registrationId, competitionId },
      })
      toast.success("Invite resent")
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to resend invite",
      )
    } finally {
      setPendingInviteActions((s) => ({ ...s, [invitationId]: false }))
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>
                Team Members ({currentCount} / {teamSize})
              </CardTitle>
              <CardDescription>
                Active members on the roster plus any outstanding invitations.
              </CardDescription>
            </div>
            {canAddMore && (
              <Button
                size="sm"
                onClick={() => setShowAddDialog(true)}
                className="shrink-0"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Teammate
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Active members */}
          {activeMembers.length === 0 && pendingInvites.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground border border-dashed rounded-md">
              No active members or invitations.
            </div>
          ) : (
            <ul className="divide-y border rounded-md">
              {activeMembers.map((m) => (
                <li
                  key={m.userId}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-9 w-9">
                      <AvatarImage
                        src={m.avatar ?? undefined}
                        alt={memberDisplayName(m)}
                      />
                      <AvatarFallback className="text-xs">
                        {memberInitials(m)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-medium truncate flex items-center gap-2">
                        {memberDisplayName(m)}
                        {m.isCaptain && (
                          <Badge variant="secondary" className="text-xs">
                            Captain
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {m.email}
                        {m.joinedAt && (
                          <span className="ml-2">
                            joined {formatDate(m.joinedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {!m.isCaptain && m.userId !== captainUserId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRemoveTarget(m)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      Remove
                    </Button>
                  )}
                </li>
              ))}

              {pendingInvites.map((invite) => {
                const busy = !!pendingInviteActions[invite.id]
                const isAccepted = invite.status === "accepted"
                return (
                  <li
                    key={invite.id}
                    className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">
                          {invite.guestName || invite.email}
                        </span>
                        {isAccepted ? (
                          <Badge
                            variant="outline"
                            className="text-xs bg-green-50 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                          >
                            Accepted — awaiting sign-up
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-xs bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
                          >
                            Invite pending
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                        {invite.guestName && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {invite.email}
                          </span>
                        )}
                        <span>sent {formatDate(invite.createdAt)}</span>
                        {invite.expiresAt && (
                          <span>expires {formatDate(invite.expiresAt)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResendInvite(invite.id)}
                        disabled={busy}
                      >
                        <RefreshCcw className="h-3.5 w-3.5 mr-1.5" />
                        Resend
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelInvite(invite.id)}
                        disabled={busy}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-3.5 w-3.5 mr-1.5" />
                        Cancel
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove teammate</AlertDialogTitle>
            <AlertDialogDescription>
              Remove{" "}
              <strong>
                {removeTarget ? memberDisplayName(removeTarget) : ""}
              </strong>{" "}
              from this team? Their user account remains intact — they just
              won't be part of this registration anymore.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={isRemoving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemoving ? "Removing..." : "Remove teammate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddTeammateDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        registrationId={registrationId}
        competitionId={competitionId}
        existingEmails={[
          ...activeMembers.map((m) => m.email.toLowerCase()),
          ...pendingInvites.map((p) => p.email.toLowerCase()),
        ]}
      />
    </>
  )
}
