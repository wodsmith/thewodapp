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
	Calendar,
	DollarSign,
	Home,
	Layers,
	Medal,
	ReceiptText,
	Settings,
	Sparkles,
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
} from "@/components/ui/sidebar"
import { cn } from "@/utils/cn"

interface CompetitionSidebarProps {
	competitionId: string
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
				{ label: "Registrations", href: `${basePath}/athletes`, icon: Users },
			],
		},
		{
			label: "Run Competition",
			items: [
				{ label: "Schedule", href: `${basePath}/schedule`, icon: Calendar },
				{
					label: "Volunteers",
					href: `${basePath}/volunteers`,
					icon: UserCheck,
				},
				{ label: "Results", href: `${basePath}/results`, icon: Medal },
			],
		},
		{
			label: "Business",
			items: [
				{ label: "Pricing", href: `${basePath}/pricing`, icon: ReceiptText },
				{ label: "Revenue", href: `${basePath}/revenue`, icon: DollarSign },
				{ label: "Sponsors", href: `${basePath}/sponsors`, icon: Sparkles },
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
				<Link to={item.href}>
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
	children,
}: CompetitionSidebarProps) {
	const router = useRouterState()
	const pathname = router.location.pathname
	const basePath = `/compete/organizer/${competitionId}`
	const navigation = getNavigation(basePath)

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
			<SidebarInset>{children}</SidebarInset>
		</SidebarProvider>
	)
}
