import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  type CrewMessageTemplateType,
  getDefaultCrewMessageTemplate,
} from "@/lib/crew/message-templates"
import type {
  CrewMessageComposerData,
  CrewMessageFilters,
  CrewMessagePreviewMode,
  CrewMessageRecipient,
  QueueCrewMessagesResult,
} from "@/server-fns/crew-message-fns"
import {
  previewCrewMessageRecipientsFn,
  queueCrewMessagesFn,
  resetCrewMessageTemplateFn,
  saveCrewMessageTemplateFn,
} from "@/server-fns/crew-message-fns"
import { formatDateTimeInTimezone } from "@/utils/timezone-utils"
import { MessageRecipientsPanel } from "./messages-recipients-panel"
import {
  MessageTemplateEditor,
  type TemplateDraft,
} from "./messages-template-editor"

const SAMPLE_CONFIRM_URL = "https://wodsmith.com/crew/confirm/sample"
const SAMPLE_SCHEDULE_URL = "https://wodsmith.com/crew/schedule/sample"

function previewModeForType(
  type: CrewMessageTemplateType,
): CrewMessagePreviewMode {
  if (type === "assignment_confirmation") return "assignment_confirmation"
  if (type === "custom_broadcast") return "custom_broadcast"
  return "reminder"
}

function buildSampleValues(
  recipient: CrewMessageRecipient | undefined,
  eventName: string,
  timezone: string,
): Record<string, string> {
  const base: Record<string, string> = {
    volunteerName: "Alex Rivera",
    eventName,
    shiftName: "Saturday AM",
    roleName: "Judge",
    shiftDate: "Sat, Jul 12",
    shiftTime: "8:00 AM",
    location: "Main Floor",
    confirmUrl: SAMPLE_CONFIRM_URL,
    scheduleUrl: SAMPLE_SCHEDULE_URL,
  }
  if (!recipient) return base
  return {
    ...base,
    volunteerName: recipient.volunteerName || base.volunteerName,
    shiftName: recipient.shiftName || base.shiftName,
    roleName: recipient.roleLabel || base.roleName,
    shiftDate: recipient.startsAt
      ? formatDateTimeInTimezone(recipient.startsAt, timezone, "EEE, MMM d")
      : base.shiftDate,
    shiftTime: recipient.startsAt
      ? formatDateTimeInTimezone(recipient.startsAt, timezone, "h:mm a")
      : base.shiftTime,
  }
}

function formatQueueResult(result: QueueCrewMessagesResult): string {
  if (result.queueAvailable) {
    return `${result.queued}/${result.eligible} message${result.eligible === 1 ? "" : "s"} queued${
      result.failed ? `, ${result.failed} failed` : ""
    }`
  }
  return `${result.previewed}/${result.eligible} previewed; delivery is unavailable`
}

