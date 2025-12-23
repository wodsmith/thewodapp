import {createFileRoute, Outlet} from '@tanstack/react-router'

export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <div className="min-h-screen bg-background">
      {/* TODO: Add navigation header if needed */}
      <main>
        <Outlet />
      </main>
      {/* TODO: Add footer if needed */}
    </div>
  )
}
