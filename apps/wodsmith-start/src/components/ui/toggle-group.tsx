import {cn} from '@/lib/utils'

interface ToggleGroupProps<T extends string = string> {
  value: T
  onValueChange: (value: T) => void
  options: {value: T; label: string}[]
  className?: string
}

export function ToggleGroup<T extends string = string>({
  value,
  onValueChange,
  options,
  className,
}: ToggleGroupProps<T>) {
  return (
    <div
      className={cn('inline-flex items-center justify-center p-1', className)}
      role="tablist"
      aria-orientation="horizontal"
    >
      {options.map((option) => (
        <button
          key={option.value}
          className={cn(
            'inline-flex items-center justify-center whitespace-nowrap px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
            value === option.value ? 'shadow-sm' : 'hover:opacity-80',
          )}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onValueChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
