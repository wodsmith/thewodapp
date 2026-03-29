import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { Copy, Pencil, Trash2, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown } from "lucide-react"
import { FEATURES } from "@/config/features"
import type { CohostMembershipMetadata } from "@/db/schemas/cohost"
import { getCohostsFn } from "@/server-fns/cohost-fns"
import { checkTeamHasFeatureFn } from "@/server-fns/entitlements"
import { EditCohostPermissionsDialog } from "./-components/edit-cohost-permissions-dialog"
import { InviteCohostDialog } from "./-components/invite-cohost-dialog"

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/co-hosts",
)({
  staleTime: 10_000,
  loader: async ({ parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    if (!competition.competitionTeamId) {
      throw new Error("Competition team not found")
    }

    const competitionTeamId = competition.competitionTeamId

    const [cohostsResult, hasCouponsEntitlement] = await Promise.all([
      getCohostsFn({
        data: {
          competitionTeamId,
          organizingTeamId: competition.organizingTeamId,
        },
      }),
      checkTeamHasFeatureFn({
        data: {
          teamId: competition.organizingTeamId,
          featureKey: FEATURES.PRODUCT_COUPONS,
        },
      }).catch(() => false),
    ])

    return {
      competition,
      competitionTeamId,
      cohosts: cohostsResult.memberships,
      pendingCohostInvitations: cohostsResult.pendingInvitations,
      hasCouponsEntitlement,
    }
  },
  component: CoHostsPage,
})

function CoHostsPage() {
  const {
    competition,
    competitionTeamId,
    cohosts,
    pendingCohostInvitations,
    hasCouponsEntitlement,
  } = Route.useLoaderData()

  const [inviteOpen, setInviteOpen] = useState(false)
  const [editingCohost, setEditingCohost] = useState<{
    id: string
    name: string
    permissions: CohostMembershipMetadata
  } | null>(null)
  const router = useRouter()

  const hiddenPermissions = hasCouponsEntitlement ? [] : ["coupons"]

  const copyInviteLink = async (token: string) => {
    const url = `${window.location.origin}/compete/cohost-invite/${token}`
    await navigator.clipboard.writeText(url)
    toast.success("Invite link copied")
  }

  const handleRemoveCohost = async (membershipId: string, name: string) => {
    if (!confirm(`Remove ${name} as a co-host?`)) return
    try {
      const { removeCohostFn } = await import("@/server-fns/cohost-fns")
      await removeCohostFn({
        data: { membershipId, organizingTeamId: competition.organizingTeamId },
      })
      toast.success(`${name} removed as co-host`)
      router.invalidate()
    } catch {
      toast.error("Failed to remove co-host")
    }
  }

  const hasCohosts =
    cohosts.length > 0 || pendingCohostInvitations.length > 0

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Co-Hosts</h2>
          {hasCohosts && (
            <p className="text-sm text-muted-foreground">
              {cohosts.length} active
              {pendingCohostInvitations.length > 0
                ? `, ${pendingCohostInvitations.length} pending`
                : ""}
            </p>
          )}
        </div>
        <Button
          onClick={() => setInviteOpen(true)}
          size="sm"
          variant="outline"
        >
          <UserPlus className="mr-1.5 h-4 w-4" />
          Invite Co-Host
        </Button>
      </div>

      {hasCohosts ? (
        <div className="divide-y rounded-md border">
          {/* Active cohosts */}
          {cohosts.map((cohost) => {
            const name = cohost.user
              ? `${cohost.user.firstName ?? ""} ${cohost.user.lastName ?? ""}`.trim() ||
                cohost.user.email
              : "Unknown"
            return (
              <Collapsible key={cohost.id}>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CollapsibleTrigger className="flex items-center gap-1.5 text-sm font-medium hover:text-foreground">
                      <ChevronDown className="h-3.5 w-3.5 transition-transform [[data-state=open]>&]:rotate-180" />
                      {name}
                    </CollapsibleTrigger>
                    {cohost.user && name !== cohost.user.email && (
                      <span className="text-xs text-muted-foreground">
                        {cohost.user.email}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setEditingCohost({
                          id: cohost.id,
                          name,
                          permissions: cohost.permissions,
                        })
                      }
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRemoveCohost(cohost.id, name)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <CollapsibleContent>
                  <PermissionsList permissions={cohost.permissions} />
                </CollapsibleContent>
              </Collapsible>
            )
          })}

          {/* Pending invitations */}
          {pendingCohostInvitations.map((inv) => (
            <Collapsible key={inv.id}>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <CollapsibleTrigger className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                    <ChevronDown className="h-3.5 w-3.5 transition-transform [[data-state=open]>&]:rotate-180" />
                    {inv.email}
                  </CollapsibleTrigger>
                  <Badge variant="outline" className="text-xs">
                    Pending
                  </Badge>
                </div>
                {inv.token && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyInviteLink(inv.token!)}
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Copy Link
                  </Button>
                )}
              </div>
              <CollapsibleContent>
                <PermissionsList permissions={inv.permissions} />
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No co-hosts yet. Invite a partner to help manage this competition.
        </p>
      )}

      <InviteCohostDialog
        competitionId={competition.id}
        competitionTeamId={competitionTeamId}
        organizingTeamId={competition.organizingTeamId}
        hiddenPermissions={hiddenPermissions}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />

      {editingCohost && (
        <EditCohostPermissionsDialog
          open={!!editingCohost}
          onOpenChange={(open) => {
            if (!open) setEditingCohost(null)
          }}
          cohostName={editingCohost.name}
          currentPermissions={editingCohost.permissions}
          organizingTeamId={competition.organizingTeamId}
          hiddenPermissions={hiddenPermissions}
          membershipId={editingCohost.id}
        />
      )}
    </>
  )
}

// =============================================================================
// Permissions List (grouped, enabled-only)
// =============================================================================

const PERMISSION_GROUPS_DISPLAY = [
  {
    label: "Competition Setup",
    items: [
      { key: "divisions", label: "Divisions" },
      { key: "viewRegistrations", label: "View registrations" },
      { key: "editRegistrations", label: "Edit registrations" },
      { key: "events", label: "Events" },
      { key: "scoring", label: "Scoring" },
      { key: "waivers", label: "Waivers" },
    ],
  },
  {
    label: "Run Competition",
    items: [
      { key: "schedule", label: "Schedule" },
      { key: "locations", label: "Locations" },
      { key: "volunteers", label: "Volunteers" },
      { key: "results", label: "Results" },
    ],
  },
  {
    label: "Business",
    items: [
      { key: "pricing", label: "Pricing" },
      { key: "revenue", label: "Revenue" },
      { key: "coupons", label: "Coupons" },
      { key: "sponsors", label: "Sponsors" },
    ],
  },
]

function PermissionsList({
  permissions,
}: { permissions: CohostMembershipMetadata }) {
  return (
    <div className="space-y-2 px-4 pb-3 pt-0">
      {PERMISSION_GROUPS_DISPLAY.map((group) => {
        const enabled = group.items.filter(
          (item) => permissions[item.key as keyof CohostMembershipMetadata],
        )
        if (enabled.length === 0) return null
        return (
          <div key={group.label}>
            <p className="text-xs font-medium text-muted-foreground">
              {group.label}
            </p>
            <p className="text-sm">
              {enabled.map((item) => item.label).join(", ")}
            </p>
          </div>
        )
      })}
      {PERMISSION_GROUPS_DISPLAY.every((group) =>
        group.items.every(
          (item) => !permissions[item.key as keyof CohostMembershipMetadata],
        ),
      ) && (
        <p className="text-sm text-muted-foreground">
          No permissions granted
        </p>
      )}
    </div>
  )
}
