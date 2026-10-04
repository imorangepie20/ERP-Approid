import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { fetchDashboard, seoulToday, type DashboardFilters } from '../../api/dashboard'
import { useAuth } from '../../auth/AuthContext'
import { useItemSelection } from '../../hooks/useItemSelection'
import { AsyncState } from '../../components/common/AsyncState'
import HudCard from '../../components/common/HudCard'
import StatCard from '../../components/common/StatCard'
import DateInput from '../../components/common/DateInput'
import Button from '../../components/common/Button'

const krw = (value: number) => `₩${value.toLocaleString('ko-KR')}`
const percent = (value: number | null) => value === null ? '해당 없음' : `${value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}%`
const alertLabels: Record<string, string> = { LOW_STOCK: '안전재고 미달', OVERDUE_WORK_ORDER: '생산 납기 경과', OVERDUE_SALES_ORDER: '수주 납기 경과' }

export default function Dashboard() {
    const { core, user } = useAuth()
    const selection = useItemSelection()
    const today = seoulToday()
    const [draft, setDraft] = useState({ from: `${today.slice(0, 7)}-01`, to: today, itemId: '' })
    const [filters, setFilters] = useState<DashboardFilters>({ from: draft.from, to: draft.to })
    const query = useQuery({ queryKey: ['dashboard', filters], queryFn: ({ signal }) => fetchDashboard(core, filters, signal), staleTime: 0 })
    const apply = (event: FormEvent) => {
        event.preventDefault()
        const next = { from: draft.from, to: draft.to, itemId: draft.itemId ? Number(draft.itemId) : undefined }
        if (JSON.stringify(next) === JSON.stringify(filters)) { void query.refetch() } else setFilters(next)
    }
    const data = query.data
    return <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h1 className="text-2xl font-bold text-hud-text-primary">운영 대시보드</h1>
                <p className="mt-1 text-sm text-hud-text-muted">Spring 실제 DB 집계 · 날짜는 서울 기준 · 수주잔고와 위험 알림은 현재값</p></div>
            <Button variant="secondary" leftIcon={<RefreshCw size={16} />} disabled={query.isFetching} onClick={() => { void query.refetch() }}>새로고침</Button>
        </div>
        <HudCard title="조회 조건" headingLevel={2}>
            <form onSubmit={apply} className="flex flex-wrap items-end gap-4">
                <label className="text-sm text-hud-text-secondary">조회 시작일
                    <DateInput aria-label="조회 시작일" value={draft.from} max={draft.to || today} required
                        onChange={e => setDraft({ ...draft, from: e.target.value })} className="mt-1 rounded-lg border border-hud-border-secondary bg-hud-bg-primary px-3 py-2 text-sm text-hud-text-primary" /></label>
                <label className="text-sm text-hud-text-secondary">조회 종료일
                    <DateInput aria-label="조회 종료일" value={draft.to} min={draft.from} max={today} required
                        onChange={e => setDraft({ ...draft, to: e.target.value })} className="mt-1 rounded-lg border border-hud-border-secondary bg-hud-bg-primary px-3 py-2 text-sm text-hud-text-primary" /></label>
                <label className="text-sm text-hud-text-secondary">조회 품목
                    <select aria-label="조회 품목" value={draft.itemId} onChange={e => setDraft({ ...draft, itemId: e.target.value })}
                        disabled={!selection.ready} className="mt-1 block rounded-lg border border-hud-border-secondary bg-hud-bg-primary px-3 py-2 text-sm text-hud-text-primary">
                        <option value="">전체 품목</option>{selection.options.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select></label>
                <Button type="submit" disabled={query.isFetching || !draft.from || !draft.to || draft.from > draft.to}>조회 적용</Button>
            </form>
            {selection.status}
        </HudCard>
        <AsyncState isLoading={query.isPending} error={query.error} onRetry={() => { void query.refetch() }} loadingMessage="운영 지표를 불러오는 중...">
            {data && <>
                <p className="text-sm text-hud-text-muted" aria-live="polite">집계 기간 {data.metadata.from} ~ {data.metadata.to} · 기준시각 {new Date(data.metadata.asOf).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (서울)</p>
                <section aria-label="운영 KPI" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <StatCard title="기간 매출 (원)" value={krw(data.kpis.revenueKrw)} />
                    <StatCard title="기간 생산액 (기준단가 환산·원)" value={krw(data.kpis.productionValueKrw)} />
                    <StatCard title="현재 수주잔고 (원)" value={krw(data.kpis.backlogKrw)} />
                    <StatCard title="납기준수율 (확인된 수주)" value={percent(data.kpis.onTimeDeliveryPercent)} />
                    <StatCard title="완료 오더 평균 불량률" value={percent(data.kpis.meanOrderDefectPercent)} />
                    <StatCard title="재고회전율" value="계산 불가" />
                </section>
                <p className="text-sm text-hud-text-muted">잔고 {data.kpis.backlogOrders}건 · 납기준수 {data.kpis.onTimeOrders}/{data.kpis.eligibleDeliveryOrders}건 · 기간 내 생산완료 {data.kpis.completedWorkOrders}건</p>
                <Link className="inline-block text-sm text-hud-accent-primary underline" to={`/analytics${filters.itemId ? `?itemId=${filters.itemId}` : ''}`}>현재 생산 진척·지연 분석</Link>
                <Link className="ml-4 inline-block text-sm text-hud-accent-primary underline" to={`/analytics/inventory${filters.itemId ? `?itemId=${filters.itemId}` : ''}`}>실제 재고·Lot 근거 분석</Link>
                {user?.roles.some(r => ['ADMIN', 'SALES', 'ACCOUNTING'].includes(r)) && <Link className="ml-4 inline-block text-sm text-hud-accent-primary underline" to={`/analytics/sales${filters.itemId ? `?itemId=${filters.itemId}` : ''}`}>실제 영업·미수 요약</Link>}
                <HudCard title="월별 추이" headingLevel={2} subtitle="조회기간에 포함된 일자만 집계 · 단위: 원">
                    <div className="overflow-x-auto"><table className="w-full text-sm">
                        <caption className="sr-only">월별 실제 매출과 기준단가 환산 생산액</caption>
                        <thead><tr className="border-b border-hud-border-primary"><th scope="col" className="p-3 text-left">월</th><th scope="col" className="p-3 text-right">매출 (원)</th><th scope="col" className="p-3 text-right">생산액 (원)</th></tr></thead>
                        <tbody>{data.trends.map(row => <tr key={row.month} className="border-b border-hud-border-secondary">
                            <th scope="row" className="p-3 text-left font-normal">{row.month}</th><td className="p-3 text-right font-mono">{krw(row.revenueKrw)}</td><td className="p-3 text-right font-mono">{krw(row.productionValueKrw)}</td>
                        </tr>)}</tbody>
                    </table></div>
                    {data.kpis.revenueKrw === 0 && data.kpis.completedWorkOrders === 0 && <p className="mt-3 text-sm text-hud-text-muted">조회기간에 확인된 출하·생산완료 이력이 없습니다.</p>}
                </HudCard>
                <HudCard title="현재 위험 알림" headingLevel={2} subtitle={`안전재고 미달 ${data.alerts.lowStockItems}건 · 생산 납기 경과 ${data.alerts.overdueWorkOrders}건 · 수주 납기 경과 ${data.alerts.overdueSalesOrders}건`}>
                    {data.alerts.total === 0 ? <p className="text-sm text-hud-text-muted">현재 위험 알림이 없습니다.</p> : <ul className="space-y-3">{data.alerts.rows.map(row => <li key={`${row.kind}-${row.referenceNo}`} className="flex flex-wrap justify-between gap-2 border-b border-hud-border-secondary pb-3">
                        <div><p className="text-sm text-hud-accent-warning">{alertLabels[row.kind]} · {row.referenceNo} · {row.itemName}</p><p className="mt-1 text-xs text-hud-text-muted">{row.message}</p></div>
                        <Link className="text-sm text-hud-accent-primary underline" to={`${row.path}?keyword=${encodeURIComponent(row.referenceNo)}`}>{row.referenceNo} 확인</Link>
                    </li>)}</ul>}
                    {data.alerts.truncated && <p className="mt-3 text-sm text-hud-text-muted">총 {data.alerts.total}건 중 20건 표시. 각 업무 화면에서 전체를 확인하세요.</p>}
                </HudCard>
                <HudCard title="계산 근거와 데이터 범위" headingLevel={2}>
                    <p className="mb-3 text-sm text-hud-accent-warning">{data.kpis.inventoryTurnoverReason}</p>
                    <p className="mb-3 text-sm text-hud-text-secondary">이력 미확인: 출하 {data.coverage.undatedShipments}건 · 완료 오더 {data.coverage.undatedCompletedWorkOrders}건 · 기간 내 납기 판정 제외 {data.coverage.unknownDeliveryOrders}건</p>
                    <ul className="list-disc space-y-2 pl-5 text-xs text-hud-text-muted">{data.coverage.notes.map(note => <li key={note}>{note}</li>)}</ul>
                </HudCard>
            </>}
        </AsyncState>
    </div>
}
