import {
    Gauge,
    Clock,
    Percent,
    TrendingUp,
    TrendingDown,
    Factory,
    Box,
    CheckCircle2,
    AlertTriangle,
} from 'lucide-react'
import HudCard from '../../components/common/HudCard'
import StatCard from '../../components/common/StatCard'

const productionByItem = [
    { item: '프레임 가조립품 A', plan: 400, actual: 380, percentage: 95, color: '#00FFCC' },
    { item: '샤시 브라켓 B', plan: 900, actual: 910, percentage: 101, color: '#6366F1' },
    { item: '커버 몸체 C', plan: 500, actual: 340, percentage: 68, color: '#FF1493' },
    { item: '지지대 플레이트', plan: 1200, actual: 1150, percentage: 96, color: '#FFA500' },
    { item: '용접 서브 어셈블리', plan: 800, actual: 720, percentage: 90, color: '#10B981' },
]

const workCenters = [
    { name: 'WC-CUT-01', operatingRate: 87, utilization: 82, units: '레이저 절단기 #1' },
    { name: 'WC-CUT-02', operatingRate: 98, utilization: 94, units: '레이저 절단기 #2' },
    { name: 'WC-WLD-01', operatingRate: 75, utilization: 68, units: '용접 로봇 #1' },
    { name: 'WC-WLD-02', operatingRate: 94, utilization: 90, units: '용접 로봇 #2' },
    { name: 'WC-INJ-03', operatingRate: 68, utilization: 61, units: '사출성형기 #3' },
]

const defectCauses = [
    { cause: '용접불량', count: 42, percentage: 38, color: '#FF1493' },
    { cause: '성형불량', count: 28, percentage: 25, color: '#6366F1' },
    { cause: '치수초과', count: 18, percentage: 16, color: '#FFA500' },
    { cause: '도장불량', count: 13, percentage: 12, color: '#00FFCC' },
    { cause: '이물혼입', count: 9, percentage: 9, color: '#10B981' },
]

const monthlyTrend = [
    { month: '4월', plan: 72, actual: 68 }, { month: '5월', plan: 75, actual: 72 },
    { month: '6월', plan: 78, actual: 76 }, { month: '7월', plan: 80, actual: 79 },
    { month: '8월', plan: 82, actual: 81 }, { month: '9월', plan: 85, actual: 83 },
]

