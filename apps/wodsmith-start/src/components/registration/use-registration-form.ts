import { useNavigate } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import type {
  Competition,
  ScalingGroup,
  ScalingLevel,
  Team,
  Waiver,
} from "@/db/schema"
import { trackEvent } from "@/lib/posthog"
import type { PublicCompetitionDivision } from "@/server-fns/competition-divisions-fns"
import { initiateRegistrationPaymentFn } from "@/server-fns/registration-fns"
import type { RegistrationQuestion } from "@/server-fns/registration-questions-fns"
import { signWaiverFn } from "@/server-fns/waiver-fns"
import { clearCouponSession, getCouponSession } from "@/utils/coupon-cookie"

export interface Teammate {
  email: string
  firstName: string
  lastName: string
  affiliateName: string
}

export interface TeamEntry {
  divisionId: string
  teamName: string
  teammates: Teammate[]
}

export interface UseRegistrationFormInput {
  competition: Competition & { organizingTeam: Team | null }
  scalingGroup: ScalingGroup & { scalingLevels: ScalingLevel[] }
  publicDivisions: PublicCompetitionDivision[]
  waivers: Waiver[]
  questions: RegistrationQuestion[]
  defaultAffiliateName?: string
  registeredDivisionIds?: string[]
  removedDivisionIds?: string[]
  previousAnswers?: Array<{ questionId: string; answer: string }>
  signedWaiverIds?: string[]
  paymentCanceled?: boolean
  /**
   * When set + eligible, the form starts with this division pre-selected
   * (and the invite variant pins it).
   */
  initialDivisionId?: string
  /**
   * Forwarded to `initiateRegistrationPaymentFn` so the server can settle
   * the matching invite (Phase 2C/D).
   */
  inviteToken?: string
}

