## 1.5 Organizer Commerce Configuration

Organizers need a UI to configure registration fees for their competition. This lives in the competition admin area.

### Routes

```
/compete/organizer/[slug]/settings/registration
  └── Registration fee configuration
      ├── Default fee (applies to divisions without specific fee)
      ├── Per-division fee overrides
      └── Fee handling options (who pays Stripe fees)
```

### Page Component

**File**: `src/app/(compete)/compete/organizer/[slug]/settings/registration/page.tsx`

```typescript
import { notFound } from "next/navigation"
import { getCompetition } from "@/server/competitions"
import { getCompetitionDivisionFees } from "@/actions/commerce.action"
import { RegistrationFeeSettings } from "./_components/registration-fee-settings"
import { requireTeamPermission } from "@/utils/team-auth"

export default async function RegistrationSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const competition = await getCompetition(slug)

  if (!competition) notFound()

  // Verify organizer has permission
  await requireTeamPermission(competition.organizingTeamId, "MANAGE_COMPETITIONS")

  // Get current fee configuration
  const feeConfig = await getCompetitionDivisionFees(competition.id)

  // Get divisions from competition's scaling group
  const divisions = await getDivisionsForCompetition(competition.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Registration Settings</h1>
        <p className="text-muted-foreground">
          Configure registration fees for {competition.name}
        </p>
      </div>

      <RegistrationFeeSettings
        competition={competition}
        divisions={divisions}
        currentFees={feeConfig}
      />
    </div>
  )
}
```

### Server Actions for Fee Management

**Add to**: `src/actions/commerce.action.ts`

```typescript
/**
 * Update competition-level fee configuration
 */
export async function updateCompetitionFeeConfig(input: {
  competitionId: string
  defaultRegistrationFeeCents?: number
  platformFeePercentage?: number
  platformFeeFixed?: number
  passStripeFeesToCustomer?: boolean
}) {
  return withRateLimit(async () => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error("Unauthorized")

    const db = getDb()

    // Verify user has permission to manage this competition
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, input.competitionId),
    })
    if (!competition) throw new Error("Competition not found")

    await requireTeamPermission(competition.organizingTeamId, "MANAGE_COMPETITIONS")

    // Update competition
    await db.update(competitionsTable)
      .set({
        defaultRegistrationFeeCents: input.defaultRegistrationFeeCents,
        platformFeePercentage: input.platformFeePercentage,
        platformFeeFixed: input.platformFeeFixed,
        passStripeFeesToCustomer: input.passStripeFeesToCustomer,
        updatedAt: new Date(),
      })
      .where(eq(competitionsTable.id, input.competitionId))

    return { success: true }
  }, RATE_LIMITS.DEFAULT)
}

/**
 * Update or remove a division-specific fee
 */
export async function updateDivisionFee(input: {
  competitionId: string
  divisionId: string
  feeCents: number | null // null = remove override
}) {
  return withRateLimit(async () => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error("Unauthorized")

    const db = getDb()

    // Verify permission
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, input.competitionId),
    })
    if (!competition) throw new Error("Competition not found")

    await requireTeamPermission(competition.organizingTeamId, "MANAGE_COMPETITIONS")

    if (input.feeCents === null) {
      // Remove override
      await db.delete(competitionDivisionFeesTable)
        .where(
          and(
            eq(competitionDivisionFeesTable.competitionId, input.competitionId),
            eq(competitionDivisionFeesTable.divisionId, input.divisionId),
          )
        )
    } else {
      // Upsert fee
      const existing = await db.query.competitionDivisionFeesTable.findFirst({
        where: and(
          eq(competitionDivisionFeesTable.competitionId, input.competitionId),
          eq(competitionDivisionFeesTable.divisionId, input.divisionId),
        ),
      })

      if (existing) {
        await db.update(competitionDivisionFeesTable)
          .set({ feeCents: input.feeCents, updatedAt: new Date() })
          .where(eq(competitionDivisionFeesTable.id, existing.id))
      } else {
        await db.insert(competitionDivisionFeesTable).values({
          competitionId: input.competitionId,
          divisionId: input.divisionId,
          feeCents: input.feeCents,
        })
      }
    }

    return { success: true }
  }, RATE_LIMITS.DEFAULT)
}
```

---