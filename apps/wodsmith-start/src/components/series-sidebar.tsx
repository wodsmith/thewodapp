"use client"

import { Link, useRouterState } from "@tanstack/react-router"
import {
  Calendar,
  Home,
  Layers,
  Menu,
  Pencil,
  Trophy,
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

interface SeriesSidebarProps {
  groupId: string
  children: React.ReactNode
}

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const getNavigation = (
  basePath: string,
): { overview: NavItem; groups: NavGroup[] } => ({
  overview: {
    label: "Overview",
    href: basePath,
    icon: Home,
  },
  groups: [
    {
      label: "Series Setup",
      items: [
        { label: "Edit Series", href: `${basePath}/edit`, icon: Pencil },
        { label: "Divisions", href: `${basePath}/divisions`, icon: Layers },
      ],
    },
    {
      label: "Events",
      items: [
        {
          label: "Event Templates",
          href: `${basePath}/events`,
          icon: Calendar,
        },
        {
          label: "Event Mappings",
          href: `${basePath}/event-mappings`,
          icon: Calendar,
        },
      ],
    },
    {
      label: "Leaderboard",
      items: [
        {
          label: "Global Leaderboard",
          href: `${basePath}/leaderboard`,
          icon: Trophy,
        },
      ],
    },
  ],
})

function NavMenuItem({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon
  const { setOpenMobile } = useSidebar()

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={item.label}
      >
        <Link to={item.href} onClick={() => setOpenMobile(false)}>
          <Icon className="h-4 w-4" />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function SeriesSidebarHeader() {
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

function SeriesSidebarFooter() {
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

export function SeriesSidebar({
  groupId,
  children,
}: SeriesSidebarProps) {
  const router = useRouterState()
  const pathname = router.location.pathname
  const basePath = `/compete/organizer/series/${groupId}`
  const navigation = getNavigation(basePath)

  const isActive = (href: string) => {
    if (href === basePath) {
      return pathname === basePath || pathname === `${basePath}/`
    }
    return pathname.startsWith(href)
  }

  return (
    <SidebarProvider>
      <Sidebar variant="sidebar" collapsible="icon">
        <SeriesSidebarHeader />
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
        <SeriesSidebarFooter />
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
