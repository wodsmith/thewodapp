/**
 * Admin Documentation CMS — create page
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"
import { toast } from "sonner"
import { createRouteDocFn } from "@/server-fns/route-docs-fns"
import {
  RouteDocForm,
  type RouteDocFormValues,
} from "./-components/route-doc-form"

export const Route = createFileRoute("/admin/docs/new")({
  component: NewDocPage,
})

function NewDocPage() {
  const navigate = useNavigate()
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
        <a href="/admin" className="hover:text-foreground">
          Admin
        </a>
        <span>/</span>
        <a href="/admin/docs" className="hover:text-foreground">
          Documentation
        </a>
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
        />
      </div>
    </div>
  )
}
