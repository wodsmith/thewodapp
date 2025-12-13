"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
	AlertTriangle,
	Calendar,
	DollarSign,
	Home,
	Medal,
	ReceiptText,
	Sparkles,
	Trophy,
	Users,
	Layers,
} from "lucide-react"
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarInset,
	SidebarTrigger,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"

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

const getNavigation = (basePath: string): { overview: NavItem; groups: NavGroup[] } => ({
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
			],
		},
		{
			label: "Participants",
			items: [
				{ label: "Athletes", href: `${basePath}/athletes`, icon: Users },
				{ label: "Sponsors", href: `${basePath}/sponsors`, icon: Sparkles },
			],
		},
		{
			label: "Run Competition",
			items: [
				{ label: "Schedule", href: `${basePath}/schedule`, icon: Calendar },
				{ label: "Results", href: `${basePath}/results`, icon: Medal },
			],
		},
		{
			label: "Business",
			items: [
				{ label: "Pricing", href: `${basePath}/pricing`, icon: ReceiptText },
				{ label: "Revenue", href: `${basePath}/revenue`, icon: DollarSign },
			],
		},
		{
			label: "Settings",
			items: [
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
					isDestructive && !isActive && "text-destructive/80 hover:text-destructive hover:bg-destructive/10",
					isDestructive && isActive && "bg-destructive/10 text-destructive",
				)}
			>
				<Link href={item.href}>
					<Icon className={cn("h-4 w-4", isDestructive && "text-destructive")} />
					<span>{item.label}</span>
				</Link>
			</SidebarMenuButton>
		</SidebarMenuItem>
	)
}

export function CompetitionSidebar({ competitionId, children }: CompetitionSidebarProps) {
	const pathname = usePathname()
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
			<Sidebar variant="inset" collapsible="icon">
				<SidebarHeader className="h-14 flex-row items-center border-b px-4">
					<SidebarTrigger className="-ml-1" />
					<Separator orientation="vertical" className="mx-2 h-4" />
					<span className="font-semibold text-sm truncate group-data-[collapsible=icon]:hidden">
						Competition
					</span>
				</SidebarHeader>
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
			</Sidebar>
			<SidebarInset>{children}</SidebarInset>
		</SidebarProvider>
	)
}
