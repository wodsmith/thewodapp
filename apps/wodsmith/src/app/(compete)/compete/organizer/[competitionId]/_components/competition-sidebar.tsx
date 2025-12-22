"use client"

import {
	AlertTriangle,
	Calendar,
	ClipboardSignature,
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
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { CompeteSidebarBrand } from "@/components/brand/compete-sidebar-brand"
import { Button } from "@/components/ui/button"
import {
	Sidebar,
	SidebarContent,
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
import { cn } from "@/lib/utils"

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
				{
					label: "Waivers",
					href: `${basePath}/waivers`,
					icon: ClipboardSignature,
				},
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
				<Link href={item.href}>
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
	const { state, toggleSidebar } = useSidebar()

	return (
		<SidebarHeader className="h-14 flex-row items-center border-b px-3 group-data-[collapsible=icon]:px-2">
			{state === "collapsed" ? (
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="h-8 w-8"
					onClick={toggleSidebar}
				>
					<Image
						src="/wodsmith-logo-no-text.png"
						alt=""
						width={24}
						height={24}
						className="size-6"
					/>
					<span className="sr-only">Expand sidebar</span>
				</Button>
			) : (
				<>
					<SidebarTrigger className="-ml-1" />
					<CompeteSidebarBrand className="flex-1" />
				</>
			)}
		</SidebarHeader>
	)
}

export function CompetitionSidebar({
	competitionId,
	children,
}: CompetitionSidebarProps) {
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
			</Sidebar>
			<SidebarInset>{children}</SidebarInset>
		</SidebarProvider>
	)
}
