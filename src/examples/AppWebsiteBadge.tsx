import { GlobeIcon } from 'lucide-react'

export function AppWebsiteBadge({
	name,
	domain,
	index
}: {
	name: string
	domain: string
	index: number
}) {
	return (
		<div className='inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white p-1 text-sm shadow-sm'>
			<div className='flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white'>
				<GlobeIcon className='h-4 w-4' />
			</div>

			<div className='flex items-center gap-2'>
				<span className='font-medium text-gray-900'>{name}</span>
				<span className='text-xs text-gray-500'>{domain}</span>
			</div>

			<div className='flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700'>
				{index}
			</div>
		</div>
	)
}
