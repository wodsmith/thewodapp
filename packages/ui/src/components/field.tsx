"use client"

import { Slot } from "@radix-ui/react-slot"
import {
  Children,
  type ComponentPropsWithRef,
  cloneElement,
  createContext,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
  use,
} from "react"
import { cn } from "../utils/cn"
import { Label as LabelPrimitive } from "./label"

type Metadata = {
  id: string
  description: ReactNode | undefined
  error: ReactNode | undefined
  hasDescription: boolean
  hasError: boolean
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

function describedBy(...values: Array<string | undefined>) {
  const tokens = values
    .flatMap((value) => value?.split(/\s+/) ?? [])
    .filter(Boolean)
  const uniqueTokens = [...new Set(tokens)]
  return uniqueTokens.length > 0 ? uniqueTokens.join(" ") : undefined
}

function hasRenderableContent(value: ReactNode): boolean {
  return Children.toArray(value).some((node) => {
    if (typeof node === "string") return node.trim().length > 0
    if (
      isValidElement<{ children?: ReactNode }>(node) &&
      node.type === Fragment
    ) {
      return hasRenderableContent(node.props.children)
    }
    return true
  })
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
  children,
  ...props
}: FieldRootProps) {
  requireStableId(id, "Field.Root")
  const metadata = {
    id,
    description,
    error,
    hasDescription: hasRenderableContent(description),
    hasError: hasRenderableContent(error),
    descriptionId: `${id}-description`,
    errorId: `${id}-error`,
  }

  return (
    <FieldContext value={metadata}>
      <div className={cn("space-y-2", className)} {...props}>
        {children}
      </div>
    </FieldContext>
  )
}

function FieldLabel({
  className,
  ...props
}: ComponentPropsWithRef<typeof LabelPrimitive>) {
  const { id, hasError } = useField("Field.Label")
  return (
    <LabelPrimitive
      className={cn(hasError && "text-destructive", className)}
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
  const { id, hasDescription, hasError, descriptionId, errorId } =
    useField("Field.Control")
  const child = Children.only(children) as ReactElement<{
    id?: string
    "aria-describedby"?: string
    "aria-invalid"?: boolean | "false" | "true"
  }>
  if (child.type === Fragment) {
    throw new Error("Field.Control requires one concrete control child")
  }
  const normalizedChild = cloneElement(child, {
    id,
    "aria-describedby": describedBy(
      child.props["aria-describedby"],
      ariaDescribedBy,
      hasDescription ? descriptionId : undefined,
      hasError ? errorId : undefined,
    ),
    "aria-invalid": hasError ? true : undefined,
  })

  return <Slot {...props}>{normalizedChild}</Slot>
}

type MetadataProps = Omit<ComponentPropsWithRef<"p">, "children">

function FieldDescription({ className, ...props }: MetadataProps) {
  const { description, descriptionId, hasDescription } =
    useField("Field.Description")
  if (!hasDescription) return null

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
  const { error, errorId, hasError } = useField("Field.Error")
  if (!hasError) return null

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
  children,
  "aria-describedby": ariaDescribedBy,
  ...props
}: FieldGroupRootProps) {
  requireStableId(id, "FieldGroup.Root")
  const metadata = {
    id,
    description,
    error,
    hasDescription: hasRenderableContent(description),
    hasError: hasRenderableContent(error),
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
          metadata.hasDescription ? metadata.descriptionId : undefined,
          metadata.hasError ? metadata.errorId : undefined,
        )}
        aria-invalid={metadata.hasError ? true : undefined}
      >
        {children}
      </fieldset>
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
  const { description, descriptionId, hasDescription } = useFieldGroup(
    "FieldGroup.Description",
  )
  if (!hasDescription) return null

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
  const { error, errorId, hasError } = useFieldGroup("FieldGroup.Error")
  if (!hasError) return null

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
