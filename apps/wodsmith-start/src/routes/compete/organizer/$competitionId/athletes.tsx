/**
 * Organizer Athletes Page
 * Port from apps/wodsmith/src/app/(compete)/compete/organizer/[competitionId]/(with-sidebar)/athletes/page.tsx
 *
 * This file uses top-level imports for server-only modules.
 */
// @lat: [[organizer-dashboard#Registrations (Athletes)]]

import {
  createFileRoute,
  getRouteApi,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  Download,
  Link2,
  Mail,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react"
import React, { useState } from "react"
import { toast } from "sonner"
import { z } from "zod"
import { RegistrationQuestionsEditor } from "@/components/competition-settings/registration-questions-editor"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pagination } from "@/components/pagination"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { INVITATION_STATUS } from "@/db/schemas/teams"
import {
  getOrganizerRegistrationsFn,
  getPendingTeammateInvitationsFn,
  type PendingTeammateInvite,
} from "@/server-fns/competition-detail-fns"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import { removeRegistrationFn } from "@/server-fns/registration-fns"
import { ManualRegistrationDialog } from "./-components/manual-registration-dialog"
import {
  cancelPurchaseTransferFn,
  getPendingTransfersForCompetitionFn,
} from "@/server-fns/purchase-transfer-fns"
import { TransferDivisionDialog } from "./-components/transfer-division-dialog"
import { TransferRegistrationDialog } from "./-components/transfer-registration-dialog"
import {
  getCompetitionQuestionsFn,
  getCompetitionRegistrationAnswersFn,
} from "@/server-fns/registration-questions-fns"
import {
  getCompetitionWaiverSignaturesFn,
  getCompetitionWaiversFn,
} from "@/server-fns/waiver-fns"

const parentRoute = getRouteApi("/compete/organizer/$competitionId")

const sortColumns = [
  "name",
  "division",
  "teamName",
  "affiliate",
  "registeredAt",
  "joinedAt",
] as const
type SortColumn = (typeof sortColumns)[number]
type SortDirection = "asc" | "desc"

const DEFAULT_PAGE_SIZE = 100
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500]
// Sentinel value for the Affiliate filter indicating "athletes without an affiliate"
const NO_AFFILIATE_FILTER = "__none__"

const athletesSearchSchema = z.object({
  tab: z
    .enum(["athletes", "registration-rules"])
    .optional()
    .default("athletes"),
  division: z.string().optional(),
  // Free-text search over athlete name, email, and team name
  q: z.string().optional(),
  // Affiliate filter: either an affiliate name, the NO_AFFILIATE_FILTER sentinel, or undefined for all
  affiliate: z.string().optional(),
  // questionFilters: { questionId: ["value1", "value2"] }
  questionFilters: z.record(z.string(), z.array(z.string())).optional(),
  // waiverFilters: ["waiverId:signed", "waiverId:unsigned"]
  waiverFilters: z.array(z.string()).optional(),
  // Sorting
  sortBy: z.enum(sortColumns).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  // Pagination
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(1000).optional(),
})

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/athletes",
)({
  staleTime: 10_000,
  component: AthletesPage,
  validateSearch: athletesSearchSchema,
  loaderDeps: ({ search }) => ({
    division: search?.division,
    questionFilters: search?.questionFilters,
    waiverFilters: search?.waiverFilters,
    sortBy: search?.sortBy,
    sortDir: search?.sortDir,
  }),
  loader: async ({ params, deps, parentMatchPromise }) => {
    const { competitionId } = params
    const divisionFilter = deps?.division

    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    // Parallel fetch: registrations, divisions, questions, answers, waivers, signatures, pending invites, and pending transfers
    const [
      registrationsResult,
      divisionsResult,
      questionsResult,
      answersResult,
      waiversResult,
      signaturesResult,
      pendingInvitesResult,
      pendingTransfersResult,
    ] = await Promise.all([
      getOrganizerRegistrationsFn({
        data: { competitionId, divisionFilter },
      }),
      getCompetitionDivisionsWithCountsFn({
        data: { competitionId, teamId: competition.organizingTeamId },
      }),
      getCompetitionQuestionsFn({
        data: { competitionId },
      }),
      getCompetitionRegistrationAnswersFn({
        data: { competitionId, teamId: competition.organizingTeamId },
      }),
      getCompetitionWaiversFn({
        data: { competitionId },
      }),
      getCompetitionWaiverSignaturesFn({
        data: { competitionId, teamId: competition.organizingTeamId },
      }),
      getPendingTeammateInvitationsFn({
        data: { competitionId },
      }),
      getPendingTransfersForCompetitionFn({
        data: { competitionId },
      }),
    ])

    return {
      registrations: registrationsResult.registrations,
      divisions: divisionsResult.divisions,
      questions: questionsResult.questions,
      answersByRegistration: answersResult.answersByRegistration,
      waivers: waiversResult.waivers,
      signaturesByUser: signaturesResult.signatures.reduce(
        (acc, sig) => {
          const key = `${sig.userId}-${sig.waiverId}`
          acc[key] = sig.signedAt
          return acc
        },
        {} as Record<string, Date>,
      ),
      pendingInvites: pendingInvitesResult.pendingInvites,
      pendingTransfers: pendingTransfersResult,
      currentDivisionFilter: divisionFilter,
      currentQuestionFilters: deps?.questionFilters || {},
      currentWaiverFilters: deps?.waiverFilters || [],
      currentSortBy: deps?.sortBy as SortColumn | undefined,
      currentSortDir: deps?.sortDir as SortDirection | undefined,
      teamId: competition.organizingTeamId,
    }
  },
})

