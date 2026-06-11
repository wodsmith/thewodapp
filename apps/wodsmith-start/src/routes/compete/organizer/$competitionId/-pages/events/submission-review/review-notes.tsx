/**
 * Submission Review — Review Notes
 *
 * Review note form, filterable note list, and the no-rep movement tally card
 * for the shared submission review page. Mutations default to the organizer
 * review-note server fns; cohost routes inject cohost-permissioned callbacks
 * via the page's `overrides` prop.
 */

import { useServerFn } from "@tanstack/react-start"
import { ArrowDownUp, MessageSquare, Pencil, Trash2 } from "lucide-react"
import { useCallback, useState } from "react"
import type { VideoPlayerRef } from "@/components/compete/video-player-embed"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  createReviewNoteFn,
  deleteReviewNoteFn,
  updateReviewNoteFn,
} from "@/server-fns/review-note-fns"

/** Mirrors the createReviewNoteFn input schema. */
export interface CreateReviewNoteInput {
  videoSubmissionId: string
  competitionId: string
  type: "general" | "no-rep"
  content: string
  timestampSeconds?: number
  movementId?: string
}

/** Mirrors the updateReviewNoteFn input schema. */
export interface UpdateReviewNoteInput {
  noteId: string
  competitionId: string
  type?: "general" | "no-rep"
  content?: string
  movementId?: string | null
}

