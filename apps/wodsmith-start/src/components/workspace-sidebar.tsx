"use client"

/**
 * Workspace Sidebar
 *
 * A push sidebar for organizer pages that hosts contextual tools next to
 * the work, modeled on PostHog's side panel. It is a flex sibling of the
 * page content, so opening it reflows the page to the left and stays fully
 * interactive while open; the panel is sticky and scrolls independently.
 *
 * The panel is **tabbed** via a small icon toolbar at the top. Today the
 * only tab is Documentation (contextual help for the current route), but
 * the toolbar is built to grow: add a tool (e.g. an agent) by extending
 * WORKSPACE_TABS and rendering its panel in WorkspaceContent.
 *
 * Documentation content types: inline markdown articles, videos (R2
 * uploads play natively, YouTube/Vimeo embed via VideoEmbed), and links.
 */

import { useMatches } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  ExternalLink,
  FileText,
  Link2,
  type LucideIcon,
  PanelRightClose,
  PlayCircle,
  Search,
  X,
} from "lucide-react"
import { type ReactNode, useEffect, useMemo, useState } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { VideoEmbed } from "@/components/video-embed"
import {
  getOrganizerDocsIndexFn,
  getRouteDocsForRouteFn,
} from "@/server-fns/route-docs-fns"
import { cn } from "@/utils/cn"
import {
  bucketDocsForMatches,
  isDirectVideoFileUrl,
  labelForRouteId,
  ORGANIZER_ROUTE_PREFIX,
  type RouteDocForViewer,
} from "@/utils/route-docs"
import { isSafeUrl } from "@/utils/url"

// Session-lifetime cache so back/forward navigation between organizer
// pages doesn't refetch docs for routes we've already looked up.
const docsCache = new Map<string, RouteDocForViewer[]>()

type WorkspaceTabId = "documentation"

interface WorkspaceTab {
  id: WorkspaceTabId
  label: string
  icon: LucideIcon
}

// Order matches the top toolbar, left to right. Extend this list (and the
// switch in WorkspaceContent) to add tools to the sidebar (e.g. an agent).
const WORKSPACE_TABS: WorkspaceTab[] = [
  { id: "documentation", label: "Documentation", icon: BookOpen },
]

/**
 * Wraps the organizer layout. Renders the page content as a flex child so
 * the workspace panel can push it aside instead of overlaying it.
 */
