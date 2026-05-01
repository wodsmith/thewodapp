"use client"

import { useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { CohostMembershipMetadata } from "@/db/schemas/cohost"

const PERMISSION_GROUPS = [
  {
    label: "Competition Setup",
    items: [
      { key: "divisions" as const, label: "Divisions" },
      { key: "viewRegistrations" as const, label: "View registrations" },
      { key: "editRegistrations" as const, label: "Manage Registrations" },
      { key: "editEvents" as const, label: "Edit events" },
      { key: "scoringConfig" as const, label: "Scoring config" },
      { key: "waivers" as const, label: "Waivers" },
    ],
  },
  {
    label: "Run Competition",
    items: [
      { key: "schedule" as const, label: "Schedule" },
      { key: "locations" as const, label: "Locations" },
      { key: "volunteers" as const, label: "Volunteers" },
      { key: "results" as const, label: "Results" },
      { key: "leaderboardPreview" as const, label: "Leaderboard preview" },
    ],
  },
  {
    label: "Business",
    items: [
      { key: "pricing" as const, label: "Pricing" },
      { key: "revenue" as const, label: "Revenue" },
      { key: "coupons" as const, label: "Coupons" },
      { key: "sponsors" as const, label: "Sponsors" },
    ],
  },
]

type PermissionKey = keyof Omit<CohostMembershipMetadata, "inviteNotes">

type EditCohostPermissionsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  cohostName: string
  currentPermissions: CohostMembershipMetadata
  organizingTeamId: string
  /** Permission keys to hide (e.g. when team lacks entitlement) */
  hiddenPermissions?: string[]
} & (
  | { mode?: "competition"; membershipId: string; email?: never; groupId?: never }
  | { mode: "series"; email: string; groupId: string; membershipId?: never }
)

export function EditCohostPermissionsDialog(props: EditCohostPermissionsDialogProps) {
  const { open, onOpenChange, cohostName, currentPermissions, organizingTeamId, hiddenPermissions = [] } = props
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [permissions, setPermissions] = useState<Record<PermissionKey, boolean>>(() => ({
    divisions: currentPermissions.divisions,
    editEvents: currentPermissions.editEvents,
    scoringConfig: currentPermissions.scoringConfig,
    viewRegistrations: currentPermissions.viewRegistrations,
    editRegistrations: currentPermissions.editRegistrations,
    waivers: currentPermissions.waivers,
    schedule: currentPermissions.schedule,
    locations: currentPermissions.locations,
    volunteers: currentPermissions.volunteers,
    results: currentPermissions.results,
    leaderboardPreview: currentPermissions.leaderboardPreview,
    pricing: currentPermissions.pricing,
    revenue: currentPermissions.revenue,
    coupons: currentPermissions.coupons,
    sponsors: currentPermissions.sponsors,
  }))

  // Reset permissions when dialog opens with new data
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setPermissions({
        divisions: currentPermissions.divisions,
        editEvents: currentPermissions.editEvents,
        scoringConfig: currentPermissions.scoringConfig,
        viewRegistrations: currentPermissions.viewRegistrations,
        editRegistrations: currentPermissions.editRegistrations,
        waivers: currentPermissions.waivers,
        schedule: currentPermissions.schedule,
        locations: currentPermissions.locations,
        volunteers: currentPermissions.volunteers,
        results: currentPermissions.results,
        leaderboardPreview: currentPermissions.leaderboardPreview,
        pricing: currentPermissions.pricing,
        revenue: currentPermissions.revenue,
        coupons: currentPermissions.coupons,
        sponsors: currentPermissions.sponsors,
      })
    }
    onOpenChange(isOpen)
  }

  const handleSave = async () => {
    setIsSubmitting(true)
    try {
      if (props.mode === "series") {
        const { updateSeriesCohostPermissionsFn } = await import(
          "@/server-fns/series-cohost-fns"
        )
        await updateSeriesCohostPermissionsFn({
          data: {
            email: props.email,
            groupId: props.groupId,
            organizingTeamId,
            permissions,
          },
        })
        toast.success(`Permissions updated for ${cohostName} across all series competitions`)
      } else {
        const { updateCohostPermissionsFn } = await import("@/server-fns/cohost-fns")
        await updateCohostPermissionsFn({
          data: {
            membershipId: props.membershipId,
            organizingTeamId,
            permissions,
          },
        })
        toast.success(`Permissions updated for ${cohostName}`)
      }
      onOpenChange(false)
      router.invalidate()
    } catch {
      toast.error("Failed to update permissions")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Permissions — {cohostName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-4">
          <div>
            <p className="text-sm font-medium leading-none">Permissions</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {props.mode === "series"
                ? "Changes apply to all competitions in this series"
                : "Select what this co-host can access"}
            </p>
          </div>

          {PERMISSION_GROUPS.map((group) => {
            const visibleItems = group.items.filter(
              (item) => !hiddenPermissions.includes(item.key),
            )
            if (visibleItems.length === 0) return null
            return (
              <div key={group.label} className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>

                {visibleItems.map((item) => (
                  <div key={item.key} className="flex flex-row items-start space-x-3 space-y-0">
                    <Checkbox
                      id={`edit-perm-${item.key}`}
                      checked={permissions[item.key]}
                      onCheckedChange={(checked) =>
                        setPermissions((prev) => ({ ...prev, [item.key]: !!checked }))
                      }
                    />
                    <label
                      htmlFor={`edit-perm-${item.key}`}
                      className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {item.label}
                    </label>
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Permissions"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
