import { useNavigate } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { InviteDivisionHero } from "@/components/registration/invite-division-hero"
import { Button } from "@/components/ui/button"
import type {
  Competition,
  ScalingGroup,
  ScalingLevel,
  Team,
  Waiver,
} from "@/db/schema"
import type { PublicCompetitionDivision } from "@/server-fns/competition-divisions-fns"
import type { RegistrationQuestion } from "@/server-fns/registration-questions-fns"
import type { CompetitionCapacityResult } from "@/utils/competition-capacity"
import {
  AffiliateSection,
  CapacityBanners,
  ClosedRegistrationBanner,
  CompetitionDetailsCard,
  DivisionPickerSection,
  FeeSummarySection,
  PageHeader,
  RegisteredAlert,
  RegistrationQuestionsSection,
  RemovedAlert,
  TeamDetailsSection,
  WaiversSection,
} from "./registration-sections"
import {
  type UseRegistrationFormReturn,
  useRegistrationForm,
} from "./use-registration-form"

// Loader-data shape shared by both variants. Kept colocated so the route can
// pass the same payload regardless of which variant it picks.
export interface RegistrationFormProps {
  competition: Competition & { organizingTeam: Team | null }
  scalingGroup: ScalingGroup & { scalingLevels: ScalingLevel[] }
  publicDivisions: PublicCompetitionDivision[]
  competitionCapacity?: CompetitionCapacityResult | null
  userId: string
  registrationOpensAt: string | null
  registrationClosesAt: string | null
  paymentCanceled?: boolean
  defaultAffiliateName?: string
  waivers: Waiver[]
  questions: RegistrationQuestion[]
  userFirstName?: string | null
  userLastName?: string | null
  userEmail?: string | null
  registeredDivisionIds?: string[]
  removedDivisionIds?: string[]
  previousAnswers?: Array<{ questionId: string; answer: string }>
  signedWaiverIds?: string[]
}

interface PublicProps extends RegistrationFormProps {
  registrationOpen: boolean
  inviteToken?: string
}

interface InviteProps extends RegistrationFormProps {
  initialDivisionId: string
  inviteToken?: string
  // Real public-window state, propagated from the route, so the
  // ineligible-invite-division fallback to PublicRegistrationForm doesn't
  // silently flip registration open and submit a request that the server
  // will reject for a closed window.
  publicRegistrationOpen: boolean
  prefillTeammates?: Array<{
    email: string
    firstName: string
    lastName: string
    affiliateName: string
  }>
  prefillTeamName?: string
}

// ─── Public variant ─────────────────────────────────────────────────────────

