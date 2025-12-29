import { createFileRoute, Outlet } from "@tanstack/react-router"
import { SettingsSidebar } from "@/components/settings/settings-sidebar"

export const Route = createFileRoute("/_protected/settings")({
	component: SettingsLayout,
})

function SettingsLayout() {
	return (
		<div className="flex flex-col max-w-screen-xl mx-auto">
			<header className="hidden md:flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
				<div className="flex items-center gap-2 px-4">
					<h1 className="text-lg font-semibold">Settings</h1>
				</div>
			</header>
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				<div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
					<aside className="lg:w-1/5">
						<SettingsSidebar />
					</aside>
					<div className="flex-1">
						<Outlet />
					</div>
				</div>
			</div>
		</div>
	)
}
