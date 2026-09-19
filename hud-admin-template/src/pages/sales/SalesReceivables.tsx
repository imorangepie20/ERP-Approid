import { Plus } from 'lucide-react'
import DataTable, { DataTableColumn } from '../../components/common/DataTable'
import StatusBadge, { StatusTone } from '../../components/common/StatusBadge'
import Button from '../../components/common/Button'

interface Receivable {
    id: string
    customer: string
    order: string
    amount: number
    dueDate: string
    overdueDays: number
    status: string
}

const receivables: Receivable[] = [
    { id: 'AR-001', customer: '주식회사 대영', order: 'SO-2608-014', amount: 18400000, dueDate: '2026-09-15', overdueDays: 5, status: '연체' },
    { id: 'AR-002', customer: '한솔테크', order: 'SO-2608-021', amount: 9750000, dueDate: '2026-09-20', overdueDays: 0, status: '미납' },
    { id: 'AR-003', customer: '강남정밀', order: 'SO-2609-002', amount: 6400000, dueDate: '2026-10-10', overdueDays: 0, status: '미납' },
    { id: 'AR-004', customer: '동방산업', order: 'SO-2609-005', amount: 11250000, dueDate: '2026-09-28', overdueDays: 0, status: '수납예정' },
    { id: 'AR-005', customer: '주식회사 대영', order: 'SO-2609-004', amount: 9200000, dueDate: '2026-09-18', overdueDays: 2, status: '연체' },
    { id: 'AR-006', customer: '한솔테크', order: 'SO-2609-006', amount: 4875000, dueDate: '2026-10-20', overdueDays: 0, status: '미납' },
]

const statusToneMap: Record<string, StatusTone> = {
    '연체': 'danger',
    '미납': 'warning',
    '수납예정': 'info',
    '수납완료': 'success',
}

const formatWon = (value: number) => `${value.toLocaleString('ko-KR')}원`

const SalesReceivables = () => {
    const columns: DataTableColumn<Receivable>[] = [
        { key: 'id', label: '청구번호', render: row => <span className="font-mono text-hud-accent-primary">{row.id}</span> },
        { key: 'customer', label: '고객사' },
        { key: 'order', label: '수주번호', render: row => <span className="font-mono text-hud-text-secondary">{row.order}</span> },
        { key: 'amount', label: '청구금액', render: row => <span className="font-mono text-hud-text-primary">{formatWon(row.amount)}</span> },
        { key: 'dueDate', label: '수납기일' },
        { key: 'overdueDays', label: '연체일', render: row => <span className={`font-mono ${row.overdueDays > 0 ? 'text-hud-accent-danger' : 'text-hud-text-muted'}`}>{row.overdueDays > 0 ? `${row.overdueDays}일` : '-'}</span> },
        { key: 'status', label: '상태', render: row => <StatusBadge tone={statusToneMap[row.status] ?? 'muted'}>{row.status}</StatusBadge> },
    ]

    return (
        <DataTable<Receivable>
            title="미납 관리"
            subtitle="고객사별 수납기일과 연체 현황을 추적합니다."
            columns={columns}
            data={receivables}
            rowKey="id"
            searchPlaceholder="청구번호, 고객사 검색..."
            toolbar={<Button variant="primary" glow leftIcon={<Plus size={18} />}>독촉 발송</Button>}
        />
    )
}

export default SalesReceivables
