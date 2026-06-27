/**
 * Crew event sidebar shell.
 *
 * Mirrors the WODsmith organizer event sidebar pattern while keeping Crew
 * organizer and admin navigation definitions separate.
 */

"use client"

import { Link, useRouterState } from "@tanstack/react-router"
import {
  ArrowLeft,
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  CreditCard,
  Eye,
  Gauge,
  Gavel,
  Home,
  LayoutGrid,
  ListChecks,
  type LucideIcon,
  Mail,
  Menu,
  Printer,
  Rocket,
  Settings,
  UserPlus,
} from "lucide-react"
import type { ReactNode } from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import type { CrewNavItem } from "@/lib/crew/navigation"
import { cn } from "@/utils/cn"

export interface CrewEventSidebarEvent {
  id: string
  name: string
  startDate?: string | null
  endDate?: string | null
}

export interface CrewEventSidebarNavItem {
  key: string
  label: string
  href: string
  icon: LucideIcon
  exact?: boolean
}

export interface CrewEventSidebarNavGroup {
  label: string
  items: CrewEventSidebarNavItem[]
}

export interface CrewEventSidebarNavigation {
  overview: CrewEventSidebarNavItem
  groups: CrewEventSidebarNavGroup[]
}

interface CrewEventSidebarShellProps {
  variant: "organizer" | "admin"
  event: CrewEventSidebarEvent
  navigation: CrewEventSidebarNavigation
  eyebrow: string
  children: ReactNode
}

const organizerIconByKey: Record<string, LucideIcon> = {
  home: Home,
  setup: Settings,
  heats: LayoutGrid,
  staffing: ClipboardList,
  volunteers: UserPlus,
  shifts: CalendarClock,
  judges: Gavel,
  confirmations: Mail,
  "event-day": CalendarCheck,
  "print-packet": Printer,
}

export function getCrewOrganizerEventSidebarNavigation({
  eventId,
  navItems,
}: {
  eventId: string
  navItems: readonly CrewNavItem[]
}): CrewEventSidebarNavigation {
  const overview =
    navItems.find((item) => item.key === "home") ??
    ({
      key: "home",
      label: "Home",
      to: "/events/$eventId",
      persona: ["organizer_admin"],
    } satisfies CrewNavItem)

  const workflowItems = navItems
    .filter((item) =>
      ["setup", "heats", "staffing", "volunteers"].includes(
        item.key,
      ),
    )
    .map((item) => toOrganizerSidebarItem(item, eventId))

  const operationsItems = navItems
    .filter((item) =>
      ["shifts", "judges", "confirmations", "event-day", "print-packet"].includes(
        item.key,
      ),
    )
    .map((item) => toOrganizerSidebarItem(item, eventId))

  return {
    overview: toOrganizerSidebarItem(overview, eventId, true),
    groups: [
      { label: "Workflow", items: workflowItems },
      { label: "Operations", items: operationsItems },
    ].filter((group) => group.items.length > 0),
  }
}

export function getCrewAdminEventSidebarNavigation(
  eventId: string,
): CrewEventSidebarNavigation {
  return {
    overview: {
      key: "admin-overview",
      label: "Overview",
      href: `/admin/crew/events/${eventId}`,
      icon: Gauge,
      exact: true,
    },
    groups: [
      {
        label: "Operator",
        items: [
          {
            key: "admin-readiness",
            label: "Readiness",
            href: `/admin/crew/events/${eventId}/readiness`,
            icon: ListChecks,
          },
          {
            key: "admin-billing",
            label: "Billing",
            href: `/admin/crew/events/${eventId}/billing`,
            icon: CreditCard,
          },
          {
            key: "admin-conversion",
            label: "Conversion",
            href: `/admin/crew/events/${eventId}/convert`,
            icon: Rocket,
          },
        ],
      },
      {
        label: "Views",
        items: [
          {
            key: "organizer-view",
            label: "Organizer view",
            href: `/events/${eventId}`,
            icon: Eye,
          },
          {
            key: "admin-events",
            label: "Event list",
            href: "/admin/crew/events",
            icon: ArrowLeft,
            exact: true,
          },
        ],
      },
    ],
  }
}

