/**
 * Series registration export server functions.
 *
 * Produces organizer-only CSV exports that span every competition in a series.
 */
// @lat: [[organizer-dashboard#Registrations (Athletes)]]

import { createServerFn } from "@tanstack/react-start"
import { and, asc, eq, inArray, isNull, ne, or } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  commercePurchaseTable,
  competitionGroupsTable,
  competitionRegistrationAnswersTable,
  competitionRegistrationQuestionsTable,
  competitionRegistrationsTable,
  competitionsTable,
  INVITATION_STATUS,
  SYSTEM_ROLES_ENUM,
  TEAM_PERMISSIONS,
  teamInvitationTable,
  teamMembershipTable,
  waiverSignaturesTable,
  waiversTable,
} from "@/db/schema"
import { ROLES_ENUM } from "@/db/schemas/users"
import { getSessionFromCookie } from "@/utils/auth"

const exportSeriesRegistrationsCsvInputSchema = z.object({
  groupId: z.string().min(1, "Group ID is required"),
})

type RegistrationMetadata = {
  affiliates?: Record<string, string | null>
}

type PendingInviteMetadata = {
  guestName?: string
  affiliateName?: string
  pendingAnswers?: Array<{ questionId: string; answer: string }>
  pendingSignatures?: Array<{
    waiverId: string
    signedAt: string
    signatureName?: string
  }>
  submittedAt?: string
}

function parseJson<T>(value: unknown): T | null {
  if (!value) return null
  if (typeof value !== "string") return value as T
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString()
}

function formatCents(value: number | null | undefined): string {
  if (value == null) return ""
  return (value / 100).toFixed(2)
}

