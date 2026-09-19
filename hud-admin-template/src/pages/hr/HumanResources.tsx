import { Plus } from 'lucide-react'
import DataTable, { DataTableColumn } from '../../components/common/DataTable'
import StatusBadge, { StatusTone } from '../../components/common/StatusBadge'
import Button from '../../components/common/Button'

interface EmployeeRow {
    id: string
    name: string
    department: string
    position: string
    workCenter: string
    joinDate: string
    status: string
}

const employees: EmployeeRow[] = [
    { id: 'EMP-001', name: '김대표', department: '경영지원', position: '대표이사', workCenter: '-', joinDate: '2019-03-01', status: '재직' },
    { id: 'EMP-012', name: '박생산', department: '생산관리', position: '팀장', workCenter: 'WC-CUT-01', joinDate: '2020-06-15', status: '재직' },
    { id: 'EMP-023', name: '이용접', department: '생산1팀', position: '작업자', workCenter: 'WC-WLD-01', joinDate: '2021-02-10', status: '재직' },
    { id: 'EMP-034', name: '정사출', department: '생산2팀', position: '작업자', workCenter: 'WC-INJ-03', joinDate: '2022-09-01', status: '재직' },
    { id: 'EMP-045', name: '최영업', department: '영업팀', position: '과장', workCenter: '-', joinDate: '2020-11-20', status: '재직' },
    { id: 'EMP-056', name: '강자재', department: '자재팀', position: '담당자', workCenter: '자재창고', joinDate: '2023-04-05', status: '재직' },
    { id: 'EMP-067', name: '윤품질', department: '품질팀', position: '담당자', workCenter: 'WC-QC-01', joinDate: '2021-08-12', status: '퇴사' },
]

const statusToneMap: Record<string, StatusTone> = {
    '재직': 'success',
    '퇴사': 'muted',
}

const HumanResources = () => {
    const columns: DataTableColumn<EmployeeRow>[] = [
        { key: 'id', label: '사번', render: row => <span className="font-mono text-hud-accent-primary">{row.id}</span> },
        { key: 'name', label: '성명', render: row => <span className="text-hud-text-primary">{row.name}</span> },
        { key: 'department', label: '부서' },
        { key: 'position', label: '직위' },
        { key: 'workCenter', label: '소속 작업장', render: row => <span className="font-mono text-hud-text-secondary">{row.workCenter}</span> },
        { key: 'joinDate', label: '입사일' },
        { key: 'status', label: '상태', render: row => <StatusBadge tone={statusToneMap[row.status] ?? 'muted'}>{row.status}</StatusBadge> },
    ]

    return (
        <DataTable<EmployeeRow>
            title="인사·조직"
            subtitle="직원 마스터, 소속 공정/작업장, 권한을 관리합니다."
            columns={columns}
            data={employees}
            rowKey="id"
            searchPlaceholder="사번, 성명, 부서 검색..."
            toolbar={<Button variant="primary" glow leftIcon={<Plus size={18} />}>직원 등록</Button>}
        />
    )
}

export default HumanResources
