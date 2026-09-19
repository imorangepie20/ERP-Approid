import DataTable, { DataTableColumn } from '../../components/common/DataTable'
import StatusBadge, { StatusTone } from '../../components/common/StatusBadge'
import HudCard from '../../components/common/HudCard'

interface EquipmentRow {
    id: string
    name: string
    workCenter: string
    capacity: number
    uptime: number
    operatingRate: number
    status: string
}

const equipments: EquipmentRow[] = [
    { id: 'EQ-CUT-01', name: '레이저 절단기 #1', workCenter: 'WC-CUT-01', capacity: 120, uptime: 104, operatingRate: 87, status: '가동' },
    { id: 'EQ-CUT-02', name: '레이저 절단기 #2', workCenter: 'WC-CUT-02', capacity: 120, uptime: 118, operatingRate: 98, status: '가동' },
    { id: 'EQ-WLD-01', name: '용접 로봇 #1', workCenter: 'WC-WLD-01', capacity: 96, uptime: 72, operatingRate: 75, status: '가동' },
    { id: 'EQ-WLD-02', name: '용접 로봇 #2', workCenter: 'WC-WLD-02', capacity: 96, uptime: 90, operatingRate: 94, status: '가동' },
    { id: 'EQ-PRS-01', name: '프레스 200T', workCenter: 'WC-PRS-01', capacity: 80, uptime: 0, operatingRate: 0, status: '고장' },
    { id: 'EQ-INJ-03', name: '사출성형기 #3', workCenter: 'WC-INJ-03', capacity: 100, uptime: 68, operatingRate: 68, status: '유휴' },
]

const statusToneMap: Record<string, StatusTone> = {
    '가동': 'success',
    '유휴': 'warning',
    '고장': 'danger',
}

const Equipment = () => {
    const columns: DataTableColumn<EquipmentRow>[] = [
        { key: 'id', label: '설비ID', render: row => <span className="font-mono text-hud-accent-primary">{row.id}</span> },
        { key: 'name', label: '설비명', render: row => <span className="text-hud-text-primary">{row.name}</span> },
        { key: 'workCenter', label: '작업장', render: row => <span className="font-mono text-hud-text-secondary">{row.workCenter}</span> },
        { key: 'capacity', label: '능력(h/월)', render: row => <span className="font-mono">{row.capacity}</span> },
        { key: 'uptime', label: '가동(h)', render: row => <span className="font-mono">{row.uptime}</span> },
        {
            key: 'operatingRate', label: '가동률', render: row => (
                <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-hud-bg-primary rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full ${row.operatingRate >= 90 ? 'bg-hud-accent-success' : row.operatingRate >= 70 ? 'bg-hud-accent-warning' : 'bg-hud-accent-danger'}`}
                            style={{ width: `${row.operatingRate}%` }}
                        />
                    </div>
                    <span className="font-mono text-xs text-hud-text-secondary">{row.operatingRate}%</span>
                </div>
            )
        },
        { key: 'status', label: '상태', render: row => <StatusBadge tone={statusToneMap[row.status] ?? 'muted'}>{row.status}</StatusBadge> },
    ]

    const avgRate = Math.round(equipments.reduce((sum, e) => sum + e.operatingRate, 0) / equipments.length)

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-2xl font-bold text-hud-text-primary">설비 현황</h1>
                <p className="text-hud-text-muted mt-1">설비별 능력, 가동 시간, 가동률을 관리합니다.</p>
            </div>

            <HudCard title="전체 설비 가동률" subtitle="월간 평균 OEE">
                <div className="space-y-4">
                    {equipments.map(eq => (
                        <div key={eq.id}>
                            <div className="flex justify-between text-sm mb-1.5">
                                <span className="text-hud-text-secondary">{eq.id} · {eq.name}</span>
                                <span className="text-hud-text-primary font-mono">{eq.operatingRate}%</span>
                            </div>
                            <div className="h-2 bg-hud-bg-primary rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${eq.operatingRate >= 90 ? 'bg-hud-accent-success' : eq.operatingRate >= 70 ? 'bg-hud-accent-warning' : 'bg-hud-accent-danger'}`}
                                    style={{ width: `${eq.operatingRate}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-6 pt-4 border-t border-hud-border-secondary flex items-center justify-between">
                    <span className="text-sm text-hud-text-muted">평균 가동률</span>
                    <span className="text-lg font-bold font-mono text-hud-accent-primary">{avgRate}%</span>
                </div>
            </HudCard>

            <DataTable<EquipmentRow>
                columns={columns}
                data={equipments}
                rowKey="id"
                searchPlaceholder="설비ID, 설비명 검색..."
            />
        </div>
    )
}

export default Equipment
