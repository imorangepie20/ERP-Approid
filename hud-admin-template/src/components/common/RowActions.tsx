import { ReactNode } from 'react'
import { Edit2, Trash2 } from 'lucide-react'
import Button from './Button'

interface RowActionsProps {
    onEdit?: () => void
    onDelete?: () => void
    children?: ReactNode
}

/** DataTable 셀에 넣을 수정/삭제 버튼 */
const RowActions = ({ onEdit, onDelete, children }: RowActionsProps) => (
    <div className="flex items-center justify-end gap-1">
        {onEdit && (
            <button
                onClick={onEdit}
                title="수정"
                className="p-1.5 rounded hover:bg-hud-bg-hover text-hud-text-muted hover:text-hud-accent-primary transition-hud"
            >
                <Edit2 size={14} />
            </button>
        )}
        {onDelete && (
            <button
                onClick={onDelete}
                title="삭제"
                className="p-1.5 rounded hover:bg-hud-bg-hover text-hud-text-muted hover:text-hud-accent-danger transition-hud"
            >
                <Trash2 size={14} />
            </button>
        )}
        {children}
    </div>
)

export default RowActions