function csvCell(value: unknown): string {
  const text = String(value ?? "").replace(/"/g, '""')
  const sanitized = /^[=+\-@\t\r\n]/.test(text) ? `'${text}` : text
  return `"${sanitized}"`
}

/**
 * Export all athlete registration data for competitions in a series.
 * Returns one CSV row per athlete/teammate/pending invite.
 */
export const exportSeriesRegistrationsCsvFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    exportSeriesRegistrationsCsvInputSchema.parse(data),
  )
  .handler(async ({ data }): Promise<string> => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Unauthorized")

    const db = getDb()

    const group = await db.query.competitionGroupsTable.findFirst({
      where: eq(competitionGroupsTable.id, data.groupId),
      columns: {
        id: true,
        organizingTeamId: true,
      },
    })
    if (!group) throw new Error("Series not found")

    const isAdmin = session.user?.role === ROLES_ENUM.ADMIN
    const hasPermission =
      isAdmin ||
      (session.teams ?? []).some(
        (team) =>
          team.id === group.organizingTeamId &&
          team.permissions.includes(TEAM_PERMISSIONS.MANAGE_COMPETITIONS),
      )
    if (!hasPermission) {
      throw new Error(
        `Missing required permission: ${TEAM_PERMISSIONS.MANAGE_COMPETITIONS}`,
      )
    }

    const competitions = await db.query.competitionsTable.findMany({
      where: eq(competitionsTable.groupId, data.groupId),
      columns: {
        id: true,
        name: true,
        slug: true,
        startDate: true,
      },
      orderBy: (table, { asc }) => [asc(table.startDate), asc(table.name)],
    })

    if (competitions.length === 0) {
      return [
        "Competition Name",
        "Competition Date",
        "Registration ID",
        "Athlete Name",
        "Email",
      ]
        .map(csvCell)
        .join(",")
    }

    const competitionIds = competitions.map((competition) => competition.id)
    const competitionById = new Map(
      competitions.map((competition) => [competition.id, competition]),
    )

    const [registrations, questions, waivers] = await Promise.all([
      db.query.competitionRegistrationsTable.findMany({
        where: inArray(competitionRegistrationsTable.eventId, competitionIds),
        orderBy: (table, { asc }) => [
          asc(table.eventId),
          asc(table.registeredAt),
        ],
        with: {
          user: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              gender: true,
              dateOfBirth: true,
              affiliateName: true,
            },
          },
          division: {
            columns: {
              id: true,
              label: true,
              teamSize: true,
            },
          },
          athleteTeam: {
            columns: {
              id: true,
            },
            with: {
              memberships: {
                columns: {
                  id: true,
                  userId: true,
                  joinedAt: true,
                },
                where: eq(teamMembershipTable.isActive, true),
                with: {
                  user: {
                    columns: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                      gender: true,
                      dateOfBirth: true,
                      affiliateName: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      db
        .select({
          id: competitionRegistrationQuestionsTable.id,
          competitionId: competitionRegistrationQuestionsTable.competitionId,
          groupId: competitionRegistrationQuestionsTable.groupId,
          label: competitionRegistrationQuestionsTable.label,
          sortOrder: competitionRegistrationQuestionsTable.sortOrder,
        })
        .from(competitionRegistrationQuestionsTable)
        .where(
          and(
            eq(competitionRegistrationQuestionsTable.questionTarget, "athlete"),
            or(
              eq(competitionRegistrationQuestionsTable.groupId, data.groupId),
              inArray(
                competitionRegistrationQuestionsTable.competitionId,
                competitionIds,
              ),
            ),
          ),
        )
        .orderBy(
          asc(competitionRegistrationQuestionsTable.groupId),
          asc(competitionRegistrationQuestionsTable.competitionId),
          asc(competitionRegistrationQuestionsTable.sortOrder),
        ),
      db.query.waiversTable.findMany({
        where: inArray(waiversTable.competitionId, competitionIds),
        columns: {
          id: true,
          competitionId: true,
          title: true,
          position: true,
        },
        orderBy: (table, { asc }) => [
          asc(table.competitionId),
          asc(table.position),
        ],
      }),
    ])

    const registrationIds = registrations.map((registration) => registration.id)
    const purchaseIds = registrations
      .map((registration) => registration.commercePurchaseId)
      .filter((id): id is string => !!id)
    const athleteTeamIds = registrations
      .map((registration) => registration.athleteTeamId)
      .filter((id): id is string => !!id)
    const waiverIds = waivers.map((waiver) => waiver.id)

    const [answers, signatures, purchases, invitations] = await Promise.all([
      registrationIds.length > 0
        ? db
            .select({
              questionId: competitionRegistrationAnswersTable.questionId,
              registrationId:
                competitionRegistrationAnswersTable.registrationId,
              userId: competitionRegistrationAnswersTable.userId,
              answer: competitionRegistrationAnswersTable.answer,
            })
            .from(competitionRegistrationAnswersTable)
            .where(
              inArray(
                competitionRegistrationAnswersTable.registrationId,
                registrationIds,
              ),
            )
        : [],
      waiverIds.length > 0
        ? db.query.waiverSignaturesTable.findMany({
            where: inArray(waiverSignaturesTable.waiverId, waiverIds),
            columns: {
              waiverId: true,
              userId: true,
              signedAt: true,
            },
          })
        : [],
      purchaseIds.length > 0
        ? db.query.commercePurchaseTable.findMany({
            where: inArray(commercePurchaseTable.id, purchaseIds),
            columns: {
              id: true,
              status: true,
              totalCents: true,
              platformFeeCents: true,
              stripeFeeCents: true,
              organizerNetCents: true,
              completedAt: true,
            },
          })
        : [],
      athleteTeamIds.length > 0
        ? db.query.teamInvitationTable.findMany({
            where: and(
              inArray(teamInvitationTable.teamId, athleteTeamIds),
              eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.MEMBER),
              isNull(teamInvitationTable.acceptedAt),
              ne(teamInvitationTable.status, INVITATION_STATUS.CANCELLED),
            ),
            columns: {
              id: true,
              teamId: true,
              email: true,
              status: true,
              acceptedAt: true,
              metadata: true,
              createdAt: true,
            },
          })
        : [],
    ])

    const answersByRegistrationUser = new Map<string, Map<string, string>>()
    for (const answer of answers) {
      const key = `${answer.registrationId}:${answer.userId}`
      const answerMap = answersByRegistrationUser.get(key) ?? new Map()
      answerMap.set(answer.questionId, answer.answer)
      answersByRegistrationUser.set(key, answerMap)
    }

    const signaturesByUser = new Map<string, Map<string, Date>>()
    for (const signature of signatures) {
      const signatureMap = signaturesByUser.get(signature.userId) ?? new Map()
      signatureMap.set(signature.waiverId, signature.signedAt)
      signaturesByUser.set(signature.userId, signatureMap)
    }

    const purchasesById = new Map(
      purchases.map((purchase) => [purchase.id, purchase]),
    )
    const invitationsByTeamId = new Map<string, typeof invitations>()
    for (const invitation of invitations) {
      const teamInvitations = invitationsByTeamId.get(invitation.teamId) ?? []
      teamInvitations.push(invitation)
      invitationsByTeamId.set(invitation.teamId, teamInvitations)
    }

    const questionHeaders = questions.map((question) => {
      if (question.groupId) return `Series: ${question.label}`
      const competition = question.competitionId
        ? competitionById.get(question.competitionId)
        : null
      return `${competition?.name ?? "Competition"}: ${question.label}`
    })

    const waiverHeaders = waivers.map((waiver) => {
      const competition = competitionById.get(waiver.competitionId)
      return `${competition?.name ?? "Competition"}: ${waiver.title} (Signed)`
    })

    const headers = [
      "Competition Name",
      "Competition Slug",
      "Competition Date",
      "Registration ID",
      "Registration Status",
      "Registration Created At",
      "Registered At",
      "Division",
      "Team Name",
      "Athlete Role",
      "Athlete Status",
      "Athlete Name",
      "Email",
      "Gender",
      "Date of Birth",
      "Affiliate",
      "Joined At",
      "Payment Status",
      "Paid At",
      "Purchase ID",
      "Purchase Status",
      "Amount Paid",
      "Stripe Fee",
      "Platform Fee",
      "Organizer Net",
      ...questionHeaders,
      ...waiverHeaders,
    ]

    const rows: string[][] = []

    for (const registration of registrations) {
      const competition = competitionById.get(registration.eventId)
      const purchase = registration.commercePurchaseId
        ? purchasesById.get(registration.commercePurchaseId)
        : null
      const isTeamDivision = (registration.division?.teamSize ?? 1) > 1
      const registrationMetadata = parseJson<RegistrationMetadata>(
        registration.metadata,
      )
      const metadataAffiliates = registrationMetadata?.affiliates ?? {}

      const baseCells = [
        competition?.name ?? "",
        competition?.slug ?? "",
        formatDate(competition?.startDate),
        registration.id,
        registration.status,
        formatDate(registration.createdAt),
        formatDate(registration.registeredAt),
        registration.division?.label ?? "",
        isTeamDivision ? (registration.teamName ?? "") : "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        registration.paymentStatus ?? "",
        formatDate(registration.paidAt),
        registration.commercePurchaseId ?? "",
        purchase?.status ?? "",
        formatCents(purchase?.totalCents),
        formatCents(purchase?.stripeFeeCents),
        formatCents(purchase?.platformFeeCents),
        formatCents(purchase?.organizerNetCents),
      ]

      const pushRegisteredAthlete = (
        user: {
          id: string
          firstName: string | null
          lastName: string | null
          email: string | null
          gender?: string | null
          dateOfBirth?: Date | null
          affiliateName?: string | null
        },
        role: "Captain" | "Teammate",
        joinedAt: Date | null,
      ) => {
        const userAnswerMap =
          answersByRegistrationUser.get(`${registration.id}:${user.id}`) ??
          new Map()
        const userSignatureMap = signaturesByUser.get(user.id) ?? new Map()
        const questionCells = questions.map(
          (question) => userAnswerMap.get(question.id) ?? "",
        )
        const waiverCells = waivers.map((waiver) => {
          if (waiver.competitionId !== registration.eventId) return ""
          const signedAt = userSignatureMap.get(waiver.id)
          return signedAt ? formatDate(signedAt) : "Not signed"
        })

        rows.push([
          ...baseCells.slice(0, 9),
          role,
          "Registered",
          `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
          user.email ?? "",
          user.gender ?? "",
          formatDate(user.dateOfBirth),
          metadataAffiliates[user.id] ?? user.affiliateName ?? "",
          formatDate(joinedAt),
          ...baseCells.slice(17),
          ...questionCells,
          ...waiverCells,
        ])
      }

      if (registration.user) {
        pushRegisteredAthlete(registration.user, "Captain", null)
      }

      if (isTeamDivision && registration.athleteTeam?.memberships) {
        for (const membership of registration.athleteTeam.memberships) {
          if (!membership.user || membership.userId === registration.userId) {
            continue
          }
          pushRegisteredAthlete(
            membership.user,
            "Teammate",
            membership.joinedAt,
          )
        }
      }

      if (isTeamDivision && registration.athleteTeamId) {
        for (const invitation of invitationsByTeamId.get(
          registration.athleteTeamId,
        ) ?? []) {
          const metadata = parseJson<PendingInviteMetadata>(invitation.metadata)
          const pendingAnswerMap = new Map(
            (metadata?.pendingAnswers ?? []).map((answer) => [
              answer.questionId,
              answer.answer,
            ]),
          )
          const pendingSignatureMap = new Map(
            (metadata?.pendingSignatures ?? []).map((signature) => [
              signature.waiverId,
              signature.signedAt,
            ]),
          )
          const questionCells = questions.map(
            (question) => pendingAnswerMap.get(question.id) ?? "",
          )
          const waiverCells = waivers.map((waiver) => {
            if (waiver.competitionId !== registration.eventId) return ""
            const signedAt = pendingSignatureMap.get(waiver.id)
            return signedAt ? formatDate(signedAt) : "Not signed"
          })

          rows.push([
            ...baseCells.slice(0, 9),
            "Teammate",
            invitation.status === "accepted"
              ? "Accepted Invite"
              : "Pending Invite",
            metadata?.guestName ?? "",
            invitation.email,
            "",
            "",
            metadata?.affiliateName ?? "",
            formatDate(invitation.acceptedAt ?? metadata?.submittedAt ?? null),
            ...baseCells.slice(17),
            ...questionCells,
            ...waiverCells,
          ])
        }
      }
    }

    return [
      headers.map(csvCell).join(","),
      ...rows.map((row) => row.map(csvCell).join(",")),
    ].join("\n")
  })
