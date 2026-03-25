export function AppInlineReference({ n }: { n: number }) {
	return (
		<span className='ml-1 inline-flex h-5 min-w-5 translate-y-[-1px] items-center justify-center rounded-full bg-gray-100 px-1 text-[10px] leading-none font-semibold text-gray-700'>
			{n}
		</span>
	)
}
