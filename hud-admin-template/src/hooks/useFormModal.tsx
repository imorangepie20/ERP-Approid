import { useCallback, useState } from 'react'
import FormModal, { ModalField } from '../components/common/FormModal'

type Values = Record<string, string>

interface UseFormModalOptions<T> {
    fields: (values: Values, editing?: T) => ModalField[]
    /** 신규 레코드 생성 (문자열 값을 받아 ID를 반환하거나 void) */
    onCreate: (values: Values) => string | void
    /** 기존 레코드 수정 */
    onUpdate?: (id: string, values: Values) => void
    /** 레코드 삭제 */
    onDelete?: (id: string) => void
    title: string
    subtitle?: string
    submitLabel?: string
    toValues?: (record: T) => Values
    validate?: (values: Values) => string | null
}

export const useFormModal = <T extends { id: string }>({
    fields,
    onCreate,
    onUpdate,
    onDelete,
    title,
    subtitle,
    submitLabel,
    toValues,
    validate,
}: UseFormModalOptions<T>) => {
    const [isOpen, setIsOpen] = useState(false)
    const [editing, setEditing] = useState<T | null>(null)
    const [values, setValues] = useState<Values>({})
    const [error, setError] = useState<string | null>(null)

    const openCreate = useCallback(() => {
        setError(null)
        setEditing(null)
        setValues({})
        setIsOpen(true)
    }, [])

    const openEdit = useCallback((record: T) => {
        setError(null)
        setEditing(record)
        setValues(toValues ? toValues(record) :
            Object.fromEntries(
                Object.entries(record).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)])
            )
        )
        setIsOpen(true)
    }, [toValues])

    const close = useCallback(() => {
        setError(null)
        setIsOpen(false)
        setEditing(null)
        setValues({})
    }, [])

    const handleChange = useCallback((key: string, value: string) => {
        setError(null)
        setValues(prev => ({ ...prev, [key]: value }))
    }, [])

    const handleSubmit = useCallback(() => {
        const validationError = validate?.(values)
        if (validationError) { setError(validationError); return }
        if (editing) {
            onUpdate?.(editing.id, values)
        } else {
            onCreate(values)
        }
        close()
    }, [editing, values, onCreate, onUpdate, close, validate])

    const confirmDelete = useCallback((record: T) => {
        if (!onDelete) return
        if (window.confirm(`"${record.id}" 레코드를 삭제하시겠습니까?`)) {
            onDelete(record.id)
        }
    }, [onDelete])

    const modal = (
        <FormModal
            isOpen={isOpen}
            onClose={close}
            title={editing ? `${title} 수정` : `${title} 등록`}
            subtitle={subtitle}
            fields={fields(values, editing ?? undefined)}
            values={values}
            onChange={handleChange}
            onSubmit={handleSubmit}
            submitLabel={editing ? '수정' : submitLabel ?? '등록'}
            error={error}
        />
    )

    return {
        openCreate,
        openEdit,
        close,
        modal,
        confirmDelete,
        isOpen,
        editing,
    }
}
