import type { ReactNode } from 'react'

export function AppMessage({
	children,
	badgesHead,
	badgesFooter
}: {
	children: ReactNode
	badgesHead?: ReactNode
	badgesFooter?: ReactNode
}) {
	return (
		<div className='max-w-3xl rounded-xl border border-gray-200 p-4 text-sm text-gray-800 shadow-sm'>
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
