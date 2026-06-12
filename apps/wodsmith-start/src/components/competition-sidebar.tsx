/**
 * Competition Sidebar Component
 *
 * Sidebar navigation for competition management pages, shared by organizer and
 * cohost dashboards. Organizer mode shows every section; cohost mode filters
 * nav items by the cohost's granted permissions and links under /compete/cohost.
 * Nav items declare their cohost permission key here so new organizer sections
 * automatically show up for cohosts once a permission is assigned.
 */

"use client"

import { Link, useRouterState } from "@tanstack/react-router"
import {
  AlertTriangle,
  BarChart3,
  Calculator,
  Calendar,
  ClipboardCheck,
  ClipboardSignature,
  Clock,
  DollarSign,
  Grid3X3,
  Handshake,
  Home,
  Layers,
  Mail,
  MapPin,
  Medal,
  Megaphone,
  Menu,
  ReceiptText,
  Settings,
  Sparkles,
  Tag,
  Trophy,
  UserCheck,
  Users,
} from "lucide-react"
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
import type { CohostMembershipMetadata } from "@/db/schemas/cohost"
import { cn } from "@/utils/cn"

interface CohostSidebarContext {
  competitionName: string
  permissions: CohostMembershipMetadata
}

interface CompetitionSidebarProps {
  competitionId: string
  competitionType?: "in-person" | "online"
  /** When set, renders the cohost variant: nav filtered by permissions, links under /compete/cohost. */
  cohost?: CohostSidebarContext
  children: React.ReactNode
}

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  variant?: "default" | "destructive"
  /**
   * Cohost permission required to see this item. Items without a permission
   * key are organizer-only and never shown to cohosts.
   */
  cohostPermission?: keyof CohostMembershipMetadata
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const getNavigation = (
  basePath: string,
  competitionType?: "in-person" | "online",
): { overview: NavItem; groups: NavGroup[] } => ({
  overview: {
    label: "Overview",
    href: basePath,
    icon: Home,
  },
  groups: [
    {
      label: "Competition Setup",
      items: [
        {
          label: "Divisions",
          href: `${basePath}/divisions`,
          icon: Layers,
          cohostPermission: "divisions",
        },
        {
          label: "Events",
          href: `${basePath}/events`,
          icon: Trophy,
          cohostPermission: "editEvents",
        },
        {
          label: "Locations",
          href: `${basePath}/locations`,
          icon: MapPin,
          cohostPermission: "locations",
        },
        {
          label: "Event divisions",
          href: `${basePath}/event-divisions`,
          icon: Grid3X3,
        },
        // Submission Windows only for online competitions
        ...(competitionType === "online"
          ? [
              {
                label: "Submission windows",
                href: `${basePath}/submission-windows`,
                icon: Clock,
                cohostPermission: "editEvents" as const,
              },
            ]
          : []),
        {
          label: "Scoring",
          href: `${basePath}/scoring`,
          icon: Calculator,
          cohostPermission: "scoringConfig",
        },
        {
          label: "Registrations",
          href: `${basePath}/athletes`,
          icon: Users,
          cohostPermission: "viewRegistrations",
        },
        { label: "Invites", href: `${basePath}/invites`, icon: Mail },
        {
          label: "Waivers",
          href: `${basePath}/waivers`,
          icon: ClipboardSignature,
          cohostPermission: "waivers",
        },
      ],
    },
    {
      label: "Run Competition",
      items: [
        // Schedule only for in-person competitions
        ...(competitionType !== "online"
          ? [
              {
                label: "Schedule",
                href: `${basePath}/schedule`,
                icon: Calendar,
                cohostPermission: "schedule" as const,
              },
            ]
          : []),
        // Check-in landing page only for in-person competitions; it explains
        // the flow and opens the volunteer-facing kiosk in a new tab.
        ...(competitionType !== "online"
          ? [
              {
                label: "Check-in",
                href: `${basePath}/check-in`,
                icon: ClipboardCheck,
              },
            ]
          : []),
        {
          label: "Volunteers",
          href: `${basePath}/volunteers`,
          icon: UserCheck,
          cohostPermission: "volunteers",
        },
        {
          label: competitionType === "online" ? "Submissions" : "Results",
          href: `${basePath}/results`,
          icon: Medal,
          cohostPermission: "results",
        },
        {
          label: "Leaderboard preview",
          href: `${basePath}/leaderboard-preview`,
          icon: BarChart3,
          cohostPermission: "leaderboardPreview",
        },
        {
          label: "Broadcasts",
          href: `${basePath}/broadcasts`,
          icon: Megaphone,
        },
      ],
    },
    {
      label: "Business",
      items: [
        {
          label: "Pricing",
          href: `${basePath}/pricing`,
          icon: ReceiptText,
          cohostPermission: "pricing",
        },
        {
          label: "Revenue",
          href: `${basePath}/revenue`,
          icon: DollarSign,
          cohostPermission: "revenue",
        },
        {
          label: "Coupons",
          href: `${basePath}/coupons`,
          icon: Tag,
          cohostPermission: "coupons",
        },
        {
          label: "Sponsors",
          href: `${basePath}/sponsors`,
          icon: Sparkles,
          cohostPermission: "sponsors",
        },
        {
          label: "Co-Hosts",
          href: `${basePath}/co-hosts`,
          icon: Handshake,
        },
      ],
    },
    {
      label: "Settings",
      items: [
        { label: "Settings", href: `${basePath}/settings`, icon: Settings },
        {
          label: "Danger zone",
          href: `${basePath}/danger-zone`,
          icon: AlertTriangle,
          variant: "destructive" as const,
        },
      ],
    },
  ],
})

