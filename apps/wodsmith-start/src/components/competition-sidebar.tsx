/**
 * Competition Sidebar Component
 *
 * Sidebar navigation for organizer competition detail pages.
 * Provides navigation to all competition management sections.
 */

"use client"

import { Link, useRouterState } from "@tanstack/react-router"
import {
  AlertTriangle,
  Calculator,
  Calendar,
  ClipboardSignature,
  Clock,
  DollarSign,
  Handshake,
  Home,
  Layers,
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
import { cn } from "@/utils/cn"

interface CompetitionSidebarProps {
  competitionId: string
  competitionType?: "in-person" | "online"
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
        { label: "Divisions", href: `${basePath}/divisions`, icon: Layers },
        { label: "Events", href: `${basePath}/events`, icon: Trophy },
        // Submission Windows only for online competitions
        ...(competitionType === "online"
          ? [
              {
                label: "Submission Windows",
                href: `${basePath}/submission-windows`,
                icon: Clock,
              },
            ]
          : []),
        { label: "Scoring", href: `${basePath}/scoring`, icon: Calculator },
        { label: "Registrations", href: `${basePath}/athletes`, icon: Users },
        {
          label: "Waivers",
          href: `${basePath}/waivers`,
          icon: ClipboardSignature,
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
              },
            ]
          : []),
        { label: "Locations", href: `${basePath}/locations`, icon: MapPin },
        {
          label: "Volunteers",
          href: `${basePath}/volunteers`,
          icon: UserCheck,
        },
        {
          label: competitionType === "online" ? "Submissions" : "Results",
          href: `${basePath}/results`,
          icon: Medal,
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
        { label: "Pricing", href: `${basePath}/pricing`, icon: ReceiptText },
        { label: "Revenue", href: `${basePath}/revenue`, icon: DollarSign },
        { label: "Coupons", href: `${basePath}/coupons`, icon: Tag },
        { label: "Sponsors", href: `${basePath}/sponsors`, icon: Sparkles },
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
          label: "Danger Zone",
          href: `${basePath}/danger-zone`,
          icon: AlertTriangle,
          variant: "destructive" as const,
        },
      ],
    },
  ],
})

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

function CompetitionSidebarHeader() {
  return (
    <SidebarHeader className="h-14 flex-row items-center border-b px-3 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:justify-center">
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
        <h1 className="text-lg text-foreground whitespace-nowrap">
          <span className="font-black uppercase">wod</span>smith{" "}
          <span className="font-medium text-amber-600 dark:text-amber-500">
            Compete
          </span>
        </h1>
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
  children,
}: CompetitionSidebarProps) {
  const router = useRouterState()
  const pathname = router.location.pathname
  const basePath = `/compete/organizer/${competitionId}`
  const navigation = getNavigation(basePath, competitionType)

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
        <CompetitionSidebarHeader />
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
        <CompetitionSidebarFooter />
      </Sidebar>
      <SidebarInset>
        <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center gap-2 border-b bg-background px-3 md:hidden">
          <SidebarTrigger className="-ml-1">
            <Menu className="h-5 w-5" />
          </SidebarTrigger>
          <Link to="/compete" className="flex items-center gap-2">
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
        </header>
        <div className="h-14 md:hidden" />
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
