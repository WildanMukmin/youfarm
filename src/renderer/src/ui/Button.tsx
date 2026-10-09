import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'ghost'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'md' | 'sm'
}

const STYLES: Record<Variant, string> = {
  primary: 'border-transparent bg-crimson text-white shadow-glow hover:brightness-110 disabled:shadow-none',
  ghost: 'border-line-hi text-ink hover:border-crimson hover:text-crimson-hi'
}

export default function Button({ variant = 'primary', size = 'md', className = '', ...rest }: Props) {
  return (
    <button
      {...rest}
      className={`${size === 'sm' ? 'min-h-8 px-2.5 text-xs' : 'min-h-10 px-4 text-sm'} rounded-sm border font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${STYLES[variant]} ${className}`}
    />
  )
}
