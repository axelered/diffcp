import clsx from 'clsx'
import type { ButtonHTMLAttributes } from 'react'

type AppButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: 'primary' | 'secondary'
}

export function AppButton({ variant = 'primary', className, ...props }: AppButtonProps) {
	return (
		<button
			className={clsx(
				'inline-flex cursor-pointer items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:pointer-events-none disabled:opacity-50',
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
