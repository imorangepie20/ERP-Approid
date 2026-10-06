import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchInventoryAnalysis, type InventoryAnalysisRow } from '../../api/inventoryAnalysis'
import { adjustStock } from '../../api/inventory'
import { ApiError } from '../../api/http'
import { seoulToday } from '../../api/dashboard'
import { useAuth } from '../../auth/AuthContext'
import { useItemSelection } from '../../hooks/useItemSelection'
import { AsyncState } from '../../components/common/AsyncState'
import DateInput from '../../components/common/DateInput'
import Button from '../../components/common/Button'
import HudCard from '../../components/common/HudCard'
import StatCard from '../../components/common/StatCard'

const inputClass = 'mt-1 block rounded-lg border border-hud-border-secondary bg-hud-bg-primary px-3 py-2 text-sm text-hud-text-primary'
const quantity = (value: number, unit: string) => `${value.toLocaleString('ko-KR', { maximumFractionDigits: 4 })} ${unit}`
export default function InventoryAnalysis() {
    const { core, user } = useAuth(), selection = useItemSelection(), [params] = useSearchParams(), today = seoulToday()
    const canAdjust = user?.roles.some(r => r === 'ADMIN' || r === 'MATERIAL') ?? false
    const cache = useQueryClient()
    const [draft, setDraft] = useState(() => {
        const itemId = params.get('itemId') ?? ''
        return { from: `${today.slice(0, 7)}-01`, to: today, ageDays: '90', keyword: '', itemId: /^[1-9]\d*$/.test(itemId) && Number.isSafeInteger(Number(itemId)) ? itemId : '' }
    })
    const [filters, setFilters] = useState(draft), [itemType, setItemType] = useState('all'), [risk, setRisk] = useState('all'), [sort, setSort] = useState('itemNo,asc'), [page, setPage] = useState(0)
    const [adjusting, setAdjusting] = useState<InventoryAnalysisRow | null>(null)
    const [counted, setCounted] = useState(''), [warehouse, setWarehouse] = useState(''), [reason, setReason] = useState('')
    const [notice, setNotice] = useState('')
    const query = useQuery({ queryKey: ['inventory-analysis', filters, itemType, risk, sort, page], staleTime: 0,
        queryFn: ({ signal }) => fetchInventoryAnalysis(core, { ...filters, ageDays: Number(filters.ageDays), itemId: filters.itemId ? Number(filters.itemId) : undefined, itemType, risk, sort, page, size: 20 }, signal) })
    const data = query.data
    const adjust = useMutation({
        mutationFn: () => adjustStock(core, { itemId: adjusting!.itemId, countedQty: Number(counted), warehouse: warehouse.trim(), reason: reason.trim() }),
        onSuccess: async row => {
            await cache.invalidateQueries({ queryKey: ['inventory-analysis'] })
            setAdjusting(null)
            const diff = `${row.adjustedQty >= 0 ? '+' : '−'}${Math.abs(row.adjustedQty).toLocaleString('ko-KR', { maximumFractionDigits: 4 })} ${adjusting!.unit}`
            setNotice(`실사 조정했습니다. ${row.itemNo} · 실측 ${quantity(row.countedQty, adjusting!.unit)} · 차이 ${diff}`)
        },
        onError: () => { void cache.invalidateQueries({ queryKey: ['inventory-analysis'] }) },
    })
    const openAdjust = (row: InventoryAnalysisRow) => {
        adjust.reset(); setNotice(''); setAdjusting(row)
        setCounted(String(row.currentStock)); setWarehouse(''); setReason('')
    }
    const countedValid = counted.trim() !== '' && Number.isFinite(Number(counted)) && Number(counted) >= 0
    const adjustReady = adjusting !== null && countedValid && warehouse.trim() !== '' && reason.trim() !== '' && reason.trim().length <= 200 && !adjust.isPending
    return <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-hud-text-primary">재고 현황 · 실제 원천 분석</h1><p className="mt-1 text-sm text-hud-text-secondary">현재고·수불·Lot 기록을 비교합니다. 차이는 자동 보정하지 않으며 기간말 재고와 회전율을 추정하지 않습니다.</p></div>
        {notice && <div role="status" className="text-sm text-hud-accent-success">{notice}</div>}
        <HudCard title="재고 분석 조건" headingLevel={2}><form className="flex flex-wrap items-end gap-4" onSubmit={e => {
            e.preventDefault(); setPage(0); if (JSON.stringify(draft) === JSON.stringify(filters)) { void query.refetch() } else setFilters({ ...draft })
        }}>
            <label className="text-sm">수불 시작일<DateInput aria-label="수불 시작일" className={inputClass} value={draft.from} max={draft.to} required onChange={e => setDraft({ ...draft, from: e.target.value })} /></label>
            <label className="text-sm">수불 종료일<DateInput aria-label="수불 종료일" className={inputClass} value={draft.to} min={draft.from} max={today} required onChange={e => setDraft({ ...draft, to: e.target.value })} /></label>
            <label className="text-sm">Lot 경과 기준일수<input aria-label="Lot 경과 기준일수" type="number" min="1" max="3650" step="1" required className={inputClass} value={draft.ageDays} onChange={e => setDraft({ ...draft, ageDays: e.target.value })} /></label>
            <label className="text-sm">재고 품목<select aria-label="재고 품목" className={inputClass} disabled={!selection.ready} value={draft.itemId} onChange={e => setDraft({ ...draft, itemId: e.target.value })}><option value="">전체 품목</option>{selection.options.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}</select></label>
            <label className="text-sm">재고 품번·품명 검색<input aria-label="재고 품번·품명 검색" className={inputClass} maxLength={128} value={draft.keyword} onChange={e => setDraft({ ...draft, keyword: e.target.value })} /></label>
            <Button type="submit" disabled={query.isFetching || !draft.from || !draft.to || draft.from > draft.to || !Number.isInteger(Number(draft.ageDays)) || Number(draft.ageDays) < 1 || Number(draft.ageDays) > 3650}>재고 분석 적용</Button>
            <Button variant="outline" type="button" disabled={query.isFetching} onClick={() => { void query.refetch() }}>재고 현재값 새로고침</Button>
        </form>{selection.status}</HudCard>
        <AsyncState isLoading={query.isPending} error={query.error} onRetry={() => { void query.refetch() }} loadingMessage="실제 재고를 조회하는 중...">
            {data && <>
                <p className="text-sm text-hud-text-secondary">수불 기간 {data.from} ~ {data.to} · 현재 기준 {new Date(data.asOf).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (서울) · Lot 제조·입고일 경과 {data.ageDays}일 이상</p>
                <section aria-label="재고 분석 요약" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <StatCard title="조회 품목 수" value={`${data.summary.totalItems}종`} />
                    <StatCard title="현재고 안전재고 미달" value={`${data.summary.lowStockItems}종`} />
                    <StatCard title="현재고·수불 차이" value={`${data.summary.ledgerMismatchItems}종`} />
                    <StatCard title="현재고·Lot 차이" value={`${data.summary.lotMismatchItems}종`} />
                    <StatCard title="경과 Lot 보유 품목" value={`${data.summary.agedItems}종`} />
                    <StatCard title="재고회전율" value="계산 불가" />
                </section>
                <p className="text-sm text-hud-accent-warning">보류 Lot 보유 {data.summary.heldItems}종 · 만료 Lot 보유 {data.summary.expiredItems}종 · 음수/미래일 Lot {data.summary.invalidLots}건 · 미래일 수불 {data.summary.futureTransactions}건</p>
                <HudCard title="품목별 실제 재고 근거" headingLevel={2}>
                    <div className="mb-4 flex flex-wrap gap-4">
                        <label className="text-sm">재고 품목 유형<select aria-label="재고 품목 유형" className={inputClass} value={itemType} onChange={e => { setItemType(e.target.value); setPage(0) }}>{['all', '제품', '반제품', '자재'].map(v => <option key={v} value={v}>{v === 'all' ? '전체 유형' : v}</option>)}</select></label>
                        <label className="text-sm">재고 위험 범위<select aria-label="재고 위험 범위" className={inputClass} value={risk} onChange={e => { setRisk(e.target.value); setPage(0) }}><option value="all">전체</option><option value="low">현재고 안전재고 미달</option><option value="ledger">현재고·수불 차이</option><option value="lots">현재고·Lot 차이</option><option value="aged">경과 Lot 보유</option></select></label>
                        <label className="text-sm">재고 정렬<select aria-label="재고 정렬" className={inputClass} value={sort} onChange={e => { setSort(e.target.value); setPage(0) }}><option value="itemNo,asc">품번 순</option><option value="currentStock,desc">현재고 큰 순 (단위 주의)</option><option value="stockLedgerDelta,asc">수불 차이 작은 순</option><option value="agedLotQty,desc">경과 Lot 큰 순 (단위 주의)</option></select></label>
                    </div>
                    <p className="mb-3 text-sm text-hud-text-secondary">요약은 위험을 포함한 전체 필터 결과 · 행별 단위 유지 · 보류/만료/경과 수량은 중복될 수 있어 합산 금지</p>
                    {data.rows.length === 0 ? <p>조회 범위에 해당하는 품목이 없습니다.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">현재고·수불 합계·Lot 상태·기간 부호 증감의 실제 품목별 비교</caption>
                        <thead><tr>{['품목 / 단위', '현재고 / 안전재고', '수불 합계 / 차이', 'Lot 기록 / 확인 사용가능', '보류 / 만료 / 경과 Lot', '기간 증가 / 감소 / 순증감', '원천 / 업무'].map(h => <th key={h} scope="col" className="p-2 text-left whitespace-nowrap">{h}</th>)}</tr></thead>
                        <tbody>{data.rows.map(row => <tr key={row.itemId} className="border-t border-hud-border-secondary"><th scope="row" className="p-2 text-left font-normal"><Link className="text-hud-accent-primary underline" to={`/items?keyword=${encodeURIComponent(row.itemNo)}`}>{row.itemNo}</Link><p>{row.itemName}</p><p>{row.itemType} · {row.unit}</p></th>
                            <td className="p-2 whitespace-nowrap">{quantity(row.currentStock, row.unit)}<br />{quantity(row.safetyStock, row.unit)}{row.lowStock && <p className="text-hud-accent-danger">현재고 미달</p>}</td>
                            <td className="p-2 whitespace-nowrap">{quantity(row.ledgerBalance, row.unit)}<br />{quantity(row.stockLedgerDelta, row.unit)}{row.ledgerMismatch && <p className="text-hud-accent-warning">수불 차이 확인</p>}</td>
                            <td className="p-2 whitespace-nowrap">{quantity(row.recordedLotQty, row.unit)}<br />{quantity(row.knownUsableLotQty, row.unit)}{row.lotMismatch && <p className="text-hud-accent-warning">Lot 차이 확인</p>}</td>
                            <td className="p-2 whitespace-nowrap">{quantity(row.heldLotQty, row.unit)}<br />{quantity(row.expiredLotQty, row.unit)}<br />{quantity(row.agedLotQty, row.unit)}</td>
                            <td className="p-2 whitespace-nowrap">+{quantity(row.periodIncreaseQty, row.unit)}<br />−{quantity(row.periodDecreaseQty, row.unit)}<br />{quantity(row.periodNetQty, row.unit)}</td>
                            <td className="p-2 whitespace-nowrap">Lot {row.lotCount}건 · 오류 {row.invalidLots}건<br />미래 수불 {row.futureTransactions}건<br /><Link className="text-hud-accent-primary underline" to={`/inventory/lots?itemId=${row.itemId}`}>실제 Lot 원천 보기</Link><br /><Link className="text-hud-accent-primary underline" to={`/purchase/mrp?itemId=${row.itemId}`}>실제 발주제안 보기</Link>{canAdjust && <><br /><Button variant="ghost" size="sm" aria-label={`실사 조정 ${row.itemNo}`} onClick={() => openAdjust(row)}>실사 조정</Button></>}</td></tr>)}</tbody></table></div>}
                    <div className="mt-4 flex items-center gap-3"><Button variant="outline" disabled={page === 0 || query.isFetching} onClick={() => setPage(page - 1)}>이전</Button><span>{page + 1} / {Math.max(1, data.totalPages)} 페이지 · {data.totalElements}종</span><Button variant="outline" disabled={page + 1 >= data.totalPages || query.isFetching} onClick={() => setPage(page + 1)}>다음</Button></div>
                </HudCard>
                <HudCard title="재고 계산 근거와 미지원 범위" headingLevel={2}><ul className="list-disc space-y-2 pl-5 text-sm text-hud-text-secondary">{data.notes.map(n => <li key={n}>{n}</li>)}</ul><Link className="mt-4 inline-block text-hud-accent-primary underline" to="/">운영 대시보드</Link></HudCard>
            </>}
        </AsyncState>
        <Dialog open={adjusting !== null} onClose={() => { if (!adjust.isPending) setAdjusting(null) }} className="relative z-[110]">
            <div className="fixed inset-0 bg-black/60" aria-hidden="true" /><div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="w-full max-w-md rounded-lg bg-hud-bg-secondary border border-hud-border-secondary p-6">
                    <DialogTitle className="text-lg">실사 조정</DialogTitle>
                    {adjusting && <p className="my-4 text-sm">{adjusting.itemNo} · 현재고 {quantity(adjusting.currentStock, adjusting.unit)} · 수불 합계 {quantity(adjusting.ledgerBalance, adjusting.unit)} · 실측 수량으로 현재고를 맞추고 차이를 실사 수불로 기록합니다. 과거 원천은 변경하지 않습니다.</p>}
                    <div className="space-y-3">
                        <label className="block text-sm">실측 수량 *<input aria-label="실측 수량 *" type="number" min="0" step="0.0001" className={inputClass} value={counted} disabled={adjust.isPending} onChange={e => { setCounted(e.target.value); adjust.reset() }} /></label>
                        <label className="block text-sm">실사 창고 *<input aria-label="실사 창고 *" className={inputClass} maxLength={32} value={warehouse} disabled={adjust.isPending} onChange={e => { setWarehouse(e.target.value); adjust.reset() }} /></label>
                        <label className="block text-sm">조정 사유 *<input aria-label="조정 사유 *" className={inputClass} maxLength={200} value={reason} disabled={adjust.isPending} onChange={e => { setReason(e.target.value); adjust.reset() }} /></label>
                    </div>
                    {adjust.error && <div role="alert" className="mt-3 text-sm text-hud-accent-danger">{adjust.error instanceof ApiError && adjust.error.traceId ? `Trace ID: ${adjust.error.traceId}` : '요청을 처리하지 못했습니다.'}</div>}
                    <div className="flex justify-end gap-3 mt-4"><Button variant="ghost" disabled={adjust.isPending} onClick={() => setAdjusting(null)}>닫기</Button>
                        <Button variant="primary" disabled={!adjustReady} onClick={() => { if (adjustReady) adjust.mutate() }}>{adjust.isPending ? '처리 중...' : '조정 확인'}</Button></div>
                </DialogPanel>
            </div>
        </Dialog>
    </div>
}
