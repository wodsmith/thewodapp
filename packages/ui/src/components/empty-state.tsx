"use client"

import { Slot } from "@radix-ui/react-slot"
import {
  Children,
  type ComponentPropsWithRef,
  createContext,
  Fragment,
  isValidElement,
  type ReactNode,
  use,
} from "react"
import { cn } from "../utils/cn"

const EmptyStateContext = createContext(false)

function useEmptyState(component: string) {
  const isWithinEmptyState = use(EmptyStateContext)
  if (!isWithinEmptyState) {
    throw new Error(
      `${component} must be used within <EmptyState.Root> or <EmptyState.Card>`,
    )
  }
}

function EmptyStateRoot({ className, ...props }: ComponentPropsWithRef<"div">) {
  return (
    <EmptyStateContext value>
      <div
        className={cn(
          "flex min-w-0 flex-col items-center justify-center gap-4 py-8 text-center",
          className,
        )}
        {...props}
      />
    </EmptyStateContext>
  )
}

function EmptyStateCard({ className, ...props }: ComponentPropsWithRef<"div">) {
  return (
    <EmptyStateContext value>
      <div
        className={cn(
          "flex w-full min-w-0 max-w-xl flex-col items-center justify-center gap-4 rounded-lg border bg-card p-8 text-center text-card-foreground shadow-sm",
          className,
        )}
        {...props}
      />
    </EmptyStateContext>
  )
}

function EmptyStateIcon({ className, ...props }: ComponentPropsWithRef<"div">) {
  useEmptyState("EmptyState.Icon")
  return (
    <div
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground [&>svg]:size-6",
        className,
      )}
      {...props}
      aria-hidden="true"
    />
  )
}

type EmptyStateTitleProps = Omit<
  ComponentPropsWithRef<typeof Slot>,
  "children"
> & {
  children: ReactNode
}

function EmptyStateTitle({
  children,
  className,
  ...props
}: EmptyStateTitleProps) {
  useEmptyState("EmptyState.Title")
  const child = Children.only(children)
  if (
    !isValidElement(child) ||
    child.type === Fragment ||
    typeof child.type !== "string" ||
    !/^h[1-6]$/.test(child.type)
  ) {
    throw new Error("EmptyState.Title requires one h1 through h6 child")
  }

  return (
    <Slot
      className={cn(
        "break-words text-balance text-xl font-semibold tracking-tight",
        className,
      )}
      {...props}
    >
      {child}
    </Slot>
  )
}

function EmptyStateDescription({
  className,
  ...props
}: ComponentPropsWithRef<"p">) {
  useEmptyState("EmptyState.Description")
  return (
    <p
      className={cn(
        "max-w-prose break-words text-pretty text-sm text-muted-foreground",
        className,
      )}
      {...props}
    />
  )
}

function EmptyStateActions({
  className,
  ...props
}: ComponentPropsWithRef<"div">) {
  useEmptyState("EmptyState.Actions")
  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center justify-center gap-2",
        className,
      )}
      {...props}
    />
  )
}

const EmptyState = {
  Root: EmptyStateRoot,
  Card: EmptyStateCard,
  Icon: EmptyStateIcon,
  Title: EmptyStateTitle,
  Description: EmptyStateDescription,
  Actions: EmptyStateActions,
}

export { EmptyState }
