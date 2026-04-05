"use client"

import { Link } from "@tanstack/react-router"
import { CalendarIcon, GlobeIcon, MapPinIcon } from "lucide-react"
import type { CompetitionWithOrganizingTeam } from "@/server-fns/competition-fns"
import { formatLocationBadge } from "@/utils/address"
import { cn } from "@/utils/cn"
import { isSameUTCDay } from "@/utils/date-utils"

type CompetitionStatus =
  | "registration-open"
  | "active"
  | "coming-soon"
  | "registration-closed"
  | "past"

interface CompetitionCardProps {
  competition: CompetitionWithOrganizingTeam
  status: CompetitionStatus
  index: number
  animate?: boolean
}

const STATUS_CONFIG: Record<
  CompetitionStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Live Now",
    className:
      "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800",
  },
  "registration-open": {
    label: "Register",
    className: "text-primary bg-primary/10 border-primary/20",
  },
  "coming-soon": {
    label: "Upcoming",
    className: "text-muted-foreground bg-muted border-transparent",
  },
  "registration-closed": {
    label: "Closed",
    className: "text-muted-foreground bg-muted border-transparent",
  },
  past: {
    label: "Completed",
    className: "text-muted-foreground bg-muted border-transparent",
  },
}

// Curated gradient pairs that look good in both light and dark mode
const GRADIENT_PAIRS = [
  ["#f97316", "#ea580c"], // orange
  ["#3b82f6", "#2563eb"], // blue
  ["#8b5cf6", "#7c3aed"], // violet
  ["#ec4899", "#db2777"], // pink
  ["#14b8a6", "#0d9488"], // teal
  ["#f59e0b", "#d97706"], // amber
  ["#6366f1", "#4f46e5"], // indigo
  ["#10b981", "#059669"], // emerald
  ["#ef4444", "#dc2626"], // red
  ["#06b6d4", "#0891b2"], // cyan
] as const

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function getGradient(name: string) {
  const idx = hashString(name) % GRADIENT_PAIRS.length
  return GRADIENT_PAIRS[idx]
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
}

function formatDateRange(startDate: string, endDate: string) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }
  if (isSameUTCDay(startDate, endDate)) {
    return start.toLocaleDateString("en-US", { ...opts, year: "numeric" })
  }
  const sameMonth =
    start.getUTCMonth() === end.getUTCMonth() &&
    start.getUTCFullYear() === end.getUTCFullYear()
  if (sameMonth) {
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}–${end.getUTCDate()}, ${end.getUTCFullYear()}`
  }
  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`
}

export function CompetitionCard({
  competition,
  status,
  index,
  animate = true,
}: CompetitionCardProps) {
  const locationBadge = formatLocationBadge(
    competition.address,
    competition.competitionType,
    competition.organizingTeam?.name,
  )
  const cfg = STATUS_CONFIG[status]
  const dateRange = formatDateRange(competition.startDate, competition.endDate)
  const profileImage = competition.profileImageUrl
  const [gradFrom, gradTo] = getGradient(competition.name)
  const initials = getInitials(competition.name)

  return (
    <Link
      to="/compete/$slug"
      params={{ slug: competition.slug }}
      className={cn(
        "group relative flex gap-4 rounded-lg border bg-card p-4 sm:p-5",
        "transition-[border-color,box-shadow] duration-200",
        "hover:border-primary/30 hover:shadow-md hover:shadow-primary/5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "motion-reduce:transition-none motion-reduce:!animate-none",
      )}
      style={
        animate
          ? { animation: `card-enter 0.35s ease-out ${index * 50}ms backwards` }
          : undefined
      }
    >
      {/* Profile image / fallback */}
      <div className="shrink-0">
        {profileImage ? (
          <img
            src={profileImage}
            alt=""
            width={48}
            height={48}
            loading="lazy"
            className="h-12 w-12 rounded-lg object-cover"
          />
        ) : (
          <div
            className="flex h-12 w-12 items-center justify-center rounded-lg text-white text-sm font-bold select-none"
            style={{
              background: `linear-gradient(135deg, ${gradFrom}, ${gradTo})`,
            }}
            aria-hidden="true"
          >
            {initials}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {/* Name */}
        <h3 className="text-[15px] font-semibold leading-tight tracking-tight">
          {competition.name}
        </h3>

        {/* Organizer */}
        {competition.organizingTeam && (
          <p className="text-sm text-muted-foreground truncate">
            {competition.organizingTeam.name}
          </p>
        )}

        {/* Date + Location + Status */}
        <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap mt-auto pt-1 text-[13px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarIcon
              className="h-3 w-3 shrink-0 opacity-60"
              aria-hidden="true"
            />
            {dateRange}
          </span>
          <span className="flex items-center gap-1">
            {locationBadge.icon === "globe" ? (
              <GlobeIcon
                className="h-3 w-3 shrink-0 opacity-60"
                aria-hidden="true"
              />
            ) : (
              <MapPinIcon
                className="h-3 w-3 shrink-0 opacity-60"
                aria-hidden="true"
              />
            )}
            <span className="truncate">{locationBadge.text}</span>
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-px text-[11px] font-semibold",
              cfg.className,
            )}
          >
            {cfg.label}
          </span>
        </div>
      </div>
    </Link>
  )
}
