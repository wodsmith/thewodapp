import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Search,
  Tag,
  User,
  Users,
  X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { WaiverViewer } from "@/components/compete/waiver-viewer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Competition, ScalingLevel, Team, Waiver } from "@/db/schema"
import type { PublicCompetitionDivision } from "@/server-fns/competition-divisions-fns"
import type { RegistrationQuestion } from "@/server-fns/registration-questions-fns"
import { cn } from "@/utils/cn"
import type { CompetitionCapacityResult } from "@/utils/competition-capacity"
import { isSameDateString } from "@/utils/date-utils"
import { AffiliateCombobox } from "./affiliate-combobox"
import { FeeBreakdown } from "./fee-breakdown"
import type { TeamEntry, Teammate } from "./use-registration-form"

// ─── utils ──────────────────────────────────────────────────────────────────

export function formatRegistrationDate(date: string | Date | number | null) {
  if (!date) return "TBA"
  if (typeof date === "string") {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (match) {
      const [, y, m, d] = match
      const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
      const weekdays = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ]
      const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ]
      return `${weekdays[date.getUTCDay()]}, ${months[Number(m) - 1]} ${Number(d)}, ${y}`
    }
    return "TBA"
  }
  const d = typeof date === "number" ? new Date(date) : date
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

// ─── header / banners ───────────────────────────────────────────────────────

export function PageHeader({ competition }: { competition: Competition }) {
  return (
    <div className="space-y-2">
      <h1 className="text-3xl font-bold">Register for Competition</h1>
      <p className="text-muted-foreground">{competition.name}</p>
    </div>
  )
}

