"use client"

import { Slot } from "@radix-ui/react-slot"
import {
  Children,
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  use,
} from "react"
import { cn } from "../utils/cn"
import { Label as LabelPrimitive } from "./label"

type Metadata = {
  id: string
  description: ReactNode | undefined
  error: ReactNode | undefined
  descriptionId: string
  errorId: string
}

const FieldContext = createContext<Metadata | null>(null)
const FieldGroupContext = createContext<Metadata | null>(null)

function requireStableId(id: string, component: string) {
  if (!id.trim()) {
    throw new Error(`${component} requires a stable id`)
  }
}

function useField(component: string) {
  const context = use(FieldContext)
  if (!context) {
    throw new Error(`${component} must be used within <Field.Root>`)
  }
  return context
}

function useFieldGroup(component: string) {
  const context = use(FieldGroupContext)
  if (!context) {
    throw new Error(`${component} must be used within <FieldGroup.Root>`)
  }
  return context
}

function describedBy(
  existing: string | undefined,
  descriptionId: string | undefined,
  errorId: string | undefined,
) {
  const tokens = [existing, descriptionId, errorId]
    .flatMap((value) => value?.split(/\s+/) ?? [])
    .filter(Boolean)
  const uniqueTokens = [...new Set(tokens)]
  return uniqueTokens.length > 0 ? uniqueTokens.join(" ") : undefined
}

type FieldRootProps = ComponentPropsWithRef<"div"> & {
  id: string
  description?: ReactNode
  error?: ReactNode
}

function FieldRoot({
  id,
  description,
  error,
  className,
  ...props
}: FieldRootProps) {
  requireStableId(id, "Field.Root")
  const metadata = {
    id,
    description,
    error,
    descriptionId: `${id}-description`,
    errorId: `${id}-error`,
  }

  return (
    <FieldContext value={metadata}>
      <div className={cn("space-y-2", className)} {...props} />
    </FieldContext>
  )
}

function FieldLabel({
  className,
  ...props
}: ComponentPropsWithRef<typeof LabelPrimitive>) {
  const { id, error } = useField("Field.Label")
  return (
    <LabelPrimitive
      className={cn(error && "text-destructive", className)}
      {...props}
      htmlFor={id}
    />
  )
}

function FieldControl({
  children,
  "aria-describedby": ariaDescribedBy,
  ...props
}: ComponentPropsWithRef<typeof Slot>) {
  const { id, description, error, descriptionId, errorId } =
    useField("Field.Control")

  return (
    <Slot
      {...props}
      id={id}
      aria-describedby={describedBy(
        ariaDescribedBy,
        description == null ? undefined : descriptionId,
        error == null ? undefined : errorId,
      )}
      aria-invalid={error == null ? undefined : true}
    >
      {Children.only(children)}
    </Slot>
  )
}

type MetadataProps = Omit<ComponentPropsWithRef<"p">, "children">

function FieldDescription({ className, ...props }: MetadataProps) {
  const { description, descriptionId } = useField("Field.Description")
  if (description == null) return null

  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
      id={descriptionId}
    >
      {description}
    </p>
  )
}

function FieldError({ className, ...props }: MetadataProps) {
  const { error, errorId } = useField("Field.Error")
  if (error == null) return null

  return (
    <p
      className={cn("text-sm font-medium text-destructive", className)}
      {...props}
      id={errorId}
      role="alert"
    >
      {error}
    </p>
  )
}

type FieldGroupRootProps = ComponentPropsWithRef<"fieldset"> & {
  id: string
  description?: ReactNode
  error?: ReactNode
}

function FieldGroupRoot({
  id,
  description,
  error,
  className,
  "aria-describedby": ariaDescribedBy,
  ...props
}: FieldGroupRootProps) {
  requireStableId(id, "FieldGroup.Root")
  const metadata = {
    id,
    description,
    error,
    descriptionId: `${id}-description`,
    errorId: `${id}-error`,
  }

  return (
    <FieldGroupContext value={metadata}>
      <fieldset
        className={cn("space-y-3", className)}
        {...props}
        aria-describedby={describedBy(
          ariaDescribedBy,
          description == null ? undefined : metadata.descriptionId,
          error == null ? undefined : metadata.errorId,
        )}
        aria-invalid={error == null ? undefined : true}
      />
    </FieldGroupContext>
  )
}

function FieldGroupLegend({
  className,
  ...props
}: ComponentPropsWithRef<"legend">) {
  useFieldGroup("FieldGroup.Legend")
  return <legend className={cn("text-sm font-medium", className)} {...props} />
}

function FieldGroupDescription({ className, ...props }: MetadataProps) {
  const { description, descriptionId } = useFieldGroup("FieldGroup.Description")
  if (description == null) return null

  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
      id={descriptionId}
    >
      {description}
    </p>
  )
}

function FieldGroupError({ className, ...props }: MetadataProps) {
  const { error, errorId } = useFieldGroup("FieldGroup.Error")
  if (error == null) return null

  return (
    <p
      className={cn("text-sm font-medium text-destructive", className)}
      {...props}
      id={errorId}
      role="alert"
    >
      {error}
    </p>
  )
}

const Field = {
  Root: FieldRoot,
  Label: FieldLabel,
  Control: FieldControl,
  Description: FieldDescription,
  Error: FieldError,
}

const FieldGroup = {
  Root: FieldGroupRoot,
  Legend: FieldGroupLegend,
  Description: FieldGroupDescription,
  Error: FieldGroupError,
}

export { Field, FieldGroup }
