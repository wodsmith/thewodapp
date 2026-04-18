import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Check, Pencil, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { updateRegistrationTeamNameFn } from "@/server-fns/organizer-athlete-fns"
import type {
  AthleteDetailCommercePurchase,
  AthleteDetailDivision,
  AthleteDetailRegistration,
} from "./types"

interface RegistrationInfoCardProps {
  registration: AthleteDetailRegistration
  division: AthleteDetailDivision | null
  competitionId: string
  isTeamDivision: boolean
  commercePurchase: AthleteDetailCommercePurchase | null
  formatDate: (d: Date | string | null | undefined) => string
  onChangeDivisionClick: () => void
}

export function RegistrationInfoCard({
  registration,
  division,
  competitionId,
  isTeamDivision,
  commercePurchase,
  formatDate,
  onChangeDivisionClick,
}: RegistrationInfoCardProps) {
  const router = useRouter()
  const updateTeamName = useServerFn(updateRegistrationTeamNameFn)

  const [editingTeamName, setEditingTeamName] = useState(false)
  const [teamNameInput, setTeamNameInput] = useState(
    registration.teamName ?? "",
  )
  const [isSavingTeamName, setIsSavingTeamName] = useState(false)

  const handleSaveTeamName = async () => {
    const trimmed = teamNameInput.trim()
    if (!trimmed) {
      toast.error("Team name cannot be empty")
      return
    }
    setIsSavingTeamName(true)
    try {
      await updateTeamName({
        data: {
          registrationId: registration.id,
          competitionId,
          teamName: trimmed,
        },
      })
      toast.success("Team name updated")
      setEditingTeamName(false)
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update team name",
      )
    } finally {
      setIsSavingTeamName(false)
    }
  }

  const paidAmount =
    commercePurchase?.totalCents != null
      ? `$${(commercePurchase.totalCents / 100).toFixed(2)}`
      : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registration Details</CardTitle>
        <CardDescription>
          High-level information about this registration.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2">
        {isTeamDivision && (
          <div className="space-y-1.5 sm:col-span-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Team Name
            </div>
            {editingTeamName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={teamNameInput}
                  onChange={(e) => setTeamNameInput(e.target.value)}
                  disabled={isSavingTeamName}
                  autoFocus
                  className="max-w-sm"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleSaveTeamName}
                  disabled={isSavingTeamName}
                  aria-label="Save team name"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setEditingTeamName(false)
                    setTeamNameInput(registration.teamName ?? "")
                  }}
                  disabled={isSavingTeamName}
                  aria-label="Cancel team name edit"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-base font-medium">
                  {registration.teamName || (
                    <span className="text-muted-foreground italic font-normal">
                      Unnamed Team
                    </span>
                  )}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setEditingTeamName(true)}
                  aria-label="Edit team name"
                  className="h-7 w-7"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Division
          </div>
          <div className="flex items-center gap-2">
            {division ? (
              <Badge variant="outline" className="text-sm">
                {division.label}
              </Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={onChangeDivisionClick}
              className="h-7 px-2 text-xs"
            >
              Change
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Registered
          </div>
          <div className="text-sm">{formatDate(registration.registeredAt)}</div>
        </div>

        <div className="space-y-1.5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Payment Status
          </div>
          <div className="flex items-center gap-2 text-sm">
            {registration.paymentStatus ? (
              <Badge
                variant={
                  registration.paymentStatus === "paid"
                    ? "outline"
                    : "secondary"
                }
                className={
                  registration.paymentStatus === "paid"
                    ? "bg-green-50 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                    : ""
                }
              >
                {registration.paymentStatus}
              </Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
            {paidAmount && (
              <span className="text-muted-foreground">{paidAmount}</span>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Registration Status
          </div>
          <Badge
            variant={
              registration.status === "removed" ? "destructive" : "outline"
            }
            className={
              registration.status === "active"
                ? "bg-green-50 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                : ""
            }
          >
            {registration.status}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