/** Filter nav groups down to items the cohost has permission to see. */
const filterForCohost = (
  groups: NavGroup[],
  permissions: CohostMembershipMetadata,
): NavGroup[] =>
  groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => item.cohostPermission && permissions[item.cohostPermission],
      ),
    }))
    .filter((group) => group.items.length > 0)

function NavMenuItem({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon
  const isDestructive = item.variant === "destructive"
  const { setOpenMobile } = useSidebar()

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={item.label}
        className={cn(
          isDestructive &&
            !isActive &&
            "text-destructive/80 hover:text-destructive hover:bg-destructive/10",
          isDestructive && isActive && "bg-destructive/10 text-destructive",
        )}
      >
        <Link to={item.href} onClick={() => setOpenMobile(false)}>
          <Icon
            className={cn("h-4 w-4", isDestructive && "text-destructive")}
          />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function CompetitionSidebarHeader({
  cohost,
}: {
  cohost?: CohostSidebarContext
}) {
  return (
    <SidebarHeader
      className={cn(
        "border-b px-3 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:justify-center",
        cohost
          ? "py-3 group-data-[collapsible=icon]:py-3"
          : "h-14 flex-row items-center",
      )}
    >
      {/* @lat: [[architecture#Route Groups#compete]] */}
      <Link
        to="/"
        className="flex items-center gap-2 min-w-0 group-data-[collapsible=icon]:hidden"
      >
        <img
          src="/wodsmith-logo-no-text.png"
          alt="wodsmith compete"
          width={32}
          height={32}
          className="shrink-0"
        />
        <div className="flex flex-col leading-tight">
          <h1 className="text-lg text-foreground whitespace-nowrap">
            <span className="font-black uppercase">wod</span>smith{" "}
            <span className="font-medium text-amber-600 dark:text-amber-500">
              Compete
            </span>
          </h1>
          {cohost && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-500">
              Co-Hosting
            </span>
          )}
        </div>
      </Link>
      {/* @lat: [[architecture#Route Groups#compete]] */}
      <Link to="/" className="hidden group-data-[collapsible=icon]:block">
        <img
          src="/wodsmith-logo-no-text.png"
          alt="wodsmith compete"
          width={24}
          height={24}
          className="size-6"
        />
      </Link>
      {cohost && (
        <p className="mt-1 truncate text-sm font-medium text-muted-foreground group-data-[collapsible=icon]:hidden">
          {cohost.competitionName}
        </p>
      )}
    </SidebarHeader>
  )
}

function CompetitionSidebarFooter() {
  return (
    <SidebarFooter className="border-t">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild tooltip="Toggle Sidebar">
            <SidebarTrigger className="w-full justify-start" />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  )
}

export function CompetitionSidebar({
  competitionId,
  competitionType,
  cohost,
  children,
}: CompetitionSidebarProps) {
  const router = useRouterState()
  const pathname = router.location.pathname
  const basePath = cohost
    ? `/compete/cohost/${competitionId}`
    : `/compete/organizer/${competitionId}`
  const navigation = getNavigation(basePath, competitionType)
  const groups = cohost
    ? filterForCohost(navigation.groups, cohost.permissions)
    : navigation.groups

  const isActive = (href: string) => {
    if (href === basePath) {
      // Overview is active only when exactly on base path
      return pathname === basePath
    }
    return pathname.startsWith(href)
  }

  return (
    <SidebarProvider>
      <Sidebar variant="sidebar" collapsible="icon">
        <CompetitionSidebarHeader cohost={cohost} />
        <SidebarRail />
        <SidebarContent>
          {/* Overview - standalone at top */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <NavMenuItem
                  item={navigation.overview}
                  isActive={isActive(navigation.overview.href)}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Grouped navigation */}
          {groups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <NavMenuItem
                      key={item.href}
                      item={item}
                      isActive={isActive(item.href)}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <CompetitionSidebarFooter />
      </Sidebar>
      <SidebarInset>
        <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center gap-2 border-b bg-background px-3 md:hidden">
          <SidebarTrigger className="-ml-1">
            <Menu className="h-5 w-5" />
          </SidebarTrigger>
          {/* @lat: [[architecture#Route Groups#compete]] */}
          {cohost ? (
            <div className="flex items-center gap-2 min-w-0">
              <Link to="/" className="flex items-center gap-2 shrink-0">
                <img
                  src="/wodsmith-logo-no-text.png"
                  alt="wodsmith compete"
                  width={24}
                  height={24}
                />
              </Link>
              <span className="truncate text-sm font-medium">
                {cohost.competitionName}
              </span>
            </div>
          ) : (
            <Link to="/" className="flex items-center gap-2">
              <img
                src="/wodsmith-logo-no-text.png"
                alt="wodsmith compete"
                width={24}
                height={24}
              />
              <span className="text-sm font-semibold">
                <span className="font-black uppercase">wod</span>smith{" "}
                <span className="font-medium text-amber-600 dark:text-amber-500">
                  Compete
                </span>
              </span>
            </Link>
          )}
        </header>
        <div className="h-14 md:hidden" />
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
