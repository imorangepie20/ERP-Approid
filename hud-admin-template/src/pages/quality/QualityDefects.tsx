import { Plus } from 'lucide-react'
import DataTable, { DataTableColumn } from '../../components/common/DataTable'
import StatusBadge, { StatusTone } from '../../components/common/StatusBadge'
import Button from '../../components/common/Button'

interface DefectRow {
    id: string
    item: string
    lot: string
    defectCode: string
    cause: string
    qty: number
    handling: string
    date: string
    status: string
}

const defects: DefectRow[] = [
    { id: 'DF-2610-001', item: 'ABS 펠릿', lot: 'LOT-260907', defectCode: '이물혼입', cause: '운송 중 이물 유입', qty: 12, handling: '폐기', date: '2026-10-04', status: '처리완료' },
    { id: 'DF-2610-002', item: '프레임 가조립품 A', lot: 'LOT-261001-A', defectCode: '용접불량', cause: '토치 각도 편차', qty: 4, handling: '재작업', date: '2026-10-05', status: '처리완료' },
    { id: 'DF-2610-003', item: '커버 몸체 C', lot: 'LOT-260928', defectCode: '성형불량', cause: '금형 온도 미달', qty: 5, handling: '재작업', date: '2026-09-29', status: '처리중' },
    { id: 'DF-2610-004', item: '강판 3.0mm', lot: 'LOT-261001', defectCode: '치수초과', cause: '절단 공차', qty: 3, handling: '특채', date: '2026-10-04', status: '승인대기' },
    { id: 'DF-2609-018', item: '용접 서브 어셈블리', lot: 'LOT-260920', defectCode: '용접불량', cause: '지그 미정렬', qty: 6, handling: '재작업', date: '2026-09-21', status: '처리완료' },
    { id: 'DF-2609-021', item: '지지대 플레이트', lot: 'LOT-260915', defectCode: '도장불량', cause: '도장 두께 편차', qty: 9, handling: '폐기', date: '2026-09-16', status: '처리완료' },
]

const statusToneMap: Record<string, StatusTone> = {
    '처리완료': 'success',
    '처리중': 'info',
    '승인대기': 'warning',
}

const QualityDefects = () => {
    const columns: DataTableColumn<DefectRow>[] = [
        { key: 'id', label: '불량번호', render: row => <span className="font-mono text-hud-accent-primary">{row.id}</span> },
        { key: 'item', label: '품목', render: row => <span className="text-hud-text-primary">{row.item}</span> },
        { key: 'lot', label: 'Lot No.', render: row => <span className="font-mono text-hud-text-secondary">{row.lot}</span> },
        { key: 'defectCode', label: '불량코드' },
        { key: 'cause', label: '원인' },
        { key: 'qty', label: '수량', render: row => <span className="font-mono text-hud-accent-danger">{row.qty.toLocaleString()}</span> },
        { key: 'handling', label: '처리방법' },
        { key: 'date', label: '발생일' },
        { key: 'status', label: '상태', render: row => <StatusBadge tone={statusToneMap[row.status] ?? 'muted'}>{row.status}</StatusBadge> },
    ]

    return (
        <DataTable<DefectRow>
            title="불량 관리"
            subtitle="불량코드·원인·처리(재작업/폐기/특채) 내역을 추적합니다."
            columns={columns}
            data={defects}
            rowKey="id"
            searchPlaceholder="불량번호, 품목, 불량코드 검색..."
            toolbar={<Button variant="primary" glow leftIcon={<Plus size={18} />}>불량 등록</Button>}
        />
    )
}

export default QualityDefects
