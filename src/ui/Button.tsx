import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from 'react'
import { cn } from './cn'
import { Icon, type IconName } from './Icon'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-strong active:bg-accent shadow-[0_8px_24px_-12px_rgb(200_241_105/0.6)]',
  secondary: 'bg-raised text-fg border border-line hover:border-line-strong',
  ghost: 'bg-transparent text-muted hover:text-fg hover:bg-raised',
  danger: 'bg-danger-soft text-danger hover:bg-danger/20',
}
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-xl',
  md: 'h-11 px-4 text-[15px] gap-2 rounded-[var(--radius-control)]',
  lg: 'h-14 px-5 text-base gap-2.5 rounded-2xl',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: IconName
  loading?: boolean
  block?: boolean
  children?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, loading, block, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center font-semibold tracking-[-0.01em] transition-[transform,background-color,border-color,color] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45',
        variants[variant], sizes[size], block && 'w-full', className,
      )}
      {...rest}
    >
      {loading ? <Spinner size={size === 'lg' ? 20 : 16} /> : icon && <Icon name={icon} size={size === 'sm' ? 16 : 20} />}
      {children}
    </button>
  )
})

export function IconButton({ icon, label, className, size = 44, variant = 'ghost', ...rest }:
  { icon: IconName; label: string; size?: number; variant?: Variant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full transition-[transform,background-color,color] duration-150 active:scale-90 disabled:opacity-40',
        variants[variant], className,
      )}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} />
    </button>
  )
}
