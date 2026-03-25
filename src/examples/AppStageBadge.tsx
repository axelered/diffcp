import type { ReactNode } from 'react'
import clsx from 'clsx'

export function AppStageBadge({
	icon,
	label,
	state = 'done'
}: {
	icon: ReactNode
	label: string
	state?: 'done' | 'active' | 'idle'
}) {
	return (
		<div
			className={clsx(
				`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm shadow-sm`,
				{
					done: 'border-emerald-200 bg-emerald-50 text-emerald-700',
					active: 'border-blue-200 bg-blue-50 text-blue-700',
					idle: 'animate-pulse border-gray-200 bg-white text-gray-600'
				}[state]
			)}
		>
			<span className='flex h-4 w-4 items-center justify-center'>{icon}</span>
			<span className='font-medium'>{label}</span>
		</div>
	)
}
