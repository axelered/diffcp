import type { ReactNode } from 'react'

export function AppFileBadge({
  icon,
  title,
  size,
  tint
}: {
  icon: ReactNode
  title: string
  size: string
  tint: string
}) {
  return (
    <div className='flex items-center gap-2 rounded-md border border-gray-300 bg-white p-1 shadow-sm'>
      <div className={`rounded-sm p-2 text-white ${tint}`}>{icon}</div>
      <div className='flex min-w-24 flex-col pr-4 leading-4'>
        <span className='font-semibold text-gray-900'>{title}</span>
        <span className='text-xs text-gray-500'>{size}</span>
      </div>
    </div>
  )
}
