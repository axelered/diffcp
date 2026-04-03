import clsx from 'clsx'
import type { ButtonHTMLAttributes } from 'react'

type AppButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
}

export function AppButton({ variant = 'primary', className, ...props }: AppButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex cursor-pointer items-center justify-center gap-4 rounded-lg px-6 py-2',
        'transition focus:ring-2 focus:ring-offset-2 focus:outline-none',
        'disabled:pointer-events-none disabled:opacity-50',
        '[&>svg]:size-5',
        {
          'bg-gray-900 text-white hover:bg-gray-800 focus:ring-gray-900': variant === 'primary',
          'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-400': variant === 'secondary'
        },
        className
      )}
      {...props}
    />
  )
}
