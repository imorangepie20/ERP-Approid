import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { ApiError } from '../../api/http'
import { actOnShipment, fetchShipment, fetchShipmentAllocation, fetchShipmentLots, fetchShipmentOrders, fetchShipmentPage,
    saveShipment, shipmentStatuses, type ShipmentAction, type ShipmentRow } from '../../api/shipments'
import { useAuth } from '../../auth/AuthContext'
import { dateAfterDays } from '../../hooks/usePartnerSelection'
import { AsyncState } from '../../components/common/AsyncState'
import Button from '../../components/common/Button'
import DataTable, { type DataTableColumn } from '../../components/common/DataTable'
import FormModal, { type ModalField } from '../../components/common/FormModal'
import StatusBadge from '../../components/common/StatusBadge'
import { formatWon, statusTone } from '../../store/DataContext'

const sorts: Record<string, string> = { shipmentNo: 'shipmentNo', salesOrderNo: 'salesOrder.salesOrderNo', customerName: 'customer.name',
    itemNo: 'item.itemNo', qty: 'qty', amount: 'amount', deliveryDate: 'deliveryDate', status: 'status' }
const labels: Record<ShipmentAction, string> = { dispatch: '배차', depart: '출발', confirm: '출하 확정', cancel: '출하 취소' }
function errorContent(error: unknown) {
    const api = error instanceof ApiError ? error : undefined
    return <><p>{api?.message ?? '요청을 처리하지 못했습니다.'}</p>{api?.traceId && <p>Trace ID: {api.traceId}</p>}
        {api?.errors?.map(e => <p key={`${e.field}-${e.reason}`}>{e.field}: {e.reason}</p>)}</>
}
export default function SalesShipments() {
    const { core, user } = useAuth(); const cache = useQueryClient()
    const canWrite = user?.roles.some(r => r === 'ADMIN' || r === 'SALES') ?? false
    const [searchParams] = useSearchParams()
    const [keyword, setKeyword] = useState(() => searchParams.get('keyword') ?? ''), [status, setStatus] = useState(''), [orderFilter, setOrderFilter] = useState(searchParams.get('salesOrderId') ?? '')
    const [page, setPage] = useState(1), [size, setSize] = useState(10), [sort, setSort] = useState('shipmentNo')
    const [direction, setDirection] = useState<'asc' | 'desc'>('desc')
    const [formOpen, setFormOpen] = useState(false), [editing, setEditing] = useState<ShipmentRow | null>(null)
    const [values, setValues] = useState<Record<string, string>>({}), [notice, setNotice] = useState('')
    const [target, setTarget] = useState<{ row: ShipmentRow; action: ShipmentAction } | null>(null)
    const [detailId, setDetailId] = useState<number | null>(null)
    const orders = useQuery({ queryKey: ['sales-orders', 'shipment-options'], queryFn: ({ signal }) => fetchShipmentOrders(core, signal) })
    const eligible = (orders.data ?? []).filter(o => ['확정', '생산중'].includes(o.status))
    const selected = eligible.find(o => o.id === Number(values.salesOrderId))
    const lots = useQuery({ queryKey: ['lots', 'shipment-options', selected?.itemId], enabled: formOpen && !!selected,
        queryFn: ({ signal }) => fetchShipmentLots(core, selected!.itemId, signal) })
    const allocation = useQuery({ queryKey: ['shipments', 'allocation', selected?.id, editing?.id], enabled: formOpen && !!selected,
        queryFn: ({ signal }) => fetchShipmentAllocation(core, selected!.id, editing?.id ?? null, signal) })
    const eligibleLots = (lots.data ?? []).filter(l => ['정상', '유통기한임박'].includes(l.status) && l.qty > 0 && (!l.expiry || l.expiry >= dateAfterDays(0)))
    const list = useQuery({ queryKey: ['shipments', { keyword, status, orderFilter, page, size, sort, direction }], queryFn: async ({ signal }) => {
        const result = await fetchShipmentPage(core, { keyword, status, salesOrderId: orderFilter ? Number(orderFilter) : undefined,
            page: page - 1, size, sort: `${sorts[sort]},${direction}` }, signal)
        if (!signal.aborted && page > Math.max(1, result.totalPages)) setPage(Math.max(1, result.totalPages))
        return result
    } })
    const detail = useQuery({ queryKey: ['shipments', 'detail', detailId], enabled: detailId !== null,
        queryFn: ({ signal }) => fetchShipment(core, detailId!, signal) })
    const invalidate = async () => { await Promise.all(['shipments', 'sales-orders', 'items', 'lots', 'inventory', 'receivables'].map(k => cache.invalidateQueries({ queryKey: [k] }))) }
    const save = useMutation({ mutationFn: () => saveShipment(core, editing?.id ?? null, {
        ...(!editing ? { salesOrderId: Number(values.salesOrderId) } : {}), lotId: Number(values.lotId), qty: Number(values.qty),
        deliveryDate: values.deliveryDate, vehicle: values.vehicle, trackingNo: values.trackingNo }),
        onSuccess: async row => { await invalidate(); setFormOpen(false); setNotice(`${row.shipmentNo} 저장했습니다.`) }, onError: () => { void invalidate() } })
    const action = useMutation({ mutationFn: (t: NonNullable<typeof target>) => actOnShipment(core, t.row.id, t.action),
        onSuccess: async message => { await invalidate(); setTarget(null); setNotice(message) }, onError: () => { void invalidate() } })
    const openForm = (row: ShipmentRow | null) => {
        save.reset(); setNotice(''); setEditing(row); setValues({ salesOrderId: row ? String(row.salesOrderId) : '', lotId: row?.lotId ? String(row.lotId) : '',
            qty: String(row?.qty ?? 1), deliveryDate: row?.deliveryDate ?? dateAfterDays(0), vehicle: row?.vehicle ?? '', trackingNo: row?.trackingNo ?? '' }); setFormOpen(true)
    }
    const fields: ModalField[] = [
        { key: 'salesOrderId', label: '수주번호', type: 'select', required: true, readOnly: !!editing,
            options: eligible.map(o => ({ value: o.id, label: `${o.salesOrderNo} · ${o.customerName} · ${o.itemNo} (${o.itemName})` })) },
        { key: 'lotId', label: '출하 Lot', type: 'select', required: true, options: eligibleLots.map(l => ({ value: l.id, label: `${l.lotNo} · ${l.warehouse} · 잔량 ${l.qty}` })) },
        { key: 'qty', label: '출하 수량', type: 'number', required: true, min: 0.0001, step: 0.0001 },
        { key: 'deliveryDate', label: '배송 예정일', type: 'date', required: true },
        { key: 'vehicle', label: '차량', type: 'text', maxLength: 64 }, { key: 'trackingNo', label: '송장번호', type: 'text', maxLength: 64 },
    ]
    const button = (r: ShipmentRow, a: ShipmentAction) => <Button key={a} size="sm" variant="ghost" onClick={() => { action.reset(); setNotice(''); setTarget({ row: r, action: a }) }}>{labels[a]}</Button>
    const columns: DataTableColumn<ShipmentRow>[] = [
        { key: 'shipmentNo', label: '출하번호' }, { key: 'salesOrderNo', label: '수주번호' }, { key: 'customerName', label: '고객사' },
        { key: 'itemNo', label: '품목', render: r => `${r.itemNo} · ${r.itemName}` },
        { key: 'lotNo', label: 'Lot', sortable: false, render: r => r.lotNo ?? '미연결' },
        { key: 'qty', label: '수량', render: r => r.qty.toLocaleString() }, { key: 'amount', label: '금액', render: r => formatWon(r.amount) },
        { key: 'deliveryDate', label: '배송 예정일' }, { key: 'status', label: '상태', render: r => <StatusBadge tone={statusTone[r.status] ?? 'muted'}>{r.status}</StatusBadge> },
        { key: 'actions', label: '관리', sortable: false, render: r => <div className="flex flex-wrap justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setDetailId(r.id)}>상세</Button>
            {canWrite && <>
                {['지시', '배차'].includes(r.status) && <Button size="sm" variant="ghost" onClick={() => openForm(r)}>수정</Button>}
                {r.lotId && r.status === '지시' && button(r, 'dispatch')}
                {r.lotId && r.status === '배차' && button(r, 'depart')}
                {r.lotId && ['배차', '출발'].includes(r.status) && button(r, 'confirm')}
                {['지시', '배차'].includes(r.status) && button(r, 'cancel')}
            </>}
        </div> },
    ]
    return <>
        {notice && <div role="status" className="mb-4 text-hud-accent-success">{notice}</div>}
        <AsyncState isLoading={orders.isPending} error={orders.error} onRetry={() => { void orders.refetch() }} />
        {orders.isSuccess && eligible.length === 0 && <p role="status">출하 가능한 확정/생산중 수주가 없습니다.</p>}
        <DataTable<ShipmentRow> title="출하 관리" subtitle={`총 ${list.data?.totalElements ?? 0}건 · 실제 DB 기준`}
            columns={columns} data={list.data?.rows ?? []} rowKey="id" searchPlaceholder="출하번호, 고객사, 품번 검색..."
            toolbar={canWrite && <Button variant="primary" disabled={!orders.isSuccess || eligible.length === 0} onClick={() => openForm(null)}>출하 지시</Button>}
            filter={<div className="flex gap-2">
                <select aria-label="출하 상태 필터" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="bg-hud-bg-primary border border-hud-border-secondary rounded-lg px-3 py-2 text-sm">
                    <option value="">전체 상태</option>{shipmentStatuses.map(s => <option key={s}>{s}</option>)}
                </select>
                <select aria-label="수주 필터" value={orderFilter} onChange={e => { setOrderFilter(e.target.value); setPage(1) }} className="bg-hud-bg-primary border border-hud-border-secondary rounded-lg px-3 py-2 text-sm">
                    <option value="">전체 수주</option>{orders.data?.map(o => <option key={o.id} value={o.id}>{o.salesOrderNo}</option>)}
                </select>
            </div>}
            remote={{ searchQuery: keyword, currentPage: page, rowsPerPage: size, totalElements: list.data?.totalElements ?? 0, totalPages: list.data?.totalPages ?? 0,
                sortColumn: sort, sortDirection: direction, onSearchQueryChange: v => { setKeyword(v); setPage(1) }, onPageChange: setPage,
                onRowsPerPageChange: v => { setSize(v); setPage(1) }, onSortChange: (s, d) => { if (sorts[s]) { setSort(s); setDirection(d); setPage(1) } } }}
            asyncState={{ isLoading: list.isPending, error: list.error, onRetry: () => { void list.refetch() }, emptyMessage: '검색 결과가 없습니다.' }} />
        <FormModal isOpen={formOpen} onClose={() => { if (!save.isPending) setFormOpen(false) }} title={editing ? '출하 수정' : '출하 지시'}
            subtitle="출하별 Lot를 선택합니다. 확정 전 재고 예약은 없으며 확정 시 재고·Lot 잔량을 다시 검증합니다."
            fields={fields} values={values} onChange={(key, value) => { setValues(v => ({ ...v, [key]: value, ...(key === 'salesOrderId' ? { lotId: '' } : {}) })); save.reset() }}
            onSubmit={() => { if (!save.isPending && lots.isSuccess && allocation.isSuccess) save.mutate() }} isSubmitting={save.isPending}
            error={save.error ? errorContent(save.error) : undefined}>
            {selected && <div className="sm:col-span-2 space-y-2">
                <AsyncState isLoading={lots.isPending || allocation.isPending} error={lots.error ?? allocation.error} onRetry={() => { void lots.refetch(); void allocation.refetch() }} />
                {allocation.isSuccess && <p>수주 {selected.qty} · 다른 출하 지시 {allocation.data} · 지시 가능 잔량 {selected.qty - allocation.data}</p>}
                {lots.isSuccess && eligibleLots.length === 0 && <p>출하 가능한 Lot이 없습니다.</p>}
            </div>}
        </FormModal>
        <Dialog open={target !== null} onClose={() => { if (!action.isPending) setTarget(null) }} className="relative z-[110]">
            <div className="fixed inset-0 bg-black/60" aria-hidden="true" /><div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="w-full max-w-md rounded-lg bg-hud-bg-secondary border border-hud-border-secondary p-6">
                    <DialogTitle className="text-lg">{target ? labels[target.action] : ''}</DialogTitle>
                    <p className="my-4">{target?.row.shipmentNo} · {target?.action === 'confirm' ? 'Lot·현재고 차감, 수주 누적 출하와 미수 생성을 함께 반영합니다. 확정 후 취소는 지원하지 않습니다.' : '서버 상태를 변경하고 감사 이력을 보존합니다.'}</p>
                    {action.error && <div role="alert">{errorContent(action.error)}</div>}
                    <div className="flex justify-end gap-3 mt-4"><Button variant="ghost" disabled={action.isPending} onClick={() => setTarget(null)}>닫기</Button>
                        <Button disabled={action.isPending} onClick={() => { if (target && !action.isPending) action.mutate(target) }}>{action.isPending ? '처리 중...' : `${target ? labels[target.action] : ''} 확인`}</Button></div>
                </DialogPanel>
            </div>
        </Dialog>
        <Dialog open={detailId !== null} onClose={() => setDetailId(null)} className="relative z-[100]">
            <div className="fixed inset-0 bg-black/60" aria-hidden="true" /><div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-hud-bg-secondary border border-hud-border-secondary p-6">
                    <DialogTitle className="text-lg mb-4">출하 상세</DialogTitle>
                    <AsyncState isLoading={detail.isPending} error={detail.error} onRetry={() => { void detail.refetch() }} />
                    {detail.data && <div className="space-y-2">
                        <p>{detail.data.shipmentNo} · {detail.data.salesOrderNo} · {detail.data.customerName} · {detail.data.status}</p>
                        <p>{detail.data.itemNo} · {detail.data.itemName} · 수량 {detail.data.qty} · {formatWon(detail.data.amount)}</p>
                        <p>Lot: {detail.data.lotNo ?? '미연결'} · 출고: {detail.data.inventoryTxnNo ?? '없음'} · 미수: {detail.data.receivableNo ?? '없음'}</p>
                        <p>차량: {detail.data.vehicle || '없음'} · 송장: {detail.data.trackingNo || '없음'}</p>
                        <p>배송 예정: {detail.data.deliveryDate} · 출발: {detail.data.departedDate ?? '없음'} · 확정: {detail.data.confirmedDate ?? '없음'}</p>
                        {!detail.data.lotId && <p>과거 출하: Lot·출고·미수 연결은 추정하지 않습니다. 지시/배차는 실제 Lot 확인 후 수정하세요.</p>}
                    </div>}
                    <div className="text-right mt-4"><Button variant="ghost" onClick={() => setDetailId(null)}>닫기</Button></div>
                </DialogPanel>
            </div>
        </Dialog>
    </>
}
