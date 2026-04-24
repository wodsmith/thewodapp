/**
 * Round detail route — single round + grouped recipients.
 *
 * Loader pulls the round metadata + every invite attached to it, splits
 * them into source-derived and bespoke buckets, and renders both in
 * grouped tables. Status pills mirror the roster table so the visual
 * language stays consistent.
 */

import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { ChevronLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  COMPETITION_INVITE_ORIGIN,
  COMPETITION_INVITE_ROUND_STATUS,
  COMPETITION_INVITE_STATUS,
  type CompetitionInviteRoundStatus,
  type CompetitionInviteStatus,
} from "@/db/schemas/competition-invites"
import { getRoundDetailFn } from "@/server-fns/competition-invite-fns"

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/invites/rounds/$roundId",
)({
  staleTime: 10_000,
  component: RoundDetailPage,
  loader: async ({ params, context }) => {
    const session = context.session
    if (!session?.user?.id) {
      throw redirect({
        to: "/sign-in",
        search: {
          redirect: `/compete/organizer/${params.competitionId}/invites/rounds/${params.roundId}`,
        },
      })
    }

    return getRoundDetailFn({
      data: {
        championshipCompetitionId: params.competitionId,
        roundId: params.roundId,
      },
    })
  },
})

const STATUS_LABEL: Record<CompetitionInviteStatus, string> = {
  [COMPETITION_INVITE_STATUS.PENDING]: "Pending",
  [COMPETITION_INVITE_STATUS.ACCEPTED_PAID]: "Paid",
  [COMPETITION_INVITE_STATUS.DECLINED]: "Declined",
  [COMPETITION_INVITE_STATUS.EXPIRED]: "Expired",
  [COMPETITION_INVITE_STATUS.REVOKED]: "Revoked",
}

function StatusPill({ status }: { status: CompetitionInviteStatus }) {
  switch (status) {
    case COMPETITION_INVITE_STATUS.ACCEPTED_PAID:
      return <Badge>Paid</Badge>
    case COMPETITION_INVITE_STATUS.PENDING:
      return <Badge variant="secondary">Pending</Badge>
    case COMPETITION_INVITE_STATUS.DECLINED:
      return <Badge variant="destructive">Declined</Badge>
    case COMPETITION_INVITE_STATUS.EXPIRED:
      return <Badge variant="outline">Expired</Badge>
    case COMPETITION_INVITE_STATUS.REVOKED:
      return <Badge variant="outline">Revoked</Badge>
    default:
      return <Badge variant="secondary">{STATUS_LABEL[status]}</Badge>
  }
}

function RoundStatusPill({
  status,
}: {
  status: CompetitionInviteRoundStatus
}) {
  switch (status) {
    case COMPETITION_INVITE_ROUND_STATUS.DRAFT:
      return <Badge variant="outline">Draft</Badge>
    case COMPETITION_INVITE_ROUND_STATUS.SENDING:
      return <Badge variant="secondary">Sending</Badge>
    case COMPETITION_INVITE_ROUND_STATUS.SENT:
      return <Badge>Sent</Badge>
    case COMPETITION_INVITE_ROUND_STATUS.FAILED:
      return <Badge variant="destructive">Failed</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—"
  const date = typeof d === "string" ? new Date(d) : d
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function RoundDetailPage() {
  const { round, invites } = Route.useLoaderData()
  const { competitionId } = Route.useParams()

  const sourceInvites = invites.filter(
    (i) => i.origin === COMPETITION_INVITE_ORIGIN.SOURCE,
  )
  const bespokeInvites = invites.filter(
    (i) => i.origin === COMPETITION_INVITE_ORIGIN.BESPOKE,
  )

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link
            to="/compete/organizer/$competitionId/invites"
            params={{ competitionId }}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to invites
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Round {round.roundNumber} · {round.label}
            </h1>
            <RoundStatusPill status={round.status} />
          </div>
          <p className="text-muted-foreground">{round.subject}</p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <div>RSVP by {formatDate(round.rsvpDeadlineAt)}</div>
          <div>Sent {formatDate(round.sentAt)}</div>
          <div>{round.recipientCount} recipients</div>
        </div>
      </div>

      <RecipientSection
        title="From qualification sources"
        emptyHint="No source-derived recipients in this round."
        rows={sourceInvites}
      />

      <RecipientSection
        title="Bespoke / direct invites"
        emptyHint="No bespoke recipients in this round."
        rows={bespokeInvites}
      />
    </div>
  )
}

interface RecipientRow {
  id: string
  email: string
  status: CompetitionInviteStatus
  inviteeFirstName: string | null
  inviteeLastName: string | null
  bespokeReason: string | null
  sourcePlacement: number | null
  sourcePlacementLabel: string | null
}

function RecipientSection({
  title,
  emptyHint,
  rows,
}: {
  title: string
  emptyHint: string
  rows: RecipientRow[]
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <Badge variant="outline">
          {rows.length} {rows.length === 1 ? "recipient" : "recipients"}
        </Badge>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          {emptyHint}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Athlete</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const name =
                [row.inviteeFirstName, row.inviteeLastName]
                  .filter(Boolean)
                  .join(" ") || row.email
              const detail =
                row.sourcePlacementLabel ??
                row.bespokeReason ??
                (row.sourcePlacement != null
                  ? `#${row.sourcePlacement}`
                  : "—")
              return (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.email}
                  </TableCell>
                  <TableCell>{detail}</TableCell>
                  <TableCell>
                    <StatusPill status={row.status} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
