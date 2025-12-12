import { createFileRoute, Outlet } from '@tanstack/react-router'
import { MainLayout } from '~/components/layouts/main-layout'

export const Route = createFileRoute('/_main')({
  component: MainLayoutComponent,
})

function MainLayoutComponent() {
  return (
    <MainLayout>
      <Outlet />
    </MainLayout>
  )
}