export function WorkspaceSidebar({ children }: { children: ReactNode }) {
  const matches = useMatches()
  const routeIds = useMemo(
    () =>
      matches
        .map((match) => match.routeId as string)
        .filter((routeId) => routeId.startsWith(ORGANIZER_ROUTE_PREFIX)),
    [matches],
  )
  const cacheKey = routeIds.join("|")

  const getDocs = useServerFn(getRouteDocsForRouteFn)
  const [docs, setDocs] = useState<RouteDocForViewer[]>(
    () => docsCache.get(cacheKey) ?? [],
  )
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>("documentation")

  useEffect(() => {
    const cached = docsCache.get(cacheKey)
    if (cached) {
      setDocs(cached)
      return
    }

    setDocs([])
    if (routeIds.length === 0) return

    let cancelled = false
    getDocs({ data: { routeIds } })
      .then((result) => {
        docsCache.set(cacheKey, result.docs)
        if (!cancelled) setDocs(result.docs)
      })
      .catch(() => {
        // Help content is best-effort — never break the page over it.
      })
    return () => {
      cancelled = true
    }
  }, [cacheKey, getDocs, routeIds])

  // Gate the launcher on having something to show. When more tools land
  // this can open regardless of docs.
  const hasContent = docs.length > 0

  return (
    <div className="flex w-full items-stretch">
      {/* min-w-0 lets the content shrink instead of overflowing when the
          panel opens; flex-1 hands the panel its fixed column. */}
      <div className="min-w-0 flex-1">{children}</div>

      {hasContent && open && (
        <aside
          aria-label="Workspace"
          className="sticky top-0 hidden h-screen w-full shrink-0 flex-col overflow-y-auto border-border border-l bg-background md:flex md:w-[22rem] lg:w-[26rem]"
        >
          {/* Dark icon toolbar. Small tab icons on the left, close on the
              right — sticky so it stays put while the panel body scrolls. */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-zinc-800 border-b bg-zinc-900 px-2 py-1.5">
            <div className="flex items-center gap-1">
              {WORKSPACE_TABS.map((tab) => {
                const Icon = tab.icon
                const isActive = tab.id === activeTab
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    aria-label={tab.label}
                    aria-pressed={isActive}
                    title={tab.label}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                      isActive
                        ? "bg-zinc-700 text-white"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close workspace"
              title="Close"
              className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <WorkspaceContent docs={docs} routeIds={routeIds} />
        </aside>
      )}

      {/* Floating launcher, top-right, icon-only. Hidden while the panel is
          open (the panel has its own close control). On small screens the
          panel can't push, so the button is hidden there too. */}
      {hasContent && !open && (
        <Button
          type="button"
          size="icon"
          onClick={() => setOpen(true)}
          className="fixed top-4 right-4 z-40 hidden rounded-full text-black shadow-lg md:inline-flex"
          aria-label="Open workspace panel"
        >
          <PanelRightClose className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

// Session-lifetime cache of the full organizer docs index (Browse view),
// fetched lazily the first time a user opens Browse.
let docsIndexCache: RouteDocForViewer[] | null = null

// The documentation panel is a shallow navigation stack (depth ≤ 2):
// a contextual/browse root, then an article reading view drilled into
// from either root. `from` records which root to return to on Back.
type DocView =
  | { kind: "context" }
  | { kind: "browse" }
  | { kind: "article"; doc: RouteDocForViewer; from: "context" | "browse" }

function WorkspaceContent({
  docs,
  routeIds,
}: {
  docs: RouteDocForViewer[]
  routeIds: string[]
}) {
  const [view, setView] = useState<DocView>({ kind: "context" })

  if (view.kind === "article") {
    return (
      <ArticleView doc={view.doc} onBack={() => setView({ kind: view.from })} />
    )
  }

  if (view.kind === "browse") {
    return (
      <BrowseView
        routeIds={routeIds}
        onBack={() => setView({ kind: "context" })}
        onOpen={(doc) => setView({ kind: "article", doc, from: "browse" })}
      />
    )
  }

  return (
    <ContextView
      docs={docs}
      routeIds={routeIds}
      onBrowse={() => setView({ kind: "browse" })}
      onOpen={(doc) => setView({ kind: "article", doc, from: "context" })}
    />
  )
}

/**
 * Default contextual view. Lists the current page's own docs ("On this
 * page") above docs inherited from ancestor/layout routes ("In this
 * section"). Every doc is a uniform row — reading happens in the
 * full-panel article view — plus an entry point into Browse.
 */
function ContextView({
  docs,
  routeIds,
  onBrowse,
  onOpen,
}: {
  docs: RouteDocForViewer[]
  routeIds: string[]
  onBrowse: () => void
  onOpen: (doc: RouteDocForViewer) => void
}) {
  const { page, section } = useMemo(
    () => bucketDocsForMatches(docs, routeIds),
    [docs, routeIds],
  )

  return (
    <div className="flex flex-col">
      <div className="border-border border-b px-4 py-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <BookOpen className="h-4 w-4 text-primary" />
          Documentation
        </h2>
        <p className="mt-0.5 text-muted-foreground text-xs">
          Guides and videos for this page
        </p>
      </div>

      <div className="flex flex-col gap-6 p-4">
        {page.length > 0 ? (
          <DocGroup label="On this page">
            {page.map((doc) => (
              <DocRow key={doc.id} doc={doc} onOpen={onOpen} showDescription />
            ))}
          </DocGroup>
        ) : (
          <p className="text-muted-foreground text-sm">
            No documentation for this page yet.
          </p>
        )}

        {section.length > 0 && (
          <DocGroup label="In this section">
            {section.map((doc) => (
              <DocRow key={doc.id} doc={doc} onOpen={onOpen} showDescription />
            ))}
          </DocGroup>
        )}
      </div>

      <div className="border-border border-t px-4 py-3">
        <button
          type="button"
          onClick={onBrowse}
          className="flex w-full items-center justify-between text-left text-muted-foreground text-sm transition-colors hover:text-foreground"
        >
          <span className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Browse all docs
          </span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function DocGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </h3>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  )
}

/** A type icon so rows read as article / video / external link at a glance. */
function docTypeIcon(type: RouteDocForViewer["type"]): LucideIcon {
  if (type === "video") return PlayCircle
  if (type === "link") return Link2
  return FileText
}

/**
 * Compact doc row. Markdown/video open the in-panel article view; link
 * docs open the external URL directly (no reading view to drill into).
 * `showDescription` adds the doc's summary under the title (used in the
 * contextual lists, where rows are the primary content).
 */
function DocRow({
  doc,
  onOpen,
  showDescription = false,
}: {
  doc: RouteDocForViewer
  onOpen: (doc: RouteDocForViewer) => void
  showDescription?: boolean
}) {
  const Icon = docTypeIcon(doc.type)

  const body = (
    <>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="flex-1">
        <span className="block font-medium">{doc.title}</span>
        {showDescription && doc.description && (
          <span className="mt-0.5 block text-muted-foreground text-xs">
            {doc.description}
          </span>
        )}
      </span>
    </>
  )

  const className =
    "flex items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"

  if (doc.type === "link") {
    return (
      <a
        href={doc.linkUrl && isSafeUrl(doc.linkUrl) ? doc.linkUrl : "#"}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {body}
        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </a>
    )
  }

  return (
    <button type="button" onClick={() => onOpen(doc)} className={className}>
      {body}
      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  )
}

/**
 * Full-panel reading view for a single markdown/video doc, reached by
 * drilling in from the contextual or browse list. A back control returns
 * to wherever the user came from.
 */
function ArticleView({
  doc,
  onBack,
}: {
  doc: RouteDocForViewer
  onBack: () => void
}) {
  return (
    <div className="flex flex-col">
      <div className="border-border border-b px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-muted-foreground text-sm transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div>
          <h2 className="font-semibold text-lg">{doc.title}</h2>
          {doc.description && (
            <p className="mt-1 text-muted-foreground text-sm">
              {doc.description}
            </p>
          )}
        </div>

        {doc.type === "markdown" && doc.content && (
          <DocMarkdown content={doc.content} />
        )}

        {doc.type === "video" && doc.videoUrl && (
          <DocVideo url={doc.videoUrl} title={doc.title} />
        )}
      </div>
    </div>
  )
}

/**
 * Browse view: the full published organizer doc set grouped by route, so
 * the user can jump to help for adjacent pages. The current page's route
 * group is marked and floated to the top; a search box filters by title.
 */
function BrowseView({
  routeIds,
  onBack,
  onOpen,
}: {
  routeIds: string[]
  onBack: () => void
  onOpen: (doc: RouteDocForViewer) => void
}) {
  const getIndex = useServerFn(getOrganizerDocsIndexFn)
  const [index, setIndex] = useState<RouteDocForViewer[] | null>(docsIndexCache)
  const [query, setQuery] = useState("")
  const currentRouteIds = useMemo(() => new Set(routeIds), [routeIds])

  useEffect(() => {
    if (docsIndexCache) return
    let cancelled = false
    getIndex()
      .then((result) => {
        docsIndexCache = result.docs
        if (!cancelled) setIndex(result.docs)
      })
      .catch(() => {
        if (!cancelled) setIndex([])
      })
    return () => {
      cancelled = true
    }
  }, [getIndex])

  const groups = useMemo(() => {
    if (!index) return []
    const normalizedQuery = query.trim().toLowerCase()

    const byRoute = new Map<string, RouteDocForViewer[]>()
    for (const doc of index) {
      if (normalizedQuery) {
        const haystack = `${doc.title} ${doc.description ?? ""}`.toLowerCase()
        if (!haystack.includes(normalizedQuery)) continue
      }
      for (const routeId of doc.routeIds) {
        if (!routeId.startsWith(ORGANIZER_ROUTE_PREFIX)) continue
        const existing = byRoute.get(routeId)
        if (existing) existing.push(doc)
        else byRoute.set(routeId, [doc])
      }
    }

    return (
      Array.from(byRoute.entries())
        .map(([routeId, docs]) => ({
          routeId,
          label: labelForRouteId(routeId),
          isCurrent: currentRouteIds.has(routeId),
          docs: docs.sort(
            (a, b) =>
              a.sortOrder - b.sortOrder || a.title.localeCompare(b.title),
          ),
        }))
        // Current page's group first, then alphabetically by label.
        .sort((a, b) => {
          if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1
          return a.label.localeCompare(b.label)
        })
    )
  }, [index, query, currentRouteIds])

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 border-border border-b px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-muted-foreground text-sm transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="relative">
          <Search className="-translate-y-1/2 absolute top-1/2 left-2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search docs"
            className="pl-8"
          />
        </div>
      </div>

      <div className="flex flex-col gap-5 p-4">
        {index === null && (
          <p className="text-muted-foreground text-sm">Loading docs…</p>
        )}
        {index !== null && groups.length === 0 && (
          <p className="text-muted-foreground text-sm">
            {query ? "No docs match your search." : "No docs published yet."}
          </p>
        )}
        {groups.map((group) => (
          <div key={group.routeId}>
            <h3 className="mb-2 flex items-center gap-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
              {group.label}
              {group.isCurrent && (
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-medium text-[10px] text-primary normal-case tracking-normal">
                  This page
                </span>
              )}
            </h3>
            <div className="flex flex-col gap-1">
              {group.docs.map((doc) => (
                <DocRow
                  key={`${group.routeId}-${doc.id}`}
                  doc={doc}
                  onOpen={onOpen}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Shared markdown renderer for the full-panel article view. */
function DocMarkdown({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-li:text-foreground prose-p:text-foreground prose-strong:text-foreground dark:prose-invert">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href }) => (
            <a
              href={href && isSafeUrl(href) ? href : "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  )
}

function DocVideo({ url, title }: { url: string; title: string }) {
  // R2-hosted uploads (and any direct file URL) play natively; platform
  // URLs (YouTube/Vimeo) go through the shared embed component.
  if (isDirectVideoFileUrl(url)) {
    return (
      <div
        className="relative overflow-hidden rounded-lg bg-black"
        style={{ aspectRatio: "16/9" }}
      >
        {/* biome-ignore lint/a11y/useMediaCaption: documentation videos don't have captions */}
        <video
          src={url}
          aria-label={title}
          controls
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full"
        />
      </div>
    )
  }
  return <VideoEmbed url={url} />
}
