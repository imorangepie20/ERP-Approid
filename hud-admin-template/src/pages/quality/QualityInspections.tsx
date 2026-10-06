import { Plus } from 'lucide-react'
import DataTable, { DataTableColumn } from '../../components/common/DataTable'
import StatusBadge, { StatusTone } from '../../components/common/StatusBadge'
import Button from '../../components/common/Button'

interface InspectionRow {
    id: string
    type: string
    item: string
    lot: string
    sampleQty: number
    defectQty: number
    inspector: string
    date: string
    result: string
}

const inspections: InspectionRow[] = [
    { id: 'QC-2610-001', type: '입고검사', item: '강판 3.0mm', lot: 'LOT-261001', sampleQty: 20, defectQty: 3, inspector: '김품질', date: '2026-10-04', result: '합격' },
    { id: 'QC-2610-002', type: '입고검사', item: 'ABS 펠릿', lot: 'LOT-260907', sampleQty: 10, defectQty: 12, inspector: '김품질', date: '2026-10-04', result: '부적합' },
    { id: 'QC-2610-003', type: '공정검사', item: '프레임 가조립품 A', lot: 'LOT-261001-A', sampleQty: 30, defectQty: 4, inspector: '이검사', date: '2026-10-05', result: '합격' },
    { id: 'QC-2610-004', type: '완제품검사', item: '샤시 브라켓 B', lot: 'LOT-261002', sampleQty: 50, defectQty: 0, inspector: '이검사', date: '2026-10-01', result: '합격' },
    { id: 'QC-2610-005', type: '공정검사', item: '커버 몸체 C', lot: 'LOT-260928', sampleQty: 20, defectQty: 5, inspector: '김품질', date: '2026-09-29', result: '재검사' },
    { id: 'QC-2610-006', type: '출하검사', item: '지지대 플레이트', lot: 'LOT-260925', sampleQty: 40, defectQty: 1, inspector: '박QC', date: '2026-09-26', result: '합격' },
]

const resultToneMap: Record<string, StatusTone> = {
    '합격': 'success',
    '부적합': 'danger',
    '재검사': 'warning',
}

const QualityInspections = () => {
    const columns: DataTableColumn<InspectionRow>[] = [
        { key: 'id', label: '검사번호', render: row => <span className="font-mono text-hud-accent-primary">{row.id}</span> },
        { key: 'type', label: '검사구분' },
        { key: 'item', label: '품목', render: row => <span className="text-hud-text-primary">{row.item}</span> },
        { key: 'lot', label: 'Lot No.', render: row => <span className="font-mono text-hud-text-secondary">{row.lot}</span> },
        { key: 'sampleQty', label: '샘플수', render: row => <span className="font-mono">{row.sampleQty.toLocaleString()}</span> },
        { key: 'defectQty', label: '불량수', render: row => <span className={`font-mono ${row.defectQty > 0 ? 'text-hud-accent-danger' : 'text-hud-text-muted'}`}>{row.defectQty.toLocaleString()}</span> },
        { key: 'inspector', label: '검사자' },
        { key: 'date', label: '검사일' },
        { key: 'result', label: '결과', render: row => <StatusBadge tone={resultToneMap[row.result] ?? 'muted'}>{row.result}</StatusBadge> },
    ]

    return (
        <DataTable<InspectionRow>
            title="검사 실적"
            subtitle="자재 입고검사·공정검사·완제품검사 실적을 관리합니다."
            columns={columns}
            data={inspections}
            rowKey="id"
            searchPlaceholder="검사번호, 품목, Lot 검색..."
            toolbar={<Button variant="primary" glow leftIcon={<Plus size={18} />} disabled title="준비 중">검사 등록</Button>}
        />
    )
}

export default QualityInspections
