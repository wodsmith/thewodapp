/**
 * Admin Documentation CMS — create page
 */

import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"
import { toast } from "sonner"
import { z } from "zod"
import {
  createRouteDocFn,
  getNextSortOrderForRouteFn,
} from "@/server-fns/route-docs-fns"
import {
  RouteDocForm,
  type RouteDocFormValues,
} from "./-components/route-doc-form"

const newDocSearchSchema = z.object({
  // Optional route id to pre-map the new doc to (from the list page + buttons).
  routeId: z.string().min(1).max(255).optional(),
})

export const Route = createFileRoute("/admin/docs/new")({
  validateSearch: newDocSearchSchema,
  loaderDeps: ({ search }) => ({ routeId: search.routeId }),
  loader: async ({ deps }) => {
    // Pre-mapping to a route? Default the new doc to the end of that group.
    if (!deps.routeId) return { sortOrder: 1 }
    const { sortOrder } = await getNextSortOrderForRouteFn({
      data: { routeId: deps.routeId },
    })
    return { sortOrder }
  },
  component: NewDocPage,
})

function NewDocPage() {
  const navigate = useNavigate()
  const router = useRouter()
  const { routeId } = Route.useSearch()
  const { sortOrder } = Route.useLoaderData()
  const createDoc = useServerFn(createRouteDocFn)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (values: RouteDocFormValues) => {
    setIsSubmitting(true)
    try {
      await createDoc({
        data: {
          title: values.title.trim(),
          description: values.description.trim() || undefined,
          type: values.type,
          content: values.content || undefined,
          videoUrl: values.videoUrl.trim() || undefined,
          linkUrl: values.linkUrl.trim() || undefined,
          isPublished: values.isPublished,
          sortOrder: values.sortOrder,
          routeIds: values.routeIds,
        },
      })
      toast.success("Documentation created")
      // Invalidate so the list page loader refetches the new doc.
      await router.invalidate()
      navigate({ to: "/admin/docs" })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create doc",
      )
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl">
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
        <Link to="/admin" className="hover:text-foreground">
          Admin
        </Link>
        <span>/</span>
        <Link to="/admin/docs" className="hover:text-foreground">
          Documentation
        </Link>
        <span>/</span>
        <span className="text-foreground">New</span>
      </nav>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">New documentation</h1>
          <p className="mt-1 text-muted-foreground">
            Create contextual help and map it to organizer pages
          </p>
        </div>

        <RouteDocForm
          submitLabel="Create doc"
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          initialValues={
            routeId ? { routeIds: [routeId], sortOrder } : undefined
          }
        />
      </div>
    </div>
  )
}
