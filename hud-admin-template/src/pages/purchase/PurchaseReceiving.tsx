import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { Plus } from 'lucide-react'
import { ApiError } from '../../api/http'
import { cancelReceiving, fetchReceiving, fetchReceivingOrders, fetchReceivingPage, receivingStatuses, saveReceiving, type ReceivingRow } from '../../api/receivings'
import { useAuth } from '../../auth/AuthContext'
import { dateAfterDays } from '../../hooks/usePartnerSelection'
import { AsyncState } from '../../components/common/AsyncState'
import Button from '../../components/common/Button'
import DataTable, { type DataTableColumn } from '../../components/common/DataTable'
import FormModal, { type ModalField } from '../../components/common/FormModal'
import StatusBadge from '../../components/common/StatusBadge'
import { statusTone } from '../../store/DataContext'

const sorts: Record<string, string> = { receivingNo: 'receivingNo', purchaseOrderNo: 'purchaseOrder.purchaseOrderNo', vendorName: 'vendor.name',
    itemNo: 'item.itemNo', orderQty: 'orderQty', receivedQty: 'receivedQty', defectQty: 'defectQty', receivedDate: 'receivedDate', status: 'status' }
function errorContent(error: unknown) {
    const api = error instanceof ApiError ? error : undefined
    return <><p>{api?.message ?? '요청을 처리하지 못했습니다.'}</p>{api?.traceId && <p>Trace ID: {api.traceId}</p>}
        {api?.errors?.map(e => <p key={`${e.field}-${e.reason}`}>{e.field}: {e.reason}</p>)}</>
}
export default function PurchaseReceiving() {
    const { core, user } = useAuth()
    const canWrite = user?.roles.some(r => r === 'ADMIN' || r === 'MATERIAL') ?? false
    const cache = useQueryClient()
    const [searchParams] = useSearchParams()
    const [keyword, setKeyword] = useState(() => searchParams.get('keyword') ?? '')
    const [status, setStatus] = useState('')
    const [purchaseOrderId, setPurchaseOrderId] = useState('')
    const [page, setPage] = useState(1)
    const [size, setSize] = useState(10)
    const [sort, setSort] = useState('receivingNo')
    const [direction, setDirection] = useState<'asc' | 'desc'>('desc')
    const [formOpen, setFormOpen] = useState(false)
    const [values, setValues] = useState<Record<string, string>>({})
    const [target, setTarget] = useState<ReceivingRow | null>(null)
    const [detailId, setDetailId] = useState<number | null>(null)
    const [notice, setNotice] = useState('')
    const orders = useQuery({ queryKey: ['purchase-orders', 'receiving-options'], queryFn: ({ signal }) => fetchReceivingOrders(core, signal) })
    const eligible = (orders.data ?? []).filter(p => ['발주', '부분입고'].includes(p.status) && p.qty > p.receivedQty)
    const selected = eligible.find(p => p.id === Number(values.purchaseOrderId))
    const list = useQuery({ queryKey: ['receivings', { keyword, status, purchaseOrderId, page, size, sort, direction }], queryFn: async ({ signal }) => {
        const result = await fetchReceivingPage(core, { keyword, status, purchaseOrderId: purchaseOrderId ? Number(purchaseOrderId) : undefined,
            page: page - 1, size, sort: `${sorts[sort]},${direction}` }, signal)
        if (!signal.aborted && page > Math.max(1, result.totalPages)) setPage(Math.max(1, result.totalPages))
        return result
    } })
    const detail = useQuery({ queryKey: ['receivings', 'detail', detailId], enabled: detailId !== null,
        queryFn: ({ signal }) => fetchReceiving(core, detailId!, signal) })
    const invalidate = async () => { await Promise.all(['receivings', 'purchase-orders', 'items', 'inventory', 'lots'].map(key => cache.invalidateQueries({ queryKey: [key] }))) }
    const save = useMutation({ mutationFn: () => saveReceiving(core, { purchaseOrderId: Number(values.purchaseOrderId),
        receivedQty: Number(values.receivedQty), defectQty: Number(values.defectQty), receivedDate: values.receivedDate }),
        onSuccess: async result => { await invalidate(); setFormOpen(false); setNotice(result.message) },
        onError: () => { void invalidate() } })
    const cancel = useMutation({ mutationFn: (row: ReceivingRow) => cancelReceiving(core, row.id),
        onSuccess: async result => { await invalidate(); setTarget(null); setNotice(result.message) }, onError: () => { void invalidate() } })
    const fields: ModalField[] = [
        { key: 'purchaseOrderId', label: '발주번호', type: 'select', required: true,
            options: eligible.map(p => ({ value: p.id, label: `${p.purchaseOrderNo} · ${p.vendorName} · ${p.itemNo} (${p.itemName}) · 잔량 ${p.qty - p.receivedQty}` })) },
        { key: 'receivedQty', label: '총 입고수량', type: 'number', required: true, min: 0.0001, step: 0.0001 },
        { key: 'defectQty', label: '불량수량', type: 'number', required: true, min: 0, step: 0.0001 },
        { key: 'receivedDate', label: '입고일', type: 'date', required: true },
    ]
    const columns: DataTableColumn<ReceivingRow>[] = [
        { key: 'receivingNo', label: '입고번호', render: r => <span className="font-mono text-hud-accent-primary">{r.receivingNo}</span> },
        { key: 'purchaseOrderNo', label: '발주번호' }, { key: 'vendorName', label: '발주처' },
        { key: 'itemNo', label: '품목', render: r => `${r.itemNo} · ${r.itemName}` },
        { key: 'orderQty', label: '발주수량', render: r => r.orderQty.toLocaleString() },
        { key: 'receivedQty', label: '총 입고', render: r => r.receivedQty.toLocaleString() },
        { key: 'goodQty', label: '양품', sortable: false, render: r => r.goodQty.toLocaleString() },
        { key: 'defectQty', label: '불량', render: r => r.defectQty.toLocaleString() },
        { key: 'receivedDate', label: '입고일' },
        { key: 'status', label: '상태', render: r => <StatusBadge tone={statusTone[r.status] ?? 'muted'}>{r.status}</StatusBadge> },
        { key: 'actions', label: '관리', sortable: false, render: r => <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setDetailId(r.id)}>상세</Button>
            {canWrite && r.stockApplied && ['합격', '부분합격', '불합격'].includes(r.status)
                && <Button size="sm" variant="ghost" onClick={() => { cancel.reset(); setNotice(''); setTarget(r) }}>입고 취소</Button>}
        </div> },
    ]
    return <>
        {notice && <div role="status" className="mb-4 text-hud-accent-success">{notice}</div>}
        <AsyncState isLoading={orders.isPending} error={orders.error} onRetry={() => { void orders.refetch() }} />
        {orders.isSuccess && eligible.length === 0 && <p role="status">입고 가능한 발주가 없습니다. 실제 발주를 등록하거나 입고 잔량을 확인하세요.</p>}
        <DataTable<ReceivingRow> title="입고 관리" subtitle={`총 ${list.data?.totalElements ?? 0}건 · 실제 DB 기준`}
            columns={columns} data={list.data?.rows ?? []} rowKey="id" searchPlaceholder="입고번호, 발주번호, 발주처, 품번 검색..."
            toolbar={canWrite && <Button variant="primary" leftIcon={<Plus size={18} />} disabled={!orders.isSuccess || eligible.length === 0}
                onClick={() => { save.reset(); setNotice(''); setValues({ purchaseOrderId: '', receivedQty: '1', defectQty: '0', receivedDate: dateAfterDays(0) }); setFormOpen(true) }}>입고 등록</Button>}
            filter={<div className="flex gap-2">
                <select aria-label="입고 상태 필터" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="bg-hud-bg-primary border border-hud-border-secondary rounded-lg px-3 py-2 text-sm">
                    <option value="">전체 상태</option>{receivingStatuses.map(s => <option key={s}>{s}</option>)}
                </select>
                <select aria-label="발주 필터" value={purchaseOrderId} onChange={e => { setPurchaseOrderId(e.target.value); setPage(1) }} className="bg-hud-bg-primary border border-hud-border-secondary rounded-lg px-3 py-2 text-sm">
                    <option value="">전체 발주</option>{orders.data?.map(p => <option key={p.id} value={p.id}>{p.purchaseOrderNo}</option>)}
                </select>
            </div>}
            remote={{ searchQuery: keyword, currentPage: page, rowsPerPage: size, totalElements: list.data?.totalElements ?? 0, totalPages: list.data?.totalPages ?? 0,
                sortColumn: sort, sortDirection: direction, onSearchQueryChange: v => { setKeyword(v); setPage(1) }, onPageChange: setPage,
                onRowsPerPageChange: v => { setSize(v); setPage(1) }, onSortChange: (s, d) => { if (sorts[s]) { setSort(s); setDirection(d); setPage(1) } } }}
            asyncState={{ isLoading: list.isPending, error: list.error, onRetry: () => { void list.refetch() }, emptyMessage: '검색 결과가 없습니다.' }} />
        <FormModal isOpen={formOpen} onClose={() => { if (!save.isPending) setFormOpen(false) }} title="입고 등록"
            subtitle="총 입고수량에 불량을 포함합니다. 양품만 Lot·현재고에 반영하며, 발주 잔량은 총 입고수량으로 차감합니다."
            fields={fields} values={values} onChange={(key, value) => { setValues(v => ({ ...v, [key]: value })); save.reset() }}
            onSubmit={() => { if (!save.isPending) save.mutate() }} submitLabel="등록" isSubmitting={save.isPending} error={save.error ? errorContent(save.error) : undefined}>
            {selected && <p className="sm:col-span-2 text-sm">발주 {selected.qty} · 누적입고 {selected.receivedQty} · 잔량 {selected.qty - selected.receivedQty} · {selected.status}</p>}
        </FormModal>
        <Dialog open={target !== null} onClose={() => { if (!cancel.isPending) setTarget(null) }} className="relative z-[110]">
            <div className="fixed inset-0 bg-black/60" aria-hidden="true" /><div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="w-full max-w-md rounded-lg bg-hud-bg-secondary border border-hud-border-secondary p-6">
                    <DialogTitle className="text-lg">입고 취소</DialogTitle><p className="my-4">{target?.receivingNo} · 입고 이력을 보존하고 양품 역출고·Lot 잔량·현재고·발주 누적입고를 함께 보상합니다. 사용/보류/폐기된 Lot은 취소할 수 없습니다.</p>
                    {cancel.error && <div role="alert">{errorContent(cancel.error)}</div>}
                    <div className="flex justify-end gap-3 mt-4"><Button variant="ghost" disabled={cancel.isPending} onClick={() => setTarget(null)}>닫기</Button>
                        <Button variant="danger" disabled={cancel.isPending} onClick={() => { if (target && !cancel.isPending) cancel.mutate(target) }}>{cancel.isPending ? '처리 중...' : '입고 취소 확인'}</Button></div>
                </DialogPanel>
            </div>
        </Dialog>
        <Dialog open={detailId !== null} onClose={() => setDetailId(null)} className="relative z-[100]">
            <div className="fixed inset-0 bg-black/60" aria-hidden="true" /><div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-hud-bg-secondary border border-hud-border-secondary p-6">
                    <DialogTitle className="text-lg mb-4">입고 상세</DialogTitle>
                    <AsyncState isLoading={detail.isPending} error={detail.error} onRetry={() => { void detail.refetch() }} />
                    {detail.data && <div className="space-y-2">
                        <p>{detail.data.receivingNo} · {detail.data.purchaseOrderNo} · {detail.data.vendorName} · {detail.data.status}</p>
                        <p>{detail.data.itemNo} · {detail.data.itemName} · {detail.data.receivedDate}</p>
                        <p>총 입고 {detail.data.receivedQty} · 양품 {detail.data.goodQty} · 불량 {detail.data.defectQty}</p>
                        <p>Lot: {detail.data.lotNo ?? '없음'} · 원 입고: {detail.data.inventoryTxnNo ?? '없음'}</p>
                        <p>역출고: {detail.data.reversalTxnNo ?? '없음'} · 취소일: {detail.data.cancelledDate ?? '없음'}</p>
                        {!detail.data.stockApplied && <p>과거 입고: 재고 반영/연결 정보 확인 전 자동 취소 불가</p>}
                    </div>}
                    <div className="text-right mt-4"><Button variant="ghost" onClick={() => setDetailId(null)}>닫기</Button></div>
                </DialogPanel>
            </div>
        </Dialog>
    </>
}
