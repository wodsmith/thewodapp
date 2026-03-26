/**
 * Cohost Sidebar Component
 *
 * Sidebar navigation for cohost competition detail pages.
 * Mirrors the organizer sidebar but filters nav items based on cohost permissions.
 */

"use client"

import { Link, useRouterState } from "@tanstack/react-router"
import {
  Calculator,
  Calendar,
  ClipboardSignature,
  Clock,
  DollarSign,
  Home,
  Layers,
  MapPin,
  Medal,
  Menu,
  ReceiptText,
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

interface CohostSidebarProps {
  competitionId: string
  competitionName: string
  competitionType?: "in-person" | "online"
  permissions: CohostMembershipMetadata
  children: React.ReactNode
}

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  variant?: "default" | "destructive"
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const getNavigation = (
  basePath: string,
  competitionType?: "in-person" | "online",
  permissions?: CohostMembershipMetadata,
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
        ...(permissions?.divisions
          ? [{ label: "Divisions", href: `${basePath}/divisions`, icon: Layers }]
          : []),
        ...(permissions?.events
          ? [
              { label: "Events", href: `${basePath}/events`, icon: Trophy },
              ...(competitionType === "online"
                ? [
                    {
                      label: "Submission Windows",
                      href: `${basePath}/submission-windows`,
                      icon: Clock,
                    },
                  ]
                : []),
            ]
          : []),
        ...(permissions?.scoring
          ? [{ label: "Scoring", href: `${basePath}/scoring`, icon: Calculator }]
          : []),
        ...(permissions?.viewRegistrations || permissions?.editRegistrations
          ? [{ label: "Registrations", href: `${basePath}/athletes`, icon: Users }]
          : []),
        ...(permissions?.waivers
          ? [
              {
                label: "Waivers",
                href: `${basePath}/waivers`,
                icon: ClipboardSignature,
              },
            ]
          : []),
      ],
    },
    {
      label: "Run Competition",
      items: [
        ...(competitionType !== "online" && permissions?.schedule
          ? [
              {
                label: "Schedule",
                href: `${basePath}/schedule`,
                icon: Calendar,
              },
            ]
          : []),
        ...(permissions?.locations
          ? [{ label: "Locations", href: `${basePath}/locations`, icon: MapPin }]
          : []),
        ...(permissions?.volunteers
          ? [
              {
                label: "Volunteers",
                href: `${basePath}/volunteers`,
                icon: UserCheck,
              },
            ]
          : []),
        ...(permissions?.results
          ? [
              {
                label: competitionType === "online" ? "Submissions" : "Results",
                href: `${basePath}/results`,
                icon: Medal,
              },
            ]
          : []),
      ],
    },
    {
      label: "Business",
      items: [
        ...(permissions?.pricing
          ? [
              {
                label: "Pricing",
                href: `${basePath}/pricing`,
                icon: ReceiptText,
              },
            ]
          : []),
        ...(permissions?.revenue
          ? [
              {
                label: "Revenue",
                href: `${basePath}/revenue`,
                icon: DollarSign,
              },
            ]
          : []),
        ...(permissions?.coupons
          ? [
              {
                label: "Coupons",
                href: `${basePath}/coupons`,
                icon: Tag,
              },
            ]
          : []),
        ...(permissions?.sponsors
          ? [{ label: "Sponsors", href: `${basePath}/sponsors`, icon: Sparkles }]
          : []),
      ],
    },
  ].filter((group) => group.items.length > 0),
})

function NavMenuItem({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon
  const { setOpenMobile } = useSidebar()

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
        <Link to={item.href} onClick={() => setOpenMobile(false)}>
          <Icon className="h-4 w-4" />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function CohostSidebarHeader({ competitionName }: { competitionName: string }) {
  return (
    <SidebarHeader className="border-b px-3 py-3 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3 group-data-[collapsible=icon]:justify-center">
      <Link
        to="/compete"
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
          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-500">
            Co-Hosting
          </span>
        </div>
      </Link>
      <Link
        to="/compete"
        className="hidden group-data-[collapsible=icon]:block"
      >
        <img
          src="/wodsmith-logo-no-text.png"
          alt="wodsmith compete"
          width={24}
          height={24}
          className="size-6"
        />
      </Link>
      <p className="mt-1 truncate text-sm font-medium text-muted-foreground group-data-[collapsible=icon]:hidden">
        {competitionName}
      </p>
    </SidebarHeader>
  )
}

function CohostSidebarFooter() {
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

export function CohostSidebar({
  competitionId,
  competitionName,
  competitionType,
  permissions,
  children,
}: CohostSidebarProps) {
  const router = useRouterState()
  const pathname = router.location.pathname
  const basePath = `/compete/cohost/${competitionId}`
  const navigation = getNavigation(basePath, competitionType, permissions)

  const isActive = (href: string) => {
    if (href === basePath) {
      return pathname === basePath
    }
    return pathname.startsWith(href)
  }

  return (
    <SidebarProvider>
      <Sidebar variant="sidebar" collapsible="icon">
        <CohostSidebarHeader competitionName={competitionName} />
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
          {navigation.groups.map((group) => (
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
        <CohostSidebarFooter />
      </Sidebar>
      <SidebarInset>
        <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center gap-2 border-b bg-background px-3 md:hidden">
          <SidebarTrigger className="-ml-1">
            <Menu className="h-5 w-5" />
          </SidebarTrigger>
          <div className="flex items-center gap-2 min-w-0">
            <Link to="/compete" className="flex items-center gap-2 shrink-0">
              <img
                src="/wodsmith-logo-no-text.png"
                alt="wodsmith compete"
                width={24}
                height={24}
              />
            </Link>
            <span className="truncate text-sm font-medium">{competitionName}</span>
          </div>
        </header>
        <div className="h-14 md:hidden" />
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
