/**
 * Admin Documentation CMS — list page
 *
 * Lists all documentation drawer entries grouped by the route they are
 * mapped to. Each route group is collapsible and searchable, and the docs
 * within a group can be drag-reordered — the order maps to each doc's
 * `sortOrder`, which is the order the drawer renders them in.
 */

import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine"
import {
  draggable,
  dropTargetForElements,
  type ElementDropTargetEventBasePayload,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { pointerOutsideOfPreview } from "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview"
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview"
import {
  attachClosestEdge,
  type Edge,
  extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge"
import { DropIndicator } from "@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { format } from "date-fns"
import {
  BookOpen,
  ChevronRight,
  ExternalLink,
  FileText,
  GripVertical,
  Plus,
  PlusCircle,
  Search,
  Video,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import type { AdminRouteDoc } from "@/server-fns/route-docs-fns"
import {
  getAllRouteDocsAdminFn,
  reorderRouteDocsFn,
} from "@/server-fns/route-docs-fns"
import { cn } from "@/utils/cn"

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

const NO_ROUTE_KEY = "__no_route__"
const NO_ROUTE_LABEL = "No routes mapped"

interface RouteGroup {
  routeId: string
  label: string
  docs: AdminRouteDoc[]
}

/**
 * Group docs by the route they are mapped to. A doc mapped to multiple
 * routes appears under each route group; unmapped docs collect under a
 * dedicated "No routes mapped" group sorted last. Docs within a group are
 * ordered by sortOrder (then title) to mirror the drawer's ordering.
 */
function groupDocsByRoute(docs: AdminRouteDoc[]): RouteGroup[] {
  const groups = new Map<string, AdminRouteDoc[]>()

  for (const doc of docs) {
    if (doc.routes.length === 0) {
      const existing = groups.get(NO_ROUTE_KEY) ?? []
      existing.push(doc)
      groups.set(NO_ROUTE_KEY, existing)
      continue
    }
    for (const route of doc.routes) {
      const existing = groups.get(route.routeId) ?? []
      existing.push(doc)
      groups.set(route.routeId, existing)
    }
  }

  return Array.from(groups.entries())
    .map(([routeId, groupDocs]) => ({
      routeId,
      label: routeId === NO_ROUTE_KEY ? NO_ROUTE_LABEL : routeId,
      docs: [...groupDocs].sort(
        (a, b) =>
          a.sortOrder - b.sortOrder || a.title.localeCompare(b.title),
      ),
    }))
    .sort((a, b) => {
      // Keep the unmapped group last; otherwise sort by route id.
      if (a.routeId === NO_ROUTE_KEY) return 1
      if (b.routeId === NO_ROUTE_KEY) return -1
      return a.label.localeCompare(b.label)
    })
}

function AdminDocsPage() {
  const loaderData = Route.useLoaderData()
  const reorderDocs = useServerFn(reorderRouteDocsFn)
  const [query, setQuery] = useState("")
  // Local copy so drag-reorders apply optimistically without a refetch.
  const [docs, setDocs] = useState<AdminRouteDoc[]>(loaderData.docs)

  // Re-sync when the loader refetches (e.g. after a doc is created/edited).
  useEffect(() => {
    setDocs(loaderData.docs)
  }, [loaderData.docs])

  const groups = useMemo(() => groupDocsByRoute(docs), [docs])

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groups
    return groups.filter((group) => group.label.toLowerCase().includes(q))
  }, [groups, query])

  // Reorder docs within a single group, reassign their sortOrder, and
  // persist. Optimistic — reverts to the prior order if the save fails.
  const handleReorder = useCallback(
    async (group: RouteGroup, sourceIndex: number, targetIndex: number) => {
      const ordered = [...group.docs]
      const [moved] = ordered.splice(sourceIndex, 1)
      if (!moved) return
      ordered.splice(targetIndex, 0, moved)

      const updates = ordered.map((doc, i) => ({
        docId: doc.id,
        sortOrder: i + 1,
      }))
      const sortMap = new Map(updates.map((u) => [u.docId, u.sortOrder]))

      const previous = docs
      setDocs((prev) =>
        prev.map((doc) =>
          sortMap.has(doc.id)
            ? { ...doc, sortOrder: sortMap.get(doc.id) as number }
            : doc,
        ),
      )

      try {
        await reorderDocs({ data: { docs: updates } })
      } catch (error) {
        setDocs(previous)
        toast.error(
          error instanceof Error ? error.message : "Failed to reorder docs",
        )
      }
    },
    [docs, reorderDocs],
  )

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
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search routes…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {filteredGroups.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No routes match “{query}”
              </p>
            ) : (
              <div className="space-y-3">
                {filteredGroups.map((group) => {
                  const searching = query.trim().length > 0
                  return (
                    <RouteGroupSection
                      // Key on search state so defaultOpen re-applies (remount)
                      // when toggling between searching and browsing.
                      key={`${group.routeId}:${searching}`}
                      group={group}
                      // Auto-expand when searching so matches are visible.
                      defaultOpen={searching}
                      onReorder={handleReorder}
                    />
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function RouteGroupSection({
  group,
  defaultOpen,
  onReorder,
}: {
  group: RouteGroup
  defaultOpen: boolean
  onReorder: (
    group: RouteGroup,
    sourceIndex: number,
    targetIndex: number,
  ) => void
}) {
  // Remount on search state change so defaultOpen takes effect.
  const [open, setOpen] = useState(defaultOpen)
  // Scope drag-and-drop to this group so docs can't be dropped across groups.
  const [instanceId] = useState(() => Symbol("docs-group"))

  // The unmapped group has no concrete route to pre-fill, so no + button.
  const mappable = group.routeId !== NO_ROUTE_KEY
  const sortable = group.docs.length > 1

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-lg border"
    >
      <div className="flex items-center hover:bg-accent/50">
        <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 px-4 py-3 text-left">
          <ChevronRight
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90",
            )}
          />
          <span className="min-w-0 flex-1 truncate font-mono text-sm">
            {group.label}
          </span>
          <Badge variant="secondary" className="shrink-0">
            {group.docs.length}
          </Badge>
        </CollapsibleTrigger>
        {mappable && (
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="mr-2 shrink-0"
            title={`Add a doc for ${group.label}`}
          >
            <Link
              to="/admin/docs/new"
              search={{ routeId: group.routeId }}
              onClick={(e) => e.stopPropagation()}
            >
              <PlusCircle className="h-4 w-4" />
              <span className="sr-only">Add a doc for {group.label}</span>
            </Link>
          </Button>
        )}
      </div>
      <CollapsibleContent>
        <div className="space-y-2 border-t p-3">
          {group.docs.map((doc, index) => (
            <DraggableDocCard
              key={doc.id}
              doc={doc}
              index={index}
              instanceId={instanceId}
              sortable={sortable}
              onDrop={(sourceIndex, targetIndex) =>
                onReorder(group, sourceIndex, targetIndex)
              }
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function DraggableDocCard({
  doc,
  index,
  instanceId,
  sortable,
  onDrop,
}: {
  doc: AdminRouteDoc
  index: number
  instanceId: symbol
  sortable: boolean
  onDrop: (sourceIndex: number, targetIndex: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const dragHandleRef = useRef<HTMLButtonElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null)
  const closestEdgeRef = useRef<Edge | null>(null)

  const updateClosestEdge = useCallback((edge: Edge | null) => {
    closestEdgeRef.current = edge
    setClosestEdge(edge)
  }, [])

  useEffect(() => {
    const element = ref.current
    const dragHandle = dragHandleRef.current
    if (!element || !dragHandle || !sortable) return

    const itemData = { id: doc.id, index, instanceId }

    return combine(
      draggable({
        element: dragHandle,
        getInitialData: () => itemData,
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
        onGenerateDragPreview({ nativeSetDragImage }) {
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: pointerOutsideOfPreview({ x: "16px", y: "8px" }),
            render({ container }) {
              const preview = document.createElement("div")
              preview.style.cssText = `
                background: hsl(var(--background));
                border: 2px solid hsl(var(--border));
                border-radius: 6px;
                padding: 8px 12px;
                font-size: 14px;
                color: hsl(var(--foreground));
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
              `
              preview.textContent = doc.title
              container.appendChild(preview)
            },
          })
        },
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) =>
          source.data.instanceId === instanceId && source.data.index !== index,
        getData({ input }) {
          return attachClosestEdge(itemData, {
            element,
            input,
            allowedEdges: ["top", "bottom"],
          })
        },
        onDrag({ source, self }: ElementDropTargetEventBasePayload) {
          if (source.data.index === index) {
            updateClosestEdge(null)
            return
          }

          const edge = extractClosestEdge(self.data)
          const sourceIndex = source.data.index
          if (typeof sourceIndex !== "number") return

          const isItemBeforeSource = index === sourceIndex - 1
          const isItemAfterSource = index === sourceIndex + 1
          const isDropIndicatorHidden =
            (isItemBeforeSource && edge === "bottom") ||
            (isItemAfterSource && edge === "top")

          updateClosestEdge(isDropIndicatorHidden ? null : edge)
        },
        onDragLeave: () => updateClosestEdge(null),
        onDrop({ source }) {
          const sourceIndex = source.data.index
          if (typeof sourceIndex === "number" && sourceIndex !== index) {
            const edge = closestEdgeRef.current
            const targetIndex = edge === "top" ? index : index + 1
            const adjustedTargetIndex =
              sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
            onDrop(sourceIndex, adjustedTargetIndex)
          }
          updateClosestEdge(null)
        },
      }),
    )
  }, [doc.id, doc.title, index, instanceId, sortable, onDrop, updateClosestEdge])

  return (
    <div ref={ref} className="relative">
      {closestEdge && <DropIndicator edge={closestEdge} gap="8px" />}
      <DocCard
        doc={doc}
        dragHandleRef={dragHandleRef}
        sortable={sortable}
        isDragging={isDragging}
      />
    </div>
  )
}

function DocCard({
  doc,
  dragHandleRef,
  sortable,
  isDragging,
}: {
  doc: AdminRouteDoc
  dragHandleRef: React.Ref<HTMLButtonElement>
  sortable: boolean
  isDragging: boolean
}) {
  const meta = TYPE_META[doc.type]
  const Icon = meta.icon

  return (
    <div className={cn("flex items-stretch gap-1", isDragging && "opacity-50")}>
      {sortable && (
        <button
          ref={dragHandleRef}
          type="button"
          aria-label="Drag to reorder"
          className="flex shrink-0 cursor-grab items-center rounded px-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <Link
        to="/admin/docs/$docId"
        params={{ docId: doc.id }}
        className="block min-w-0 flex-1"
      >
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
    </div>
  )
}
