
type SeparatorWithTextProps = {
  leftBorderProps?: React.HTMLAttributes<HTMLDivElement>
  rightBorderProps?: React.HTMLAttributes<HTMLDivElement>
} & React.HTMLAttributes<HTMLDivElement>

export default function SeparatorWithText({
  children,
  leftBorderProps,
  rightBorderProps,
  ...props
}: SeparatorWithTextProps) {
  return (
    <div className="relative flex items-center" {...props}>
      <div className="flex-grow border-t border-foreground-muted" {...leftBorderProps}></div>
      <span className="flex-shrink mx-4">{children}</span>
      <div className="flex-grow border-t border-foreground-muted" {...rightBorderProps}></div>
    </div>
  )
}
