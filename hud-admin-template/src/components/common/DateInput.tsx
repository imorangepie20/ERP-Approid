import { useId, useRef, type ComponentProps } from 'react'
import { CalendarDays } from 'lucide-react'

type DateInputProps = Omit<ComponentProps<'input'>, 'type'> & {
    type?: 'date' | 'datetime-local'
}

export default function DateInput({
    type = 'date',
    id,
    className = '',
    disabled,
    readOnly,
    ...props
}: DateInputProps) {
    const generatedId = useId()
    const inputId = id ?? generatedId
    const inputRef = useRef<HTMLInputElement>(null)
    const label = props['aria-label']?.replace(/\s*\*$/, '') ?? '날짜'

    const openCalendar = () => {
        const input = inputRef.current
        if (!input || disabled || readOnly) return
        input.focus()
        // Keep the native date control usable in browsers without showPicker support.
        try {
            input.showPicker?.()
        } catch {
            // Embedded browsers may block programmatic pickers; manual input still works.
        }
    }

    return (
        <div className="relative">
            <input
                {...props}
                ref={inputRef}
                id={inputId}
                type={type}
                disabled={disabled}
                readOnly={readOnly}
                className={`${className} pr-12`}
            />
            <button
                type="button"
                aria-label={`${label} 달력 열기`}
                aria-controls={inputId}
                disabled={disabled || readOnly}
                onClick={openCalendar}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-hud-accent-primary hover:bg-hud-bg-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-hud-accent-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
                <CalendarDays size={18} aria-hidden="true" />
            </button>
        </div>
    )
}
