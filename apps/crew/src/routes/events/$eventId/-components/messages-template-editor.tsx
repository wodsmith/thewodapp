import { Loader2, RotateCcw, Save } from "lucide-react"
import { useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  type CrewTemplateVariableKey,
  getCompetitionMessageTemplateVariables,
  MESSAGE_TEMPLATE_TYPES,
  type MessageTemplateType,
  renderCompetitionMessageTemplate,
} from "@/lib/crew/message-templates"

export const TEMPLATE_TYPE_META: Record<
  MessageTemplateType,
  { label: string; description: string }
> = {
  assignment_confirmation: {
    label: "Assignment invites",
    description: "Ask volunteers to confirm the shifts they are assigned to.",
  },
  reminder_48_hour: {
    label: "48-hour reminder",
    description: "Nudge volunteers who have not responded two days out.",
  },
  reminder_24_hour: {
    label: "24-hour reminder",
    description: "Final reminder the day before the shift.",
  },
  custom_broadcast: {
    label: "Custom message",
    description: "Free-form note to any group of volunteers.",
  },
}

export interface TemplateDraft {
  subject: string
  body: string
}

export function MessageTemplateEditor({
  templateType,
  draft,
  isCustomized,
  isDirty,
  isSaving,
  isResetting,
  sampleValues,
  onSelectType,
  onDraftChange,
  onSave,
  onReset,
}: {
  templateType: MessageTemplateType
  draft: TemplateDraft
  isCustomized: boolean
  isDirty: boolean
  isSaving: boolean
  isResetting: boolean
  sampleValues: Record<CrewTemplateVariableKey, string>
  onSelectType: (type: MessageTemplateType) => void
  onDraftChange: (draft: TemplateDraft) => void
  onSave: () => void
  onReset: () => void
}) {
  const subjectRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const activeFieldRef = useRef<"subject" | "body">("body")

  const variables = getCompetitionMessageTemplateVariables(templateType)
  const preview = renderCompetitionMessageTemplate({
    subject: draft.subject,
    body: draft.body,
    variables: sampleValues,
  })

  function insertVariable(name: CrewTemplateVariableKey) {
    const token = `{{${name}}}`
    const field = activeFieldRef.current
    const el = field === "subject" ? subjectRef.current : bodyRef.current
    const value = field === "subject" ? draft.subject : draft.body
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const next = value.slice(0, start) + token + value.slice(end)
    onDraftChange({ ...draft, [field]: next })
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      const caret = start + token.length
      el.setSelectionRange(caret, caret)
    })
  }

  return (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Message type</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {MESSAGE_TEMPLATE_TYPES.map((type: MessageTemplateType) => {
            const meta = TEMPLATE_TYPE_META[type]
            const selected = type === templateType
            return (
              <button
                key={type}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelectType(type)}
                className={`rounded-md border p-3 text-left transition-colors ${
                  selected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "bg-card hover:bg-muted"
                }`}
              >
                <span className="block text-sm font-medium">{meta.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {meta.description}
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        {isCustomized ? (
          <Badge variant="secondary">Customized</Badge>
        ) : (
          <Badge variant="outline">Default</Badge>
        )}
        {isDirty ? (
          <span className="text-xs text-muted-foreground">Unsaved changes</span>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="message-subject">Subject</Label>
        <Input
          id="message-subject"
          ref={subjectRef}
          value={draft.subject}
          onFocus={() => {
            activeFieldRef.current = "subject"
          }}
          onChange={(e) => onDraftChange({ ...draft, subject: e.target.value })}
          placeholder="Email subject line"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="message-body">Body</Label>
        <Textarea
          id="message-body"
          ref={bodyRef}
          rows={8}
          value={draft.body}
          onFocus={() => {
            activeFieldRef.current = "body"
          }}
          onChange={(e) => onDraftChange({ ...draft, body: e.target.value })}
          placeholder="Write your message. Use variables to personalize it."
        />
      </div>

      {variables.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Insert a variable at the cursor
          </p>
          <div className="flex flex-wrap gap-1.5">
            {variables.map((variable) => (
              <button
                key={variable.key}
                type="button"
                title={variable.description}
                onClick={() => insertVariable(variable.key)}
                className="rounded-md border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {variable.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={onSave}
          disabled={isSaving || isResetting || !isDirty}
        >
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save template
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onReset}
          disabled={isResetting || isSaving || !isCustomized}
        >
          {isResetting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="mr-2 h-4 w-4" />
          )}
          Reset to default
        </Button>
      </div>

      <div className="rounded-md border bg-card shadow-sm">
        <div className="border-b px-4 py-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Preview
          </p>
        </div>
        <div className="space-y-3 p-4">
          <p className="font-semibold">{preview.subject || "(no subject)"}</p>
          <div className="space-y-2 text-sm text-muted-foreground">
            {preview.paragraphs.length > 0 ? (
              preview.paragraphs.map((paragraph, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: preview paragraphs are positional
                <p key={index} className="whitespace-pre-wrap">
                  {paragraph}
                </p>
              ))
            ) : (
              <p className="italic">Your message body will appear here.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
