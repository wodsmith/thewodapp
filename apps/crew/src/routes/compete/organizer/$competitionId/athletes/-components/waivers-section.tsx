import { Check, Clock, UserCheck } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  type AthleteDetailMember,
  type AthleteDetailPendingInvite,
  type AthleteDetailWaiver,
  type AthleteDetailWaiverSignature,
  memberDisplayName,
  memberInitials,
} from "./types"

interface WaiversSectionProps {
  waivers: AthleteDetailWaiver[]
  waiverSignatures: AthleteDetailWaiverSignature[]
  members: AthleteDetailMember[]
  pendingInvites: AthleteDetailPendingInvite[]
  isTeamDivision: boolean
  formatDate: (d: Date | string | null | undefined) => string
}

function inviteInitial(invite: AthleteDetailPendingInvite): string {
  return (invite.guestName?.[0] ?? invite.email[0] ?? "?").toUpperCase()
}

function inviteDisplayName(invite: AthleteDetailPendingInvite): string {
  return invite.guestName?.trim() || invite.email
}

export function WaiversSection({
  waivers,
  waiverSignatures,
  members,
  pendingInvites,
  isTeamDivision,
  formatDate,
}: WaiversSectionProps) {
  const activeMembers = members.filter((m) => m.isActive)

  const signedAt = (userId: string, waiverId: string): Date | null => {
    const s = waiverSignatures.find(
      (x) => x.userId === userId && x.waiverId === waiverId,
    )
    return s?.signedAt ?? null
  }

  const pendingSignatureFor = (
    invite: AthleteDetailPendingInvite,
    waiverId: string,
  ) => invite.pendingSignatures?.find((s) => s.waiverId === waiverId) ?? null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Waivers</CardTitle>
        <CardDescription>
          Signature status per person — including pre-signed waivers from
          pending teammates who haven't completed sign-up yet. Read-only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {waivers.map((waiver) => {
          const memberSigned = activeMembers.filter((m) =>
            signedAt(m.userId, waiver.id),
          ).length
          const inviteSigned = isTeamDivision
            ? pendingInvites.filter((inv) =>
                pendingSignatureFor(inv, waiver.id),
              ).length
            : 0
          const total =
            activeMembers.length + (isTeamDivision ? pendingInvites.length : 0)
          const signed = memberSigned + inviteSigned
          const allSigned = total > 0 && signed === total

          return (
            <div key={waiver.id} className="space-y-3">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <div className="font-semibold">{waiver.title}</div>
                  {waiver.required && (
                    <Badge variant="outline" className="text-[10px]">
                      Required
                    </Badge>
                  )}
                </div>
                {total > 0 && (
                  <span
                    className={
                      "font-mono text-[10px] uppercase tracking-[0.22em] tabular-nums shrink-0 " +
                      (allSigned
                        ? "text-green-600 dark:text-green-400"
                        : "text-muted-foreground")
                    }
                  >
                    {signed}/{total} signed
                  </span>
                )}
              </div>

              <ul className="divide-y rounded-md border">
                {activeMembers.map((m) => {
                  const date = signedAt(m.userId, waiver.id)
                  return (
                    <li
                      key={`${waiver.id}-m-${m.userId}`}
                      className="flex items-center gap-3 p-3"
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage
                          src={m.avatar ?? undefined}
                          alt={memberDisplayName(m)}
                        />
                        <AvatarFallback className="text-[11px] font-semibold">
                          {memberInitials(m)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">
                            {memberDisplayName(m)}
                          </span>
                          <Badge
                            variant={m.isCaptain ? "secondary" : "outline"}
                            className="text-[10px] uppercase tracking-wide"
                          >
                            {m.isCaptain ? "Captain" : "Teammate"}
                          </Badge>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {date ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
                            <Check className="h-3.5 w-3.5" />
                            Signed {formatDate(date)}
                          </span>
                        ) : (
                          <span className="text-xs italic text-muted-foreground">
                            Not signed
                          </span>
                        )}
                      </div>
                    </li>
                  )
                })}

                {isTeamDivision &&
                  pendingInvites.map((invite) => {
                    const presigned = pendingSignatureFor(invite, waiver.id)
                    const hasSubmitted =
                      invite.status === "accepted" || !!invite.submittedAt
                    return (
                      <li
                        key={`${waiver.id}-i-${invite.id}`}
                        className="flex items-center gap-3 p-3 bg-muted/20"
                      >
                        <div className="h-8 w-8 shrink-0 rounded-full border border-dashed border-muted-foreground/40 bg-background flex items-center justify-center text-[11px] font-semibold text-muted-foreground">
                          {inviteInitial(invite)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground/90 truncate">
                              {inviteDisplayName(invite)}
                            </span>
                            {hasSubmitted ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] uppercase tracking-wide bg-green-50 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                              >
                                <UserCheck className="h-2.5 w-2.5 mr-1" />
                                Awaiting sign-up
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[10px] uppercase tracking-wide bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
                              >
                                <Clock className="h-2.5 w-2.5 mr-1" />
                                Awaiting response
                              </Badge>
                            )}
                          </div>
                          {presigned?.signatureName && (
                            <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                              Signed as{" "}
                              <span className="italic text-foreground/80">
                                {presigned.signatureName}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          {presigned ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
                              <Check className="h-3.5 w-3.5" />
                              Pre-signed {formatDate(presigned.signedAt)}
                            </span>
                          ) : hasSubmitted ? (
                            <span className="text-xs italic text-muted-foreground">
                              Not signed
                            </span>
                          ) : (
                            <span className="text-xs italic text-muted-foreground/70">
                              No response yet
                            </span>
                          )}
                        </div>
                      </li>
                    )
                  })}
              </ul>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
