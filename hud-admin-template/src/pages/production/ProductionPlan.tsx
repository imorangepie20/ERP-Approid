import { Plus } from 'lucide-react'
import DataTable, { DataTableColumn } from '../../components/common/DataTable'
import StatusBadge, { StatusTone } from '../../components/common/StatusBadge'
import Button from '../../components/common/Button'

interface PlanRow {
    id: string
    item: string
    month: string
    planQty: number
    orderQty: number
    stockQty: number
    gap: number
    status: string
}

const plans: PlanRow[] = [
    { id: 'MPS-2610-01', item: '프레임 가조립품 A', month: '2026-10', planQty: 400, orderQty: 320, stockQty: 60, gap: 20, status: '수주생산' },
    { id: 'MPS-2610-02', item: '샤시 브라켓 B', month: '2026-10', planQty: 900, orderQty: 450, stockQty: 1450, gap: -1000, status: '재고우선' },
    { id: 'MPS-2610-03', item: '커버 몰드 C', month: '2026-10', planQty: 500, orderQty: 200, stockQty: 60, gap: 240, status: '수주생산' },
    { id: 'MPS-2610-04', item: '지지대 플레이트', month: '2026-10', planQty: 1200, orderQty: 540, stockQty: 820, gap: -160, status: '재고우선' },
    { id: 'MPS-2611-01', item: '프레임 가조립품 A', month: '2026-11', planQty: 350, orderQty: 60, stockQty: 60, gap: 230, status: '예측생산' },
    { id: 'MPS-2611-02', item: '커버 몰드 C', month: '2026-11', planQty: 400, orderQty: 0, stockQty: 60, gap: 340, status: '예측생산' },
]

const statusToneMap: Record<string, StatusTone> = {
    '수주생산': 'primary',
    '재고우선': 'info',
    '예측생산': 'warning',
}

const ProductionPlan = () => {
    const columns: DataTableColumn<PlanRow>[] = [
        { key: 'id', label: '계획번호', render: row => <span className="font-mono text-hud-accent-primary">{row.id}</span> },
        { key: 'item', label: '품목', render: row => <span className="text-hud-text-primary">{row.item}</span> },
        { key: 'month', label: '계획월' },
        { key: 'planQty', label: '계획수량', render: row => <span className="font-mono">{row.planQty.toLocaleString()}</span> },
        { key: 'orderQty', label: '수주수량', render: row => <span className="font-mono">{row.orderQty.toLocaleString()}</span> },
        { key: 'stockQty', label: '현재고', render: row => <span className="font-mono">{row.stockQty.toLocaleString()}</span> },
        {
            key: 'gap', label: '생산필요량', render: row => (
                <span className={`font-mono ${row.gap > 0 ? 'text-hud-accent-warning' : 'text-hud-accent-success'}`}>
                    {row.gap > 0 ? `+${row.gap.toLocaleString()}` : row.gap.toLocaleString()}
                </span>
            )
        },
        { key: 'status', label: '생산방식', render: row => <StatusBadge tone={statusToneMap[row.status] ?? 'muted'}>{row.status}</StatusBadge> },
    ]

    return (
        <DataTable<PlanRow>
            title="생산계획"
            subtitle="월/주 단위 MPS와 수주·재고 기반 생산 필요량을 관리합니다."
            columns={columns}
            data={plans}
            rowKey="id"
            searchPlaceholder="계획번호, 품목 검색..."
            toolbar={<Button variant="primary" glow leftIcon={<Plus size={18} />}>계획 등록</Button>}
        />
    )
}

export default ProductionPlan
