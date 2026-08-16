"use client"

import { cva, type VariantProps } from "class-variance-authority"
import { type ComponentPropsWithRef, createContext, use } from "react"
import { cn } from "../utils/cn"

const MetricContext = createContext(false)

function useMetric(component: string) {
  const isWithinMetric = use(MetricContext)
  if (!isWithinMetric) {
    throw new Error(
      `${component} must be used within <Metric.Root>, <Metric.Card>, or <Metric.Inset>`,
    )
  }
}

function MetricSurface({
  className,
  children,
  ...props
}: ComponentPropsWithRef<"dl">) {
  return (
    <MetricContext value>
      <dl className={className} {...props}>
        {children}
      </dl>
    </MetricContext>
  )
}

function MetricRoot({ className, ...props }: ComponentPropsWithRef<"dl">) {
  return (
    <MetricSurface
      className={cn("grid min-w-0 gap-1 text-foreground", className)}
      {...props}
    />
  )
}

function MetricCard({ className, ...props }: ComponentPropsWithRef<"dl">) {
  return (
    <MetricSurface
      className={cn(
        "grid min-w-0 gap-1 rounded-lg border bg-card p-5 text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    />
  )
}

function MetricInset({ className, ...props }: ComponentPropsWithRef<"dl">) {
  return (
    <MetricSurface
      className={cn(
        "grid min-w-0 gap-1 rounded-md bg-muted p-3 text-foreground",
        className,
      )}
      {...props}
    />
  )
}

type MetricIconProps = ComponentPropsWithRef<"span">

function MetricIcon({
  className,
  "aria-hidden": ariaHidden,
  ...props
}: MetricIconProps) {
  useMetric("Metric.Icon")
  return (
    <span
      aria-hidden={ariaHidden ?? true}
      className={cn(
        "mb-1 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&>svg]:size-5",
        className,
      )}
      {...props}
    />
  )
}

function MetricLabel({ className, ...props }: ComponentPropsWithRef<"dt">) {
  useMetric("Metric.Label")
  return (
    <dt
      className={cn(
        "min-w-0 break-words text-sm font-medium text-foreground/70 [overflow-wrap:anywhere]",
        className,
      )}
      {...props}
    />
  )
}

const metricValueVariants = cva(
  "m-0 min-w-0 break-words font-semibold leading-none tracking-tight tabular-nums [overflow-wrap:anywhere]",
  {
    variants: {
      size: {
        sm: "text-lg",
        md: "text-2xl",
        lg: "text-3xl",
      },
      tone: {
        neutral: "text-foreground",
        positive: "text-emerald-700 dark:text-emerald-400",
        warning: "text-amber-700 dark:text-amber-400",
        critical: "text-destructive",
      },
    },
    defaultVariants: {
      size: "md",
      tone: "neutral",
    },
  },
)

type MetricValueProps = ComponentPropsWithRef<"dd"> &
  VariantProps<typeof metricValueVariants>

function MetricValue({ className, size, tone, ...props }: MetricValueProps) {
  useMetric("Metric.Value")
  return (
    <dd
      className={cn(metricValueVariants({ size, tone }), className)}
      {...props}
    />
  )
}

function MetricSupporting({
  className,
  ...props
}: ComponentPropsWithRef<"dd">) {
  useMetric("Metric.Supporting")
  return (
    <dd
      className={cn(
        "m-0 min-w-0 break-words text-sm text-foreground/70 [overflow-wrap:anywhere]",
        className,
      )}
      {...props}
    />
  )
}

const Metric = {
  Root: MetricRoot,
  Card: MetricCard,
  Inset: MetricInset,
  Label: MetricLabel,
  Icon: MetricIcon,
  Value: MetricValue,
  Supporting: MetricSupporting,
}

export { Metric, metricValueVariants }
export type { MetricIconProps, MetricValueProps }
