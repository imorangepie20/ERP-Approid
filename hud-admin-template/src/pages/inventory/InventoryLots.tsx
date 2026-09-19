import { Plus } from 'lucide-react'
import DataTable, { DataTableColumn } from '../../components/common/DataTable'
import StatusBadge, { StatusTone } from '../../components/common/StatusBadge'
import Button from '../../components/common/Button'

interface LotRow {
    id: string
    item: string
    warehouse: string
    qty: number
    producedAt: string
    expiry: string
    status: string
}

const lots: LotRow[] = [
    { id: 'LOT-261001-A', item: '프레임 가조립품 A', warehouse: '완제품창고', qty: 180, producedAt: '2026-10-02', expiry: '-', status: '가용' },
    { id: 'LOT-261001-B', item: '프레임 가조립품 A', warehouse: '완제품창고', qty: 140, producedAt: '2026-10-03', expiry: '-', status: '가용' },
    { id: 'LOT-261002', item: '샤시 브라켓 B', warehouse: '완제품창고', qty: 1450, producedAt: '2026-10-01', expiry: '-', status: '가용' },
    { id: 'LOT-260928', item: '커버 몸체 C', warehouse: '완제품창고', qty: 60, producedAt: '2026-09-28', expiry: '-', status: '보류' },
    { id: 'LOT-260907', item: 'ABS 펠릿', warehouse: '자재창고', qty: 480, producedAt: '2026-09-07', expiry: '2027-03-07', status: '임박' },
    { id: 'LOT-260820', item: 'ABS 펠릿', warehouse: '자재창고', qty: 120, producedAt: '2026-08-20', expiry: '2026-11-20', status: '임박' },
    { id: 'LOT-260715', item: 'ABS 펠릿', warehouse: '자재창고', qty: 0, producedAt: '2026-07-15', expiry: '2026-10-15', status: '출고완료' },
]

const statusToneMap: Record<string, StatusTone> = {
    '가용': 'success',
    '보류': 'warning',
    '임박': 'danger',
    '출고완료': 'muted',
}

const InventoryLots = () => {
    const columns: DataTableColumn<LotRow>[] = [
        { key: 'id', label: 'Lot No.', render: row => <span className="font-mono text-hud-accent-primary">{row.id}</span> },
        { key: 'item', label: '품목', render: row => <span className="text-hud-text-primary">{row.item}</span> },
        { key: 'warehouse', label: '창고' },
        { key: 'qty', label: '수량', render: row => <span className="font-mono">{row.qty.toLocaleString()}</span> },
        { key: 'producedAt', label: '제조일' },
        { key: 'expiry', label: '유통기한', render: row => <span className={`font-mono ${row.expiry !== '-' && row.status === '임박' ? 'text-hud-accent-danger' : 'text-hud-text-muted'}`}>{row.expiry}</span> },
        { key: 'status', label: '상태', render: row => <StatusBadge tone={statusToneMap[row.status] ?? 'muted'}>{row.status}</StatusBadge> },
    ]

    return (
        <DataTable<LotRow>
            title="Lot 관리"
            subtitle="제조번호별 입출고, 유통기한, 선입선출(FIFO)을 관리합니다."
            columns={columns}
            data={lots}
            rowKey="id"
            searchPlaceholder="Lot No., 품목 검색..."
            toolbar={<Button variant="primary" glow leftIcon={<Plus size={18} />}>Lot 등록</Button>}
        />
    )
}

export default InventoryLots
