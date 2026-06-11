/**
 * Admin Documentation CMS — edit page
 *
 * Edit a doc, manage its route mappings, and review/restore previous
 * versions (content-changing saves snapshot the prior state).
 */

import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { format } from "date-fns"
import { History, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  deleteRouteDocFn,
  getRouteDocAdminFn,
  restoreRouteDocVersionFn,
  updateRouteDocFn,
} from "@/server-fns/route-docs-fns"
import {
  RouteDocForm,
  type RouteDocFormValues,
} from "./-components/route-doc-form"

export const Route = createFileRoute("/admin/docs/$docId")({
  loader: async ({ params }) => {
    const { doc } = await getRouteDocAdminFn({
      data: { docId: params.docId },
    })
    return { doc }
  },
  component: EditDocPage,
})

function EditDocPage() {
  const { doc } = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()

  const updateDoc = useServerFn(updateRouteDocFn)
  const deleteDoc = useServerFn(deleteRouteDocFn)
  const restoreVersion = useServerFn(restoreRouteDocVersionFn)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  const handleSubmit = async (values: RouteDocFormValues) => {
    setIsSubmitting(true)
    try {
      await updateDoc({
        data: {
          docId: doc.id,
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
      toast.success("Documentation updated")
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update doc",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRestore = async (versionId: string) => {
    setIsRestoring(true)
    try {
      await restoreVersion({ data: { docId: doc.id, versionId } })
      toast.success("Version restored")
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to restore version",
      )
    } finally {
      setIsRestoring(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteDoc({ data: { docId: doc.id } })
      toast.success("Documentation deleted")
      navigate({ to: "/admin/docs" })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete doc",
      )
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
        <span className="text-foreground">{doc.title}</span>
      </nav>

      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Edit documentation</h1>
            <p className="mt-1 text-muted-foreground">
              Changes to content create a restorable version snapshot
            </p>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this doc?</AlertDialogTitle>
                <AlertDialogDescription>
                  "{doc.title}" and its version history will be permanently
                  deleted. It will disappear from the docs drawer on all mapped
                  routes.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <RouteDocForm
          key={`${doc.id}-${doc.updateCounter}`}
          initialValues={{
            title: doc.title,
            description: doc.description ?? "",
            type: doc.type,
            content: doc.content ?? "",
            videoUrl: doc.videoUrl ?? "",
            linkUrl: doc.linkUrl ?? "",
            isPublished: doc.isPublished,
            sortOrder: doc.sortOrder,
            routeIds: doc.routes.map((route) => route.routeId),
          }}
          submitLabel="Save changes"
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5" />
              Version history
            </CardTitle>
            <CardDescription>
              Snapshots of previous content — restore any version (the current
              state is snapshotted first, so restores are reversible)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {doc.versions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No versions yet. Saving content changes will record one.
              </p>
            ) : (
              <div className="space-y-2">
                {doc.versions.map((version) => (
                  <div
                    key={version.id}
                    className="flex items-center justify-between gap-4 rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">v{version.version}</Badge>
                        <span className="truncate text-sm font-medium">
                          {version.title}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Saved{" "}
                        {format(
                          new Date(version.createdAt),
                          "MMM d, yyyy 'at' h:mm a",
                        )}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isRestoring}
                      onClick={() => handleRestore(version.id)}
                    >
                      Restore
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