export function CapacityBanners({
  capacity,
}: {
  capacity?: CompetitionCapacityResult | null
}) {
  if (!capacity) return null
  if (capacity.isFull) {
    return (
      <Card className="border-amber-500/50 bg-amber-500/10">
        <CardContent className="pt-6">
          <div className="flex items-start gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Competition is full</p>
              <p className="text-sm text-muted-foreground">
                This competition has reached its maximum number of
                registrations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }
  if (
    capacity.spotsAvailable !== null &&
    capacity.spotsAvailable !== undefined &&
    capacity.spotsAvailable <= 5
  ) {
    return (
      <Card className="border-amber-500/50 bg-amber-500/10">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-amber-600">
            <Users className="h-4 w-4 shrink-0" />
            <p className="text-sm font-semibold">
              Only {capacity.spotsAvailable} spot
              {capacity.spotsAvailable === 1 ? "" : "s"} left across all
              divisions!
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }
  return null
}

export function RemovedAlert({
  removedDivisionIds,
  getDivision,
}: {
  removedDivisionIds: string[]
  getDivision: (id: string) => ScalingLevel | undefined
}) {
  if (removedDivisionIds.length === 0) return null
  return (
    <Card className="border-destructive/20 bg-destructive/5">
      <CardContent className="pt-6">
        <div className="flex items-start gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="text-sm space-y-1">
            <p className="font-medium">
              Your registration
              {removedDivisionIds.length === 1 ? " was" : "s were"} removed from
              this competition:
            </p>
            <ul className="list-disc pl-4">
              {removedDivisionIds.map((id) => {
                const div = getDivision(id)
                return <li key={id}>{div?.label ?? "Unknown division"}</li>
              })}
            </ul>
            <p className="text-muted-foreground">
              If you believe this was a mistake, please contact the event
              organizer.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function RegisteredAlert({
  registeredDivisionIds,
}: {
  registeredDivisionIds: string[]
}) {
  if (registeredDivisionIds.length === 0) return null
  return (
    <Card className="border-green-500/20 bg-green-500/5">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm font-medium">
            You're already registered for{" "}
            {registeredDivisionIds.length === 1
              ? "1 division"
              : `${registeredDivisionIds.length} divisions`}
            . Select additional divisions below.
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export function ClosedRegistrationBanner({
  registrationOpensAt,
  registrationClosesAt,
}: {
  registrationOpensAt: string | null
  registrationClosesAt: string | null
}) {
  const message = (() => {
    if (!registrationOpensAt || !registrationClosesAt) {
      return "Registration dates have not been set yet."
    }
    const todayStr = new Date().toISOString().slice(0, 10)
    if (todayStr < registrationOpensAt) {
      return `Registration opens ${formatRegistrationDate(registrationOpensAt)} and closes ${formatRegistrationDate(registrationClosesAt)}`
    }
    if (todayStr > registrationClosesAt) {
      return `Registration was open from ${formatRegistrationDate(registrationOpensAt)} to ${formatRegistrationDate(registrationClosesAt)}`
    }
    return null
  })()
  if (!message) return null
  return (
    <Card className="border-yellow-500/50 bg-yellow-500/10">
      <CardContent className="pt-6">
        <p className="text-sm font-medium">{message}</p>
      </CardContent>
    </Card>
  )
}

export function CompetitionDetailsCard({
  competition,
  registrationOpensAt,
  registrationClosesAt,
  hideRegistrationWindow = false,
}: {
  competition: Competition & { organizingTeam: Team | null }
  registrationOpensAt: string | null
  registrationClosesAt: string | null
  /**
   * Suppresses the "Registration Window" row. Set when the form is in
   * invite-locked mode — invitees bypass the public registration window,
   * so the row is irrelevant and surfaces "TBA - TBA" when dates aren't
   * configured, which contradicts the "you can register now" CTA.
   */
  hideRegistrationWindow?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Competition Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div>
          <p className="text-muted-foreground text-sm">
            {isSameDateString(competition.startDate, competition.endDate)
              ? "Competition Date"
              : "Competition Dates"}
          </p>
          <p className="font-medium">
            {isSameDateString(competition.startDate, competition.endDate)
              ? formatRegistrationDate(competition.startDate)
              : `${formatRegistrationDate(competition.startDate)} - ${formatRegistrationDate(competition.endDate)}`}
          </p>
        </div>
        {!hideRegistrationWindow && (
          <div>
            <p className="text-muted-foreground text-sm">Registration Window</p>
            <p className="font-medium">
              {formatRegistrationDate(registrationOpensAt)} -{" "}
              {formatRegistrationDate(registrationClosesAt)}
            </p>
          </div>
        )}
        <div>
          <p className="text-muted-foreground text-sm">Hosted By</p>
          <p className="font-medium">
            {competition.organizingTeam?.name || "TBA"}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── division picker (Public variant only) ──────────────────────────────────

function DivisionMultiSelect({
  scalingLevels,
  publicDivisions,
  selectedIds,
  registeredDivisionIds,
  removedDivisionIds,
  onToggle,
  disabled,
}: {
  scalingLevels: ScalingLevel[]
  publicDivisions: PublicCompetitionDivision[]
  selectedIds: string[]
  registeredDivisionIds: Set<string>
  removedDivisionIds: Set<string>
  onToggle: (id: string, checked: boolean) => void
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = scalingLevels.filter((l) =>
    l.label.toLowerCase().includes(search.toLowerCase()),
  )

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0)
    else setSearch("")
  }, [open])

  const getPublicDiv = (id: string) => publicDivisions.find((d) => d.id === id)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* biome-ignore lint/a11y/useSemanticElements: Custom combobox pattern */}
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          <span className="truncate text-muted-foreground">
            {selectedIds.length === 0
              ? "Search divisions..."
              : `${selectedIds.length} division${selectedIds.length > 1 ? "s" : ""} selected`}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            ref={inputRef}
            placeholder="Search divisions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 border-0 p-0 placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No divisions found.
            </p>
          ) : (
            filtered.map((level) => {
              const info = getPublicDiv(level.id)
              const isFull = info?.isFull ?? false
              const spotsAvailable = info?.spotsAvailable
              const maxSpots = info?.maxSpots
              const isRegistered = registeredDivisionIds.has(level.id)
              const isRemoved = removedDivisionIds.has(level.id)
              const isSelected = selectedIds.includes(level.id)
              const isItemDisabled =
                disabled || isFull || isRegistered || isRemoved

              return (
                <button
                  key={level.id}
                  type="button"
                  onClick={() => {
                    if (!isItemDisabled) onToggle(level.id, !isSelected)
                  }}
                  disabled={isItemDisabled}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                    isSelected && "bg-accent/50",
                    isItemDisabled &&
                      "opacity-50 cursor-not-allowed hover:bg-transparent",
                  )}
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isSelected ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span
                    className={cn(
                      "flex-1 text-left font-medium",
                      isFull &&
                        !isRegistered &&
                        "line-through text-muted-foreground",
                    )}
                  >
                    {level.label}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(level.teamSize ?? 1) > 1 ? (
                      <Badge variant="secondary" className="text-xs">
                        <Users className="w-3 h-3 mr-1" />
                        {level.teamSize}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        <User className="w-3 h-3 mr-1" />
                        Indy
                      </Badge>
                    )}
                    {isRemoved ? (
                      <Badge
                        variant="outline"
                        className="text-xs text-destructive border-destructive/30"
                      >
                        Removed
                      </Badge>
                    ) : isRegistered ? (
                      <Badge
                        variant="outline"
                        className="text-xs text-green-600 border-green-500/30"
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Registered
                      </Badge>
                    ) : isFull ? (
                      <Badge variant="destructive" className="text-xs">
                        SOLD OUT
                      </Badge>
                    ) : maxSpots !== null &&
                      spotsAvailable !== null &&
                      spotsAvailable !== undefined &&
                      spotsAvailable <= 5 ? (
                      <Badge
                        variant="secondary"
                        className="text-xs text-amber-600 dark:text-amber-400"
                      >
                        {spotsAvailable} left
                      </Badge>
                    ) : null}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function DivisionPickerSection({
  scalingLevels,
  publicDivisions,
  selectedIds,
  registeredDivisionIds,
  removedDivisionIds,
  getDivision,
  onToggle,
  disabled,
}: {
  scalingLevels: ScalingLevel[]
  publicDivisions: PublicCompetitionDivision[]
  selectedIds: string[]
  registeredDivisionIds: Set<string>
  removedDivisionIds: Set<string>
  getDivision: (id: string) => ScalingLevel | undefined
  onToggle: (id: string, checked: boolean) => void
  disabled: boolean
}) {
  const hasSelected = selectedIds.length > 0
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Select Division{selectedIds.length > 1 ? "s" : ""}
        </CardTitle>
        <CardDescription>
          Choose one or more divisions to register for
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DivisionMultiSelect
          scalingLevels={scalingLevels}
          publicDivisions={publicDivisions}
          selectedIds={selectedIds}
          registeredDivisionIds={registeredDivisionIds}
          removedDivisionIds={removedDivisionIds}
          onToggle={onToggle}
          disabled={disabled}
        />
        {hasSelected ? (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {selectedIds.map((id) => {
              const level = getDivision(id)
              if (!level) return null
              return (
                <Badge
                  key={id}
                  variant="secondary"
                  className="pl-2 pr-1 py-1 gap-1"
                >
                  {level.label}
                  <button
                    type="button"
                    onClick={() => onToggle(id, false)}
                    className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                    disabled={disabled}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mt-3">
            Select at least one division to continue
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── shared form sections ───────────────────────────────────────────────────

export function AffiliateSection({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  disabled: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Affiliate</CardTitle>
        <CardDescription>
          Select your gym or affiliate. Choose "Independent" if you don't train
          at a gym.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label>Affiliate *</Label>
          <AffiliateCombobox
            value={value}
            onChange={onChange}
            placeholder="Search or select affiliate..."
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            Your gym or affiliate name will be displayed on leaderboards
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export function RegistrationQuestionsSection({
  questions,
  answers,
  onAnswerChange,
  disabled,
}: {
  questions: RegistrationQuestion[]
  answers: Array<{ questionId: string; answer: string }>
  onAnswerChange: (questionId: string, value: string) => void
  disabled: boolean
}) {
  if (questions.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Registration Questions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {questions.map((question) => {
          const answer = answers.find((a) => a.questionId === question.id)
          return (
            <div key={question.id} className="space-y-2">
              <Label>
                {question.label}
                {question.required && (
                  <span className="text-destructive"> *</span>
                )}
              </Label>
              {question.type === "select" ? (
                <Select
                  onValueChange={(val) => onAnswerChange(question.id, val)}
                  value={answer?.answer || undefined}
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    {question.options?.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : question.type === "number" ? (
                <Input
                  type="number"
                  value={answer?.answer ?? ""}
                  onChange={(e) => onAnswerChange(question.id, e.target.value)}
                  disabled={disabled}
                />
              ) : (
                <Input
                  value={answer?.answer ?? ""}
                  onChange={(e) => onAnswerChange(question.id, e.target.value)}
                  disabled={disabled}
                />
              )}
              {question.helpText && (
                <p className="text-xs text-muted-foreground">
                  {question.helpText}
                </p>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

export function FeeSummarySection({
  competitionId,
  selectedDivisionIds,
  getDivision,
  divisionFees,
  onFeesLoaded,
  activeCoupon,
}: {
  competitionId: string
  selectedDivisionIds: string[]
  getDivision: (id: string) => ScalingLevel | undefined
  divisionFees: Map<string, number>
  onFeesLoaded: (
    divisionId: string,
    fees: { isFree: boolean; totalChargeCents?: number } | null,
  ) => void
  activeCoupon: { code: string; amountOffCents: number } | null
}) {
  if (selectedDivisionIds.length === 0) return null
  const isMulti = selectedDivisionIds.length > 1
  return (
    <Card>
      <CardHeader>
        <CardTitle>Registration Fee{isMulti ? "s" : ""}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {selectedDivisionIds.map((divisionId) => {
          const division = getDivision(divisionId)
          const hideDivTotal = isMulti || !!activeCoupon
          return (
            <div key={divisionId}>
              {isMulti && (
                <p className="text-sm font-medium mb-1">
                  {division?.label ?? "Division"}
                </p>
              )}
              <FeeBreakdown
                competitionId={competitionId}
                divisionId={divisionId}
                hideTotal={hideDivTotal}
                onFeesLoaded={onFeesLoaded}
              />
            </div>
          )
        })}
        {divisionFees.size > 0
          ? (() => {
              const subtotal = Array.from(divisionFees.values()).reduce(
                (sum, c) => sum + c,
                0,
              )
              if (!activeCoupon) {
                if (!isMulti) return null
                return (
                  <div className="flex justify-between font-medium pt-2 border-t">
                    <span>Total</span>
                    <span className="text-lg">
                      ${(subtotal / 100).toFixed(2)}
                    </span>
                  </div>
                )
              }
              const discount = Math.min(activeCoupon.amountOffCents, subtotal)
              const total = subtotal - discount
              return (
                <>
                  {isMulti && (
                    <div className="flex justify-between text-sm pt-2 border-t">
                      <span>Subtotal</span>
                      <span>${(subtotal / 100).toFixed(2)}</span>
                    </div>
                  )}
                  <div
                    className={cn(
                      "flex justify-between text-sm text-emerald-700 dark:text-emerald-400",
                      !isMulti && "pt-2 border-t",
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5" />
                      Coupon ({activeCoupon.code})
                    </span>
                    <span>-${(discount / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-medium pt-2 border-t">
                    <span>Total</span>
                    <span className="text-lg">${(total / 100).toFixed(2)}</span>
                  </div>
                </>
              )
            })()
          : null}
      </CardContent>
    </Card>
  )
}

export function TeamDetailsSection({
  selectedTeamDivisions,
  teamEntries,
  updateTeamEntry,
  updateTeammate,
  userFirstName,
  userLastName,
  userEmail,
  disabled,
}: {
  selectedTeamDivisions: ScalingLevel[]
  teamEntries: Map<string, TeamEntry>
  updateTeamEntry: (
    divisionId: string,
    field: "teamName",
    value: string,
  ) => void
  updateTeammate: (
    divisionId: string,
    index: number,
    field: keyof Teammate,
    value: string,
  ) => void
  userFirstName?: string | null
  userLastName?: string | null
  userEmail?: string | null
  disabled: boolean
}) {
  if (selectedTeamDivisions.length === 0) return null
  return (
    <>
      {selectedTeamDivisions.map((division) => {
        const teamEntry = teamEntries.get(division.id)
        if (!teamEntry) return null
        return (
          <Card key={division.id}>
            <CardHeader>
              <CardTitle>
                Team Details
                {selectedTeamDivisions.length > 1 && (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    - {division.label}
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Enter your team name and invite your teammates for{" "}
                {division.label} ({division.teamSize} athletes)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Team Name *</Label>
                <Input
                  placeholder="Enter your team name"
                  value={teamEntry.teamName}
                  onChange={(e) =>
                    updateTeamEntry(division.id, "teamName", e.target.value)
                  }
                  disabled={disabled}
                />
                <p className="text-xs text-muted-foreground">
                  This will be displayed on leaderboards
                </p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Teammates</h4>
                  <Badge variant="outline">
                    {teamEntry.teammates.length + 1} of {division.teamSize}{" "}
                    added
                  </Badge>
                </div>
                <Card className="p-4 bg-muted/50">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">Teammate 1 (You)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">
                          First Name
                        </Label>
                        <Input
                          value={userFirstName || ""}
                          disabled
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Last Name</Label>
                        <Input
                          value={userLastName || ""}
                          disabled
                          className="mt-1.5"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Email</Label>
                      <Input
                        value={userEmail || ""}
                        disabled
                        className="mt-1.5"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Update your profile to change this information.
                    </p>
                  </div>
                </Card>
                {teamEntry.teammates.map((teammate, index) => (
                  <Card
                    key={`${division.id}-teammate-${index}`}
                    className="p-4"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">
                          Teammate {index + 2}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <Label>Email *</Label>
                        <Input
                          type="email"
                          placeholder="teammate@email.com"
                          value={teammate.email}
                          onChange={(e) =>
                            updateTeammate(
                              division.id,
                              index,
                              "email",
                              e.target.value,
                            )
                          }
                          disabled={disabled}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>First Name</Label>
                          <Input
                            placeholder="First name"
                            value={teammate.firstName}
                            onChange={(e) =>
                              updateTeammate(
                                division.id,
                                index,
                                "firstName",
                                e.target.value,
                              )
                            }
                            disabled={disabled}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Last Name</Label>
                          <Input
                            placeholder="Last name"
                            value={teammate.lastName}
                            onChange={(e) =>
                              updateTeammate(
                                division.id,
                                index,
                                "lastName",
                                e.target.value,
                              )
                            }
                            disabled={disabled}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Affiliate (Optional)</Label>
                        <AffiliateCombobox
                          value={teammate.affiliateName}
                          onChange={(val) =>
                            updateTeammate(
                              division.id,
                              index,
                              "affiliateName",
                              val,
                            )
                          }
                          placeholder="Search or enter affiliate..."
                          disabled={disabled}
                        />
                      </div>
                    </div>
                  </Card>
                ))}
                <p className="text-sm text-muted-foreground">
                  Teammates will receive an email invitation to join your team.
                  They must accept the invite to complete their registration.
                </p>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </>
  )
}

export function WaiversSection({
  waivers,
  agreedWaivers,
  onWaiverToggle,
  disabled,
}: {
  waivers: Waiver[]
  agreedWaivers: Set<string>
  onWaiverToggle: (waiverId: string, checked: boolean) => void
  disabled: boolean
}) {
  if (waivers.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Waivers & Agreements</CardTitle>
        <CardDescription>
          Please review and agree to the following waivers to complete your
          registration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {waivers.map((waiver) => (
          <div key={waiver.id} className="space-y-4">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">{waiver.title}</h4>
              {waiver.required && (
                <Badge variant="destructive" className="text-xs">
                  Required
                </Badge>
              )}
            </div>
            <div className="border rounded-lg p-4 max-h-64 overflow-y-auto bg-muted/10">
              <WaiverViewer
                content={waiver.content}
                className="prose prose-sm max-w-none dark:prose-invert"
              />
            </div>
            <div className="flex items-start gap-3 p-4 bg-muted/20 rounded-lg">
              <Checkbox
                id={`waiver-${waiver.id}`}
                checked={agreedWaivers.has(waiver.id)}
                onCheckedChange={(checked) =>
                  onWaiverToggle(waiver.id, checked === true)
                }
                disabled={disabled}
              />
              <Label
                htmlFor={`waiver-${waiver.id}`}
                className="text-sm font-medium leading-none cursor-pointer"
              >
                I have read and agree to this waiver
                {waiver.required && (
                  <span className="text-destructive ml-1">*</span>
                )}
              </Label>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