export function useRegistrationForm(input: UseRegistrationFormInput) {
  const {
    competition,
    scalingGroup,
    publicDivisions,
    waivers,
    questions,
    defaultAffiliateName,
    registeredDivisionIds = [],
    removedDivisionIds = [],
    previousAnswers = [],
    signedWaiverIds = [],
    paymentCanceled,
    initialDivisionId,
    inviteToken,
  } = input

  const navigate = useNavigate()
  const signWaiver = useServerFn(signWaiverFn)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Active coupon from sessionStorage
  const [activeCoupon] = useState(() => {
    const coupon = getCouponSession()
    return coupon?.competitionSlug === competition.slug ? coupon : null
  })

  // Resolve initial division (eligible iff present + not registered/removed/full)
  const invitedDivision = (() => {
    if (!initialDivisionId) return null
    const level = scalingGroup.scalingLevels.find(
      (l) => l.id === initialDivisionId,
    )
    if (!level) return null
    if (registeredDivisionIds.includes(level.id)) return null
    if (removedDivisionIds.includes(level.id)) return null
    const pub = publicDivisions.find((d) => d.id === level.id)
    if (pub?.isFull) return null
    return level
  })()

  const [selectedDivisionIds, setSelectedDivisionIds] = useState<string[]>(
    invitedDivision ? [invitedDivision.id] : [],
  )
  const [affiliateName, setAffiliateName] = useState(defaultAffiliateName ?? "")

  const [teamEntries, setTeamEntries] = useState<Map<string, TeamEntry>>(() => {
    const next = new Map<string, TeamEntry>()
    if (invitedDivision && invitedDivision.teamSize > 1) {
      const teammatesNeeded = invitedDivision.teamSize - 1
      next.set(invitedDivision.id, {
        divisionId: invitedDivision.id,
        teamName: "",
        teammates: Array.from({ length: teammatesNeeded }, () => ({
          email: "",
          firstName: "",
          lastName: "",
          affiliateName: "",
        })),
      })
    }
    return next
  })

  const [divisionFees, setDivisionFees] = useState<Map<string, number>>(
    new Map(),
  )

  // Prune fee entries for deselected divisions
  useEffect(() => {
    setDivisionFees((prev) => {
      const selectedSet = new Set(selectedDivisionIds)
      let changed = false
      for (const key of prev.keys()) {
        if (!selectedSet.has(key)) changed = true
      }
      if (!changed) return prev
      const next = new Map<string, number>()
      for (const [k, v] of prev) {
        if (selectedSet.has(k)) next.set(k, v)
      }
      return next
    })
  }, [selectedDivisionIds])

  const handleFeesLoaded = (
    divisionId: string,
    fees: { isFree: boolean; totalChargeCents?: number } | null,
  ) => {
    setDivisionFees((prev) => {
      const next = new Map(prev)
      if (fees && !fees.isFree && fees.totalChargeCents) {
        next.set(divisionId, fees.totalChargeCents)
      } else {
        next.delete(divisionId)
      }
      return next
    })
  }

  const [answers, setAnswers] = useState<
    Array<{ questionId: string; answer: string }>
  >(
    questions.map((q) => {
      const prev = previousAnswers.find((a) => a.questionId === q.id)
      return { questionId: q.id, answer: prev?.answer ?? "" }
    }),
  )

  const [agreedWaivers, setAgreedWaivers] = useState<Set<string>>(() => {
    const signedSet = new Set(signedWaiverIds)
    const preAgreed = new Set<string>()
    for (const w of waivers) {
      if (signedSet.has(w.id)) preAgreed.add(w.id)
    }
    return preAgreed
  })

  const requiredWaivers = waivers.filter((w) => w.required)
  const allRequiredWaiversAgreed = requiredWaivers.every((w) =>
    agreedWaivers.has(w.id),
  )

  const registeredDivisionIdSet = new Set(registeredDivisionIds)
  const removedDivisionIdSet = new Set(removedDivisionIds)

  // Track registration started on mount
  useEffect(() => {
    trackEvent("competition_registration_started", {
      competition_id: competition.id,
      competition_name: competition.name,
      competition_slug: competition.slug,
    })
  }, [competition.id, competition.name, competition.slug])

  // Show toast if returning from canceled payment
  useEffect(() => {
    if (paymentCanceled) {
      toast.error("Payment was canceled. Please try again when you're ready.")
    }
  }, [paymentCanceled])

  const getDivision = (divisionId: string) =>
    scalingGroup.scalingLevels.find((l) => l.id === divisionId)

  const handleDivisionToggle = (divisionId: string, checked: boolean) => {
    if (checked) {
      setSelectedDivisionIds((prev) => [...prev, divisionId])
      const division = getDivision(divisionId)
      if (division && division.teamSize > 1) {
        const teammatesNeeded = division.teamSize - 1
        setTeamEntries((prev) => {
          const next = new Map(prev)
          next.set(divisionId, {
            divisionId,
            teamName: "",
            teammates: Array.from({ length: teammatesNeeded }, () => ({
              email: "",
              firstName: "",
              lastName: "",
              affiliateName: "",
            })),
          })
          return next
        })
      }
    } else {
      setSelectedDivisionIds((prev) => prev.filter((id) => id !== divisionId))
      setTeamEntries((prev) => {
        const next = new Map(prev)
        next.delete(divisionId)
        return next
      })
    }
  }

  const updateTeamEntry = (
    divisionId: string,
    field: "teamName",
    value: string,
  ) => {
    setTeamEntries((prev) => {
      const next = new Map(prev)
      const entry = next.get(divisionId)
      if (entry) next.set(divisionId, { ...entry, [field]: value })
      return next
    })
  }

  const updateTeammate = (
    divisionId: string,
    index: number,
    field: keyof Teammate,
    value: string,
  ) => {
    setTeamEntries((prev) => {
      const next = new Map(prev)
      const entry = next.get(divisionId)
      if (entry) {
        const teammates = [...entry.teammates]
        teammates[index] = { ...teammates[index], [field]: value }
        next.set(divisionId, { ...entry, teammates })
      }
      return next
    })
  }

  const handleWaiverCheckChange = (waiverId: string, checked: boolean) => {
    setAgreedWaivers((prev) => {
      const newSet = new Set(prev)
      if (checked) newSet.add(waiverId)
      else newSet.delete(waiverId)
      return newSet
    })
  }

  const updateAnswer = (questionId: string, value: string) => {
    setAnswers((prev) =>
      prev.map((a) =>
        a.questionId === questionId ? { ...a, answer: value } : a,
      ),
    )
  }

  const buildRegistrationItems = () =>
    selectedDivisionIds.map((divisionId) => {
      const division = getDivision(divisionId)
      const isTeam = (division?.teamSize ?? 1) > 1
      const teamEntry = teamEntries.get(divisionId)
      return {
        divisionId,
        teamName: isTeam ? teamEntry?.teamName : undefined,
        teammates: isTeam ? teamEntry?.teammates : undefined,
      }
    })

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedDivisionIds.length === 0) {
      toast.error("Please select at least one division")
      return
    }
    if (!affiliateName.trim()) {
      toast.error("Please select your affiliate or Independent")
      return
    }

    for (const divisionId of selectedDivisionIds) {
      const division = getDivision(divisionId)
      if (!division || division.teamSize <= 1) continue

      const teamEntry = teamEntries.get(divisionId)
      if (!teamEntry?.teamName?.trim()) {
        toast.error(`Team name is required for ${division.label}`)
        return
      }
      const teammatesNeeded = division.teamSize - 1
      if (
        !teamEntry.teammates ||
        teamEntry.teammates.length !== teammatesNeeded
      ) {
        toast.error(
          `Please add ${teammatesNeeded} teammate(s) for ${division.label}`,
        )
        return
      }
      for (const teammate of teamEntry.teammates) {
        if (!teammate.email?.trim()) {
          toast.error(`All teammate emails are required for ${division.label}`)
          return
        }
      }
    }

    if (questions.length > 0) {
      for (const question of questions) {
        if (question.required) {
          const answer = answers.find((a) => a.questionId === question.id)
          if (!answer?.answer?.trim()) {
            toast.error(
              `Please answer the required question: ${question.label}`,
            )
            return
          }
        }
      }
    }

    if (!allRequiredWaiversAgreed) {
      toast.error("Please agree to all required waivers before registering")
      return
    }

    setIsSubmitting(true)

    try {
      for (const waiverId of agreedWaivers) {
        const result = await signWaiver({
          data: {
            waiverId,
            registrationId: undefined,
            ipAddress: undefined,
          },
        })
        if (!result.success) {
          toast.error("Failed to sign waiver")
          setIsSubmitting(false)
          return
        }
      }

      const items = buildRegistrationItems()

      // The server resolves the token, verifies it matches the session +
      // competition + division, and bypasses the public registration window.
      // Phase 2D will additionally settle the matching invite to
      // `accepted_paid` via Stripe metadata.
      const result = await initiateRegistrationPaymentFn({
        data: {
          competitionId: competition.id,
          items,
          affiliateName: affiliateName || undefined,
          answers,
          couponCode: activeCoupon?.code,
          ...(inviteToken ? { inviteToken } : {}),
        },
      })

      if (result.isFree) {
        if (activeCoupon) clearCouponSession()
        trackEvent("competition_registration_completed", {
          competition_id: competition.id,
          competition_name: competition.name,
          competition_slug: competition.slug,
          division_count: items.length,
        })
        toast.success("Successfully registered!")
        navigate({
          to: `/compete/${competition.slug}/registered`,
          search: { registration_id: result.registrationId ?? undefined },
        })
        return
      }

      if (result.checkoutUrl) {
        if (activeCoupon) clearCouponSession()
        trackEvent("competition_registration_payment_started", {
          competition_id: competition.id,
          competition_name: competition.name,
          competition_slug: competition.slug,
          division_count: items.length,
        })
        window.location.href = result.checkoutUrl
        return
      }

      throw new Error("Failed to create checkout session")
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Registration failed"

      trackEvent("competition_registration_failed", {
        competition_id: competition.id,
        competition_name: competition.name,
        competition_slug: competition.slug,
        error_type: "unknown",
      })

      toast.error(errorMessage)
      setIsSubmitting(false)
    }
  }

  const hasSelectedDivisions = selectedDivisionIds.length > 0
  const competitionFull = false // capacity gating happens at the variant level
  const selectedTeamDivisions = selectedDivisionIds
    .map((id) => getDivision(id))
    .filter((d): d is ScalingLevel => d !== undefined && d.teamSize > 1)

  return {
    // pass-throughs (so variants don't need to re-pass everything)
    competition,
    scalingGroup,
    publicDivisions,
    waivers,
    questions,

    // state
    isSubmitting,
    activeCoupon,
    invitedDivision,
    selectedDivisionIds,
    selectedTeamDivisions,
    hasSelectedDivisions,
    affiliateName,
    setAffiliateName,
    teamEntries,
    divisionFees,
    answers,
    agreedWaivers,
    allRequiredWaiversAgreed,
    registeredDivisionIdSet,
    removedDivisionIdSet,
    competitionFull,

    // handlers
    getDivision,
    handleDivisionToggle,
    handleFeesLoaded,
    updateTeamEntry,
    updateTeammate,
    handleWaiverCheckChange,
    updateAnswer,
    onSubmit,
  }
}

export type UseRegistrationFormReturn = ReturnType<typeof useRegistrationForm>
