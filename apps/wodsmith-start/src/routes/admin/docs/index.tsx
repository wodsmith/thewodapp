/**
 * Admin Documentation CMS — list page
 *
 * Lists all documentation drawer entries with their type, mapped routes,
 * and publish state. Entry point for the lightweight docs CMS.
 */

import { createFileRoute, Link } from "@tanstack/react-router"
import { format } from "date-fns"
import { BookOpen, ExternalLink, FileText, Plus, Video } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { AdminRouteDoc } from "@/server-fns/route-docs-fns"
import { getAllRouteDocsAdminFn } from "@/server-fns/route-docs-fns"

export const Route = createFileRoute("/admin/docs/")({
  loader: async () => {
    const { docs } = await getAllRouteDocsAdminFn()
    return { docs }
  },
  component: AdminDocsPage,
})

const TYPE_META = {
  markdown: { label: "Article", icon: FileText },
  video: { label: "Video", icon: Video },
  link: { label: "Link", icon: ExternalLink },
} as const

function AdminDocsPage() {
  const { docs } = Route.useLoaderData()

  return (
    <div className="max-w-4xl">
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
        <Link to="/admin" className="hover:text-foreground">
          Admin
        </Link>
        <span>/</span>
        <span className="text-foreground">Documentation</span>
      </nav>

      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Documentation</h1>
            <p className="mt-1 text-muted-foreground">
              Contextual help shown in the docs drawer on organizer pages
            </p>
          </div>
          <Button asChild>
            <Link to="/admin/docs/new">
              <Plus className="h-4 w-4" />
              New doc
            </Link>
          </Button>
        </div>

        {docs.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5" />
                No documentation yet
              </CardTitle>
              <CardDescription>
                Create your first doc and map it to organizer routes — it will
                appear in the docs drawer on those pages.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-3">
            {docs.map((doc) => (
              <DocCard key={doc.id} doc={doc} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DocCard({ doc }: { doc: AdminRouteDoc }) {
  const meta = TYPE_META[doc.type]
  const Icon = meta.icon

  return (
    <Link to="/admin/docs/$docId" params={{ docId: doc.id }} className="block">
      <Card className="transition-colors hover:bg-accent/50">
        <CardContent className="flex items-start justify-between gap-4 p-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{doc.title}</span>
              <Badge variant="outline" className="gap-1">
                <Icon className="h-3 w-3" />
                {meta.label}
              </Badge>
              {doc.isPublished ? (
                <Badge>Published</Badge>
              ) : (
                <Badge variant="secondary">Draft</Badge>
              )}
            </div>
            {doc.description && (
              <p className="truncate text-sm text-muted-foreground">
                {doc.description}
              </p>
            )}
            <p className="truncate font-mono text-xs text-muted-foreground">
              {doc.routes.length === 0
                ? "No routes mapped"
                : doc.routes.map((route) => route.routeId).join(", ")}
            </p>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            Updated {format(new Date(doc.updatedAt), "MMM d, yyyy")}
          </span>
        </CardContent>
      </Card>
    </Link>
  )
}
