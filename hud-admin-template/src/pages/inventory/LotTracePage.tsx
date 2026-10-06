import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchLotTrace, fetchLotTracePage, lotStatuses, type LotTraceRow, type LotTraceMovement } from '../../api/lotTraces'
import { disposeLot, holdLot, releaseLot } from '../../api/lots'
import { ApiError } from '../../api/http'
import { useAuth } from '../../auth/AuthContext'
import { useItemSelection } from '../../hooks/useItemSelection'
import DataTable, { type DataTableColumn } from '../../components/common/DataTable'
import Button from '../../components/common/Button'
import { AsyncState } from '../../components/common/AsyncState'
import StatusBadge from '../../components/common/StatusBadge'

const inputClass = 'rounded-lg border border-hud-border-secondary bg-hud-bg-primary px-3 py-2 text-sm text-hud-text-primary'
const quantity = (v: number, unit: string) => `${v.toLocaleString('ko-KR', { maximumFractionDigits: 4 })} ${unit}`
function sourceLink(m: LotTraceMovement) {
    if (m.sourceType === 'RECEIVING') return `/purchase/receiving?keyword=${encodeURIComponent(m.sourceNo!)}`
    if (m.sourceType === 'WORK_ORDER') return `/production/orders?keyword=${encodeURIComponent(m.sourceNo!)}`
    if (m.sourceType === 'SHIPMENT') return `/sales/shipments?keyword=${encodeURIComponent(m.sourceNo!)}`
    return null
}
export default function LotTracePage() {
    const { core, user } = useAuth(), selection = useItemSelection(), [params] = useSearchParams()
    const canDispose = user?.roles.some(r => r === 'ADMIN' || r === 'QUALITY') ?? false
    const canHoldRelease = user?.roles.some(r => r === 'ADMIN' || r === 'QUALITY' || r === 'MATERIAL') ?? false
    const cache = useQueryClient()
    const [itemId, setItemId] = useState(() => { const id = params.get('itemId') ?? ''; return /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id)) ? id : '' })
    const [keyword, setKeyword] = useState(''), [status, setStatus] = useState(''), [warehouse, setWarehouse] = useState('')
    const [page, setPage] = useState(1), [size, setSize] = useState(10), [sort, setSort] = useState('lotNo'), [direction, setDirection] = useState<'asc' | 'desc'>('asc')
    const [detailId, setDetailId] = useState<number | null>(null), [movementPage, setMovementPage] = useState(0)
    const [disposing, setDisposing] = useState<LotTraceRow | null>(null), [notice, setNotice] = useState('')
    const [holding, setHolding] = useState<LotTraceRow | null>(null)
    const [releasing, setReleasing] = useState<LotTraceRow | null>(null)
    const list = useQuery({ queryKey: ['lot-traces', { itemId, keyword, status, warehouse, page, size, sort, direction }], staleTime: 0,
        queryFn: async ({ signal }) => { const result = await fetchLotTracePage(core, { itemId: itemId ? Number(itemId) : undefined, keyword, status, warehouse, page: page - 1, size, sort: `${sort},${direction}` }, signal)
            if (!signal.aborted && page > Math.max(1, result.totalPages)) setPage(Math.max(1, result.totalPages)); return result } })
    const detail = useQuery({ queryKey: ['lot-traces', 'detail', detailId, movementPage], enabled: detailId !== null, staleTime: 0,
        queryFn: ({ signal }) => fetchLotTrace(core, detailId!, movementPage, signal) })
    const invalidate = () => cache.invalidateQueries({ queryKey: ['lot-traces'] })
    const dispose = useMutation({
        mutationFn: (row: LotTraceRow) => disposeLot(core, row.id),
        onSuccess: async row => { await invalidate(); setDisposing(null); setNotice(`Lot을 폐기했습니다. ${row.lotNo}`) },
        onError: () => { void invalidate() },
    })
    const hold = useMutation({
        mutationFn: (row: LotTraceRow) => holdLot(core, row.id),
        onSuccess: async row => { await invalidate(); setHolding(null); setNotice(`Lot을 보류했습니다. ${row.lotNo}`) },
        onError: () => { void invalidate() },
    })
    const release = useMutation({
        mutationFn: (row: LotTraceRow) => releaseLot(core, row.id),
        onSuccess: async row => { await invalidate(); setReleasing(null); setNotice(`Lot 보류를 해제했습니다. ${row.lotNo}`) },
        onError: () => { void invalidate() },
    })
    const columns: DataTableColumn<LotTraceRow>[] = [
        { key: 'lotNo', label: 'Lot 번호', render: r => <Button variant="ghost" size="sm" onClick={() => { setMovementPage(0); setDetailId(r.id) }}>{r.lotNo}</Button> },
        { key: 'itemNo', label: '품목', sortable: false, render: r => <Link className="text-hud-accent-primary underline" to={`/items?keyword=${encodeURIComponent(r.itemNo)}`}>{r.itemNo} · {r.itemName}</Link> },
        { key: 'warehouse', label: '기록 창고', sortable: false }, { key: 'qty', label: '기록 잔량', render: r => quantity(r.qty, r.unit) },
        { key: 'producedAt', label: '제조·입고일' }, { key: 'expiry', label: '유통기한', render: r => r.expiry ?? '없음' },
        { key: 'status', label: '상태 / 날짜 경고', sortable: false, render: r => <><StatusBadge tone={r.status === '폐기' ? 'muted' : r.status === '보류' ? 'warning' : 'success'}>{r.status}</StatusBadge>
            {r.expired && <p className="text-hud-accent-danger">만료</p>}{r.expiringSoon && <p className="text-hud-accent-warning">30일 이내 만료</p>}{r.invalid && <p className="text-hud-accent-danger">음수/미래일 확인</p>}</> },
    ]
    return <div className="space-y-4">
        {notice && <div role="status" className="text-sm text-hud-accent-success">{notice}</div>}
        <p className="text-sm text-hud-text-secondary">실제 Lot 잔량·기록 창고 조회입니다. 출하 가용량/FIFO를 보장하지 않습니다.</p>
        <DataTable title="Lot 원천 추적" subtitle={`실제 DB ${list.data?.totalElements ?? 0}건 · 날짜 경고 기준 서울 오늘`}
            columns={columns} data={list.data?.rows ?? []} rowKey="id" searchPlaceholder="Lot 번호, 품번, 품명 검색..."
            toolbar={<Button variant="outline" disabled={list.isFetching} onClick={() => { void list.refetch() }}>Lot 새로고침</Button>}
            filter={<div className="flex flex-wrap gap-3">
                <select aria-label="Lot 품목 필터" className={inputClass} value={itemId} disabled={!selection.ready} onChange={e => { setItemId(e.target.value); setPage(1) }}><option value="">전체 품목</option>{selection.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                <select aria-label="Lot 상태 필터" className={inputClass} value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}><option value="">전체 상태</option>{lotStatuses.map(s => <option key={s}>{s}</option>)}</select>
                <input aria-label="Lot 기록 창고 필터" placeholder="기록 창고 정확 일치" maxLength={32} className={inputClass} value={warehouse} onChange={e => { setWarehouse(e.target.value); setPage(1) }} />
            </div>}
            remote={{ searchQuery: keyword, currentPage: page, rowsPerPage: size, totalElements: list.data?.totalElements ?? 0, totalPages: list.data?.totalPages ?? 0, sortColumn: sort, sortDirection: direction,
                onSearchQueryChange: v => { setKeyword(v); setPage(1) }, onPageChange: setPage, onRowsPerPageChange: v => { setSize(v); setPage(1) }, onSortChange: (s, d) => { setSort(s); setDirection(d); setPage(1) } }}
            asyncState={{ isLoading: list.isPending, error: list.error, onRetry: () => { void list.refetch() }, emptyMessage: '해당 Lot이 없습니다.' }} />
        {selection.status}
        <Dialog open={detailId !== null} onClose={() => setDetailId(null)} className="relative z-[100]">
            <div className="fixed inset-0 bg-black/60" aria-hidden="true" /><div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg bg-hud-bg-secondary border border-hud-border-secondary p-6">
                    <DialogTitle className="text-lg">Lot 원천 상세</DialogTitle>
                    <AsyncState isLoading={detail.isPending} error={detail.error} onRetry={() => { void detail.refetch() }}>
                        {detail.data && <div className="space-y-4 mt-4">
                            <p>{detail.data.lot.lotNo} · {detail.data.lot.itemNo} · 기록 잔량 {quantity(detail.data.lot.qty, detail.data.lot.unit)} · {detail.data.lot.status}</p>
                            <p>기록 창고 {detail.data.lot.warehouse} · 제조·입고일 {detail.data.lot.producedAt} · 유통기한 {detail.data.lot.expiry ?? '없음'} · 날짜 기준 {detail.data.lot.referenceDate} (서울)</p>
                            <p>조회 시각 {new Date(detail.data.asOf).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (서울)</p>
                            <Link className="text-hud-accent-primary underline" to={`/analytics/inventory?itemId=${detail.data.lot.itemId}`}>실제 품목 재고 비교</Link>
                            {detail.data.movements.rows.length === 0 ? <p>명시적으로 연결된 수불이 없습니다. 과거 원천을 추정하지 않습니다.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="text-left mb-2">명시적으로 연결된 부호 수불 · 원천 문서</caption>
                                <thead><tr>{['수불 번호 / 일자', '유형 / 기록량', '참조 / 원천 확인'].map(h => <th scope="col" className="p-2 text-left" key={h}>{h}</th>)}</tr></thead>
                                <tbody>{detail.data.movements.rows.map(m => <tr key={m.id} className="border-t border-hud-border-secondary"><td className="p-2">{m.txnNo}<br />{m.txnDate}</td>
                                    <td className="p-2">{m.txnType} · {quantity(m.qty, m.unit)}<br />{m.warehouse}{m.itemId !== detail.data!.lot.itemId && <p className="text-hud-accent-danger">Lot 품목과 불일치 확인</p>}</td>
                                    <td className="p-2">{m.refType ?? '참조 없음'} · {m.refNo ?? '번호 없음'}<br />{sourceLink(m) ? <Link className="text-hud-accent-primary underline" to={sourceLink(m)!}>{m.sourceType} · {m.sourceNo}</Link> : <span>원천 연결 미확인</span>}</td></tr>)}</tbody>
                            </table></div>}
                            <div className="flex items-center gap-3"><Button variant="outline" disabled={movementPage === 0 || detail.isFetching} onClick={() => setMovementPage(movementPage - 1)}>이전 수불</Button><span>{movementPage + 1} / {Math.max(1, detail.data.movements.totalPages)} 페이지 · {detail.data.movements.totalElements}건</span><Button variant="outline" disabled={movementPage + 1 >= detail.data.movements.totalPages || detail.isFetching} onClick={() => setMovementPage(movementPage + 1)}>다음 수불</Button><Button variant="outline" disabled={detail.isFetching} onClick={() => { void detail.refetch() }}>원천 새로고침</Button></div>
                            <ul className="list-disc pl-5 space-y-2 text-sm text-hud-text-secondary">{detail.data.notes.map(n => <li key={n}>{n}</li>)}</ul>
                            {canHoldRelease && detail.data.lot.status === '보류' && <div className="flex items-center gap-3 pt-2">
                                <Button variant="outline" size="sm" onClick={() => { release.reset(); setNotice(''); setReleasing(detail.data!.lot) }}>Lot 해제</Button>
                                <span className="text-sm text-hud-text-muted">보류를 해제하면 출하 가능 상태로 돌아갑니다.</span>
                            </div>}
                            {canHoldRelease && detail.data.lot.status !== '폐기' && detail.data.lot.status !== '보류' && <div className="flex items-center gap-3 pt-2">
                                <Button variant="outline" size="sm" onClick={() => { hold.reset(); setNotice(''); setHolding(detail.data!.lot) }}>Lot 보류</Button>
                                <span className="text-sm text-hud-text-muted">보류 Lot은 출하·입고취소할 수 없습니다.</span>
                            </div>}
                            {canDispose && detail.data.lot.status !== '폐기' && <div className="flex items-center gap-3 pt-2">
                                <Button variant="danger" size="sm" onClick={() => { dispose.reset(); setNotice(''); setDisposing(detail.data!.lot) }}>Lot 폐기</Button>
                                <span className="text-sm text-hud-text-muted">잔량을 0으로 하고 품목 현재고에서 차감하며 보상 출고를 기록합니다.</span>
                            </div>}
                        </div>}
                    </AsyncState>
                    <div className="mt-4 text-right"><Button variant="ghost" onClick={() => setDetailId(null)}>닫기</Button></div>
                </DialogPanel>
            </div>
        </Dialog>
        <Dialog open={disposing !== null} onClose={() => { if (!dispose.isPending) setDisposing(null) }} className="relative z-[110]">
            <div className="fixed inset-0 bg-black/60" aria-hidden="true" /><div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="w-full max-w-md rounded-lg bg-hud-bg-secondary border border-hud-border-secondary p-6">
                    <DialogTitle className="text-lg">Lot 폐기</DialogTitle>
                    <p className="my-4 text-sm">{disposing?.lotNo} · 잔량 {disposing ? quantity(disposing.qty, disposing.unit) : ''}을 0으로 하고 품목 현재고에서 차감합니다. 출하가 연결된 Lot은 폐기할 수 없습니다.</p>
                    {dispose.error && <div role="alert" className="text-sm text-hud-accent-danger">{dispose.error instanceof ApiError && dispose.error.traceId ? `Trace ID: ${dispose.error.traceId}` : '요청을 처리하지 못했습니다.'}</div>}
                    <div className="flex justify-end gap-3 mt-4"><Button variant="ghost" disabled={dispose.isPending} onClick={() => setDisposing(null)}>닫기</Button>
                        <Button variant="danger" disabled={dispose.isPending} onClick={() => { if (disposing && !dispose.isPending) dispose.mutate(disposing) }}>{dispose.isPending ? '처리 중...' : '폐기 확인'}</Button></div>
                </DialogPanel>
            </div>
        </Dialog>
        <Dialog open={holding !== null} onClose={() => { if (!hold.isPending) setHolding(null) }} className="relative z-[110]">
            <div className="fixed inset-0 bg-black/60" aria-hidden="true" /><div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="w-full max-w-md rounded-lg bg-hud-bg-secondary border border-hud-border-secondary p-6">
                    <DialogTitle className="text-lg">Lot 보류</DialogTitle>
                    <p className="my-4 text-sm">{holding?.lotNo} · 보류 Lot은 출하·입고취소할 수 없습니다. 폐기된 Lot은 보류할 수 없습니다.</p>
                    {hold.error && <div role="alert" className="text-sm text-hud-accent-danger">{hold.error instanceof ApiError && hold.error.traceId ? `Trace ID: ${hold.error.traceId}` : '요청을 처리하지 못했습니다.'}</div>}
                    <div className="flex justify-end gap-3 mt-4"><Button variant="ghost" disabled={hold.isPending} onClick={() => setHolding(null)}>닫기</Button>
                        <Button variant="primary" disabled={hold.isPending} onClick={() => { if (holding && !hold.isPending) hold.mutate(holding) }}>{hold.isPending ? '처리 중...' : '보류 확인'}</Button></div>
                </DialogPanel>
            </div>
        </Dialog>
        <Dialog open={releasing !== null} onClose={() => { if (!release.isPending) setReleasing(null) }} className="relative z-[110]">
            <div className="fixed inset-0 bg-black/60" aria-hidden="true" /><div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="w-full max-w-md rounded-lg bg-hud-bg-secondary border border-hud-border-secondary p-6">
                    <DialogTitle className="text-lg">Lot 보류 해제</DialogTitle>
                    <p className="my-4 text-sm">{releasing?.lotNo} · 보류 상태의 Lot만 해제할 수 있으며 해제 후 출하 가능 상태로 돌아갑니다.</p>
                    {release.error && <div role="alert" className="text-sm text-hud-accent-danger">{release.error instanceof ApiError && release.error.traceId ? `Trace ID: ${release.error.traceId}` : '요청을 처리하지 못했습니다.'}</div>}
                    <div className="flex justify-end gap-3 mt-4"><Button variant="ghost" disabled={release.isPending} onClick={() => setReleasing(null)}>닫기</Button>
                        <Button variant="primary" disabled={release.isPending} onClick={() => { if (releasing && !release.isPending) release.mutate(releasing) }}>{release.isPending ? '처리 중...' : '해제 확인'}</Button></div>
                </DialogPanel>
            </div>
        </Dialog>
    </div>
}