export function CrewEventSidebarShell({
  variant,
  event,
  navigation,
  eyebrow,
  children,
}: CrewEventSidebarShellProps) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const activeKey = getActiveSidebarItemKey(navigation, pathname)

  return (
    <SidebarProvider>
      <Sidebar variant="sidebar" collapsible="icon">
        <CrewSidebarHeader variant={variant} />
        <SidebarRail />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <CrewSidebarNavItem
                  item={navigation.overview}
                  isActive={activeKey === navigation.overview.key}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {navigation.groups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <CrewSidebarNavItem
                      key={item.key}
                      item={item}
                      isActive={activeKey === item.key}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <CrewSidebarFooter />
      </Sidebar>

      <SidebarInset>
        <header className="fixed top-0 right-0 left-0 z-40 flex h-14 items-center gap-2 border-b bg-background px-3 md:hidden">
          <SidebarTrigger className="-ml-1">
            <Menu className="size-5" />
          </SidebarTrigger>
          <CrewBrandLink variant={variant} compact />
        </header>
        <div className="h-14 md:hidden" />

        <div className="flex flex-1 flex-col gap-4 p-4 sm:gap-6 sm:p-6">
          <header className="flex flex-col gap-2 border-b pb-5">
            <p className="text-sm font-medium uppercase text-muted-foreground">
              {eyebrow}
            </p>
            <div>
              <h1 className="break-words text-2xl font-semibold sm:text-3xl">
                {event.name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatEventDateRange(event)}
              </p>
            </div>
          </header>

          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function toOrganizerSidebarItem(
  item: CrewNavItem,
  eventId: string,
  exact = false,
): CrewEventSidebarNavItem {
  return {
    key: item.key,
    label: item.label,
    href: item.to.replace("$eventId", eventId),
    icon: organizerIconByKey[item.key] ?? Home,
    exact,
  }
}

function getActiveSidebarItemKey(
  navigation: CrewEventSidebarNavigation,
  pathname: string,
) {
  const items = [
    navigation.overview,
    ...navigation.groups.flatMap((group) => group.items),
  ]
  const normalizedPathname = normalizePathname(pathname)

  return items.reduce<string | null>((activeKey, item) => {
    const activeItem = items.find((candidate) => candidate.key === activeKey)
    if (!matchesPathname(item, normalizedPathname)) return activeKey
    if (!activeItem || item.href.length > activeItem.href.length) {
      return item.key
    }
    return activeKey
  }, null)
}

function matchesPathname(
  item: CrewEventSidebarNavItem,
  normalizedPathname: string,
) {
  const normalizedHref = normalizePathname(item.href)
  if (item.exact) return normalizedPathname === normalizedHref
  return (
    normalizedPathname === normalizedHref ||
    normalizedPathname.startsWith(`${normalizedHref}/`)
  )
}

function normalizePathname(pathname: string) {
  if (pathname === "/") return pathname
  return pathname.replace(/\/$/, "")
}

function CrewSidebarNavItem({
  item,
  isActive,
}: {
  item: CrewEventSidebarNavItem
  isActive: boolean
}) {
  const Icon = item.icon
  const { setOpenMobile } = useSidebar()

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
        <Link to={item.href} onClick={() => setOpenMobile(false)}>
          <Icon className="size-4" />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function CrewSidebarHeader({ variant }: { variant: "organizer" | "admin" }) {
  return (
    <SidebarHeader className="h-14 flex-row items-center border-b px-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
      <CrewBrandLink variant={variant} />
    </SidebarHeader>
  )
}

function CrewBrandLink({
  variant,
  compact = false,
}: {
  variant: "organizer" | "admin"
  compact?: boolean
}) {
  const to = variant === "admin" ? "/admin/crew" : "/"
  const label = variant === "admin" ? "Admin" : "Crew"

  return (
    <>
      <Link
        to={to}
        className={cn(
          "flex min-w-0 items-center gap-2",
          compact ? "" : "group-data-[collapsible=icon]:hidden",
        )}
      >
        <img
          src="/wodsmith-logo-no-text.png"
          alt="wodsmith crew"
          width={32}
          height={32}
          className="size-8 shrink-0"
        />
        <span className="text-lg text-foreground whitespace-nowrap">
          <span className="font-black uppercase">wod</span>smith{" "}
          <span className="font-medium text-primary">{label}</span>
        </span>
      </Link>
      {!compact && (
        <Link
          to={to}
          className="hidden group-data-[collapsible=icon]:block"
          aria-label={`WODsmith ${label}`}
        >
          <img
            src="/wodsmith-logo-no-text.png"
            alt=""
            width={24}
            height={24}
            className="size-6"
          />
        </Link>
      )}
    </>
  )
}

function CrewSidebarFooter() {
  return (
    <SidebarFooter className="border-t">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild tooltip="Toggle sidebar">
            <SidebarTrigger className="w-full justify-start" />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  )
}

function formatEventDateRange(event: CrewEventSidebarEvent) {
  const start = event.startDate ?? "Date not set"
  const end = event.endDate ?? null
  if (!end || end === start) return start
  return `${start} to ${end}`
}
