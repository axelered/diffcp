import clsx from 'clsx'
import { forwardRef, type InputHTMLAttributes } from 'react'

type AppSwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
	label?: string
}

export const AppSwitch = forwardRef<HTMLInputElement, AppSwitchProps>(
	({ className, label, ...props }, ref) => {
		return (
			<label
				className={clsx('inline-flex cursor-pointer items-center gap-3', 'select-none', className)}
			>
				<div className={clsx('relative h-6 w-11 rounded-full bg-gray-300 transition')}>
					<input ref={ref} type='checkbox' className='peer sr-only' {...props} />
					<div className='absolute inset-0 rounded-full transition peer-checked:bg-gray-900' />
					<div
						className={clsx(
							'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition',
							'peer-checked:translate-x-5'
						)}
					/>
				</div>

				{label && <span className='text-sm text-gray-900'>{label}</span>}
			</label>
		)
	}
)
