import { ReactNode, useEffect, useId } from 'react'
import { X } from 'lucide-react'
import Button from './Button'
import DateInput from './DateInput'

export interface ModalFieldOption {
    label: string
    value: string | number
}

export interface ModalField {
    key: string
    label: string
    type: 'text' | 'number' | 'date' | 'select' | 'textarea'
    required?: boolean
    options?: ModalFieldOption[]
    placeholder?: string
    step?: number
    min?: number
    maxLength?: number
    /** 읽기 전용 (자동 계산 필드 등) */
    readOnly?: boolean
    /** 값 변경 시 다른 필드에 파생값 설정 */
    onChange?: (value: string, setField: (key: string, value: string | number) => void, values: Record<string, string>) => void
}

interface FormModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    subtitle?: string
    fields: ModalField[]
    values: Record<string, string>
    onChange: (key: string, value: string) => void
    onSubmit: () => void
    submitLabel?: string
    isSubmitting?: boolean
    error?: ReactNode
    children?: ReactNode
}

const FormModal = ({
    isOpen,
    onClose,
    title,
    subtitle,
    fields,
    values,
    onChange,
    onSubmit,
    submitLabel = '저장',
    isSubmitting = false,
    error,
    children,
}: FormModalProps) => {
    const titleId = useId()
    const fieldPrefix = useId()

    useEffect(() => {
        if (!isOpen) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isSubmitting) onClose()
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [isOpen, isSubmitting, onClose])

    if (!isOpen) return null

    const setField = (key: string, value: string | number) => onChange(key, String(value))

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onSubmit()
    }

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => { if (!isSubmitting) onClose() }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="w-full max-w-2xl bg-hud-bg-secondary border border-hud-border-secondary rounded-lg shadow-2xl max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-hud-border-secondary">
                    <div>
                        <h2 id={titleId} className="text-lg font-semibold text-hud-text-primary">{title}</h2>
                        {subtitle && <p className="text-sm text-hud-text-muted mt-0.5">{subtitle}</p>}
                    </div>
                    <button
                        onClick={onClose}
                        type="button"
                        aria-label="닫기"
                        disabled={isSubmitting}
                        className="p-2 rounded-lg hover:bg-hud-bg-hover text-hud-text-muted hover:text-hud-text-primary transition-hud"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {error && (
                            <div role="alert" className="sm:col-span-2 rounded-lg border border-hud-accent-danger/40 bg-hud-accent-danger/10 px-4 py-3 text-sm text-hud-accent-danger">
                                {error}
                            </div>
                        )}
                        {fields.map(field => {
                            const colSpan = field.type === 'textarea' ? 'sm:col-span-2' : ''
                            const fieldId = `${fieldPrefix}-${field.key}`
                            const accessibleLabel = `${field.label}${field.required ? ' *' : ''}`
                            return (
                                <div key={field.key} className={colSpan}>
                                    <label htmlFor={fieldId} className="block text-sm font-medium text-hud-text-secondary mb-1.5">
                                        {field.label}
                                        {field.required && <span aria-hidden="true" className="text-hud-accent-danger ml-0.5">*</span>}
                                    </label>
                                    {field.type === 'select' ? (
                                        <select
                                            id={fieldId}
                                            aria-label={accessibleLabel}
                                            value={values[field.key] ?? ''}
                                            onChange={e => {
                                                onChange(field.key, e.target.value)
                                                field.onChange?.(e.target.value, setField, values)
                                            }}
                                            required={field.required}
                                            disabled={isSubmitting || field.readOnly}
                                            className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                                        >
                                            <option value="">선택하세요</option>
                                            {field.options?.map(opt => (
                                                <option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>
                                            ))}
                                        </select>
                                    ) : field.type === 'textarea' ? (
                                        <textarea
                                            id={fieldId}
                                            aria-label={accessibleLabel}
                                            value={values[field.key] ?? ''}
                                            onChange={e => onChange(field.key, e.target.value)}
                                            required={field.required}
                                            placeholder={field.placeholder}
                                            maxLength={field.maxLength}
                                            readOnly={field.readOnly}
                                            disabled={isSubmitting}
                                            rows={3}
                                            className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud resize-none"
                                        />
                                    ) : field.type === 'date' ? (
                                        <DateInput
                                            id={fieldId}
                                            aria-label={accessibleLabel}
                                            value={values[field.key] ?? ''}
                                            onChange={e => {
                                                onChange(field.key, e.target.value)
                                                field.onChange?.(e.target.value, setField, values)
                                            }}
                                            required={field.required}
                                            readOnly={field.readOnly}
                                            disabled={isSubmitting}
                                            className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud disabled:opacity-60 read-only:opacity-70"
                                        />
                                    ) : (
                                        <input
                                            id={fieldId}
                                            aria-label={accessibleLabel}
                                            type={field.type}
                                            value={values[field.key] ?? ''}
                                            onChange={e => {
                                                onChange(field.key, e.target.value)
                                                field.onChange?.(e.target.value, setField, values)
                                            }}
                                            required={field.required}
                                            placeholder={field.placeholder}
                                            step={field.step}
                                            min={field.min}
                                            maxLength={field.maxLength}
                                            readOnly={field.readOnly}
                                            disabled={isSubmitting}
                                            className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud disabled:opacity-60 read-only:opacity-70"
                                        />
                                    )}
                                </div>
                            )
                        })}
                        {children}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-hud-border-secondary">
                        <Button variant="ghost" type="button" onClick={onClose} disabled={isSubmitting}>
                            취소
                        </Button>
                        <Button variant="primary" glow type="submit" disabled={isSubmitting}>
                            {isSubmitting ? '처리 중...' : submitLabel}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default FormModal
