import {
    DollarSign,
    Factory,
    ClipboardList,
    Target,
    Activity,
    AlertTriangle,
    Clock,
    ArrowUpRight,
} from 'lucide-react'
import HudCard from '../../components/common/HudCard'
import StatCard from '../../components/common/StatCard'
import Button from '../../components/common/Button'
import StatusBadge, { StatusTone } from '../../components/common/StatusBadge'

interface WorkOrderRow {
    id: string
    item: string
    qty: number
    goodQty: number
    progress: number
    dueDate: string
    status: string
    delay: boolean
}

const workOrders: WorkOrderRow[] = [
    { id: 'WO-2610-001', item: '프레임 가조립품 A', qty: 120, goodQty: 96, progress: 80, dueDate: '2026-10-05', status: '진행중', delay: false },
    { id: 'WO-2610-003', item: '커버 몸체 C', qty: 80, goodQty: 24, progress: 30, dueDate: '2026-10-12', status: '진행중', delay: true },
    { id: 'WO-2610-004', item: '지지대 플레이트', qty: 450, goodQty: 0, progress: 0, dueDate: '2026-10-18', status: '지시', delay: false },
    { id: 'WO-2610-002', item: '샤시 브라켓 B', qty: 300, goodQty: 300, progress: 100, dueDate: '2026-10-08', status: '완료', delay: false },
    { id: 'WO-2610-006', item: '커버 몸체 C', qty: 200, goodQty: 0, progress: 0, dueDate: '2026-10-22', status: '지시', delay: false },
]

const topItems = [
    { name: '프레임 가조립품 A', produced: 980, revenue: '₩149,940,000', growth: 12 },
    { name: '샤시 브라켓 B', produced: 2450, revenue: '₩79,625,000', growth: 8 },
    { name: '지지대 플레이트', produced: 1820, revenue: '₩45,500,000', growth: -3 },
    { name: '커버 몸체 C', produced: 640, revenue: '₩51,200,000', growth: 15 },
    { name: '용접 서브 어셈블리', produced: 1120, revenue: '₩107,520,000', growth: 5 },
]

const equipmentStats = [
    { label: '가동률 (평균)', value: 85, color: 'hud-accent-primary' },
    { label: '생산 능력 달성율', value: 92, color: 'hud-accent-info' },
    { label: '설비 가용율', value: 78, color: 'hud-accent-warning' },
    { label: 'OEE', value: 71, color: 'hud-accent-secondary' },
]

const statusToneMap: Record<string, StatusTone> = {
    '지시': 'warning',
    '진행중': 'info',
    '완료': 'success',
}

