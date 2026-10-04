import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchProductionAnalysis } from '../../api/productionAnalysis'
import { seoulToday } from '../../api/dashboard'
import { addDateDays } from '../../api/mrp'
import { workOrderStatuses } from '../../api/workOrders'
import { useAuth } from '../../auth/AuthContext'
import { useItemSelection } from '../../hooks/useItemSelection'
import { AsyncState } from '../../components/common/AsyncState'
import DateInput from '../../components/common/DateInput'
import Button from '../../components/common/Button'
import HudCard from '../../components/common/HudCard'
import StatCard from '../../components/common/StatCard'

const inputClass = 'mt-1 block rounded-lg border border-hud-border-secondary bg-hud-bg-primary px-3 py-2 text-sm text-hud-text-primary'
const pct = (value: number | null) => value === null ? '해당 없음' : `${value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}%`
const quantity = (value: number, unit: string) => `${value.toLocaleString('ko-KR', { maximumFractionDigits: 4 })} ${unit}`
export default function Analytics() {
    const { core, user } = useAuth(), items = useItemSelection()
    const [searchParams] = useSearchParams()
    const [draft, setDraft] = useState(() => {
        const itemId = searchParams.get('itemId') ?? ''
        return { from: addDateDays(seoulToday(), -30), to: addDateDays(seoulToday(), 30),
            itemId: /^[1-9]\d*$/.test(itemId) && Number.isSafeInteger(Number(itemId)) ? itemId : '', status: 'active', keyword: '' }
    })
    const [filters, setFilters] = useState(draft), [page, setPage] = useState(0), [sort, setSort] = useState('dueDate,asc')
    const query = useQuery({ queryKey: ['production-analysis', filters, page, sort], staleTime: 0,
        queryFn: ({ signal }) => fetchProductionAnalysis(core, { ...filters, itemId: filters.itemId ? Number(filters.itemId) : undefined, page, size: 20, sort }, signal) })
    const data = query.data
    return <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-hud-text-primary">운영 분석 · 생산 진척</h1>
            <p className="mt-1 text-sm text-hud-text-secondary">완료예정일로 선택한 실제 작업오더의 현재 실적 · 조회는 업무 상태를 변경하지 않습니다.</p></div>
        <HudCard title="분석 조건" headingLevel={2}>
            <form className="flex flex-wrap items-end gap-4" onSubmit={e => { e.preventDefault(); setPage(0); if (JSON.stringify(draft) === JSON.stringify(filters)) { void query.refetch() } else setFilters({ ...draft }) }}>
                <label className="text-sm">완료예정 시작일<DateInput aria-label="완료예정 시작일" className={inputClass} value={draft.from} max={draft.to} required onChange={e => setDraft({ ...draft, from: e.target.value })} /></label>
                <label className="text-sm">완료예정 종료일<DateInput aria-label="완료예정 종료일" className={inputClass} value={draft.to} min={draft.from} required onChange={e => setDraft({ ...draft, to: e.target.value })} /></label>
                <label className="text-sm">분석 품목<select aria-label="분석 품목" className={inputClass} value={draft.itemId} disabled={!items.ready} onChange={e => setDraft({ ...draft, itemId: e.target.value })}>
                    <option value="">전체 품목</option>{items.options.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}</select></label>
                <label className="text-sm">분석 상태<select aria-label="분석 상태" className={inputClass} value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}>
                    <option value="active">활성 오더</option><option value="all">전체 상태</option>{workOrderStatuses.map(s => <option key={s}>{s}</option>)}</select></label>
                <label className="text-sm">오더·품목·담당 검색<input aria-label="오더·품목·담당 검색" className={inputClass} value={draft.keyword} maxLength={128} onChange={e => setDraft({ ...draft, keyword: e.target.value })} /></label>
                <Button type="submit" disabled={query.isFetching || !draft.from || !draft.to || draft.from > draft.to}>분석 적용</Button>
                <Button type="button" variant="outline" disabled={query.isFetching} onClick={() => { void query.refetch() }}>현재 실적 새로고침</Button>
            </form>{items.status}
        </HudCard>
        <AsyncState isLoading={query.isPending} error={query.error} onRetry={() => { void query.refetch() }} loadingMessage="생산 진척을 조회하는 중...">
            {data && <>
                <p className="text-sm text-hud-text-secondary">완료예정 기간 {data.from} ~ {data.to} · 현재 기준 {new Date(data.asOf).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (서울)</p>
                <section aria-label="생산 분석 요약" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard title="활성 작업오더" value={`${data.summary.activeOrders}건`} />
                    <StatCard title="현재 지연 오더" value={`${data.summary.delayedOrders}건`} />
                    <StatCard title="활성 오더 평균 진척" value={pct(data.summary.meanActiveProgressPercent)} />
                    <StatCard title="입력 실적 오더 평균 수율" value={pct(data.summary.meanReportedYieldPercent)} />
                </section>
                <p className="text-sm text-hud-text-secondary">전체 {data.summary.totalOrders}건 · 완료/마감 {data.summary.completedOrders}건 · 취소 {data.summary.cancelledOrders}건 · 활성 미배정 {data.summary.unassignedActiveOrders}건 · 진척 평균 대상 {data.summary.eligibleActiveOrders}건 · 수율 평균 대상 {data.summary.eligibleYieldOrders}건</p>
                {data.summary.overActualOrders > 0 && <p role="status" className="text-hud-accent-warning">초과 실적 이력 {data.summary.overActualOrders}건: 원 수량은 유지하며 비율 평균에서 제외합니다.</p>}
                <HudCard title="작업오더별 실제 진척" headingLevel={2}>
                    <label className="mb-4 block text-sm">분석 정렬<select aria-label="분석 정렬" className={inputClass} value={sort} onChange={e => { setSort(e.target.value); setPage(0) }}>
                        <option value="dueDate,asc">완료예정 빠른 순</option><option value="dueDate,desc">완료예정 늦은 순</option>
                        <option value="progressPercent,asc">진척 낮은 순</option><option value="progressPercent,desc">진척 높은 순</option>
                        <option value="priority,desc">우선순위 높은 순</option><option value="itemNo,asc">품번 순</option></select></label>
                    {data.rows.length === 0 ? <p>조회 조건에 해당하는 작업오더가 없습니다.</p> : <div className="overflow-x-auto"><table className="w-full text-sm">
                        <caption className="sr-only">작업오더별 품목 단위·지시·실적·잔량·진척·지연</caption>
                        <thead><tr>{['오더 / 품목', '지시', '양품', '불량', '남은 지시량', '진척 / 수율', '착수 / 완료예정', '상태 / 담당'].map(h => <th key={h} scope="col" className="p-2 text-left whitespace-nowrap">{h}</th>)}</tr></thead>
                        <tbody>{data.rows.map(row => <tr key={row.id} className="border-t border-hud-border-secondary">
                            <th scope="row" className="p-2 text-left font-normal whitespace-nowrap"><Link className="text-hud-accent-primary underline" to={`/production/orders?keyword=${encodeURIComponent(row.workOrderNo)}`}>{row.workOrderNo}</Link><p>{row.itemNo} · {row.itemName}</p></th>
                            {[row.qty, row.goodQty, row.defectQty, row.remainingQty].map((q, n) => <td key={n} className="p-2 font-mono whitespace-nowrap">{quantity(q, row.unit)}</td>)}
                            <td className="p-2 whitespace-nowrap">{pct(row.progressPercent)} / {pct(row.yieldPercent)}{row.overActual && <p className="text-hud-accent-warning">초과 실적 확인</p>}</td>
                            <td className="p-2 whitespace-nowrap">{row.startDate}<br />{row.dueDate}{row.delayed && <p className="text-hud-accent-danger">현재 지연</p>}</td>
                            <td className="p-2 whitespace-nowrap">{row.status} · 우선 {row.priority}<br />{row.assignee || '미배정'}</td>
                        </tr>)}</tbody></table></div>}
                    <div className="mt-4 flex items-center gap-3"><Button variant="outline" disabled={page === 0 || query.isFetching} onClick={() => setPage(page - 1)}>이전</Button>
                        <span>{page + 1} / {Math.max(1, data.totalPages)} 페이지 · {data.totalElements}건</span>
                        <Button variant="outline" disabled={page + 1 >= data.totalPages || query.isFetching} onClick={() => setPage(page + 1)}>다음</Button></div>
                </HudCard>
                <HudCard title="계산 근거와 미지원 범위" headingLevel={2}><ul className="list-disc space-y-2 pl-5 text-sm text-hud-text-secondary">{data.notes.map(note => <li key={note}>{note}</li>)}</ul>
                    <div className="mt-4 flex gap-4 text-sm"><Link className="text-hud-accent-primary underline" to="/">실제 매출·납기 대시보드</Link><Link className="text-hud-accent-primary underline" to="/purchase/mrp">실제 MRP·공급 충당</Link></div>
                    {user?.roles.some(r => ['ADMIN', 'SALES', 'ACCOUNTING'].includes(r)) && <Link className="mt-3 inline-block text-sm text-hud-accent-primary underline" to="/analytics/sales">실제 영업·미수 요약</Link>}
                    <Link className="ml-4 inline-block text-sm text-hud-accent-primary underline" to="/analytics/inventory">실제 재고·Lot 근거 분석</Link>
                </HudCard>
            </>}
        </AsyncState>
    </div>
}
