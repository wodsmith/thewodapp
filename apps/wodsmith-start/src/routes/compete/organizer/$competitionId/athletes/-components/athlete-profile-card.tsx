import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Pencil } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateAthleteUserProfileFn } from "@/server-fns/organizer-athlete-fns"
import type { AthleteDetailMember } from "./types"
import { memberDisplayName, memberInitials } from "./types"

interface AthleteProfileCardProps {
  member: AthleteDetailMember
  affiliateName: string | null
  registrationId: string
  competitionId: string
}

export function AthleteProfileCard({
  member,
  affiliateName,
  registrationId,
  competitionId,
}: AthleteProfileCardProps) {
  const router = useRouter()
  const updateProfile = useServerFn(updateAthleteUserProfileFn)

  const [editing, setEditing] = useState(false)
  const [firstName, setFirstName] = useState(member.firstName ?? "")
  const [lastName, setLastName] = useState(member.lastName ?? "")
  const [email, setEmail] = useState(member.email)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    const payload: {
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
    if (firstName.trim() && firstName.trim() !== (member.firstName ?? "")) {
      payload.firstName = firstName.trim()
    }
    if (lastName.trim() && lastName.trim() !== (member.lastName ?? "")) {
      payload.lastName = lastName.trim()
    }
    if (email.trim() && email.trim() !== member.email) {
      payload.email = email.trim()
    }

    if (
      payload.firstName === undefined &&
      payload.lastName === undefined &&
      payload.email === undefined
    ) {
      setEditing(false)
      return
    }

    setIsSaving(true)
    try {
      await updateProfile({ data: payload })
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
    setEditing(false)
  }

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
            <div className="text-xs text-muted-foreground">
              Editing the name or email updates this user's account profile
              everywhere — not just in this competition.
            </div>
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
          <div className="grid gap-1.5 text-sm">
            <div className="flex gap-3">
              <span className="text-muted-foreground w-20 shrink-0">Email</span>
              <span className="truncate">{member.email}</span>
            </div>
            {affiliateName && (
              <div className="flex gap-3">
                <span className="text-muted-foreground w-20 shrink-0">
                  Affiliate
                </span>
                <span className="truncate text-muted-foreground">
                  {affiliateName}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
