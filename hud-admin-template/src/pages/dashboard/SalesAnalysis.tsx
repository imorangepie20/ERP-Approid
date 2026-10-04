import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchSalesAnalysis } from '../../api/salesAnalysis'
import { seoulToday } from '../../api/dashboard'
import { useAuth } from '../../auth/AuthContext'
import { useItemSelection } from '../../hooks/useItemSelection'
import { usePartnerSelection } from '../../hooks/usePartnerSelection'
import { AsyncState } from '../../components/common/AsyncState'
import DateInput from '../../components/common/DateInput'
import Button from '../../components/common/Button'
import HudCard from '../../components/common/HudCard'
import StatCard from '../../components/common/StatCard'

const inputClass = 'mt-1 block rounded-lg border border-hud-border-secondary bg-hud-bg-primary px-3 py-2 text-sm text-hud-text-primary'
const won = (v: number | null) => v === null ? '이력 미확인' : `₩${v.toLocaleString('ko-KR')}`
const scopeLabels: Record<string, string> = { ordered: '기간 내 수주', backlog: '현재 활성 수주잔고', receivables: '현재 미수 연결 수주' }
export default function SalesAnalysis() {
    const { user } = useAuth()
    if (!user?.roles.some(r => ['ADMIN', 'SALES', 'ACCOUNTING'].includes(r))) return <div role="alert">영업·미수 분석은 ADMIN·SALES·ACCOUNTING만 조회할 수 있습니다.</div>
    return <AuthorizedSalesAnalysis />
}
function AuthorizedSalesAnalysis() {
    const { core } = useAuth(), items = useItemSelection(), customers = usePartnerSelection('고객사')
    const [params] = useSearchParams(), today = seoulToday()
    const [draft, setDraft] = useState(() => {
        const itemId = params.get('itemId') ?? ''
        return { from: `${today.slice(0, 7)}-01`, to: today, itemId: /^[1-9]\d*$/.test(itemId) && Number.isSafeInteger(Number(itemId)) ? itemId : '', customerId: '', keyword: '' }
    })
    const [filters, setFilters] = useState(draft), [scope, setScope] = useState('ordered'), [sort, setSort] = useState('orderedAt,desc'), [page, setPage] = useState(0)
    const query = useQuery({ queryKey: ['sales-analysis', filters, scope, sort, page], staleTime: 0,
        queryFn: ({ signal }) => fetchSalesAnalysis(core, { ...filters, itemId: filters.itemId ? Number(filters.itemId) : undefined,
            customerId: filters.customerId ? Number(filters.customerId) : undefined, scope, sort, page, size: 20 }, signal) })
    const data = query.data
    return <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-hud-text-primary">운영 분석 · 영업 요약</h1><p className="mt-1 text-sm text-hud-text-secondary">기간 수주·확정 출하와 현재 잔고·미수 원금을 구분합니다. 조회는 업무를 변경하지 않습니다.</p></div>
        <HudCard title="영업 분석 조건" headingLevel={2}><form className="flex flex-wrap items-end gap-4" onSubmit={e => {
            e.preventDefault(); setPage(0); if (JSON.stringify(draft) === JSON.stringify(filters)) { void query.refetch() } else setFilters({ ...draft })
        }}>
            <label className="text-sm">실적 시작일<DateInput aria-label="실적 시작일" className={inputClass} value={draft.from} max={draft.to} required onChange={e => setDraft({ ...draft, from: e.target.value })} /></label>
            <label className="text-sm">실적 종료일<DateInput aria-label="실적 종료일" className={inputClass} value={draft.to} min={draft.from} max={today} required onChange={e => setDraft({ ...draft, to: e.target.value })} /></label>
            <label className="text-sm">영업 품목<select aria-label="영업 품목" className={inputClass} value={draft.itemId} disabled={!items.ready} onChange={e => setDraft({ ...draft, itemId: e.target.value })}><option value="">전체 품목</option>{items.options.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}</select></label>
            <label className="text-sm">영업 고객<select aria-label="영업 고객" className={inputClass} value={draft.customerId} disabled={!customers.ready} onChange={e => setDraft({ ...draft, customerId: e.target.value })}><option value="">전체 고객</option>{customers.partners.map(c => <option key={c.id} value={c.id}>{c.partnerNo} · {c.name}</option>)}</select></label>
            <label className="text-sm">수주·고객·품목 검색<input aria-label="수주·고객·품목 검색" className={inputClass} value={draft.keyword} maxLength={128} onChange={e => setDraft({ ...draft, keyword: e.target.value })} /></label>
            <Button type="submit" disabled={query.isFetching || !draft.from || !draft.to || draft.from > draft.to}>영업 분석 적용</Button>
            <Button variant="outline" type="button" disabled={query.isFetching} onClick={() => { void query.refetch() }}>영업 현재값 새로고침</Button>
        </form>{items.status}{customers.status}</HudCard>
        <AsyncState isLoading={query.isPending} error={query.error} onRetry={() => { void query.refetch() }} loadingMessage="영업 요약을 조회하는 중...">
            {data && <>
                <p className="text-sm text-hud-text-secondary">실적 기간 {data.from} ~ {data.to} · 현재 기준 {new Date(data.asOf).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (서울)</p>
                <section aria-label="영업 분석 요약" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <StatCard title="기간 수주액 · 취소 제외" value={won(data.summary.periodOrderKrw)} />
                    <StatCard title="기간 확정 출하액" value={won(data.summary.periodRevenueKrw)} />
                    <StatCard title="확인된 현재 수주잔고" value={won(data.summary.knownCurrentBacklogKrw)} />
                    <StatCard title="현재 미수 문서 원금" value={won(data.summary.currentOpenReceivableKrw)} />
                    <StatCard title="현재 연체 문서 원금" value={won(data.summary.currentOverdueReceivableKrw)} />
                </section>
                <p className="text-sm text-hud-text-secondary">기간 수주 {data.summary.periodOrders}건(취소 {data.summary.periodCancelledOrders}건) · 확정 출하 {data.summary.periodConfirmedShipments}건 · 현재 활성잔고 {data.summary.currentBacklogOrders}건 · 미수 {data.summary.currentOpenReceivables}건(연체 {data.summary.currentOverdueReceivables}건)</p>
                <p className="text-sm text-hud-accent-warning">잔고 미확인 {data.summary.unknownBacklogOrders}건 · 매출 제외 이력 {data.summary.excludedHistoricalShipments}건 · 수주 미연결 미수 제외 {data.summary.excludedUnlinkedReceivables}건</p>
                <HudCard title="수주별 영업 원천" headingLevel={2}>
                    <div className="mb-4 flex flex-wrap gap-4"><label className="text-sm">영업 목록 범위<select aria-label="영업 목록 범위" className={inputClass} value={scope} onChange={e => { setScope(e.target.value); setPage(0) }}>{Object.entries(scopeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                        <label className="text-sm">영업 정렬<select aria-label="영업 정렬" className={inputClass} value={sort} onChange={e => { setSort(e.target.value); setPage(0) }}><option value="orderedAt,desc">수주일 최신 순</option><option value="dueDate,asc">납기 빠른 순</option><option value="amountKrw,desc">수주액 큰 순</option><option value="openReceivableKrw,desc">미수 원금 큰 순</option></select></label></div>
                    <p className="mb-3 text-sm text-hud-text-secondary">{scopeLabels[data.scope]} · {data.scope === 'ordered' ? '수주일에 기간 적용' : '현재 목록: 기간 필터 미적용'} · 요약은 전체 필터 결과</p>
                    {data.rows.length === 0 ? <p>조회 범위에 해당하는 수주가 없습니다.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">실제 수주별 금액·품목 단위·확인된 출하·현재 잔고와 미수</caption>
                        <thead><tr>{['수주 / 고객 / 품목', '수주일 / 납기', '지시 / 확인 출하', '수주액 / 확인 출하액', '기간 출하액', '현재 잔고', '현재 미수 / 연체', '상태 / 업무'].map(h => <th key={h} scope="col" className="p-2 text-left whitespace-nowrap">{h}</th>)}</tr></thead>
                        <tbody>{data.rows.map(row => <tr key={row.id} className="border-t border-hud-border-secondary"><th scope="row" className="p-2 text-left font-normal"><Link className="text-hud-accent-primary underline" to={`/sales/orders?keyword=${encodeURIComponent(row.salesOrderNo)}`}>{row.salesOrderNo}</Link><p>{row.customerNo} · {row.customerName}</p><p>{row.itemNo} · {row.itemName}</p></th>
                            <td className="p-2 whitespace-nowrap">{row.orderedAt}<br />{row.dueDate}{row.delayed && <p className="text-hud-accent-danger">현재 납기 경과</p>}</td>
                            <td className="p-2 whitespace-nowrap">{row.qty.toLocaleString('ko-KR', { maximumFractionDigits: 4 })} {row.unit}<br />{row.knownShippedQty.toLocaleString('ko-KR', { maximumFractionDigits: 4 })} {row.unit}</td>
                            <td className="p-2 whitespace-nowrap">{won(row.amountKrw)}<br />{won(row.knownShippedAmountKrw)}</td><td className="p-2 whitespace-nowrap">{won(row.periodRevenueKrw)}</td>
                            <td className="p-2 whitespace-nowrap">{won(row.currentBacklogKrw)}</td><td className="p-2 whitespace-nowrap">{won(row.currentOpenReceivableKrw)}<br />{won(row.currentOverdueReceivableKrw)}</td>
                            <td className="p-2 whitespace-nowrap">{row.status}{row.historyUnknown && <p className="text-hud-accent-warning">이력 확인 필요</p>}<br /><Link className="text-hud-accent-primary underline" to={`/sales/shipments?salesOrderId=${row.id}`}>연결 출하 보기</Link></td></tr>)}</tbody></table></div>}
                    <div className="mt-4 flex items-center gap-3"><Button variant="outline" disabled={page === 0 || query.isFetching} onClick={() => setPage(page - 1)}>이전</Button><span>{page + 1} / {Math.max(1, data.totalPages)} 페이지 · {data.totalElements}건</span><Button variant="outline" disabled={page + 1 >= data.totalPages || query.isFetching} onClick={() => setPage(page + 1)}>다음</Button></div>
                </HudCard>
                <HudCard title="영업 계산 근거와 미지원 범위" headingLevel={2}><ul className="list-disc space-y-2 pl-5 text-sm text-hud-text-secondary">{data.notes.map(n => <li key={n}>{n}</li>)}</ul><Link className="mt-4 inline-block text-hud-accent-primary underline" to="/">운영 대시보드</Link></HudCard>
            </>}
        </AsyncState>
    </div>
}