/** Mirrors the deleteReviewNoteFn input schema. */
export interface DeleteReviewNoteInput {
  noteId: string
  competitionId: string
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

interface ReviewNoteFormProps {
  videoSubmissionId: string
  competitionId: string
  movements: Array<{ id: string; name: string; type: string }>
  playerRef: React.RefObject<VideoPlayerRef | null>
  formTextareaRef: React.RefObject<HTMLTextAreaElement | null>
  onNoteCreated: () => void
  /** Cohost routes inject a cohost-permissioned create mutation. */
  onCreateNote?: (params: CreateReviewNoteInput) => Promise<unknown>
}

export function ReviewNoteForm({
  videoSubmissionId,
  competitionId,
  movements,
  playerRef,
  formTextareaRef,
  onNoteCreated,
  onCreateNote,
}: ReviewNoteFormProps) {
  const defaultCreateNote = useServerFn(createReviewNoteFn)
  const createNote =
    onCreateNote ??
    (async (params: CreateReviewNoteInput) =>
      defaultCreateNote({ data: params }))
  const [noteType, setNoteType] = useState<"general" | "no-rep">("general")
  const [content, setContent] = useState("")
  const [timestampSeconds, setTimestampSeconds] = useState<number | null>(null)
  const [selectedMovementId, setSelectedMovementId] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const captureTimestamp = useCallback(() => {
    if (playerRef.current) {
      const time = Math.round(playerRef.current.getCurrentTime())
      setTimestampSeconds(time)
    }
  }, [playerRef])

  const handleFocus = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.pauseVideo()
      captureTimestamp()
    }
  }, [playerRef, captureTimestamp])

  const handleSubmit = async () => {
    if (!content.trim()) return
    setIsSubmitting(true)
    try {
      await createNote({
        videoSubmissionId,
        competitionId,
        type: noteType,
        content: content.trim(),
        timestampSeconds: timestampSeconds ?? undefined,
        movementId:
          selectedMovementId && selectedMovementId !== "none"
            ? selectedMovementId
            : undefined,
      })
      setContent("")
      setTimestampSeconds(null)
      onNoteCreated()
      playerRef.current?.playVideo()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Add review note
        </CardTitle>
        <CardDescription>
          Press{" "}
          <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">
            n
          </kbd>{" "}
          to pause video and add a note
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={noteType === "general" ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => setNoteType("general")}
          >
            General
          </Button>
          <Button
            type="button"
            size="sm"
            variant={noteType === "no-rep" ? "destructive" : "outline"}
            className="h-7 text-xs"
            onClick={() => setNoteType("no-rep")}
          >
            No Rep
          </Button>
        </div>
        {timestampSeconds !== null && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {formatTimestamp(timestampSeconds)}
            </Badge>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setTimestampSeconds(null)}
            >
              Clear timestamp
            </button>
          </div>
        )}
        <Textarea
          ref={formTextareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder="No rep, bad form, movement standard..."
          rows={2}
          className="text-sm"
        />
        {movements.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs">Movement (optional)</Label>
            <Select
              value={selectedMovementId}
              onValueChange={setSelectedMovementId}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select movement..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {movements.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {typeof navigator !== "undefined" &&
            navigator.platform?.includes("Mac")
              ? "⌘"
              : "Ctrl"}
            +Enter to submit
          </span>
          <Button
            size="sm"
            disabled={isSubmitting || !content.trim()}
            onClick={handleSubmit}
          >
            {isSubmitting ? "Adding..." : "Add note"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

interface ReviewNotesListProps {
  notes: Array<{
    id: string
    type: string
    content: string
    timestampSeconds: number | null
    movementId: string | null
    movementName: string | null
    createdAt: Date
    reviewer: {
      id: string
      firstName: string | null
      lastName: string | null
      avatar: string | null
    }
  }>
  movements: Array<{ id: string; name: string }>
  competitionId: string
  playerRef: React.RefObject<VideoPlayerRef | null>
  onNoteUpdated: () => void
  /** Cohost routes inject a cohost-permissioned update mutation. */
  onUpdateNote?: (params: UpdateReviewNoteInput) => Promise<unknown>
  /** Cohost routes inject a cohost-permissioned delete mutation. */
  onDeleteNote?: (params: DeleteReviewNoteInput) => Promise<unknown>
}

type SortOrder = "timestamp-asc" | "timestamp-desc"
type TypeFilter = "all" | "general" | "no-rep"

export function ReviewNotesList({
  notes,
  movements,
  competitionId,
  playerRef,
  onNoteUpdated,
  onUpdateNote,
  onDeleteNote,
}: ReviewNotesListProps) {
  const defaultDeleteFn = useServerFn(deleteReviewNoteFn)
  const defaultUpdateFn = useServerFn(updateReviewNoteFn)
  const deleteNote =
    onDeleteNote ??
    (async (params: DeleteReviewNoteInput) => defaultDeleteFn({ data: params }))
  const updateNote =
    onUpdateNote ??
    (async (params: UpdateReviewNoteInput) => defaultUpdateFn({ data: params }))
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [editType, setEditType] = useState<"general" | "no-rep">("general")
  const [isSaving, setIsSaving] = useState(false)
  const [sortOrder, setSortOrder] = useState<SortOrder>("timestamp-asc")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")
  const [movementFilter, setMovementFilter] = useState<string>("all")

  const handleSeek = (seconds: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(seconds, true)
      playerRef.current.playVideo()
    }
  }

  const handleDelete = async (noteId: string) => {
    setDeletingId(noteId)
    try {
      await deleteNote({ noteId, competitionId })
      onNoteUpdated()
    } finally {
      setDeletingId(null)
    }
  }

  const startEdit = (note: ReviewNotesListProps["notes"][0]) => {
    setEditingId(note.id)
    setEditContent(note.content)
    setEditType((note.type as "general" | "no-rep") || "general")
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditContent("")
  }

  const saveEdit = async () => {
    if (!editingId || !editContent.trim()) return
    setIsSaving(true)
    try {
      await updateNote({
        noteId: editingId,
        competitionId,
        content: editContent.trim(),
        type: editType,
      })
      setEditingId(null)
      setEditContent("")
      onNoteUpdated()
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      saveEdit()
    }
    if (e.key === "Escape") {
      cancelEdit()
    }
  }

  // Reset movement filter when type filter changes away from no-rep
  const effectiveMovementFilter =
    typeFilter === "no-rep" ? movementFilter : "all"

  const filteredNotes = notes.filter((note) => {
    if (typeFilter !== "all" && note.type !== typeFilter) return false
    if (
      effectiveMovementFilter !== "all" &&
      note.movementId !== effectiveMovementFilter
    )
      return false
    return true
  })

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.timestampSeconds === null && b.timestampSeconds === null) return 0
    if (a.timestampSeconds === null) return 1
    if (b.timestampSeconds === null) return -1
    return sortOrder === "timestamp-asc"
      ? a.timestampSeconds - b.timestampSeconds
      : b.timestampSeconds - a.timestampSeconds
  })

  if (notes.length === 0) return null

  const toggleSortOrder = () => {
    setSortOrder(
      sortOrder === "timestamp-asc" ? "timestamp-desc" : "timestamp-asc",
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">
            Review Notes ({filteredNotes.length}
            {filteredNotes.length !== notes.length ? ` / ${notes.length}` : ""})
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={toggleSortOrder}
          >
            <ArrowDownUp className="h-3 w-3" />
            {sortOrder === "timestamp-asc" ? "Time ↑" : "Time ↓"}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <div className="flex gap-1">
            {(["all", "general", "no-rep"] as const).map((t) => (
              <Button
                key={t}
                type="button"
                size="sm"
                variant={
                  typeFilter === t
                    ? t === "no-rep"
                      ? "destructive"
                      : "default"
                    : "outline"
                }
                className="h-6 text-xs px-2"
                onClick={() => {
                  setTypeFilter(t)
                  if (t !== "no-rep") setMovementFilter("all")
                }}
              >
                {t === "all" ? "All" : t === "general" ? "General" : "No Rep"}
              </Button>
            ))}
          </div>
          {typeFilter === "no-rep" && movements.length > 0 && (
            <Select
              value={effectiveMovementFilter}
              onValueChange={setMovementFilter}
            >
              <SelectTrigger className="h-6 text-xs w-auto min-w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All movements</SelectItem>
                {movements.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {sortedNotes.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            No matching notes
          </p>
        ) : (
          sortedNotes.map((note) => (
            <div
              key={note.id}
              className="group rounded border px-3 py-2 text-sm space-y-1"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {editingId === note.id ? (
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={editType === "general" ? "default" : "outline"}
                        className="h-5 text-xs px-1.5"
                        onClick={() => setEditType("general")}
                      >
                        General
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          editType === "no-rep" ? "destructive" : "outline"
                        }
                        className="h-5 text-xs px-1.5"
                        onClick={() => setEditType("no-rep")}
                      >
                        No Rep
                      </Button>
                    </div>
                  ) : (
                    <>
                      {note.type === "no-rep" && (
                        <Badge
                          variant="outline"
                          className="bg-orange-500 text-white border-orange-500 text-xs"
                        >
                          No Rep
                        </Badge>
                      )}
                      {note.timestampSeconds !== null && (
                        <button
                          type="button"
                          onClick={() => handleSeek(note.timestampSeconds!)}
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          {formatTimestamp(note.timestampSeconds)}
                        </button>
                      )}
                      {note.movementName && (
                        <Badge variant="secondary" className="text-xs">
                          {note.movementName}
                        </Badge>
                      )}
                    </>
                  )}
                </div>
                {editingId !== note.id && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => startEdit(note)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={deletingId === note.id}
                      onClick={() => handleDelete(note.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              {editingId === note.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    rows={2}
                    className="text-sm"
                    autoFocus
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={cancelEdit}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      disabled={isSaving || !editContent.trim()}
                      onClick={saveEdit}
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm">{note.content}</p>
                  <p className="text-xs text-muted-foreground">
                    {note.reviewer.firstName} {note.reviewer.lastName}
                  </p>
                </>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

interface MovementTallyCardProps {
  notes: Array<{
    type: string
    movementId: string | null
    movementName: string | null
  }>
}

export function MovementTallyCard({ notes }: MovementTallyCardProps) {
  const noRepNotes = notes.filter((n) => n.type === "no-rep")
  const noRepCount = noRepNotes.length

  const tallies = new Map<string, { name: string; count: number }>()
  for (const note of noRepNotes) {
    if (note.movementId && note.movementName) {
      const existing = tallies.get(note.movementId)
      if (existing) {
        existing.count++
      } else {
        tallies.set(note.movementId, { name: note.movementName, count: 1 })
      }
    }
  }

  if (notes.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Review Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between text-sm font-medium">
          <span>No Reps</span>
          <Badge
            variant="outline"
            className="bg-orange-500 text-white border-orange-500 font-mono"
          >
            {noRepCount}
          </Badge>
        </div>
        {tallies.size > 0 && (
          <>
            <Separator />
            <p className="text-xs text-muted-foreground font-medium">
              By Movement
            </p>
            {Array.from(tallies.values()).map((t) => (
              <div
                key={t.name}
                className="flex items-center justify-between text-sm"
              >
                <span>{t.name}</span>
                <Badge
                  variant="outline"
                  className="bg-orange-500 text-white border-orange-500 font-mono"
                >
                  {t.count}
                </Badge>
              </div>
            ))}
          </>
        )}
        <Separator />
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Total notes</span>
          <span>{notes.length}</span>
        </div>
      </CardContent>
    </Card>
  )
}
