import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"

interface OrganizerEmptyStateProps {
  variant?: "card" | "plain"
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  actionIcon?: ReactNode
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  secondaryActionIcon?: ReactNode
}

export function OrganizerEmptyState({
  variant = "card",
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon,
  secondaryActionLabel,
  onSecondaryAction,
  secondaryActionIcon,
}: OrganizerEmptyStateProps) {
  const hasActions =
    (actionLabel && onAction) || (secondaryActionLabel && onSecondaryAction)

  const content = (
    <>
      <EmptyState.Icon className="mb-4 rounded-lg">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </EmptyState.Icon>
      <EmptyState.Title className="break-normal text-wrap text-lg font-semibold tracking-normal">
        <h3>{title}</h3>
      </EmptyState.Title>
      <EmptyState.Description className="mt-2 max-w-md break-normal text-wrap">
        {description}
      </EmptyState.Description>
      {hasActions ? (
        <EmptyState.Actions className="mt-5 flex-col flex-nowrap items-stretch justify-start sm:flex-row sm:items-center">
          {actionLabel && onAction ? (
            <Button onClick={onAction}>
              {actionIcon}
              {actionLabel}
            </Button>
          ) : null}
          {secondaryActionLabel && onSecondaryAction ? (
            <Button variant="outline" onClick={onSecondaryAction}>
              {secondaryActionIcon}
              {secondaryActionLabel}
            </Button>
          ) : null}
        </EmptyState.Actions>
      ) : null}
    </>
  )

  if (variant === "plain") {
    return (
      <EmptyState.Root className="gap-0 px-6 py-12">{content}</EmptyState.Root>
    )
  }

  return (
    <EmptyState.Card className="w-auto max-w-none items-stretch justify-normal gap-0 p-0">
      <div className="p-6 pt-0">
        <EmptyState.Root className="gap-0 px-6 py-12">
          {content}
        </EmptyState.Root>
      </div>
    </EmptyState.Card>
  )
}
