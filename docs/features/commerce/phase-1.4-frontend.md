## 1.4 Frontend Integration

**Integration Strategy**: Modify the existing `RegistrationForm` component to add a payment step after form validation, rather than creating a separate payment form.

### Modified Registration Flow

1. User fills out existing form (division, team name, teammates)
2. Clicks "Register" → validates form → calls `initiateRegistrationPayment()`
3. If FREE: Redirects to success immediately
4. If PAID: Redirects to Stripe Checkout (hosted payment page)
5. Stripe redirects back to success URL after payment

### Update Existing Registration Form

**File**: `src/app/(compete)/compete/[slug]/register/_components/registration-form.tsx`

With Stripe Checkout, the frontend is simpler - just redirect to the checkout URL:

```typescript
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { initiateRegistrationPayment, getRegistrationFeeBreakdown } from "@/actions/commerce.action"
// ... existing imports (NO Stripe Elements needed!)

export function RegistrationForm({
  competition,
  scalingGroup,
  userId,
  registrationOpen,
  registrationOpensAt,
  registrationClosesAt,
}: Props) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ... existing form setup with react-hook-form

  const onSubmit = async (data: FormValues) => {
    // ... existing validation

    setIsSubmitting(true)

    try {
      const result = await initiateRegistrationPayment({
        competitionId: competition.id,
        divisionId: data.divisionId,
        teamName: isTeamDivision ? data.teamName : undefined,
        affiliateName: data.affiliateName || undefined,
        teammates: isTeamDivision ? data.teammates : undefined,
      })

      // FREE registration - redirect to success
      if (result.isFree) {
        toast.success("Successfully registered!")
        router.push(`/compete/${competition.slug}`)
        return
      }

      // PAID registration - redirect to Stripe Checkout
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl
        return
      }

      throw new Error("Failed to create checkout session")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed")
      setIsSubmitting(false)
    }
  }

  // Watch selected division for fee display
  const selectedDivisionId = form.watch("divisionId")

  return (
    <div className="space-y-6">
      {/* Fee display card - updates when division changes */}
      <Card>
        <CardHeader>
          <CardTitle>Registration Fee</CardTitle>
        </CardHeader>
        <CardContent>
          <FeeBreakdownDisplay
            competitionId={competition.id}
            divisionId={selectedDivisionId || null}
          />
        </CardContent>
      </Card>

      {/* ... rest of existing form (division selector, team fields, etc.) */}

      {/* Submit button */}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Processing..." : "Register"}
      </Button>
    </div>
  )
}

// Fee breakdown display component - updates when division changes
function FeeBreakdownDisplay({
  competitionId,
  divisionId,
}: {
  competitionId: string
  divisionId: string | null
}) {
  const [fees, setFees] = useState<{
    isFree: boolean
    registrationFeeCents?: number
    platformFeeCents?: number
    totalChargeCents?: number
  } | null>(null)

  useEffect(() => {
    if (!divisionId) {
      setFees(null)
      return
    }
    getRegistrationFeeBreakdown(competitionId, divisionId).then(setFees)
  }, [competitionId, divisionId])

  if (!divisionId) {
    return <p className="text-muted-foreground text-sm">Select a division to see pricing</p>
  }

  if (!fees) return <Skeleton className="h-20" />
  if (fees.isFree) return <p className="text-green-600 font-medium">Free Registration</p>

  return (
    <div className="space-y-1 text-sm">
      <div className="flex justify-between">
        <span>Registration Fee</span>
        <span>${((fees.registrationFeeCents ?? 0) / 100).toFixed(2)}</span>
      </div>
      <div className="flex justify-between text-muted-foreground">
        <span>Platform Fee</span>
        <span>${((fees.platformFeeCents ?? 0) / 100).toFixed(2)}</span>
      </div>
      <div className="flex justify-between font-medium pt-1 border-t">
        <span>Total</span>
        <span>${((fees.totalChargeCents ?? 0) / 100).toFixed(2)}</span>
      </div>
    </div>
  )
}
```

### Success Page

**File**: `src/app/(compete)/compete/[slug]/register/success/page.tsx`

```typescript
import { redirect } from "next/navigation"
import { getSessionFromCookie } from "@/utils/auth"
import { getUserCompetitionRegistration } from "@/server/competitions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function RegistrationSuccessPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const session = await getSessionFromCookie()

  if (!session) {
    redirect(`/sign-in?redirect=/compete/${slug}`)
  }

  // Verify registration exists
  const { getCompetition } = await import("@/server/competitions")
  const competition = await getCompetition(slug)

  if (!competition) {
    redirect("/compete")
  }

  const registration = await getUserCompetitionRegistration(competition.id, session.userId)

  if (!registration) {
    // Payment may still be processing - show pending state
    return (
      <div className="mx-auto max-w-lg py-12">
        <Card>
          <CardContent className="pt-6 text-center">
            <p>Processing your registration...</p>
            <p className="text-sm text-muted-foreground mt-2">
              This may take a few moments. You&apos;ll receive a confirmation email shortly.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg py-12">
      <Card>
        <CardHeader className="text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <CardTitle className="text-2xl">Registration Complete!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p>You&apos;re registered for <strong>{competition.name}</strong></p>

          <div className="pt-4">
            <Button asChild>
              <Link href={`/compete/${slug}`}>View Competition</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

--