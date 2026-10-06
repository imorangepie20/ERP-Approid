import { Plus } from 'lucide-react'
import DataTable, { DataTableColumn } from '../../components/common/DataTable'
import StatusBadge, { StatusTone } from '../../components/common/StatusBadge'
import Button from '../../components/common/Button'

interface SubcontractRow {
    id: string
    vendor: string
    item: string
    process: string
    qty: number
    unitPrice: number
    amount: number
    dueDate: string
    status: string
}

const subcontracts: SubcontractRow[] = [
    { id: 'SC-2610-001', vendor: '대명도장', item: '프레임 가조립품 A', process: '도장', qty: 120, unitPrice: 12000, amount: 1440000, dueDate: '2026-10-06', status: '반입대기' },
    { id: 'SC-2610-002', vendor: '한강열처리', item: '지지대 플레이트', process: '열처리', qty: 450, unitPrice: 3500, amount: 1575000, dueDate: '2026-10-09', status: '반출' },
    { id: 'SC-2609-014', vendor: '대명도장', item: '용접 서브 어셈블리', process: '도장', qty: 240, unitPrice: 12000, amount: 2880000, dueDate: '2026-09-30', status: '반입완료' },
    { id: 'SC-2610-003', vendor: '정익기공', item: '커버 몸체 C', process: '기공', qty: 80, unitPrice: 28000, amount: 2240000, dueDate: '2026-10-14', status: '반출' },
    { id: 'SC-2609-018', vendor: '한강열처리', item: '샤시 브라켓 B', process: '열처리', qty: 300, unitPrice: 3500, amount: 1050000, dueDate: '2026-09-27', status: '반입완료' },
]

const statusToneMap: Record<string, StatusTone> = {
    '반출': 'info',
    '반입대기': 'warning',
    '반입완료': 'success',
}

const formatWon = (value: number) => `${value.toLocaleString('ko-KR')}원`

const Subcontract = () => {
    const columns: DataTableColumn<SubcontractRow>[] = [
        { key: 'id', label: '외주번호', render: row => <span className="font-mono text-hud-accent-primary">{row.id}</span> },
        { key: 'vendor', label: '외주처' },
        { key: 'item', label: '품목', render: row => <span className="text-hud-text-primary">{row.item}</span> },
        { key: 'process', label: '공정' },
        { key: 'qty', label: '수량', render: row => <span className="font-mono">{row.qty.toLocaleString()}</span> },
        { key: 'unitPrice', label: '외주단가', render: row => <span className="font-mono text-hud-text-secondary">{row.unitPrice.toLocaleString('ko-KR')}</span> },
        { key: 'amount', label: '외주금액', render: row => <span className="font-mono text-hud-text-primary">{formatWon(row.amount)}</span> },
        { key: 'dueDate', label: '반입예정' },
        { key: 'status', label: '상태', render: row => <StatusBadge tone={statusToneMap[row.status] ?? 'muted'}>{row.status}</StatusBadge> },
    ]

    return (
        <DataTable<SubcontractRow>
            title="외주 관리"
            subtitle="외주 공정 지시, 반출/반입, 외주비 정산을 관리합니다."
            columns={columns}
            data={subcontracts}
            rowKey="id"
            searchPlaceholder="외주번호, 외주처, 품목 검색..."
            toolbar={<Button variant="primary" glow leftIcon={<Plus size={18} />} disabled title="준비 중">외주 발주</Button>}
        />
    )
}

export default Subcontract
