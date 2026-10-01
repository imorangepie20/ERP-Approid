import { ReactNode } from 'react'
import { Edit2, Trash2 } from 'lucide-react'

interface RowActionsProps {
    onEdit?: () => void
    onDelete?: () => void
    children?: ReactNode
    disabled?: boolean
    disabledReason?: string
}

/** DataTable 셀에 넣을 수정/삭제 버튼 */
const RowActions = ({
    onEdit,
    onDelete,
    children,
    disabled = false,
    disabledReason = '사용할 수 없음',
}: RowActionsProps) => (
    <div className="flex items-center justify-end gap-1">
        {onEdit && (
            <button
                type="button"
                onClick={onEdit}
                disabled={disabled}
                title={disabled ? `수정 · ${disabledReason}` : '수정'}
                className="p-1.5 rounded hover:bg-hud-bg-hover text-hud-text-muted hover:text-hud-accent-primary transition-hud"
            >
                <Edit2 size={14} />
            </button>
        )}
        {onDelete && (
            <button
                type="button"
                onClick={onDelete}
                disabled={disabled}
                title={disabled ? `삭제 · ${disabledReason}` : '삭제'}
                className="p-1.5 rounded hover:bg-hud-bg-hover text-hud-text-muted hover:text-hud-accent-danger transition-hud"
            >
                <Trash2 size={14} />
            </button>
        )}
        {children}
    </div>
)

export default RowActions
