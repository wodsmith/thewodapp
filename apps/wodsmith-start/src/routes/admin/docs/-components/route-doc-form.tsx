/**
 * Route Doc Form
 *
 * Shared create/edit form for the documentation drawer CMS. Admins pick
 * the content type (markdown article, video, or external link), author
 * the content, and map the doc to one or more app routes.
 *
 * The route picker is populated from the live router's routesById, so it
 * always reflects the actual route tree — no hand-maintained route list.
 */

import { useRouter } from "@tanstack/react-router"
import { Loader2, Upload } from "lucide-react"
import { useMemo, useRef, useState } from "react"
import Markdown from "react-markdown"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { RouteDocType } from "@/db/schemas/route-docs"
import { ORGANIZER_ROUTE_PREFIX } from "@/utils/route-docs"

export interface RouteDocFormValues {
  title: string
  description: string
  type: RouteDocType
  content: string
  videoUrl: string
  linkUrl: string
  isPublished: boolean
  sortOrder: number
  routeIds: string[]
}

const DEFAULT_VALUES: RouteDocFormValues = {
  title: "",
  description: "",
  type: "markdown",
  content: "",
  videoUrl: "",
  linkUrl: "",
  isPublished: false,
  sortOrder: 1,
  routeIds: [],
}

interface RouteDocFormProps {
  initialValues?: Partial<RouteDocFormValues>
  submitLabel: string
  isSubmitting: boolean
  onSubmit: (values: RouteDocFormValues) => void
}

export function RouteDocForm({
  initialValues,
  submitLabel,
  isSubmitting,
  onSubmit,
}: RouteDocFormProps) {
  const [values, setValues] = useState<RouteDocFormValues>({
    ...DEFAULT_VALUES,
    ...initialValues,
  })

  const setField = <K extends keyof RouteDocFormValues>(
    field: K,
    value: RouteDocFormValues[K],
  ) => {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    if (!values.title.trim()) {
      toast.error("Title is required")
      return
    }
    if (values.type === "markdown" && !values.content.trim()) {
      toast.error("Markdown docs require content")
      return
    }
    if (values.type === "video" && !values.videoUrl.trim()) {
      toast.error("Video docs require a video URL or upload")
      return
    }
    if (values.type === "link" && !values.linkUrl.trim()) {
      toast.error("Link docs require a URL")
      return
    }
    if (values.routeIds.length === 0) {
      toast.error("Select at least one route")
      return
    }

    onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>
            Title and summary shown in the documentation drawer
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="doc-title">Title</Label>
            <Input
              id="doc-title"
              value={values.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="e.g. Scheduling heats"
              maxLength={255}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-description">Description (optional)</Label>
            <Textarea
              id="doc-description"
              value={values.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Short summary shown under the title"
              rows={2}
              maxLength={1024}
            />
          </div>

          <div className="flex flex-wrap items-end gap-6">
            <div className="space-y-2">
              <Label htmlFor="doc-sort-order">Sort order</Label>
              <Input
                id="doc-sort-order"
                type="number"
                min={0}
                max={10000}
                value={values.sortOrder}
                onChange={(e) =>
                  setField("sortOrder", Number(e.target.value) || 0)
                }
                className="w-28"
              />
            </div>

            <div className="flex items-center gap-2 pb-2">
              <Checkbox
                id="doc-published"
                checked={values.isPublished}
                onCheckedChange={(checked) =>
                  setField("isPublished", checked === true)
                }
              />
              <Label htmlFor="doc-published" className="text-sm font-normal">
                Published (visible in the drawer)
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Content</CardTitle>
          <CardDescription>
            Markdown article, video, or external link
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={values.type}
              onValueChange={(value) => setField("type", value as RouteDocType)}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="markdown">Markdown article</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="link">External link</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {values.type === "markdown" && (
            <MarkdownEditor
              value={values.content}
              onChange={(content) => setField("content", content)}
            />
          )}

          {values.type === "video" && (
            <VideoField
              value={values.videoUrl}
              onChange={(videoUrl) => setField("videoUrl", videoUrl)}
            />
          )}

          {values.type === "link" && (
            <div className="space-y-2">
              <Label htmlFor="doc-link-url">Article URL</Label>
              <Input
                id="doc-link-url"
                type="url"
                value={values.linkUrl}
                onChange={(e) => setField("linkUrl", e.target.value)}
                placeholder="https://docs.wodsmith.com/how-to/organizers/schedule-heats"
                maxLength={2048}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Routes</CardTitle>
          <CardDescription>
            Pages where this doc appears. Selecting a layout route (e.g. a
            competition section) shows the doc on all of its child pages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RoutePicker
            selected={values.routeIds}
            onChange={(routeIds) => setField("routeIds", routeIds)}
          />
        </CardContent>
      </Card>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitLabel}
      </Button>
    </form>
  )
}

function MarkdownEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [showPreview, setShowPreview] = useState(false)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="doc-content">Content (markdown)</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowPreview((prev) => !prev)}
        >
          {showPreview ? "Write" : "Preview"}
        </Button>
      </div>
      {showPreview ? (
        <div className="prose prose-sm dark:prose-invert max-w-none rounded-md border p-4">
          <Markdown>{value || "*Nothing to preview*"}</Markdown>
        </div>
      ) : (
        <Textarea
          id="doc-content"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={"## Getting started\n\nWrite your guide here…"}
          rows={14}
          className="font-mono text-sm"
        />
      )}
    </div>
  )
}

