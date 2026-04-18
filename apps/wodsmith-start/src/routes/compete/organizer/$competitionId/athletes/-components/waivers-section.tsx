import { Check } from "lucide-react"
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
  type AthleteDetailWaiver,
  type AthleteDetailWaiverSignature,
  memberDisplayName,
} from "./types"

interface WaiversSectionProps {
  waivers: AthleteDetailWaiver[]
  waiverSignatures: AthleteDetailWaiverSignature[]
  members: AthleteDetailMember[]
  formatDate: (d: Date | string | null | undefined) => string
}

export function WaiversSection({
  waivers,
  waiverSignatures,
  members,
  formatDate,
}: WaiversSectionProps) {
  const signedAt = (userId: string, waiverId: string): Date | null => {
    const s = waiverSignatures.find(
      (x) => x.userId === userId && x.waiverId === waiverId,
    )
    return s?.signedAt ?? null
  }

  const activeMembers = members.filter((m) => m.isActive)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Waivers</CardTitle>
        <CardDescription>
          Waiver signature status per team member. Read-only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {waivers.map((waiver) => (
          <div key={waiver.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="font-medium">{waiver.title}</div>
              {waiver.required && (
                <Badge variant="outline" className="text-xs">
                  Required
                </Badge>
              )}
            </div>
            <ul className="divide-y border rounded-md">
              {activeMembers.map((m) => {
                const date = signedAt(m.userId, waiver.id)
                return (
                  <li
                    key={`${waiver.id}-${m.userId}`}
                    className="flex items-center justify-between gap-3 p-3 text-sm"
                  >
                    <span className="truncate">{memberDisplayName(m)}</span>
                    {date ? (
                      <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 shrink-0">
                        <Check className="h-3.5 w-3.5" />
                        Signed {formatDate(date)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground shrink-0">
                        Not signed
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