export function MessagesComposeTab({
  eventId,
  composer,
  timezone,
}: {
  eventId: string
  composer: CrewMessageComposerData
  timezone: string
}) {
  const router = useRouter()
  const queueMessages = useServerFn(queueCrewMessagesFn)
  const saveTemplate = useServerFn(saveCrewMessageTemplateFn)
  const resetTemplate = useServerFn(resetCrewMessageTemplateFn)

  const templatesByType = useMemo(() => {
    const map = new Map<
      CrewMessageTemplateType,
      { subject: string; body: string; isCustomized: boolean }
    >()
    for (const template of composer.templates) {
      map.set(template.templateType, {
        subject: template.subject,
        body: template.body,
        isCustomized: template.isCustomized,
      })
    }
    return map
  }, [composer.templates])

  const [templateType, setTemplateType] = useState<CrewMessageTemplateType>(
    () => composer.templates[0]?.templateType ?? "assignment_confirmation",
  )

  function storedFor(type: CrewMessageTemplateType) {
    return (
      templatesByType.get(type) ?? {
        ...getDefaultCrewMessageTemplate(type),
        isCustomized: false,
      }
    )
  }

  const [draft, setDraft] = useState<TemplateDraft>(() => {
    const stored = storedFor(templateType)
    return { subject: stored.subject, body: stored.body }
  })

  const [filters, setFilters] = useState<CrewMessageFilters>({})
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [recipients, setRecipients] = useState<CrewMessageRecipient[]>([])
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [reloadNonce, setReloadNonce] = useState(0)

  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const mode = previewModeForType(templateType)
  const stored = storedFor(templateType)
  const isDirty = draft.subject !== stored.subject || draft.body !== stored.body

  // Debounced recipient preview whenever mode or filters change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadNonce intentionally forces a refetch after sends
  useEffect(() => {
    let cancelled = false
    setIsPreviewLoading(true)
    const timer = setTimeout(() => {
      previewCrewMessageRecipientsFn({ data: { eventId, mode, filters } })
        .then((result) => {
          if (!cancelled) setRecipients(result.recipients)
        })
        .catch(() => {
          if (!cancelled) setRecipients([])
        })
        .finally(() => {
          if (!cancelled) setIsPreviewLoading(false)
        })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [eventId, mode, filters, reloadNonce])

  const sampleRecipient =
    recipients.find((r) => r.eligible) ?? recipients[0] ?? undefined
  const sampleValues = buildSampleValues(
    sampleRecipient,
    composer.event.name,
    timezone,
  )

  function handleSelectType(next: CrewMessageTemplateType) {
    setTemplateType(next)
    const nextStored = storedFor(next)
    setDraft({ subject: nextStored.subject, body: nextStored.body })
    setSelectedKeys(new Set())
    // Recipient audience changes with the mode; drop filters that no longer apply.
    if (previewModeForType(next) !== mode) {
      setFilters({})
    }
  }

  function toggleKey(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function selectAllEligible() {
    setSelectedKeys(
      new Set(recipients.filter((r) => r.eligible).map((r) => r.key)),
    )
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      await saveTemplate({
        data: {
          eventId,
          templateType,
          subject: draft.subject,
          body: draft.body,
        },
      })
      toast.success("Template saved")
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save template",
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleReset() {
    setIsResetting(true)
    try {
      await resetTemplate({ data: { eventId, templateType } })
      const fallback = getDefaultCrewMessageTemplate(templateType)
      setDraft({ subject: fallback.subject, body: fallback.body })
      toast.success("Reset to default")
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not reset template",
      )
    } finally {
      setIsResetting(false)
    }
  }

  async function handleSend() {
    const keys = recipients
      .filter((r) => r.eligible && selectedKeys.has(r.key))
      .map((r) => r.key)
    if (keys.length === 0) return
    setIsSending(true)
    try {
      const result = await queueMessages({
        data: {
          eventId,
          mode,
          recipientKeys: keys,
          template: { subject: draft.subject, body: draft.body },
        },
      })
      toast.success(formatQueueResult(result))
      setSelectedKeys(new Set())
      setReloadNonce((n) => n + 1)
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not send messages",
      )
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <MessageTemplateEditor
        templateType={templateType}
        draft={draft}
        isCustomized={stored.isCustomized}
        isDirty={isDirty}
        isSaving={isSaving}
        isResetting={isResetting}
        sampleValues={sampleValues}
        onSelectType={handleSelectType}
        onDraftChange={setDraft}
        onSave={handleSave}
        onReset={handleReset}
      />
      <MessageRecipientsPanel
        mode={mode}
        filters={filters}
        filterOptions={composer.filterOptions}
        recipients={recipients}
        isLoading={isPreviewLoading}
        selectedKeys={selectedKeys}
        timezone={timezone}
        subject={draft.subject}
        isSending={isSending}
        onFiltersChange={(next) => {
          setFilters(next)
          setSelectedKeys(new Set())
        }}
        onToggle={toggleKey}
        onSelectAllEligible={selectAllEligible}
        onClearSelection={() => setSelectedKeys(new Set())}
        onSend={handleSend}
      />
    </div>
  )
}