const Analytics = () => {
    const maxDefectCount = Math.max(...defectCauses.map(d => d.count))
    const totalDefects = defectCauses.reduce((sum, d) => sum + d.count, 0)

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold text-hud-text-primary">운영 분석</h1>
                <p className="text-hud-text-muted mt-1">생산, 품질, 원가, 납기 운영 지표 분석</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="평균 가동률"
                    value="85.3%"
                    change={3.2}
                    changeLabel="전월 대비"
                    icon={<Gauge size={24} />}
                    variant="primary"
                />
                <StatCard
                    title="평균 수율"
                    value="96.8%"
                    change={-0.4}
                    changeLabel="전월 대비"
                    icon={<Percent size={24} />}
                    variant="secondary"
                />
                <StatCard
                    title="평균 생산 리드타임"
                    value="6.2일"
                    change={-0.8}
                    changeLabel="단축"
                    icon={<Clock size={24} />
                    }
                    variant="warning"
                />
                <StatCard
                    title="원가 차이율"
                    value="+2.1%"
                    change={0.3}
                    changeLabel="전월 대비"
                    icon={<TrendingUp size={24} />}
                    variant="default"
                />
            </div>

            {/* Main Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Monthly Production Trend */}
                <HudCard
                    title="월별 생산 추이"
                    subtitle="계획(%) vs 실적(%) · 최근 6개월"
                    className="lg:col-span-2"
                >
                    <div className="h-64 flex items-end justify-between gap-4">
                        {monthlyTrend.map((data) => {
                            const maxHeight = 200
                            return (
                                <div key={data.month} className="flex-1 flex flex-col items-center gap-2">
                                    <div className="w-full flex items-end justify-center gap-1 h-56">
                                        <div className="w-1/2 relative group">
                                            <div
                                                className="w-full bg-hud-accent-info/40 rounded-t hover:bg-hud-accent-info transition-all duration-300 cursor-pointer"
                                                style={{ height: `${(data.plan / 100) * maxHeight}px` }}
                                            />
                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-hud-bg-secondary border border-hud-border-secondary px-2 py-1 rounded text-xs text-hud-text-primary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                계획 {data.plan}%
                                            </div>
                                        </div>
                                        <div className="w-1/2 relative group">
                                            <div
                                                className="w-full bg-gradient-to-t from-hud-accent-primary to-hud-accent-primary/30 rounded-t hover:from-hud-accent-primary hover:to-hud-accent-secondary transition-all duration-300 cursor-pointer"
                                                style={{ height: `${(data.actual / 100) * maxHeight}px` }}
                                            />
                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-hud-bg-secondary border border-hud-border-secondary px-2 py-1 rounded text-xs text-hud-text-primary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                실적 {data.actual}%
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-xs text-hud-text-muted">{data.month}</span>
                                </div>
                            )
                        })}
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-6 text-xs text-hud-text-muted">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-hud-accent-info/40" />
                            <span>계획</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-gradient-to-t from-hud-accent-primary to-hud-accent-primary/30" />
                            <span>실적</span>
                        </div>
                    </div>
                </HudCard>

                {/* Work Center Utilization */}
                <HudCard title="작업장별 가동률" subtitle="설비 가동/능력 달성">
                    <div className="space-y-6">
                        {workCenters.map((wc) => (
                            <div key={wc.name}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="text-hud-accent-primary"><Factory size={20} /></div>
                                        <div>
                                            <span className="text-sm text-hud-text-primary">{wc.name}</span>
                                            <p className="text-xs text-hud-text-muted">{wc.units}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-sm font-mono text-hud-text-primary">{wc.operatingRate}%</span>
                                        <p className="text-xs text-hud-text-muted">능력 {wc.utilization}%</p>
                                    </div>
                                </div>
                                <div className="h-2 bg-hud-bg-primary rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${wc.operatingRate >= 90 ? 'bg-hud-accent-success' : wc.operatingRate >= 75 ? 'bg-gradient-to-r from-hud-accent-primary to-hud-accent-info' : 'bg-hud-accent-warning'}`}
                                        style={{ width: `${wc.operatingRate}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </HudCard>
            </div>

            {/* Production Achievement & Defect Pareto */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Production Achievement */}
                <HudCard title="품목별 생산 달성률" subtitle="당월 계획 대비 실적" noPadding>
                    <div>
                        {productionByItem.map((item) => (
                            <div
                                key={item.item}
                                className="flex items-center justify-between px-5 py-3 border-b border-hud-border-secondary last:border-0 hover:bg-hud-bg-hover transition-hud"
                            >
                                <div className="flex items-center gap-3">
                                    <Box size={16} className="text-hud-accent-primary" />
                                    <span className="text-sm text-hud-text-primary">{item.item}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm font-mono text-hud-text-secondary">
                                        {item.actual.toLocaleString()} / {item.plan.toLocaleString()}
                                    </span>
                                    <div className="w-24 h-2 bg-hud-bg-primary rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${item.percentage >= 95 ? 'bg-hud-accent-success' : item.percentage >= 80 ? 'bg-hud-accent-primary' : 'bg-hud-accent-danger'}`}
                                            style={{ width: `${Math.min(100, item.percentage)}%` }}
                                        />
                                    </div>
                                    <span className={`text-sm font-mono w-12 text-right ${item.percentage >= 95 ? 'text-hud-accent-success' : item.percentage >= 80 ? 'text-hud-text-primary' : 'text-hud-accent-danger'}`}>
                                        {item.percentage}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </HudCard>

                {/* Defect Pareto */}
                <HudCard title="불량 원인별 파레토" subtitle={`총 불량 ${totalDefects}건 · 당월`}>
                    <div className="space-y-4">
                        {defectCauses.map((d) => (
                            <div key={d.cause}>
                                <div className="flex items-center justify-between text-sm mb-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                                        <span className="text-hud-text-secondary">{d.cause}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono text-hud-text-primary">{d.count}건</span>
                                        <span className="font-mono text-xs text-hud-text-muted w-10 text-right">{d.percentage}%</span>
                                    </div>
                                </div>
                                <div className="h-2 bg-hud-bg-primary rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{ width: `${(d.count / maxDefectCount) * 100}%`, backgroundColor: d.color }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </HudCard>
            </div>

            {/* Delivery & Cost Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <HudCard title="납기 준수 현황" subtitle="당월 출하 기준">
                    <div className="space-y-4">
                        {[
                            { label: '납기 준수', value: 47, tone: 'text-hud-accent-success', icon: <CheckCircle2 size={18} /> },
                            { label: '납기 지연', value: 3, tone: 'text-hud-accent-danger', icon: <AlertTriangle size={18} /> },
                        ].map(row => (
                            <div key={row.label} className="flex items-center justify-between p-3 rounded-lg bg-hud-bg-primary/50">
                                <div className={`flex items-center gap-2 ${row.tone}`}>
                                    {row.icon}
                                    <span className="text-sm text-hud-text-secondary">{row.label}</span>
                                </div>
                                <span className={`font-mono font-bold ${row.tone}`}>{row.value}건</span>
                            </div>
                        ))}
                        <div className="pt-3 border-t border-hud-border-secondary">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-hud-text-muted">납기 준수율</span>
                                <span className="text-lg font-bold font-mono text-hud-accent-primary">94.0%</span>
                            </div>
                        </div>
                    </div>
                </HudCard>

                <HudCard title="원가 구성" subtitle="당월 집계">
                    <div className="space-y-4">
                        {[
                            { label: '재료비', value: 52, amount: '₩201.1M' },
                            { label: '노무비', value: 24, amount: '₩92.8M' },
                            { label: '경비', value: 12, amount: '₩46.4M' },
                            { label: '외주비', value: 12, amount: '₩46.4M' },
                        ].map(row => (
                            <div key={row.label}>
                                <div className="flex items-center justify-between text-sm mb-1.5">
                                    <span className="text-hud-text-secondary">{row.label}</span>
                                    <span className="font-mono text-hud-text-primary">{row.amount}</span>
                                </div>
                                <div className="h-2 bg-hud-bg-primary rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-hud-accent-primary to-hud-accent-info rounded-full" style={{ width: `${row.value}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </HudCard>

                <HudCard title="재고 회전율" subtitle="월간 재고 소진율">
                    <div className="flex flex-col items-center justify-center py-6">
                        <div className="relative w-32 h-32">
                            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--hud-bg-primary)" strokeWidth="12" />
                                <circle
                                    cx="50" cy="50" r="40" fill="none"
                                    stroke="var(--hud-accent-primary)" strokeWidth="12"
                                    strokeDasharray={`${2 * Math.PI * 40 * 0.72} ${2 * Math.PI * 40}`}
                                    strokeLinecap="round"
                                    className="transition-all duration-500"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-2xl font-bold text-hud-text-primary">7.2</span>
                                <span className="text-xs text-hud-text-muted">회/년</span>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-sm">
                            <TrendingDown size={16} className="text-hud-accent-danger" />
                            <span className="text-hud-accent-danger font-medium">-0.4회</span>
                            <span className="text-hud-text-muted">전월 대비</span>
                        </div>
                    </div>
                </HudCard>
            </div>
        </div>
    )
}

export default Analytics
