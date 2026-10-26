import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Input({
  className,
  type = 'text',
  ...props
}: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'h-10 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
