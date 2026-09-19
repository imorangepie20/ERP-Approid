import { Plus, TrendingUp, TrendingDown, DollarSign, Box } from 'lucide-react'
import DataTable, { DataTableColumn } from '../../components/common/DataTable'
import Button from '../../components/common/Button'
import HudCard from '../../components/common/HudCard'
import StatCard from '../../components/common/StatCard'

interface CostRow {
    id: string
    order: string
    item: string
    material: number
    labor: number
    overhead: number
    subcontract: number
    total: number
    standard: number
    diff: number
}

const costs: CostRow[] = [
    { id: 'CT-2610-001', order: 'WO-2610-001', item: '프레임 가조립품 A', material: 9600000, labor: 3600000, overhead: 1800000, subcontract: 1440000, total: 16440000, standard: 15900000, diff: 540000 },
    { id: 'CT-2610-002', order: 'WO-2610-002', item: '샤시 브라켓 B', material: 6750000, labor: 1200000, overhead: 600000, subcontract: 0, total: 8550000, standard: 8700000, diff: -150000 },
    { id: 'CT-2610-003', order: 'WO-2610-003', item: '커버 몸체 C', material: 2400000, labor: 960000, overhead: 480000, subcontract: 2240000, total: 6080000, standard: 6200000, diff: -120000 },
    { id: 'CT-2610-004', order: 'WO-2610-005', item: '용접 서브 어셈블리', material: 4800000, labor: 2880000, overhead: 1440000, subcontract: 2880000, total: 12000000, standard: 11400000, diff: 600000 },
]

const formatWon = (value: number) => `${value.toLocaleString('ko-KR')}원`

const Accounting = () => {
    const columns: DataTableColumn<CostRow>[] = [
        { key: 'id', label: '원가ID', render: row => <span className="font-mono text-hud-accent-primary">{row.id}</span> },
        { key: 'order', label: '작업오더', render: row => <span className="font-mono text-hud-text-secondary">{row.order}</span> },
        { key: 'item', label: '품목', render: row => <span className="text-hud-text-primary">{row.item}</span> },
        { key: 'material', label: '재료비', render: row => <span className="font-mono text-hud-text-secondary">{formatWon(row.material)}</span> },
        { key: 'labor', label: '노무비', render: row => <span className="font-mono text-hud-text-secondary">{formatWon(row.labor)}</span> },
        { key: 'overhead', label: '경비', render: row => <span className="font-mono text-hud-text-secondary">{formatWon(row.overhead)}</span> },
        { key: 'subcontract', label: '외주비', render: row => <span className="font-mono text-hud-text-secondary">{formatWon(row.subcontract)}</span> },
        { key: 'total', label: '실제원가', render: row => <span className="font-mono text-hud-text-primary">{formatWon(row.total)}</span> },
        {
            key: 'diff', label: '표준대비', render: row => (
                <span className={`inline-flex items-center gap-1 text-sm font-mono font-medium ${row.diff > 0 ? 'text-hud-accent-danger' : 'text-hud-accent-success'}`}>
                    {row.diff > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {row.diff > 0 ? '+' : ''}{formatWon(row.diff)}
                </span>
            )
        },
    ]

    const totalActual = costs.reduce((sum, c) => sum + c.total, 0)
    const totalDiff = costs.reduce((sum, c) => sum + c.diff, 0)

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-hud-text-primary">원가·회계</h1>
                    <p className="text-hud-text-muted mt-1">작업오더별 표준/실제 원가 차이와 회계 전표를 관리합니다.</p>
                </div>
                <Button variant="primary" glow leftIcon={<Plus size={18} />}>전표 등록</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="실제원가 합계" value={formatWon(totalActual)} icon={<Box size={24} />} variant="primary" />
                <StatCard title="원가 차이" value={`${totalDiff > 0 ? '+' : ''}${formatWon(totalDiff)}`} icon={<DollarSign size={24} />} variant={totalDiff > 0 ? 'danger' : 'primary'} />
                <StatCard title="집계 작업오더" value={costs.length.toString()} icon={<TrendingUp size={24} />} variant="secondary" />
                <StatCard title="차이율" value={`${((totalDiff / costs.reduce((s, c) => s + c.standard, 0)) * 100).toFixed(1)}%`} icon={<TrendingDown size={24} />} variant="warning" />
            </div>

            <HudCard title="원가 구성 비율" subtitle="재료비·노무비·경비·외주비">
                {(() => {
                    const sum = { material: 0, labor: 0, overhead: 0, subcontract: 0 }
                    costs.forEach(c => {
                        sum.material += c.material
                        sum.labor += c.labor
                        sum.overhead += c.overhead
                        sum.subcontract += c.subcontract
                    })
                    const total = sum.material + sum.labor + sum.overhead + sum.subcontract
                    const segments = [
                        { label: '재료비', value: sum.material, color: 'bg-hud-accent-primary' },
                        { label: '노무비', value: sum.labor, color: 'bg-hud-accent-info' },
                        { label: '경비', value: sum.overhead, color: 'bg-hud-accent-warning' },
                        { label: '외주비', value: sum.subcontract, color: 'bg-hud-accent-secondary' },
                    ]
                    return (
                        <>
                            <div className="flex h-3 rounded-full overflow-hidden">
                                {segments.map(seg => (
                                    <div
                                        key={seg.label}
                                        className={`${seg.color} transition-all duration-500`}
                                        style={{ width: `${(seg.value / total) * 100}%` }}
                                        title={`${seg.label} ${((seg.value / total) * 100).toFixed(1)}%`}
                                    />
                                ))}
                            </div>
                            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                {segments.map(seg => (
                                    <div key={seg.label}>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-3 h-3 rounded-full ${seg.color}`} />
                                            <span className="text-sm text-hud-text-secondary">{seg.label}</span>
                                        </div>
                                        <p className="text-sm font-mono text-hud-text-primary mt-1">{formatWon(seg.value)}</p>
                                        <p className="text-xs font-mono text-hud-text-muted">{((seg.value / total) * 100).toFixed(1)}%</p>
                                    </div>
                                ))}
                            </div>
                        </>
                    )
                })()}
            </HudCard>

            <DataTable<CostRow>
                columns={columns}
                data={costs}
                rowKey="id"
                searchPlaceholder="원가ID, 작업오더, 품목 검색..."
            />
        </div>
    )
}

export default Accounting
