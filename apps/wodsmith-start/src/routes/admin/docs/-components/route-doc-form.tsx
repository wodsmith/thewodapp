"use client"

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

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "@tanstack/react-router"
import { Loader2, Upload } from "lucide-react"
import { useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import Markdown from "react-markdown"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
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
import { ROUTE_DOC_TYPES } from "@/db/schemas/route-docs"
import { ORGANIZER_ROUTE_PREFIX } from "@/utils/route-docs"

function isValidUrl(value: string): boolean {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

const routeDocFormSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(255),
    description: z.string().max(1024),
    type: z.enum(ROUTE_DOC_TYPES),
    content: z.string().max(100_000),
    videoUrl: z.string().max(2048),
    linkUrl: z.string().max(2048),
    isPublished: z.boolean(),
    sortOrder: z.number().int().min(0).max(10_000),
    routeIds: z.array(z.string()).min(1, "Select at least one route"),
  })
  .superRefine((values, ctx) => {
    if (values.type === "markdown" && !values.content.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content"],
        message: "Markdown docs require content",
      })
    }
    if (values.type === "video") {
      if (!values.videoUrl.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["videoUrl"],
          message: "Video docs require a video URL or upload",
        })
      } else if (!isValidUrl(values.videoUrl.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["videoUrl"],
          message: "Must be a valid URL",
        })
      }
    }
    if (values.type === "link") {
      if (!values.linkUrl.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["linkUrl"],
          message: "Link docs require a URL",
        })
      } else if (!isValidUrl(values.linkUrl.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["linkUrl"],
          message: "Must be a valid URL",
        })
      }
    }
  })

export type RouteDocFormValues = z.infer<typeof routeDocFormSchema>

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
  const form = useForm<RouteDocFormValues>({
    resolver: zodResolver(routeDocFormSchema),
    defaultValues: { ...DEFAULT_VALUES, ...initialValues },
  })

  const docType = form.watch("type")

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>
              Title and summary shown in the documentation drawer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g. Scheduling heats"
                      maxLength={255}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Short summary shown under the title"
                      rows={2}
                      maxLength={1024}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-wrap items-end gap-6">
              <FormField
                control={form.control}
                name="sortOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sort order</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={10000}
                        value={field.value}
                        onChange={(e) =>
                          field.onChange(Number(e.target.value) || 0)
                        }
                        className="w-28"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isPublished"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2 space-y-0 pb-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) =>
                          field.onChange(checked === true)
                        }
                      />
                    </FormControl>
                    <FormLabel className="text-sm font-normal">
                      Published (visible in the drawer)
                    </FormLabel>
                  </FormItem>
                )}
              />
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
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="markdown">Markdown article</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="link">External link</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {docType === "markdown" && (
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <MarkdownEditor
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {docType === "video" && (
              <FormField
                control={form.control}
                name="videoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <VideoField
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {docType === "link" && (
              <FormField
                control={form.control}
                name="linkUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Article URL</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="url"
                        placeholder="https://docs.wodsmith.com/how-to/organizers/schedule-heats"
                        maxLength={2048}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
            <FormField
              control={form.control}
              name="routeIds"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <RoutePicker
                      selected={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </form>
    </Form>
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