export function PublicRegistrationForm(props: PublicProps) {
  const r = useRegistrationForm(props)
  const navigate = useNavigate()
  const competitionFull = props.competitionCapacity?.isFull ?? false
  const submitDisabled =
    r.isSubmitting ||
    !props.registrationOpen ||
    competitionFull ||
    !r.hasSelectedDivisions ||
    !r.affiliateName.trim() ||
    (props.waivers.length > 0 && !r.allRequiredWaiversAgreed)

  const fieldsDisabled = r.isSubmitting || !props.registrationOpen

  return (
    <div className="space-y-6">
      <PageHeader competition={props.competition} />
      <CapacityBanners capacity={props.competitionCapacity} />
      <RemovedAlert
        removedDivisionIds={props.removedDivisionIds ?? []}
        getDivision={r.getDivision}
      />
      <RegisteredAlert
        registeredDivisionIds={props.registeredDivisionIds ?? []}
      />
      {!props.registrationOpen ? (
        <ClosedRegistrationBanner
          registrationOpensAt={props.registrationOpensAt}
          registrationClosesAt={props.registrationClosesAt}
        />
      ) : null}
      <CompetitionDetailsCard
        competition={props.competition}
        registrationOpensAt={props.registrationOpensAt}
        registrationClosesAt={props.registrationClosesAt}
      />

      <form onSubmit={r.onSubmit} className="space-y-6">
        <DivisionPickerSection
          scalingLevels={props.scalingGroup.scalingLevels}
          publicDivisions={props.publicDivisions}
          selectedIds={r.selectedDivisionIds}
          registeredDivisionIds={r.registeredDivisionIdSet}
          removedDivisionIds={r.removedDivisionIdSet}
          getDivision={r.getDivision}
          onToggle={r.handleDivisionToggle}
          disabled={fieldsDisabled || competitionFull}
        />
        <AffiliateSection
          value={r.affiliateName}
          onChange={r.setAffiliateName}
          disabled={fieldsDisabled}
        />
        <RegistrationQuestionsSection
          questions={props.questions}
          answers={r.answers}
          onAnswerChange={r.updateAnswer}
          disabled={fieldsDisabled}
        />
        <FeeSummarySection
          competitionId={props.competition.id}
          selectedDivisionIds={r.selectedDivisionIds}
          getDivision={r.getDivision}
          divisionFees={r.divisionFees}
          onFeesLoaded={r.handleFeesLoaded}
          activeCoupon={r.activeCoupon}
        />
        <TeamDetailsSection
          selectedTeamDivisions={r.selectedTeamDivisions}
          teamEntries={r.teamEntries}
          updateTeamEntry={r.updateTeamEntry}
          updateTeammate={r.updateTeammate}
          userFirstName={props.userFirstName}
          userLastName={props.userLastName}
          userEmail={props.userEmail}
          disabled={fieldsDisabled}
        />
        <WaiversSection
          waivers={props.waivers}
          agreedWaivers={r.agreedWaivers}
          onWaiverToggle={r.handleWaiverCheckChange}
          disabled={fieldsDisabled}
        />
        <div className="flex gap-4">
          <Button type="submit" disabled={submitDisabled} className="flex-1">
            {r.isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : !props.registrationOpen ? (
              "Registration Closed"
            ) : competitionFull ? (
              "Competition Full"
            ) : !r.hasSelectedDivisions ? (
              "Select a Division"
            ) : props.waivers.length > 0 && !r.allRequiredWaiversAgreed ? (
              "Agree to Waivers to Continue"
            ) : r.selectedDivisionIds.length > 1 ? (
              `Register for ${r.selectedDivisionIds.length} Divisions`
            ) : r.selectedTeamDivisions.length > 0 ? (
              "Register Team"
            ) : (
              "Complete Registration"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              navigate({ to: `/compete/${props.competition.slug}` })
            }
            disabled={r.isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}

// ─── Invite variant ─────────────────────────────────────────────────────────
// The invitation IS the authorization: bypasses the public registration window,
// pins the division, and never shows a "Registration Closed" state.

export function InviteRegistrationForm(props: InviteProps) {
  const r = useRegistrationForm(props)
  const navigate = useNavigate()

  // If the URL pointed at a division that's no longer eligible (full,
  // already registered, removed), fall back to the public flow so the
  // athlete can pick a different division rather than seeing nothing.
  if (!r.invitedDivision) {
    const {
      initialDivisionId: _ignored,
      inviteToken,
      publicRegistrationOpen,
      prefillTeammates: _prefillTeammates,
      prefillTeamName: _prefillTeamName,
      ...rest
    } = props
    return (
      <PublicRegistrationForm
        {...rest}
        registrationOpen={publicRegistrationOpen}
        inviteToken={inviteToken}
      />
    )
  }

  const submitDisabled =
    r.isSubmitting ||
    !r.affiliateName.trim() ||
    (props.waivers.length > 0 && !r.allRequiredWaiversAgreed)
  const fieldsDisabled = r.isSubmitting

  return (
    <div className="space-y-6">
      <PageHeader competition={props.competition} />
      <CapacityBanners capacity={props.competitionCapacity} />
      <InviteDivisionHero
        championshipName={props.competition.name}
        divisionLabel={r.invitedDivision.label}
        teamSize={r.invitedDivision.teamSize ?? 1}
        imageUrl={props.competition.profileImageUrl}
      />
      <CompetitionDetailsCard
        competition={props.competition}
        registrationOpensAt={props.registrationOpensAt}
        registrationClosesAt={props.registrationClosesAt}
      />

      <form onSubmit={r.onSubmit} className="space-y-6">
        <AffiliateSection
          value={r.affiliateName}
          onChange={r.setAffiliateName}
          disabled={fieldsDisabled}
        />
        <RegistrationQuestionsSection
          questions={props.questions}
          answers={r.answers}
          onAnswerChange={r.updateAnswer}
          disabled={fieldsDisabled}
        />
        <FeeSummarySection
          competitionId={props.competition.id}
          selectedDivisionIds={r.selectedDivisionIds}
          getDivision={r.getDivision}
          divisionFees={r.divisionFees}
          onFeesLoaded={r.handleFeesLoaded}
          activeCoupon={r.activeCoupon}
        />
        <TeamDetailsSection
          selectedTeamDivisions={r.selectedTeamDivisions}
          teamEntries={r.teamEntries}
          updateTeamEntry={r.updateTeamEntry}
          updateTeammate={r.updateTeammate}
          userFirstName={props.userFirstName}
          userLastName={props.userLastName}
          userEmail={props.userEmail}
          disabled={fieldsDisabled}
        />
        <WaiversSection
          waivers={props.waivers}
          agreedWaivers={r.agreedWaivers}
          onWaiverToggle={r.handleWaiverCheckChange}
          disabled={fieldsDisabled}
        />
        <div className="flex gap-4">
          <Button type="submit" disabled={submitDisabled} className="flex-1">
            {r.isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : props.waivers.length > 0 && !r.allRequiredWaiversAgreed ? (
              "Agree to Waivers to Continue"
            ) : r.selectedTeamDivisions.length > 0 ? (
              "Confirm Team Spot"
            ) : (
              "Confirm Spot"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              navigate({ to: `/compete/${props.competition.slug}` })
            }
            disabled={r.isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}

// Re-export the hook return type for any caller that wants it.
export type { UseRegistrationFormReturn }