function AthletesPage() {
  const { competition } = parentRoute.useLoaderData()
  const {
    registrations,
    divisions,
    questions,
    answersByRegistration,
    waivers,
    signaturesByUser,
    pendingInvites,
    pendingTransfers,
    currentDivisionFilter,
    currentQuestionFilters,
    currentWaiverFilters,
    currentSortBy,
    currentSortDir,
    teamId,
  } = Route.useLoaderData()
  const navigate = useNavigate()
  const router = useRouter()
  const search = Route.useSearch()
  const { tab } = search
  const currentSearchQuery = search.q ?? ""
  const currentAffiliateFilter = search.affiliate
  const currentPage = search.page ?? 1
  const currentPageSize = search.pageSize ?? DEFAULT_PAGE_SIZE
  const handleTabChange = (value: string) => {
    navigate({
      to: ".",
      search: (prev) => ({
        ...prev,
        tab: value as "athletes" | "registration-rules",
      }),
      replace: true,
    })
  }
  const removeRegistration = useServerFn(removeRegistrationFn)
  const cancelPurchaseTransfer = useServerFn(cancelPurchaseTransferFn)
  const [removingRegistration, setRemovingRegistration] = useState<{
    id: string
    athleteName: string
    teamName: string | null
  } | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const [showManualRegistration, setShowManualRegistration] = useState(false)
  const [transferTarget, setTransferTarget] = useState<{
    id: string
    athleteName: string
    userId: string
    divisionId: string | null
    divisionLabel: string | null
    teamSize: number
  } | null>(null)
  const [transferRegistrationTarget, setTransferRegistrationTarget] = useState<{
    id: string
    athleteName: string
    divisionId: string | null
    divisionLabel: string | null
    commercePurchaseId: string | null
  } | null>(null)

  const handleQuestionsChange = () => {
    router.invalidate()
  }

  const handleCancelTransfer = async (transferId: string) => {
    try {
      await cancelPurchaseTransfer({ data: { transferId } })
      toast.success("Transfer cancelled successfully")
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel transfer",
      )
    }
  }

  const handleRemoveRegistration = async () => {
    if (!removingRegistration) return
    setIsRemoving(true)
    try {
      await removeRegistration({
        data: {
          registrationId: removingRegistration.id,
          competitionId: competition.id,
        },
      })
      toast.success("Registration removed successfully")
      setRemovingRegistration(null)
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to remove registration",
      )
    } finally {
      setIsRemoving(false)
    }
  }

  const handleDivisionChange = (value: string) => {
    navigate({
      to: ".",
      search: (prev) => ({
        ...prev,
        division: value === "all" ? undefined : value,
        page: undefined,
      }),
      resetScroll: false,
    })
  }

  const handleAffiliateChange = (value: string) => {
    navigate({
      to: ".",
      search: (prev) => ({
        ...prev,
        affiliate: value === "all" ? undefined : value,
        page: undefined,
      }),
      resetScroll: false,
    })
  }

  const handleSearchChange = (value: string) => {
    navigate({
      to: ".",
      search: (prev) => ({
        ...prev,
        q: value.trim() === "" ? undefined : value,
        page: undefined,
      }),
      replace: true,
      resetScroll: false,
    })
  }

  const handlePageSizeChange = (value: string) => {
    const parsed = Number(value)
    navigate({
      to: ".",
      search: (prev) => ({
        ...prev,
        pageSize: Number.isFinite(parsed) ? parsed : undefined,
        page: undefined,
      }),
      resetScroll: false,
    })
  }

  const buildPaginationSearchParams = (page: number) => ({
    ...search,
    page,
  })

  // Toggle a question filter value (add if not present, remove if present)
  const toggleQuestionFilter = (questionId: string, value: string) => {
    navigate({
      to: ".",
      search: (prev) => {
        const newFilters = { ...prev.questionFilters }
        const currentValues = newFilters[questionId] || []

        if (currentValues.includes(value)) {
          // Remove the value
          const filtered = currentValues.filter((v) => v !== value)
          if (filtered.length === 0) {
            delete newFilters[questionId]
          } else {
            newFilters[questionId] = filtered
          }
        } else {
          // Add the value
          newFilters[questionId] = [...currentValues, value]
        }

        return {
          ...prev,
          questionFilters:
            Object.keys(newFilters).length > 0 ? newFilters : undefined,
          page: undefined,
        }
      },
      resetScroll: false,
    })
  }

  // Remove a specific question filter value
  const removeQuestionFilter = (questionId: string, value: string) => {
    navigate({
      to: ".",
      search: (prev) => {
        const newFilters = { ...prev.questionFilters }
        const currentValues = newFilters[questionId] || []
        const filtered = currentValues.filter((v) => v !== value)

        if (filtered.length === 0) {
          delete newFilters[questionId]
        } else {
          newFilters[questionId] = filtered
        }

        return {
          ...prev,
          questionFilters:
            Object.keys(newFilters).length > 0 ? newFilters : undefined,
          page: undefined,
        }
      },
      resetScroll: false,
    })
  }

  // Toggle a waiver filter (add if not present, remove if present)
  const toggleWaiverFilter = (filterValue: string) => {
    navigate({
      to: ".",
      search: (prev) => {
        const currentFilters = prev.waiverFilters || []

        if (currentFilters.includes(filterValue)) {
          const filtered = currentFilters.filter((v) => v !== filterValue)
          return {
            ...prev,
            waiverFilters: filtered.length > 0 ? filtered : undefined,
            page: undefined,
          }
        } else {
          return {
            ...prev,
            waiverFilters: [...currentFilters, filterValue],
            page: undefined,
          }
        }
      },
      resetScroll: false,
    })
  }

  // Remove a specific waiver filter
  const removeWaiverFilter = (filterValue: string) => {
    navigate({
      to: ".",
      search: (prev) => {
        const filtered = (prev.waiverFilters || []).filter(
          (v) => v !== filterValue,
        )
        return {
          ...prev,
          waiverFilters: filtered.length > 0 ? filtered : undefined,
          page: undefined,
        }
      },
      resetScroll: false,
    })
  }

  // Handle column sorting
  const handleSort = (column: SortColumn) => {
    navigate({
      to: ".",
      search: (prev) => {
        // If clicking the same column, toggle direction or clear
        if (prev.sortBy === column) {
          if (prev.sortDir === "asc") {
            return { ...prev, sortDir: "desc" as const, page: undefined }
          }
          // Clear sort
          return {
            ...prev,
            sortBy: undefined,
            sortDir: undefined,
            page: undefined,
          }
        }
        // New column, default to ascending
        return {
          ...prev,
          sortBy: column,
          sortDir: "asc" as const,
          page: undefined,
        }
      },
      resetScroll: false,
    })
  }

  // Render sort icon for a column header
  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (currentSortBy !== column) {
      return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-50" />
    }
    return currentSortDir === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 ml-1" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 ml-1" />
    )
  }

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const getInitials = (firstName: string | null, lastName: string | null) => {
    const first = firstName?.[0] || ""
    const last = lastName?.[0] || ""
    return (first + last).toUpperCase() || "?"
  }

  // Get initials from a full name string (e.g., "John Doe" -> "JD")
  const getInitialsFromName = (fullName: string | null | undefined) => {
    if (!fullName) return "?"
    const parts = fullName.trim().split(/\s+/)
    const first = parts[0]?.[0] || ""
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : ""
    return (first + last).toUpperCase() || "?"
  }

  const getAnswersForUser = (registrationId: string, userId: string) => {
    const answers = answersByRegistration[registrationId] || []
    return answers.filter((a) => a.userId === userId)
  }

  // Athlete status: 'registered' = has account, 'pending' = invited but not responded, 'accepted' = guest accepted (submitted form)
  type AthleteStatus = "registered" | "pending" | "accepted"

  // Flatten registrations into individual athlete rows
  type AthleteRow = {
    ordinal: number
    ordinalLabel: string
    registrationId: string
    registrationStatus: string // 'active' | 'removed'
    commercePurchaseId: string | null
    athlete: {
      id: string
      firstName: string | null
      lastName: string | null
      email: string | null
      avatar: string | null
      affiliateName: string | null
    }
    isCaptain: boolean
    status: AthleteStatus // 'registered' = has account, 'pending' = invited, 'accepted' = guest accepted
    pendingInvite?: PendingTeammateInvite // For accessing pending answers (when status is 'pending' or 'accepted')
    division: { id: string; label: string; teamSize: number } | null
    teamName: string | null
    registeredAt: Date | string | null
    joinedAt: Date | null
  }

  const athleteRows: AthleteRow[] = []
  let rowIndex = 0
  registrations.forEach((registration) => {
    rowIndex++
    const isTeamDivision = (registration.division?.teamSize ?? 1) > 1

    // Type assertion for nested relations
    const athleteTeamWithMemberships = registration.athleteTeam as {
      memberships?: Array<{
        id: string
        userId: string
        joinedAt: Date | null
        user?: {
          id: string
          firstName: string | null
          lastName: string | null
          email: string | null
          avatar: string | null
        } | null
      }>
    } | null

    // Get all team members (captain first, then teammates)
    const allMembers: Array<{
      user: NonNullable<
        NonNullable<typeof athleteTeamWithMemberships>["memberships"]
      >[number]["user"]
      isCaptain: boolean
      joinedAt: Date | null
    }> = []

    // Add captain first
    if (registration.user) {
      allMembers.push({
        user: registration.user,
        isCaptain: true,
        joinedAt: null,
      })
    }

    // Add teammates
    if (isTeamDivision && athleteTeamWithMemberships?.memberships) {
      athleteTeamWithMemberships.memberships
        .filter((m) => m.userId !== registration.userId && m.user)
        .forEach((m) => {
          allMembers.push({
            user: m.user!,
            isCaptain: false,
            joinedAt: m.joinedAt,
          })
        })
    }

    // Parse registration metadata for per-user affiliates
    let registrationMetadata: Record<string, unknown> | null = null
    if (registration.metadata) {
      if (typeof registration.metadata === "string") {
        try {
          registrationMetadata = JSON.parse(registration.metadata)
        } catch {
          // Invalid JSON, fall back to null
        }
      } else {
        registrationMetadata = registration.metadata as Record<string, unknown>
      }
    }
    const metadataAffiliates =
      registrationMetadata?.affiliates as Record<string, string | null> | undefined

    // Create a row for each member
    allMembers.forEach((member, memberIndex) => {
      const userId = member.user?.id ?? ""
      // Prefer affiliate from registration metadata, fall back to user profile
      const affiliateName =
        metadataAffiliates?.[userId] ??
        (member.user as { affiliateName?: string | null })?.affiliateName ??
        null

      athleteRows.push({
        registrationId: registration.id,
        registrationStatus: registration.status,
        commercePurchaseId:
          (registration as { commercePurchaseId?: string | null })
            ?.commercePurchaseId ?? null,
        ordinal: rowIndex,
        ordinalLabel: memberIndex === 0 ? String(rowIndex) : "",
        athlete: {
          id: userId,
          firstName: member.user?.firstName ?? null,
          lastName: member.user?.lastName ?? null,
          email: member.user?.email ?? null,
          avatar: member.user?.avatar ?? null,
          affiliateName,
        },
        isCaptain: member.isCaptain,
        status: "registered",
        division: registration.division,
        teamName: isTeamDivision ? registration.teamName : null,
        registeredAt: member.isCaptain ? registration.registeredAt : null,
        joinedAt: member.joinedAt,
      })
    })

    // Add pending/accepted invites for this registration's athlete team
    if (isTeamDivision && registration.athleteTeam) {
      const teamPendingInvites = pendingInvites.filter(
        (inv) =>
          inv.athleteTeamId ===
          (registration.athleteTeam as { id?: string })?.id,
      )
      teamPendingInvites.forEach((invite) => {
        // Map invitation status to athlete row status
        const athleteStatus: AthleteStatus =
          invite.status === INVITATION_STATUS.ACCEPTED ? "accepted" : "pending"

        athleteRows.push({
          registrationId: registration.id,
          registrationStatus: registration.status,
          commercePurchaseId: null,
          ordinal: rowIndex,
          ordinalLabel: "",
          athlete: {
            id: `pending-${invite.id}`,
            firstName: null,
            lastName: null,
            email: invite.email,
            avatar: null,
            affiliateName: null,
          },
          isCaptain: false,
          status: athleteStatus,
          pendingInvite: invite,
          division: registration.division,
          teamName: registration.teamName,
          registeredAt: null,
          joinedAt: null,
        })
      })
    }
  })

  // Get waiver signed date for a user
  const getWaiverSignedDate = (
    userId: string,
    waiverId: string,
  ): Date | null => {
    const key = `${userId}-${waiverId}`
    return signaturesByUser[key] || null
  }

  // Get unique answer values for each question (for filters)
  const questionFilterOptions = questions.reduce(
    (acc, question) => {
      const values = new Set<string>()
      Object.values(answersByRegistration).forEach((answers) => {
        answers.forEach((a) => {
          if (a.questionId === question.id && a.answer) {
            values.add(a.answer)
          }
        })
      })
      acc[question.id] = Array.from(values).sort()
      return acc
    },
    {} as Record<string, string[]>,
  )

  // Unique affiliate options derived from all flattened rows
  const affiliateOptions = (() => {
    const names = new Set<string>()
    for (const row of athleteRows) {
      if (row.athlete.affiliateName) {
        names.add(row.athlete.affiliateName)
      }
    }
    return Array.from(names).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    )
  })()

  const normalizedSearchQuery = currentSearchQuery.trim().toLowerCase()

  // Filter athlete rows based on search query, affiliate, question, and waiver filters
  const filteredAthleteRows = athleteRows.filter((row) => {
    // Apply free-text search over name, guest name, email, and team name
    if (normalizedSearchQuery) {
      const fullName = `${row.athlete.firstName ?? ""} ${row.athlete.lastName ?? ""}`
        .trim()
        .toLowerCase()
      const guestName = row.pendingInvite?.guestName?.toLowerCase() ?? ""
      const email = row.athlete.email?.toLowerCase() ?? ""
      const team = row.teamName?.toLowerCase() ?? ""
      if (
        !fullName.includes(normalizedSearchQuery) &&
        !guestName.includes(normalizedSearchQuery) &&
        !email.includes(normalizedSearchQuery) &&
        !team.includes(normalizedSearchQuery)
      ) {
        return false
      }
    }

    // Apply affiliate filter
    if (currentAffiliateFilter) {
      if (currentAffiliateFilter === NO_AFFILIATE_FILTER) {
        if (row.athlete.affiliateName) return false
      } else if (row.athlete.affiliateName !== currentAffiliateFilter) {
        return false
      }
    }

    // Apply question filters (match ANY of the selected values per question)
    for (const [questionId, filterValues] of Object.entries(
      currentQuestionFilters,
    )) {
      if (filterValues && filterValues.length > 0) {
        const answers = getAnswersForUser(row.registrationId, row.athlete.id)
        const answer = answers.find((a) => a.questionId === questionId)
        if (!answer?.answer || !filterValues.includes(answer.answer)) {
          return false
        }
      }
    }

    // Apply waiver filters (match ANY of the selected waiver conditions - OR logic)
    if (currentWaiverFilters.length > 0) {
      const matchesAnyWaiverFilter = currentWaiverFilters.some(
        (waiverFilter) => {
          const [waiverId, status] = waiverFilter.split(":")
          const signedDate = getWaiverSignedDate(row.athlete.id, waiverId)
          if (status === "signed") return !!signedDate
          if (status === "unsigned") return !signedDate
          return false
        },
      )
      if (!matchesAnyWaiverFilter) return false
    }

    return true
  })

  // Sort filtered rows — removed registrations always at the bottom
  const sortedAthleteRows = [...filteredAthleteRows].sort((a, b) => {
    // Always sort removed to bottom
    const aRemoved = a.registrationStatus === "removed"
    const bRemoved = b.registrationStatus === "removed"
    if (aRemoved !== bRemoved) return aRemoved ? 1 : -1

    if (!currentSortBy) return 0

    const direction = currentSortDir === "desc" ? -1 : 1

    switch (currentSortBy) {
      case "name": {
        const nameA = `${a.athlete.firstName ?? ""} ${a.athlete.lastName ?? ""}`
          .toLowerCase()
          .trim()
        const nameB = `${b.athlete.firstName ?? ""} ${b.athlete.lastName ?? ""}`
          .toLowerCase()
          .trim()
        return nameA.localeCompare(nameB) * direction
      }
      case "division": {
        const divA = a.division?.label?.toLowerCase() ?? ""
        const divB = b.division?.label?.toLowerCase() ?? ""
        return divA.localeCompare(divB) * direction
      }
      case "teamName": {
        const teamA = a.teamName?.toLowerCase() ?? ""
        const teamB = b.teamName?.toLowerCase() ?? ""
        return teamA.localeCompare(teamB) * direction
      }
      case "affiliate": {
        const affA = a.athlete.affiliateName?.toLowerCase() ?? ""
        const affB = b.athlete.affiliateName?.toLowerCase() ?? ""
        return affA.localeCompare(affB) * direction
      }
      case "registeredAt": {
        const dateA = a.registeredAt ? new Date(a.registeredAt).getTime() : 0
        const dateB = b.registeredAt ? new Date(b.registeredAt).getTime() : 0
        return (dateA - dateB) * direction
      }
      case "joinedAt": {
        const dateA = a.joinedAt ? new Date(a.joinedAt).getTime() : 0
        const dateB = b.joinedAt ? new Date(b.joinedAt).getTime() : 0
        return (dateA - dateB) * direction
      }
      default:
        return 0
    }
  })

  // Compute pagination slice from the fully filtered + sorted rows.
  // The unpaginated sortedAthleteRows are still used for CSV export below.
  const totalFilteredCount = sortedAthleteRows.length
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / currentPageSize))
  const clampedPage = Math.min(Math.max(1, currentPage), totalPages)
  const pageStartIndex = (clampedPage - 1) * currentPageSize
  const paginatedAthleteRows = sortedAthleteRows.slice(
    pageStartIndex,
    pageStartIndex + currentPageSize,
  )

  const handleExportCSV = () => {
    // Build CSV header
    const headers = [
      "#",
      "Athlete Name",
      "Email",
      "Division",
      "Team Name",
      "Affiliate",
      "Registered",
      "Joined",
    ]
    questions.forEach((q) => headers.push(q.label))
    waivers.forEach((w) => headers.push(`${w.title} (Signed)`))

    // Build CSV rows from sorted athlete rows
    const rows = sortedAthleteRows.map((row) => {
      // Format name based on status
      let athleteName: string
      if (row.status === "pending") {
        athleteName = `(Pending) ${row.athlete.email}`
      } else if (row.status === "accepted") {
        // Use guest name if available for accepted invites
        athleteName =
          row.pendingInvite?.guestName || `(Accepted) ${row.athlete.email}`
      } else {
        athleteName =
          `${row.athlete.firstName ?? ""} ${row.athlete.lastName ?? ""}`.trim()
      }

      const csvRow = [
        row.ordinalLabel,
        athleteName,
        row.athlete.email ?? "",
        row.division?.label ?? "",
        row.teamName ?? "",
        row.athlete.affiliateName ?? "",
        row.registeredAt ? formatDate(row.registeredAt) : "",
        row.joinedAt ? formatDate(row.joinedAt) : "",
      ]

      // Add answer columns - check pending answers for pending/accepted invites
      if (row.status !== "registered" && row.pendingInvite) {
        questions.forEach((question) => {
          const pendingAnswer = row.pendingInvite?.pendingAnswers?.find(
            (a) => a.questionId === question.id,
          )
          csvRow.push(pendingAnswer?.answer ?? "")
        })
      } else {
        const answers = getAnswersForUser(row.registrationId, row.athlete.id)
        questions.forEach((question) => {
          const answer = answers.find((a) => a.questionId === question.id)
          csvRow.push(answer?.answer ?? "")
        })
      }

      // Add waiver columns - check pending signatures for pending/accepted invites
      if (row.status !== "registered" && row.pendingInvite) {
        waivers.forEach((waiver) => {
          const pendingSig = row.pendingInvite?.pendingSignatures?.find(
            (s) => s.waiverId === waiver.id,
          )
          csvRow.push(
            pendingSig ? formatDate(pendingSig.signedAt) : "Not signed",
          )
        })
      } else {
        waivers.forEach((waiver) => {
          const signedDate = getWaiverSignedDate(row.athlete.id, waiver.id)
          csvRow.push(signedDate ? formatDate(signedDate) : "Not signed")
        })
      }

      return csvRow
    })

    // Sanitize cell value to prevent CSV injection (formula characters)
    const sanitizeCell = (value: string): string => {
      const escaped = value.replace(/"/g, '""')
      // Prefix formula-triggering characters with a single quote to prevent spreadsheet injection
      return /^[=+\-@]/.test(escaped) ? `'${escaped}` : escaped
    }

    // Generate CSV content
    const csvContent = [
      headers.map((h) => `"${sanitizeCell(h)}"`).join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${sanitizeCell(String(cell))}"`).join(","),
      ),
    ].join("\n")

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute(
      "download",
      `${competition.slug}-athletes-${new Date().toISOString().split("T")[0]}.csv`,
    )
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="athletes">Athletes</TabsTrigger>
          <TabsTrigger value="registration-rules">
            Registration Rules
          </TabsTrigger>
        </TabsList>
        <TabsContent value="registration-rules" className="flex flex-col gap-6">
          {/* Inherited Series Questions (read-only) */}
          {questions.some((q) => q.source === "series") && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Series Registration Questions
                </CardTitle>
                <CardDescription>
                  These questions are inherited from the series and apply to all
                  competitions.{" "}
                  {competition.groupId && (
                    <Link
                      to="/compete/organizer/series/$groupId"
                      params={{ groupId: competition.groupId }}
                      className="text-primary underline underline-offset-4 hover:text-primary/80"
                    >
                      Manage on series page
                    </Link>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {questions
                    .filter((q) => q.source === "series")
                    .map((question) => (
                      <div
                        key={question.id}
                        className="flex items-start gap-3 p-4 border rounded-lg bg-muted/50"
                      >
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium">{question.label}</h4>
                            <Badge
                              variant="outline"
                              className="flex items-center gap-1 shrink-0"
                            >
                              <Link2 className="h-3 w-3" />
                              From Series
                            </Badge>
                          </div>
                          {question.helpText && (
                            <p className="text-sm text-muted-foreground">
                              {question.helpText}
                            </p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary">{question.type}</Badge>
                            <Badge
                              variant={
                                question.required ? "destructive" : "outline"
                              }
                            >
                              {question.required ? "Required" : "Optional"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Competition-specific Registration Questions Editor */}
          <RegistrationQuestionsEditor
            entityType="competition"
            entityId={competition.id}
            teamId={teamId}
            questions={questions.filter((q) => q.source === "competition")}
            onQuestionsChange={handleQuestionsChange}
          />
        </TabsContent>

        <TabsContent value="athletes" className="flex flex-col gap-6">
          {/* Athletes Section */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Registered Athletes</h2>
              <p className="text-muted-foreground text-sm">
                {registrations.filter((r) => r.status === "active").length}{" "}
                registration
                {registrations.filter((r) => r.status === "active").length !== 1
                  ? "s"
                  : ""}
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                onClick={() => setShowManualRegistration(true)}
                size="sm"
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Registration
              </Button>
              {registrations.length > 0 && (
                <Button
                  onClick={handleExportCSV}
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              )}
            </div>
          </div>

          {registrations.length === 0 && !currentDivisionFilter ? (
            <Card>
              <CardHeader>
                <CardTitle>No Registrations</CardTitle>
                <CardDescription>
                  No athletes have registered for this competition yet.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Filters */}
              <div className="flex flex-col gap-3">
                {/* Search */}
                <div className="relative w-full sm:max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    value={currentSearchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Search by name, email, or team"
                    className="pl-9"
                    aria-label="Search athletes"
                  />
                </div>

                {/* Filter dropdowns */}
                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
                  {/* Division filter (single select) */}
                  <Select
                    value={currentDivisionFilter || "all"}
                    onValueChange={handleDivisionChange}
                  >
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="All Divisions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Divisions</SelectItem>
                      {divisions.map((division) => (
                        <SelectItem key={division.id} value={division.id}>
                          {division.label} ({division.registrationCount})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Affiliate filter (single select) */}
                  <Select
                    value={currentAffiliateFilter ?? "all"}
                    onValueChange={handleAffiliateChange}
                  >
                    <SelectTrigger className="w-full sm:w-[220px]">
                      <SelectValue placeholder="All Affiliates" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Affiliates</SelectItem>
                      <SelectItem value={NO_AFFILIATE_FILTER}>
                        None (no affiliate)
                      </SelectItem>
                      {affiliateOptions.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Question filters (multi-select via dropdown) */}
                  {questions.map((question) => {
                    const options = questionFilterOptions[question.id] || []
                    const selectedValues =
                      currentQuestionFilters[question.id] || []
                    const availableOptions = options.filter(
                      (o) => !selectedValues.includes(o),
                    )
                    if (options.length === 0 || availableOptions.length === 0)
                      return null
                    return (
                      <Select
                        key={question.id}
                        value="__placeholder__"
                        onValueChange={(value) => {
                          if (value !== "__placeholder__") {
                            toggleQuestionFilter(question.id, value)
                          }
                        }}
                      >
                        <SelectTrigger className="w-full sm:w-[180px]">
                          <span className="text-muted-foreground">
                            + {question.label}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            value="__placeholder__"
                            className="hidden"
                          >
                            Select...
                          </SelectItem>
                          {availableOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )
                  })}

                  {/* Waiver filter (multi-select via dropdown) */}
                  {waivers.length > 0 &&
                    (() => {
                      const availableWaiverOptions = waivers.flatMap(
                        (waiver) => {
                          const items = []
                          const signedKey = `${waiver.id}:signed`
                          const unsignedKey = `${waiver.id}:unsigned`
                          if (!currentWaiverFilters.includes(signedKey)) {
                            items.push({
                              key: signedKey,
                              label: `${waiver.title}: Signed`,
                            })
                          }
                          if (!currentWaiverFilters.includes(unsignedKey)) {
                            items.push({
                              key: unsignedKey,
                              label: `${waiver.title}: Not Signed`,
                            })
                          }
                          return items
                        },
                      )
                      if (availableWaiverOptions.length === 0) return null
                      return (
                        <Select
                          value="__placeholder__"
                          onValueChange={(value) => {
                            if (value !== "__placeholder__") {
                              toggleWaiverFilter(value)
                            }
                          }}
                        >
                          <SelectTrigger className="w-full sm:w-[200px]">
                            <span className="text-muted-foreground">
                              + Waiver Status
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem
                              value="__placeholder__"
                              className="hidden"
                            >
                              Select...
                            </SelectItem>
                            {availableWaiverOptions.map((option) => (
                              <SelectItem key={option.key} value={option.key}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )
                    })()}
                </div>

                {/* Active filter pills */}
                {(Object.keys(currentQuestionFilters).length > 0 ||
                  currentWaiverFilters.length > 0) && (
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Question filter pills */}
                    {Object.entries(currentQuestionFilters).flatMap(
                      ([questionId, values]) => {
                        const question = questions.find(
                          (q) => q.id === questionId,
                        )
                        if (!question || !values) return []
                        return values.map((value) => (
                          <Badge
                            key={`${questionId}-${value}`}
                            variant="secondary"
                            className="pl-2 pr-1 py-1 flex items-center gap-1"
                          >
                            <span className="text-xs text-muted-foreground">
                              {question.label}:
                            </span>
                            <span>{value}</span>
                            <button
                              type="button"
                              onClick={() =>
                                removeQuestionFilter(questionId, value)
                              }
                              className="ml-1 hover:bg-muted rounded-full p-0.5"
                              aria-label={`Remove filter ${question.label}: ${value}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))
                      },
                    )}

                    {/* Waiver filter pills */}
                    {currentWaiverFilters.map((filterValue) => {
                      const [waiverId, status] = filterValue.split(":")
                      const waiver = waivers.find((w) => w.id === waiverId)
                      if (!waiver) return null
                      return (
                        <Badge
                          key={filterValue}
                          variant="secondary"
                          className="pl-2 pr-1 py-1 flex items-center gap-1"
                        >
                          <span className="text-xs text-muted-foreground">
                            {waiver.title}:
                          </span>
                          <span>
                            {status === "signed" ? "Signed" : "Not Signed"}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeWaiverFilter(filterValue)}
                            className="ml-1 hover:bg-muted rounded-full p-0.5"
                            aria-label={`Remove waiver filter ${waiver.title}: ${status === "signed" ? "Signed" : "Not Signed"}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      )
                    })}
                  </div>
                )}
              </div>

              {sortedAthleteRows.length === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>No Registrations</CardTitle>
                    <CardDescription>
                      {registrations.length === 0
                        ? "No athletes are registered in this division."
                        : "No athletes match the current filters."}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                <>
                  {/* Mobile card view */}
                  <div className="flex flex-col gap-3 md:hidden">
                    {paginatedAthleteRows.map((row) => {
                      const isRowRemoved = row.registrationStatus === "removed"
                      return (
                        <Card
                          key={`mobile-${row.registrationId}-${row.athlete.id}`}
                          className={isRowRemoved ? "opacity-50" : ""}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="font-mono text-xs text-muted-foreground shrink-0">
                                  {row.ordinalLabel}
                                </span>
                                <Avatar className="h-8 w-8 shrink-0">
                                  <AvatarImage
                                    src={row.athlete.avatar ?? undefined}
                                    alt={`${row.athlete.firstName ?? ""} ${row.athlete.lastName ?? ""}`}
                                  />
                                  <AvatarFallback className="text-xs">
                                    {row.status === "accepted" &&
                                    row.pendingInvite?.guestName
                                      ? getInitialsFromName(
                                          row.pendingInvite.guestName,
                                        )
                                      : getInitials(
                                          row.athlete.firstName,
                                          row.athlete.lastName,
                                        )}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-medium truncate">
                                    {row.status === "pending" ? (
                                      <span className="italic text-muted-foreground">
                                        Invited
                                      </span>
                                    ) : row.status === "accepted" ? (
                                      row.pendingInvite?.guestName ? (
                                        <span>
                                          {row.pendingInvite.guestName}
                                        </span>
                                      ) : (
                                        <span className="italic text-muted-foreground">
                                          Invited
                                        </span>
                                      )
                                    ) : (
                                      <>
                                        {row.athlete.firstName ?? ""}{" "}
                                        {row.athlete.lastName ?? ""}
                                        {row.isCaptain && row.teamName && (
                                          <span className="text-xs text-muted-foreground ml-1">
                                            (captain)
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </span>
                                  <span className="text-xs text-muted-foreground truncate">
                                    {row.athlete.email}
                                  </span>
                                </div>
                              </div>
                              {row.isCaptain && !isRowRemoved && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 shrink-0"
                                      aria-label="Open registration actions"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => {
                                        const athleteName =
                                          `${row.athlete.firstName ?? ""} ${row.athlete.lastName ?? ""}`.trim() ||
                                          row.athlete.email ||
                                          "Unknown"
                                        setTransferTarget({
                                          id: row.registrationId,
                                          athleteName,
                                          userId: row.athlete.id,
                                          divisionId: row.division?.id ?? null,
                                          divisionLabel:
                                            row.division?.label ?? null,
                                          teamSize: row.division?.teamSize ?? 1,
                                        })
                                      }}
                                    >
                                      <ArrowRight className="h-4 w-4 mr-2" />
                                      Change Division
                                    </DropdownMenuItem>
                                    {(() => {
                                      const pendingTransfer =
                                        pendingTransfers.find(
                                          (t) =>
                                            t.purchaseId ===
                                            row.commercePurchaseId,
                                        )
                                      const athleteName =
                                        `${row.athlete.firstName ?? ""} ${row.athlete.lastName ?? ""}`.trim() ||
                                        row.athlete.email ||
                                        "Unknown"
                                      if (pendingTransfer) {
                                        return (
                                          <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            onClick={() =>
                                              handleCancelTransfer(
                                                pendingTransfer.id,
                                              )
                                            }
                                          >
                                            <X className="h-4 w-4 mr-2" />
                                            Cancel Transfer
                                          </DropdownMenuItem>
                                        )
                                      }
                                      return (
                                        <DropdownMenuItem
                                          onClick={() =>
                                            setTransferRegistrationTarget({
                                              id: row.registrationId,
                                              athleteName,
                                              divisionId:
                                                row.division?.id ?? null,
                                              divisionLabel:
                                                row.division?.label ?? null,
                                              commercePurchaseId:
                                                row.commercePurchaseId ?? null,
                                            })
                                          }
                                          disabled={!row.commercePurchaseId}
                                        >
                                          <UserPlus className="h-4 w-4 mr-2" />
                                          Transfer Registration
                                        </DropdownMenuItem>
                                      )
                                    })()}
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() =>
                                        setRemovingRegistration({
                                          id: row.registrationId,
                                          athleteName:
                                            `${row.athlete.firstName ?? ""} ${row.athlete.lastName ?? ""}`.trim() ||
                                            row.athlete.email ||
                                            "Unknown",
                                          teamName: row.teamName,
                                        })
                                      }
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Remove Registration
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {isRowRemoved ? (
                                <Badge
                                  variant="destructive"
                                  className="text-xs"
                                >
                                  Removed
                                </Badge>
                              ) : row.status === "pending" ? (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300"
                                >
                                  Invite Pending
                                </Badge>
                              ) : row.status === "accepted" ? (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-green-50 text-green-700 border-green-300"
                                >
                                  Invite Accepted
                                </Badge>
                              ) : row.commercePurchaseId &&
                                pendingTransfers.some(
                                  (t) =>
                                    t.purchaseId === row.commercePurchaseId,
                                ) ? (
                                <div className="flex items-center gap-1">
                                  <Badge
                                    variant="outline"
                                    className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300"
                                  >
                                    Transfer Pending
                                  </Badge>
                                  <button
                                    type="button"
                                    className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                                    title="Copy transfer link"
                                    onClick={async () => {
                                      const transfer = pendingTransfers.find(
                                        (t) =>
                                          t.purchaseId ===
                                          row.commercePurchaseId,
                                      )
                                      if (transfer) {
                                        try {
                                          await navigator.clipboard.writeText(
                                            `${window.location.origin}/transfer/${transfer.id}`,
                                          )
                                          toast.success(
                                            "Transfer link copied to clipboard",
                                          )
                                        } catch {
                                          toast.error("Failed to copy link")
                                        }
                                      }
                                    }}
                                  >
                                    <Link2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : null}
                              {row.division && (
                                <Badge variant="outline" className="text-xs">
                                  {row.division.label}
                                </Badge>
                              )}
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                              {row.teamName && (
                                <>
                                  <span className="text-muted-foreground">
                                    Team
                                  </span>
                                  <span className="font-medium truncate">
                                    {row.teamName}
                                  </span>
                                </>
                              )}
                              {row.athlete.affiliateName && (
                                <>
                                  <span className="text-muted-foreground">
                                    Affiliate
                                  </span>
                                  <span className="truncate">
                                    {row.athlete.affiliateName}
                                  </span>
                                </>
                              )}
                              {questions.map((question) => {
                                let answerText: string | null = null
                                if (
                                  row.status !== "registered" &&
                                  row.pendingInvite
                                ) {
                                  answerText =
                                    row.pendingInvite.pendingAnswers?.find(
                                      (a) => a.questionId === question.id,
                                    )?.answer ?? null
                                } else {
                                  const answers = getAnswersForUser(
                                    row.registrationId,
                                    row.athlete.id,
                                  )
                                  answerText =
                                    answers.find(
                                      (a) => a.questionId === question.id,
                                    )?.answer ?? null
                                }
                                if (!answerText) return null
                                return (
                                  <React.Fragment key={question.id}>
                                    <span className="text-muted-foreground">
                                      {question.label}
                                    </span>
                                    <span className="truncate">
                                      {answerText}
                                    </span>
                                  </React.Fragment>
                                )
                              })}
                              {waivers.map((waiver) => {
                                let signedDisplay: React.ReactNode = null
                                if (
                                  row.status !== "registered" &&
                                  row.pendingInvite
                                ) {
                                  const pendingSig =
                                    row.pendingInvite.pendingSignatures?.find(
                                      (s) => s.waiverId === waiver.id,
                                    )
                                  signedDisplay = pendingSig ? (
                                    <span className="text-green-600">
                                      {formatDate(pendingSig.signedAt)}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      Not signed
                                    </span>
                                  )
                                } else {
                                  const signedDate = getWaiverSignedDate(
                                    row.athlete.id,
                                    waiver.id,
                                  )
                                  signedDisplay = signedDate ? (
                                    <span className="text-green-600">
                                      {formatDate(signedDate)}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      Not signed
                                    </span>
                                  )
                                }
                                return (
                                  <React.Fragment key={waiver.id}>
                                    <span className="text-muted-foreground">
                                      {waiver.title}
                                    </span>
                                    {signedDisplay}
                                  </React.Fragment>
                                )
                              })}
                              {row.registeredAt && (
                                <>
                                  <span className="text-muted-foreground">
                                    Registered
                                  </span>
                                  <span className="text-muted-foreground">
                                    {formatDate(row.registeredAt)}
                                  </span>
                                </>
                              )}
                              {row.joinedAt && (
                                <>
                                  <span className="text-muted-foreground">
                                    Joined
                                  </span>
                                  <span className="text-muted-foreground">
                                    {formatDate(row.joinedAt)}
                                  </span>
                                </>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>

                  {/* Desktop table view */}
                  <Card className="hidden md:block">
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]">#</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>
                              <button
                                type="button"
                                onClick={() => handleSort("name")}
                                className="flex items-center hover:text-foreground transition-colors"
                              >
                                Athlete
                                <SortIcon column="name" />
                              </button>
                            </TableHead>
                            <TableHead>
                              <button
                                type="button"
                                onClick={() => handleSort("division")}
                                className="flex items-center hover:text-foreground transition-colors"
                              >
                                Division
                                <SortIcon column="division" />
                              </button>
                            </TableHead>
                            <TableHead>
                              <button
                                type="button"
                                onClick={() => handleSort("teamName")}
                                className="flex items-center hover:text-foreground transition-colors"
                              >
                                Team Name
                                <SortIcon column="teamName" />
                              </button>
                            </TableHead>
                            <TableHead>
                              <button
                                type="button"
                                onClick={() => handleSort("affiliate")}
                                className="flex items-center hover:text-foreground transition-colors"
                              >
                                Affiliate
                                <SortIcon column="affiliate" />
                              </button>
                            </TableHead>
                            {questions.map((question) => (
                              <TableHead key={question.id}>
                                <span className="flex items-center gap-1">
                                  {question.label}
                                  {question.source === "series" && (
                                    <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
                                  )}
                                </span>
                              </TableHead>
                            ))}
                            {waivers.map((waiver) => (
                              <TableHead key={waiver.id}>
                                {waiver.title}
                              </TableHead>
                            ))}
                            <TableHead>
                              <button
                                type="button"
                                onClick={() => handleSort("registeredAt")}
                                className="flex items-center hover:text-foreground transition-colors"
                              >
                                <Calendar className="h-3.5 w-3.5 mr-1" />
                                Registered
                                <SortIcon column="registeredAt" />
                              </button>
                            </TableHead>
                            <TableHead>
                              <button
                                type="button"
                                onClick={() => handleSort("joinedAt")}
                                className="flex items-center hover:text-foreground transition-colors"
                              >
                                <Calendar className="h-3.5 w-3.5 mr-1" />
                                Joined
                                <SortIcon column="joinedAt" />
                              </button>
                            </TableHead>
                            <TableHead className="w-[40px]">
                              <span className="sr-only">Actions</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedAthleteRows.map((row) => {
                            const isRowRemoved =
                              row.registrationStatus === "removed"
                            return (
                              <TableRow
                                key={`${row.registrationId}-${row.athlete.id}`}
                                className={
                                  isRowRemoved ? "opacity-50 bg-muted/30" : ""
                                }
                              >
                                <TableCell className="font-mono text-sm text-muted-foreground">
                                  {row.ordinalLabel}
                                </TableCell>
                                <TableCell>
                                  {isRowRemoved ? (
                                    <Badge
                                      variant="destructive"
                                      className="text-xs"
                                    >
                                      Removed
                                    </Badge>
                                  ) : row.status === "pending" ? (
                                    <Badge
                                      variant="outline"
                                      className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300"
                                    >
                                      Invite Pending
                                    </Badge>
                                  ) : row.status === "accepted" ? (
                                    <Badge
                                      variant="outline"
                                      className="text-xs bg-green-50 text-green-700 border-green-300"
                                    >
                                      Invite Accepted
                                    </Badge>
                                  ) : row.commercePurchaseId &&
                                    pendingTransfers.some(
                                      (t) =>
                                        t.purchaseId === row.commercePurchaseId,
                                    ) ? (
                                    <div className="flex items-center gap-1">
                                      <Badge
                                        variant="outline"
                                        className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300"
                                      >
                                        Transfer Pending
                                      </Badge>
                                      <button
                                        type="button"
                                        className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                                        title="Copy transfer link"
                                        onClick={async () => {
                                          const transfer =
                                            pendingTransfers.find(
                                              (t) =>
                                                t.purchaseId ===
                                                row.commercePurchaseId,
                                            )
                                          if (transfer) {
                                            try {
                                              await navigator.clipboard.writeText(
                                                `${window.location.origin}/transfer/${transfer.id}`,
                                              )
                                              toast.success(
                                                "Transfer link copied to clipboard",
                                              )
                                            } catch {
                                              toast.error("Failed to copy link")
                                            }
                                          }
                                        }}
                                      >
                                        <Link2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ) : null}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <Avatar className="h-8 w-8">
                                      <AvatarImage
                                        src={row.athlete.avatar ?? undefined}
                                        alt={`${row.athlete.firstName ?? ""} ${row.athlete.lastName ?? ""}`}
                                      />
                                      <AvatarFallback className="text-xs">
                                        {row.status === "accepted" &&
                                        row.pendingInvite?.guestName
                                          ? getInitialsFromName(
                                              row.pendingInvite.guestName,
                                            )
                                          : getInitials(
                                              row.athlete.firstName,
                                              row.athlete.lastName,
                                            )}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                      <span className="font-medium">
                                        {row.status === "pending" ? (
                                          <span className="italic text-muted-foreground">
                                            Invited
                                          </span>
                                        ) : row.status === "accepted" ? (
                                          row.pendingInvite?.guestName ? (
                                              <span>
                                                {row.pendingInvite.guestName}
                                              </span>
                                            ) : (
                                              <span className="italic text-muted-foreground">
                                                Invited
                                              </span>
                                            )
                                        ) : (
                                          <>
                                            {row.athlete.firstName ?? ""}{" "}
                                            {row.athlete.lastName ?? ""}
                                            {row.isCaptain && row.teamName && (
                                              <span className="text-xs text-muted-foreground ml-1">
                                                (captain)
                                              </span>
                                            )}
                                          </>
                                        )}
                                      </span>
                                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Mail className="h-3 w-3" />
                                        {row.athlete.email}
                                      </span>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {row.division ? (
                                    <Badge variant="outline">
                                      {row.division.label}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {row.teamName ? (
                                    <span className="font-medium">
                                      {row.teamName}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {row.athlete.affiliateName ? (
                                    <span>{row.athlete.affiliateName}</span>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                </TableCell>
                                {questions.map((question) => {
                                  // For pending/accepted invites, get answer from pending data
                                  if (
                                    row.status !== "registered" &&
                                    row.pendingInvite
                                  ) {
                                    const pendingAnswer =
                                      row.pendingInvite.pendingAnswers?.find(
                                        (a) => a.questionId === question.id,
                                      )
                                    return (
                                      <TableCell
                                        key={question.id}
                                        className="text-sm"
                                      >
                                        {pendingAnswer?.answer ?? "—"}
                                      </TableCell>
                                    )
                                  }
                                  // For registered members, get from registration answers
                                  const answers = getAnswersForUser(
                                    row.registrationId,
                                    row.athlete.id,
                                  )
                                  const answer = answers.find(
                                    (a) => a.questionId === question.id,
                                  )
                                  return (
                                    <TableCell
                                      key={question.id}
                                      className="text-sm"
                                    >
                                      {answer?.answer ?? "—"}
                                    </TableCell>
                                  )
                                })}
                                {waivers.map((waiver) => {
                                  // For pending/accepted invites, check pending signatures
                                  if (
                                    row.status !== "registered" &&
                                    row.pendingInvite
                                  ) {
                                    const pendingSig =
                                      row.pendingInvite.pendingSignatures?.find(
                                        (s) => s.waiverId === waiver.id,
                                      )
                                    return (
                                      <TableCell
                                        key={waiver.id}
                                        className="text-sm"
                                      >
                                        {pendingSig ? (
                                          <span className="text-green-600">
                                            {formatDate(pendingSig.signedAt)}
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground">
                                            Not signed
                                          </span>
                                        )}
                                      </TableCell>
                                    )
                                  }
                                  // For registered members, get from waiver signatures
                                  const signedDate = getWaiverSignedDate(
                                    row.athlete.id,
                                    waiver.id,
                                  )
                                  return (
                                    <TableCell
                                      key={waiver.id}
                                      className="text-sm"
                                    >
                                      {signedDate ? (
                                        <span className="text-green-600">
                                          {formatDate(signedDate)}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">
                                          Not signed
                                        </span>
                                      )}
                                    </TableCell>
                                  )
                                })}
                                <TableCell className="text-muted-foreground text-sm">
                                  {row.registeredAt
                                    ? formatDate(row.registeredAt)
                                    : null}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {row.joinedAt
                                    ? formatDate(row.joinedAt)
                                    : null}
                                </TableCell>
                                <TableCell>
                                  {row.isCaptain && !isRowRemoved && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          aria-label="Open registration actions"
                                        >
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                          onClick={() => {
                                            const athleteName =
                                              `${row.athlete.firstName ?? ""} ${row.athlete.lastName ?? ""}`.trim() ||
                                              row.athlete.email ||
                                              "Unknown"
                                            setTransferTarget({
                                              id: row.registrationId,
                                              athleteName,
                                              userId: row.athlete.id,
                                              divisionId:
                                                row.division?.id ?? null,
                                              divisionLabel:
                                                row.division?.label ?? null,
                                              teamSize:
                                                row.division?.teamSize ?? 1,
                                            })
                                          }}
                                        >
                                          <ArrowRight className="h-4 w-4 mr-2" />
                                          Change Division
                                        </DropdownMenuItem>
                                        {(() => {
                                          const pendingTransfer =
                                            pendingTransfers.find(
                                              (t) =>
                                                t.purchaseId ===
                                                row.commercePurchaseId,
                                            )
                                          const athleteName =
                                            `${row.athlete.firstName ?? ""} ${row.athlete.lastName ?? ""}`.trim() ||
                                            row.athlete.email ||
                                            "Unknown"
                                          if (pendingTransfer) {
                                            return (
                                              <DropdownMenuItem
                                                className="text-destructive focus:text-destructive"
                                                onClick={() =>
                                                  handleCancelTransfer(
                                                    pendingTransfer.id,
                                                  )
                                                }
                                              >
                                                <X className="h-4 w-4 mr-2" />
                                                Cancel Transfer
                                              </DropdownMenuItem>
                                            )
                                          }
                                          return (
                                            <DropdownMenuItem
                                              onClick={() =>
                                                setTransferRegistrationTarget({
                                                  id: row.registrationId,
                                                  athleteName,
                                                  divisionId:
                                                    row.division?.id ?? null,
                                                  divisionLabel:
                                                    row.division?.label ?? null,
                                                  commercePurchaseId:
                                                    row.commercePurchaseId ??
                                                    null,
                                                })
                                              }
                                              disabled={!row.commercePurchaseId}
                                            >
                                              <UserPlus className="h-4 w-4 mr-2" />
                                              Transfer Registration
                                            </DropdownMenuItem>
                                          )
                                        })()}
                                        <DropdownMenuItem
                                          className="text-destructive focus:text-destructive"
                                          onClick={() =>
                                            setRemovingRegistration({
                                              id: row.registrationId,
                                              athleteName:
                                                `${row.athlete.firstName ?? ""} ${row.athlete.lastName ?? ""}`.trim() ||
                                                row.athlete.email ||
                                                "Unknown",
                                              teamName: row.teamName,
                                            })
                                          }
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Remove Registration
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* Pagination controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Rows per page
                      </span>
                      <Select
                        value={String(currentPageSize)}
                        onValueChange={handlePageSizeChange}
                      >
                        <SelectTrigger className="w-[90px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAGE_SIZE_OPTIONS.map((size) => (
                            <SelectItem key={size} value={String(size)}>
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Pagination
                      currentPage={clampedPage}
                      totalCount={totalFilteredCount}
                      pageSize={currentPageSize}
                      basePath="/compete/organizer/$competitionId/athletes"
                      params={{ competitionId: competition.id }}
                      buildSearchParams={buildPaginationSearchParams}
                      itemLabel="athletes"
                      className="sm:justify-end"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={!!removingRegistration}
        onOpenChange={(open) => !open && setRemovingRegistration(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Registration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the registration for{" "}
              <strong>{removingRegistration?.athleteName}</strong>
              {removingRegistration?.teamName && (
                <> (team: {removingRegistration.teamName})</>
              )}
              ? This will remove them from the competition, delete their heat
              assignments and scores.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveRegistration}
              disabled={isRemoving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemoving ? "Removing..." : "Remove Registration"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ManualRegistrationDialog
        open={showManualRegistration}
        onOpenChange={setShowManualRegistration}
        competitionId={competition.id}
        divisions={divisions}
        questions={questions}
      />

      {transferTarget && (
        <TransferDivisionDialog
          open={!!transferTarget}
          onOpenChange={(open) => !open && setTransferTarget(null)}
          registration={transferTarget}
          divisions={divisions}
          competitionId={competition.id}
          registeredDivisionIds={registrations
            .filter(
              (r) =>
                r.userId === transferTarget.userId &&
                r.divisionId != null &&
                r.status !== "removed",
            )
            .map((r) => r.divisionId!)}
        />
      )}

      {transferRegistrationTarget && (
        <TransferRegistrationDialog
          open={!!transferRegistrationTarget}
          onOpenChange={(open) => !open && setTransferRegistrationTarget(null)}
          registration={transferRegistrationTarget}
          competitionId={competition.id}
        />
      )}
    </>
  )
}
