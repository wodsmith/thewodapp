import type { ComponentPropsWithRef } from "react"
import { cn } from "../utils/cn"
import { Card as CardPrimitive } from "./card"

function Root({ className, ...props }: ComponentPropsWithRef<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-[90svh] w-full min-w-0 items-center justify-center bg-background px-4 py-10",
        className,
      )}
      {...props}
    />
  )
}

function Card({
  className,
  ...props
}: ComponentPropsWithRef<typeof CardPrimitive>) {
  return (
    <CardPrimitive
      className={cn("w-full min-w-0 max-w-md", className)}
      {...props}
    />
  )
}

function Plain({ className, ...props }: ComponentPropsWithRef<"section">) {
  return (
    <section
      className={cn("w-full min-w-0 max-w-sm space-y-6 p-8", className)}
      {...props}
    />
  )
}

function Header({ className, ...props }: ComponentPropsWithRef<"div">) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 p-6 text-center", className)}
      {...props}
    />
  )
}

function Title({ className, ...props }: ComponentPropsWithRef<"h1">) {
  return (
    <h1
      className={cn(
        "break-words text-balance text-2xl font-semibold leading-none tracking-tight",
        className,
      )}
      {...props}
    />
  )
}

function Description({ className, ...props }: ComponentPropsWithRef<"p">) {
  return (
    <p
      className={cn(
        "break-words text-pretty text-sm text-muted-foreground",
        className,
      )}
      {...props}
    />
  )
}

function Content({ className, ...props }: ComponentPropsWithRef<"div">) {
  return <div className={cn("min-w-0 p-6 pt-0", className)} {...props} />
}

function Footer({ className, ...props }: ComponentPropsWithRef<"div">) {
  return (
    <div
      className={cn("flex min-w-0 items-center p-6 pt-0", className)}
      {...props}
    />
  )
}

const AuthEntry = {
  Root,
  Card,
  Plain,
  Header,
  Title,
  Description,
  Content,
  Footer,
}

export {
  AuthEntry,
  Root,
  Card,
  Plain,
  Header,
  Title,
  Description,
  Content,
  Footer,
}
