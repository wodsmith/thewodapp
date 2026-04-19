import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { AffiliateCombobox } from "@/components/registration/affiliate-combobox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  updateAthleteUserProfileFn,
  updateRegistrationAffiliateAsOrganizerFn,
} from "@/server-fns/organizer-athlete-fns"
import type { AthleteDetailMember } from "./types"
import { memberDisplayName, memberInitials } from "./types"

interface AthleteProfileCardProps {
  member: AthleteDetailMember
  affiliate: string | null
  registrationId: string
  competitionId: string
  onRemove?: () => void
}

export function AthleteProfileCard({
  member,
  affiliate,
  registrationId,
  competitionId,
  onRemove,
}: AthleteProfileCardProps) {
  const router = useRouter()
  const updateProfile = useServerFn(updateAthleteUserProfileFn)
  const updateAffiliate = useServerFn(updateRegistrationAffiliateAsOrganizerFn)

  const [editing, setEditing] = useState(false)
  const [firstName, setFirstName] = useState(member.firstName ?? "")
  const [lastName, setLastName] = useState(member.lastName ?? "")
  const [email, setEmail] = useState(member.email)
  const [affiliateInput, setAffiliateInput] = useState(affiliate ?? "")
  const [isSaving, setIsSaving] = useState(false)

  // Organizers may only edit name/email while the user is a placeholder
  // (never claimed their account). After claim, the athlete owns those
  // fields — organizer edits on this page must stay scoped to the
  // registration record (team name, affiliate, answers, scores, etc.).
  const canEditProfileFields = member.isPlaceholder

  const handleSave = async () => {
    const profilePayload: {
      registrationId: string
      competitionId: string
      userId: string
      firstName?: string
      lastName?: string
      email?: string
    } = {
      registrationId,
      competitionId,
      userId: member.userId,
    }
    if (canEditProfileFields) {
      if (firstName.trim() && firstName.trim() !== (member.firstName ?? "")) {
        profilePayload.firstName = firstName.trim()
      }
      if (lastName.trim() && lastName.trim() !== (member.lastName ?? "")) {
        profilePayload.lastName = lastName.trim()
      }
      if (email.trim() && email.trim() !== member.email) {
        profilePayload.email = email.trim()
      }
    }

    const profileChanged =
      profilePayload.firstName !== undefined ||
      profilePayload.lastName !== undefined ||
      profilePayload.email !== undefined

    const trimmedAffiliate = affiliateInput.trim()
    const currentAffiliate = affiliate ?? ""
    const affiliateChanged = trimmedAffiliate !== currentAffiliate

    if (!profileChanged && !affiliateChanged) {
      setEditing(false)
      return
    }

    setIsSaving(true)
    try {
      await Promise.all([
        profileChanged
          ? updateProfile({ data: profilePayload })
          : Promise.resolve(),
        affiliateChanged
          ? updateAffiliate({
              data: {
                registrationId,
                competitionId,
                userId: member.userId,
                affiliateName: trimmedAffiliate || null,
              },
            })
          : Promise.resolve(),
      ])
      toast.success("Profile updated")
      setEditing(false)
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile",
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setFirstName(member.firstName ?? "")
    setLastName(member.lastName ?? "")
    setEmail(member.email)
    setAffiliateInput(affiliate ?? "")
    setEditing(false)
  }

  const displayAffiliate = affiliate || "Independent"

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-11 w-11">
              <AvatarImage
                src={member.avatar ?? undefined}
                alt={memberDisplayName(member)}
              />
              <AvatarFallback>{memberInitials(member)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="font-semibold truncate">
                {memberDisplayName(member)}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                {member.isCaptain ? (
                  <Badge variant="secondary" className="text-xs">
                    Captain
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    Teammate
                  </Badge>
                )}
                {!member.isActive && (
                  <Badge variant="destructive" className="text-xs">
                    Inactive
                  </Badge>
                )}
                {member.isPlaceholder && (
                  <Badge variant="outline" className="text-xs">
                    Unclaimed
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {!editing && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEditing(true)}
              aria-label="Edit athlete profile"
              className="h-8 w-8 shrink-0"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {editing ? (
          <>
            {canEditProfileFields ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor={`fn-${member.userId}`}
                      className="text-xs uppercase tracking-wide text-muted-foreground"
                    >
                      First name
                    </Label>
                    <Input
                      id={`fn-${member.userId}`}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      disabled={isSaving}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor={`ln-${member.userId}`}
                      className="text-xs uppercase tracking-wide text-muted-foreground"
                    >
                      Last name
                    </Label>
                    <Input
                      id={`ln-${member.userId}`}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      disabled={isSaving}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor={`em-${member.userId}`}
                    className="text-xs uppercase tracking-wide text-muted-foreground"
                  >
                    Email
                  </Label>
                  <Input
                    id={`em-${member.userId}`}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
              </>
            ) : (
              <div className="grid gap-1.5 text-sm">
                <div className="flex gap-3">
                  <span className="text-muted-foreground w-20 shrink-0">
                    Name
                  </span>
                  <span className="truncate">{memberDisplayName(member)}</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-muted-foreground w-20 shrink-0">
                    Email
                  </span>
                  <span className="truncate">{member.email}</span>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Affiliate
                </Label>
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70">
                  This registration only
                </span>
              </div>
              <AffiliateCombobox
                value={affiliateInput}
                onChange={setAffiliateInput}
                placeholder="Search or enter affiliate..."
                disabled={isSaving}
              />
              <p className="text-[11px] text-muted-foreground">
                Leave empty and save to set as Independent.
              </p>
            </div>
            {canEditProfileFields ? (
              <div className="rounded-md border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/30 px-3 py-2 text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
                <span className="font-semibold">Heads up:</span> this athlete
                hasn't claimed their account yet, so name and email edits are
                allowed. Once they claim, only the athlete can change their
                profile.
              </div>
            ) : (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                Name and email are locked — this athlete has claimed their
                account and owns those fields. Only the affiliate (registration-scoped)
                can be edited here.
              </div>
            )}
            <div className="flex items-center gap-2 pt-1">
              <Button onClick={handleSave} disabled={isSaving} size="sm">
                {isSaving ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="grid gap-1.5">
              <div className="flex gap-3">
                <span className="text-muted-foreground w-20 shrink-0">
                  Email
                </span>
                <span className="truncate">{member.email}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-muted-foreground w-20 shrink-0">
                  Affiliate
                </span>
                <span
                  className={
                    affiliate ? "truncate" : "truncate text-muted-foreground"
                  }
                >
                  {displayAffiliate}
                </span>
              </div>
            </div>
            {onRemove && (
              <div className="flex justify-end pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRemove}
                  className="h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Remove from team
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
