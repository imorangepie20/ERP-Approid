import { Plus } from 'lucide-react'
import DataTable, { DataTableColumn } from '../../components/common/DataTable'
import StatusBadge, { StatusTone } from '../../components/common/StatusBadge'
import Button from '../../components/common/Button'

interface MaintenanceRow {
    id: string
    equipmentId: string
    equipmentName: string
    type: string
    scheduledDate: string
    completedDate: string
    result: string
    note: string
}

const maintenances: MaintenanceRow[] = [
    { id: 'PM-2610-001', equipmentId: 'EQ-CUT-01', equipmentName: '레이저 절단기 #1', type: '정기점검', scheduledDate: '2026-10-10', completedDate: '-', result: '예정', note: '광학계 세정' },
    { id: 'PM-2609-004', equipmentId: 'EQ-WLD-01', equipmentName: '용접 로봇 #1', type: '정기점검', scheduledDate: '2026-09-15', completedDate: '2026-09-15', result: '정상', note: '토치 팁 교체' },
    { id: 'PM-2609-007', equipmentId: 'EQ-PRS-01', equipmentName: '프레스 200T', type: '고장수리', scheduledDate: '2026-09-28', completedDate: '2026-09-30', result: '수리완료', note: '유압 펌프 교체' },
    { id: 'PM-2610-002', equipmentId: 'EQ-INJ-03', equipmentName: '사출성형기 #3', type: '예방보전', scheduledDate: '2026-10-18', completedDate: '-', result: '예정', note: '금형 온도 점검' },
    { id: 'PM-2608-012', equipmentId: 'EQ-WLD-02', equipmentName: '용접 로봇 #2', type: '정기점검', scheduledDate: '2026-08-20', completedDate: '2026-08-20', result: '정상', note: '와이어 피더 점검' },
    { id: 'PM-2610-003', equipmentId: 'EQ-CUT-02', equipmentName: '레이저 절단기 #2', type: '정기점검', scheduledDate: '2026-10-25', completedDate: '-', result: '예정', note: '레일 윤활' },
]

const resultToneMap: Record<string, StatusTone> = {
    '정상': 'success',
    '수리완료': 'primary',
    '예정': 'warning',
    '이상': 'danger',
}

const EquipmentMaintenance = () => {
    const columns: DataTableColumn<MaintenanceRow>[] = [
        { key: 'id', label: '점검번호', render: row => <span className="font-mono text-hud-accent-primary">{row.id}</span> },
        { key: 'equipmentId', label: '설비ID', render: row => <span className="font-mono text-hud-text-secondary">{row.equipmentId}</span> },
        { key: 'equipmentName', label: '설비명', render: row => <span className="text-hud-text-primary">{row.equipmentName}</span> },
        { key: 'type', label: '점검구분' },
        { key: 'scheduledDate', label: '점검예정' },
        { key: 'completedDate', label: '완료일' },
        { key: 'result', label: '결과', render: row => <StatusBadge tone={resultToneMap[row.result] ?? 'muted'}>{row.result}</StatusBadge> },
        { key: 'note', label: '비고' },
    ]

    return (
        <DataTable<MaintenanceRow>
            title="점검 이력"
            subtitle="설비 점검 주기·예정일·결과 이력을 관리합니다."
            columns={columns}
            data={maintenances}
            rowKey="id"
            searchPlaceholder="점검번호, 설비명 검색..."
            toolbar={<Button variant="primary" glow leftIcon={<Plus size={18} />} disabled title="준비 중">점검 등록</Button>}
        />
    )
}

export default EquipmentMaintenance