const Dashboard = () => {
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-hud-text-primary">대시보드</h1>
                    <p className="text-hud-text-muted mt-1">2026년 10월 · 1공장 생산 현황</p>
                </div>
                <Button variant="primary" glow leftIcon={<Activity size={18} />}>
                    보고서 보기
                </Button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="당월 매출"
                    value="₩434,210,000"
                    change={12.5}
                    changeLabel="전월 대비"
                    icon={<DollarSign size={24} />}
                    variant="primary"
                />
                <StatCard
                    title="당월 생산액"
                    value="₩386,780,000"
                    change={8.2}
                    changeLabel="전월 대비"
                    icon={<Factory size={24} />}
                    variant="secondary"
                />
                <StatCard
                    title="수주 잔량"
                    value="1,429 EA"
                    change={-2.4}
                    changeLabel="전월 대비"
                    icon={<ClipboardList size={24} />}
                    variant="warning"
                />
                <StatCard
                    title="납기 준수율"
                    value="94.2%"
                    change={4.1}
                    changeLabel="전월 대비"
                    icon={<Target size={24} />}
                    variant="default"
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Chart */}
                <HudCard
                    title="생산 추이"
                    subtitle="월별 계획 vs 실적"
                    className="lg:col-span-2"
                    action={
                        <select className="bg-hud-bg-primary border border-hud-border-secondary rounded px-3 py-1.5 text-sm text-hud-text-secondary focus:outline-none focus:border-hud-accent-primary">
                            <option>최근 12개월</option>
                            <option>최근 6개월</option>
                            <option>최근 3개월</option>
                        </select>
                    }
                >
                    <div className="h-64 flex items-end justify-between gap-2">
                        {['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'].map((month, i) => {
                            const plan = [70, 72, 75, 78, 80, 82, 85, 86, 88, 90, 92, 95]
                            const actual = [65, 70, 72, 76, 78, 80, 82, 84, 85, 87, 0, 0]
                            return (
                                <div key={month} className="flex-1 flex flex-col items-center gap-2">
                                    <div className="w-full flex items-end justify-center gap-0.5 h-56">
                                        <div
                                            className="w-1/2 bg-hud-accent-info/40 rounded-t hover:bg-hud-accent-info transition-all duration-300 cursor-pointer"
                                            style={{ height: `${plan[i]}%` }}
                                            title={`${month} 계획: ${plan[i]}%`}
                                        />
                                        <div
                                            className="w-1/2 bg-gradient-to-t from-hud-accent-primary to-hud-accent-primary/50 rounded-t hover:from-hud-accent-primary hover:to-hud-accent-secondary transition-all duration-300 cursor-pointer"
                                            style={{ height: `${actual[i]}%` }}
                                            title={`${month} 실적: ${actual[i]}%`}
                                        />
                                    </div>
                                    <span className="text-xs text-hud-text-muted">{month}</span>
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
                            <div className="w-3 h-3 rounded bg-gradient-to-t from-hud-accent-primary to-hud-accent-primary/50" />
                            <span>실적</span>
                        </div>
                    </div>
                </HudCard>

                {/* Equipment Stats */}
                <HudCard title="설비 가동 현황" subtitle="전월 대비 설비 지표">
                    <div className="space-y-4">
                        {equipmentStats.map((stat) => (
                            <div key={stat.label}>
                                <div className="flex justify-between text-sm mb-1.5">
                                    <span className="text-hud-text-secondary">{stat.label}</span>
                                    <span className="text-hud-text-primary font-mono">{stat.value}%</span>
                                </div>
                                <div className="h-2 bg-hud-bg-primary rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                            width: `${stat.value}%`,
                                            background: stat.color === 'hud-accent-primary' ? 'var(--hud-accent-primary)' :
                                                stat.color === 'hud-accent-info' ? 'var(--hud-accent-info)' :
                                                    stat.color === 'hud-accent-warning' ? 'var(--hud-accent-warning)' : 'var(--hud-accent-secondary)'
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-6 pt-4 border-t border-hud-border-secondary">
                        <div className="flex items-center gap-2 text-sm text-hud-text-muted">
                            <Clock size={14} />
                            <span>최종 업데이트: 방금 전</span>
                        </div>
                    </div>
                </HudCard>
            </div>

            {/* Tables Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Work Orders */}
                <HudCard
                    title="작업오더 현황"
                    subtitle="진행 중인 작업 지시"
                    noPadding
                    action={
                        <Button variant="ghost" size="sm" rightIcon={<ArrowUpRight size={14} />}>
                            전체 보기
                        </Button>
                    }
                >
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-hud-border-secondary">
                                    <th className="text-left px-5 py-3 text-xs font-medium text-hud-text-muted uppercase tracking-wider">작업오더</th>
                                    <th className="text-left px-5 py-3 text-xs font-medium text-hud-text-muted uppercase tracking-wider">품목</th>
                                    <th className="text-left px-5 py-3 text-xs font-medium text-hud-text-muted uppercase tracking-wider">진척</th>
                                    <th className="text-left px-5 py-3 text-xs font-medium text-hud-text-muted uppercase tracking-wider">납기</th>
                                    <th className="text-left px-5 py-3 text-xs font-medium text-hud-text-muted uppercase tracking-wider">상태</th>
                                </tr>
                            </thead>
                            <tbody>
                                {workOrders.map((order) => (
                                    <tr key={order.id} className="border-b border-hud-border-secondary last:border-0 hover:bg-hud-bg-hover transition-hud">
                                        <td className="px-5 py-3">
                                            <span className="text-sm font-mono text-hud-accent-primary">{order.id}</span>
                                            {order.delay && (
                                                <p className="text-xs text-hud-accent-danger flex items-center gap-1 mt-0.5">
                                                    <AlertTriangle size={12} />
                                                    납기 지연 위험
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className="text-sm text-hud-text-primary">{order.item}</span>
                                            <p className="text-xs text-hud-text-muted">양품 {order.goodQty} / 지시 {order.qty}</p>
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-2 bg-hud-bg-primary rounded-full overflow-hidden">
                                                    <div className="h-full bg-gradient-to-r from-hud-accent-primary to-hud-accent-info rounded-full" style={{ width: `${order.progress}%` }} />
                                                </div>
                                                <span className="text-xs font-mono text-hud-text-secondary">{order.progress}%</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className="text-sm text-hud-text-secondary font-mono">{order.dueDate}</span>
                                        </td>
                                        <td className="px-5 py-3">
                                            <StatusBadge tone={statusToneMap[order.status] ?? 'muted'}>{order.status}</StatusBadge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </HudCard>

                {/* Top Items */}
                <HudCard
                    title="생산 실적 상위"
                    subtitle="월별 생산량 기준"
                    noPadding
                    action={
                        <Button variant="ghost" size="sm" rightIcon={<ArrowUpRight size={14} />}>
                            전체 보기
                        </Button>
                    }
                >
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-hud-border-secondary">
                                    <th className="text-left px-5 py-3 text-xs font-medium text-hud-text-muted uppercase tracking-wider">품목</th>
                                    <th className="text-left px-5 py-3 text-xs font-medium text-hud-text-muted uppercase tracking-wider">생산량</th>
                                    <th className="text-left px-5 py-3 text-xs font-medium text-hud-text-muted uppercase tracking-wider">매출</th>
                                    <th className="text-left px-5 py-3 text-xs font-medium text-hud-text-muted uppercase tracking-wider">성장률</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topItems.map((item) => (
                                    <tr key={item.name} className="border-b border-hud-border-secondary last:border-0 hover:bg-hud-bg-hover transition-hud">
                                        <td className="px-5 py-3">
                                            <span className="text-sm text-hud-text-primary">{item.name}</span>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className="text-sm font-mono text-hud-text-secondary">{item.produced.toLocaleString()}</span>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className="text-sm font-mono text-hud-text-primary">{item.revenue}</span>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className={`text-sm font-medium ${item.growth >= 0 ? 'text-hud-accent-success' : 'text-hud-accent-danger'}`}>
                                                {item.growth >= 0 ? '+' : ''}{item.growth}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </HudCard>
            </div>

            {/* Activity Feed */}
            <HudCard
                title="실시간 알림"
                subtitle="생산·자재·품질·설비 이벤트"
                action={
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={16} className="text-hud-accent-primary" />
                        <span className="text-sm text-hud-text-secondary">실시간</span>
                    </div>
                }
            >
                <div className="space-y-4">
                    {[
                        { action: '납기 지연 위험', detail: 'WO-2610-003 (커버 몸체 C) 진척 30% · 납기 10/12', time: '2분 전', type: 'warning' },
                        { action: '안전재고 미달', detail: 'ABS 펠릿 · 현재고 480kg / 안전재고 600kg', time: '5분 전', type: 'danger' },
                        { action: '작업오더 완료', detail: 'WO-2610-002 (샤시 브라켓 B) 양품 300/300 완료', time: '10분 전', type: 'success' },
                        { action: '설비 고장 접수', detail: 'EQ-PRS-01 프레스 200T · 유압 펌프 교체', time: '1시간 전', type: 'warning' },
                        { action: '불량 급증', detail: '용접 공정 불량률 4.2% → 6.8% (지표 임계 초과)', time: '2시간 전', type: 'danger' },
                        { action: '입고 완료', detail: 'PO-2610-003 ABS 펠릿 800kg 입고·검수 합격', time: '3시간 전', type: 'info' },
                    ].map((activity, i) => (
                        <div key={i} className="flex items-start gap-4 p-3 rounded-lg hover:bg-hud-bg-hover transition-hud">
                            <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${activity.type === 'success' ? 'bg-hud-accent-success' :
                                    activity.type === 'info' ? 'bg-hud-accent-info' :
                                        activity.type === 'warning' ? 'bg-hud-accent-warning' : 'bg-hud-accent-danger'
                                }`} />
                            <div className="flex-1">
                                <p className="text-sm text-hud-text-primary">{activity.action}</p>
                                <p className="text-xs text-hud-text-muted mt-0.5">{activity.detail}</p>
                            </div>
                            <span className="text-xs text-hud-text-muted whitespace-nowrap">{activity.time}</span>
                        </div>
                    ))}
                </div>
            </HudCard>
        </div>
    )
}

export default Dashboard
