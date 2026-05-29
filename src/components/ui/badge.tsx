import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:     'border-primary-800/50 bg-primary-900/40 text-primary-300',
        secondary:   'border-[#2d3748] bg-[#1e2533] text-muted-foreground',
        success:     'border-green-800/50 bg-green-900/30 text-green-400',
        warning:     'border-amber-800/50 bg-amber-900/30 text-amber-400',
        destructive: 'border-red-800/50 bg-red-900/30 text-red-400',
        outline:     'border-[#2d3748] text-foreground bg-transparent',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
