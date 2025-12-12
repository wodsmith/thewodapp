import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { MainNav } from '~/components/nav/main-nav'
import { SettingsBreadcrumbs } from '~/components/settings/settings-breadcrumbs'
import { SettingsSidebar } from '~/components/settings/settings-sidebar'
import { getSessionFromCookie } from '~/utils/auth.server'

export const Route = createFileRoute('/_settings')({
	beforeLoad: async () => {
		const session = await getSessionFromCookie()
		if (!session) {
			throw redirect({ to: '/sign-in' })
		}
	},
	component: SettingsLayout,
})

function SettingsLayout() {
	return (
		<div className="sm:h-screen">
			<MainNav />
			<div className="flex flex-col max-w-screen-xl mx-auto">
				<header className="hidden md:flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
					<div className="flex items-center gap-2 px-4">
						<SettingsBreadcrumbs />
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
		</div>
	)
}
