import type { ReactNode } from 'react'
import clsx from 'clsx'

export function AppMessage({
	role = 'agent',
	children,
	badgesHead,
	badgesFooter
}: {
	role?: 'agent' | 'user'
	children: ReactNode
	badgesHead?: ReactNode
	badgesFooter?: ReactNode
}) {
	return (
		<div
			className={clsx(
				'max-w-3xl rounded-xl border border-gray-200 p-4 text-sm shadow-sm',
				role === 'user'
					? 'ml-16 self-end bg-slate-800 text-right text-white'
					: 'mr-16 text-gray-800'
			)}
		>
			{badgesHead && <div className='mb-3 flex flex-wrap gap-2'>{badgesHead}</div>}
			<div className='leading-6'>{children}</div>
			{badgesFooter && (
				<div className='mt-4 flex flex-wrap gap-2 border-t border-gray-200 pt-3'>
					{badgesFooter}
				</div>
			)}
		</div>
	)
}