function VideoField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    // Allow re-selecting the same file after a failed upload
    event.target.value = ""
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("purpose", "docs-video")

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })
      const data = (await res.json().catch(() => null)) as {
        url?: string
        error?: string
      } | null

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Upload failed")
      }

      onChange(data.url)
      toast.success("Video uploaded")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="doc-video-url">Video URL</Label>
      <div className="flex gap-2">
        <Input
          id="doc-video-url"
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://youtube.com/watch?v=… or upload an MP4"
          maxLength={2048}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {isUploading ? "Uploading…" : "Upload"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Paste a YouTube/Vimeo URL, or upload an MP4/WebM/MOV (max 100MB, stored
        on R2).
      </p>
    </div>
  )
}

function RoutePicker({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (routeIds: string[]) => void
}) {
  const router = useRouter()
  const [filter, setFilter] = useState("")

  const allRouteIds = useMemo(
    () =>
      Object.keys(router.routesById)
        .filter((routeId) => routeId.startsWith(ORGANIZER_ROUTE_PREFIX))
        .sort(),
    [router],
  )

  const visibleRouteIds = useMemo(() => {
    const query = filter.trim().toLowerCase()
    if (!query) return allRouteIds
    return allRouteIds.filter((routeId) =>
      routeId.toLowerCase().includes(query),
    )
  }, [allRouteIds, filter])

  // Mapped routes that no longer exist in the route tree (e.g. after a
  // rename) — keep them visible so admins can spot and remove them.
  const staleSelected = selected.filter(
    (routeId) => !allRouteIds.includes(routeId),
  )

  const toggle = (routeId: string) => {
    if (selected.includes(routeId)) {
      onChange(selected.filter((id) => id !== routeId))
    } else {
      onChange([...selected, routeId])
    }
  }

  return (
    <div className="space-y-2">
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter routes…"
      />
      <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
        {staleSelected.map((routeId) => (
          <div
            key={routeId}
            className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
          >
            <Checkbox
              id={`route-${routeId}`}
              checked
              onCheckedChange={() => toggle(routeId)}
            />
            <Label
              htmlFor={`route-${routeId}`}
              className="font-mono text-xs font-normal text-destructive"
            >
              {routeId}{" "}
              <span className="text-muted-foreground">
                (route no longer exists)
              </span>
            </Label>
          </div>
        ))}
        {visibleRouteIds.map((routeId) => (
          <div
            key={routeId}
            className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
          >
            <Checkbox
              id={`route-${routeId}`}
              checked={selected.includes(routeId)}
              onCheckedChange={() => toggle(routeId)}
            />
            <Label
              htmlFor={`route-${routeId}`}
              className="font-mono text-xs font-normal"
            >
              {routeId}
            </Label>
          </div>
        ))}
        {visibleRouteIds.length === 0 && staleSelected.length === 0 && (
          <p className="px-2 py-4 text-sm text-muted-foreground">
            No routes match "{filter}"
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {selected.length} route{selected.length === 1 ? "" : "s"} selected
      </p>
    </div>
  )
}
