import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

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
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {description}
      </p>
      {hasActions ? (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
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
        </div>
      ) : null}
    </div>
  )

  if (variant === "plain") return content

  return (
    <Card>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
