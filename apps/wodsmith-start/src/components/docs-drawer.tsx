/**
 * Documentation Drawer
 *
 * Contextual help for organizer pages, modeled on PostHog's docs panel.
 * Mounted once in the organizer layout; watches the current route matches
 * and, when published docs exist for any matched route id, shows a
 * floating "Docs" button that opens a right-side sheet with the content.
 *
 * Content types: inline markdown articles, videos (R2 uploads play
 * natively, YouTube/Vimeo embed via VideoEmbed), and external links.
 */

import { useMatches } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { BookOpen, ExternalLink } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import Markdown from "react-markdown"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { VideoEmbed } from "@/components/video-embed"
import { getRouteDocsForRouteFn } from "@/server-fns/route-docs-fns"
import {
  isDirectVideoFileUrl,
  ORGANIZER_ROUTE_PREFIX,
  type RouteDocForViewer,
} from "@/utils/route-docs"
import { isSafeUrl } from "@/utils/url"

// Session-lifetime cache so back/forward navigation between organizer
// pages doesn't refetch docs for routes we've already looked up.
const docsCache = new Map<string, RouteDocForViewer[]>()

export function RouteDocsDrawer() {
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

  if (docs.length === 0) return null

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 rounded-full shadow-lg"
        aria-label="Open page documentation"
      >
        <BookOpen className="h-4 w-4" />
        Docs
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg"
        >
          <SheetHeader className="pb-2 text-left">
            <SheetTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Documentation
            </SheetTitle>
            <SheetDescription>Guides and videos for this page</SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-6 py-4">
            {docs.map((doc, index) => (
              <div key={doc.id} className="flex flex-col gap-3">
                {index > 0 && <Separator />}
                <DocItem doc={doc} />
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function DocItem({ doc }: { doc: RouteDocForViewer }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold">{doc.title}</h3>
        {doc.description && (
          <p className="mt-1 text-sm text-muted-foreground">
            {doc.description}
          </p>
        )}
      </div>

      {doc.type === "markdown" && doc.content && (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <Markdown
            components={{
              a: ({ children, href }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:text-primary/80"
                >
                  {children}
                </a>
              ),
            }}
          >
            {doc.content}
          </Markdown>
        </div>
      )}

      {doc.type === "video" && doc.videoUrl && (
        <DocVideo url={doc.videoUrl} title={doc.title} />
      )}

      {doc.type === "link" && doc.linkUrl && (
        <Button asChild variant="outline" size="sm">
          <a
            href={isSafeUrl(doc.linkUrl) ? doc.linkUrl : "#"}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-4 w-4" />
            Read article
          </a>
        </Button>
      )}
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
          title={title}
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
