/**
 * Integration test utility: renders the full app route tree at a given URL
 * using TanStack Router's createMemoryHistory for in-memory routing.
 *
 * Usage:
 *   const { router } = await renderWithRouter({ initialUrl: '/compete/test-comp' })
 *   expect(await screen.findByText('My Competition')).toBeInTheDocument()
 */
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import {render, type RenderResult} from '@testing-library/react'
import {routeTree} from '@/routeTree.gen'

interface RenderWithRouterOptions {
  /** The initial URL to navigate to */
  initialUrl: string
}

export async function renderWithRouter({
  initialUrl,
}: RenderWithRouterOptions): Promise<
  RenderResult & {router: ReturnType<typeof createRouter>}
> {
  const memoryHistory = createMemoryHistory({
    initialEntries: [initialUrl],
  })

  const router = createRouter({
    routeTree,
    history: memoryHistory,
    defaultPreload: false,
    defaultOnCatch: (error) => {
      console.error('[Router Error]', error)
    },
  })

  // Ensure all loaders complete before rendering
  await router.load()

  const result = render(<RouterProvider router={router} />)

  return {...result, router}
}
