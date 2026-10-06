import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { ApiError } from '../../api/http'
import { cancelPurchaseOrder, createPurchaseOrder, deletePurchaseOrder, fetchPurchaseOrderPage,
    purchaseOrderStatuses, updatePurchaseOrder, type PurchaseOrderRow } from '../../api/purchaseOrders'
import { useAuth } from '../../auth/AuthContext'
import { useItemSelection } from '../../hooks/useItemSelection'
import { dateAfterDays, usePartnerSelection } from '../../hooks/usePartnerSelection'
import Button from '../../components/common/Button'
import DataTable, { type DataTableColumn } from '../../components/common/DataTable'
import FormModal, { type ModalField } from '../../components/common/FormModal'
import RowActions from '../../components/common/RowActions'
import StatusBadge from '../../components/common/StatusBadge'
import { formatWon, statusTone } from '../../store/DataContext'

const sorts: Record<string, string> = { purchaseOrderNo: 'purchaseOrderNo', qty: 'qty', dueDate: 'dueDate', receivedQty: 'receivedQty', status: 'status' }
const newOrderNo = () => `PO-${dateAfterDays(0).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`
function errorContent(error: unknown) {
    const api = error instanceof ApiError ? error : undefined
    return <><p>{api?.message ?? '요청을 처리하지 못했습니다.'}</p>{api?.traceId && <p>Trace ID: {api.traceId}</p>}</>
}
export default function PurchaseOrders() {
    const { core, user } = useAuth()
    const canCreate = user?.roles.some(r => r === 'ADMIN' || r === 'MATERIAL') ?? false
    const canModify = user?.roles.some(r => r === 'MATERIAL') ?? false
    const cache = useQueryClient()
    const vendors = usePartnerSelection('발주처')
    const items = useItemSelection()
    const materialItems = items.items.filter(i => i.itemType === '자재')
    const [status, setStatus] = useState('')
    const [vendorId, setVendorId] = useState('')
    const [keyword, setKeyword] = useState('')
    const [page, setPage] = useState(1)
    const [size, setSize] = useState(10)
    const [sort, setSort] = useState('purchaseOrderNo')
    const [direction, setDirection] = useState<'asc' | 'desc'>('desc')
    const [formOpen, setFormOpen] = useState(false)
    const [editing, setEditing] = useState<PurchaseOrderRow | null>(null)
    const [values, setValues] = useState<Record<string, string>>({})
    const [deleting, setDeleting] = useState<PurchaseOrderRow | null>(null)
    const [cancelling, setCancelling] = useState<PurchaseOrderRow | null>(null)
    const [notice, setNotice] = useState('')
    const list = useQuery({ queryKey: ['purchase-orders', { status, vendorId, page, size, sort, direction }],
        queryFn: async ({ signal }) => {
            const result = await fetchPurchaseOrderPage(core, { status: status || undefined,
                vendorId: vendorId ? Number(vendorId) : undefined, page: page - 1, size, sort: `${sorts[sort]},${direction}` }, signal)
            if (!signal.aborted && page > Math.max(1, result.totalPages)) setPage(Math.max(1, result.totalPages))
            return result
        } })
    const visible = (list.data?.rows ?? []).filter(r => {
        const q = keyword.trim().toLowerCase()
        return !q || [r.purchaseOrderNo, r.vendorName, r.itemNo, r.itemName].some(v => v.toLowerCase().includes(q))
    })
    const invalidate = () => cache.invalidateQueries({ queryKey: ['purchase-orders'] })
    const save = useMutation({
        mutationFn: () => {
            const input = { purchaseOrderNo: values.purchaseOrderNo.trim(), vendorId: Number(values.vendorId),
                itemId: Number(values.itemId), qty: Number(values.qty), unitPrice: Number(values.unitPrice), dueDate: values.dueDate }
            return editing ? updatePurchaseOrder(core, editing.id, input) : createPurchaseOrder(core, input)
        },
        onSuccess: async row => { await invalidate(); setFormOpen(false); setEditing(null); setNotice(editing ? `발주를 수정했습니다. ${row.purchaseOrderNo}` : `발주를 등록했습니다. ${row.purchaseOrderNo}`) },
        onError: () => { void invalidate() },
    })
    const remove = useMutation({
        mutationFn: (row: PurchaseOrderRow) => deletePurchaseOrder(core, row.id),
        onSuccess: async () => { await invalidate(); setDeleting(null); setNotice('발주를 삭제했습니다.') },
        onError: () => { void invalidate() },
    })
    const cancel = useMutation({
        mutationFn: (row: PurchaseOrderRow) => cancelPurchaseOrder(core, row.id),
        onSuccess: async row => { await invalidate(); setCancelling(null); setNotice(`발주를 취소했습니다. ${row.purchaseOrderNo}`) },
        onError: () => { void invalidate() },
    })
    const openCreate = () => {
        save.reset(); setNotice(''); setEditing(null)
        setValues({ purchaseOrderNo: newOrderNo(), vendorId: '', itemId: '', qty: '1', unitPrice: '', dueDate: dateAfterDays(7) })
        setFormOpen(true)
    }
    const openEdit = (row: PurchaseOrderRow) => {
        save.reset(); setNotice(''); setEditing(row)
        setValues({ purchaseOrderNo: row.purchaseOrderNo, vendorId: String(row.vendorId), itemId: String(row.itemId),
            qty: String(row.qty), unitPrice: String(row.unitPrice), dueDate: row.dueDate })
        setFormOpen(true)
    }
    const fields: ModalField[] = [
        { key: 'purchaseOrderNo', label: '발주번호', type: 'text', required: true, maxLength: 32, readOnly: editing !== null },
        { key: 'vendorId', label: '발주처', type: 'select', required: true,
            options: vendors.partners.map(p => ({ label: `${p.partnerNo} · ${p.name}`, value: p.id })),
            onChange: (id, setField) => {
                const vendor = vendors.partners.find(p => p.id === Number(id))
                if (!vendor) return
                setField('paymentTerms', vendor.paymentTerms)
                setField('leadTimeDays', vendor.leadTimeDays)
                if (!editing) setField('dueDate', dateAfterDays(vendor.leadTimeDays))
            } },
        { key: 'paymentTerms', label: '결제조건(일)', type: 'number', readOnly: true },
        { key: 'leadTimeDays', label: '리드타임(일)', type: 'number', readOnly: true },
        { key: 'itemId', label: '품목', type: 'select', required: true,
            options: materialItems.map(i => ({ label: `${i.itemNo} · ${i.name} (${i.unit})`, value: i.id })),
            onChange: (value, setField) => {
                const item = materialItems.find(i => i.id === Number(value))
                if (item) setField('unitPrice', String(item.price))
            } },
        { key: 'qty', label: '발주수량', type: 'number', required: true, min: 0.0001, step: 0.0001 },
        { key: 'unitPrice', label: '단가(원)', type: 'number', required: true, min: 1, step: 1 },
        { key: 'dueDate', label: '입고예정일', type: 'date', required: true },
    ]
    const columns: DataTableColumn<PurchaseOrderRow>[] = [
        { key: 'purchaseOrderNo', label: '발주번호', render: r => <span className="font-mono text-hud-accent-primary">{r.purchaseOrderNo}</span> },
        { key: 'vendorName', label: '발주처', sortable: false },
        { key: 'itemNo', label: '품목', sortable: false, render: r => `${r.itemNo} · ${r.itemName}` },
        { key: 'qty', label: '발주수량', render: r => <span className="font-mono">{r.qty.toLocaleString()}</span> },
        { key: 'receivedQty', label: '누적입고', render: r => <span className="font-mono">{r.receivedQty.toLocaleString()}</span> },
        { key: 'remaining', label: '잔량', sortable: false, render: r => <span className="font-mono">잔량 {(r.qty - r.receivedQty).toLocaleString()}</span> },
        { key: 'amount', label: '금액', sortable: false, render: r => <span className="font-mono text-hud-text-primary">{formatWon(r.amount)}</span> },
        { key: 'dueDate', label: '입고예정' },
        { key: 'status', label: '상태', render: r => <StatusBadge tone={statusTone[r.status] ?? 'muted'}>{r.status}</StatusBadge> },
        { key: 'actions', label: '관리', sortable: false, render: r => <div className="flex justify-end gap-1">
            {['발주', '부분입고'].includes(r.status) && <Link to={`/purchase/receiving?purchaseOrderId=${r.id}`} title="입고 화면으로 이동"
                className="px-2 py-1 rounded text-xs font-medium text-hud-accent-primary hover:bg-hud-accent-primary/10 transition-hud">입고 화면으로 이동</Link>}
            {canModify && r.status === '발주' && <>
                <RowActions onEdit={() => openEdit(r)} onDelete={() => { remove.reset(); setNotice(''); setDeleting(r) }} />
            </>}
            {canCreate && ['발주', '부분입고'].includes(r.status) && <Button size="sm" variant="ghost"
                onClick={() => { cancel.reset(); setNotice(''); setCancelling(r) }}>발주 취소</Button>}
        </div> },
    ]
    return <>
        {notice && <div role="status" className="mb-4 text-hud-accent-success">{notice}</div>}
        {vendors.status}{items.status}
        <DataTable<PurchaseOrderRow> title="발주 관리" subtitle={`총 ${list.data?.totalElements ?? 0}건 · 실제 DB 기준`}
            columns={columns} data={visible} rowKey="id" searchPlaceholder="현재 페이지 검색..."
            toolbar={canCreate && <Button variant="primary" glow leftIcon={<Plus size={18} />} disabled={!vendors.ready || !items.ready} onClick={openCreate}>발주 등록</Button>}
            filter={<div className="flex gap-2">
                <select aria-label="발주 상태 필터" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="bg-hud-bg-primary border border-hud-border-secondary rounded-lg px-3 py-2 text-sm">
                    <option value="">전체 상태</option>{purchaseOrderStatuses.map(s => <option key={s}>{s}</option>)}
                </select>
                <select aria-label="발주처 필터" value={vendorId} onChange={e => { setVendorId(e.target.value); setPage(1) }} className="bg-hud-bg-primary border border-hud-border-secondary rounded-lg px-3 py-2 text-sm">
                    <option value="">전체 발주처</option>{vendors.partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>}
            remote={{ searchQuery: keyword, currentPage: page, rowsPerPage: size, totalElements: list.data?.totalElements ?? 0, totalPages: list.data?.totalPages ?? 0,
                sortColumn: sort, sortDirection: direction, onSearchQueryChange: v => setKeyword(v), onPageChange: setPage,
                onRowsPerPageChange: v => { setSize(v); setPage(1) }, onSortChange: (s, d) => { if (sorts[s]) { setSort(s); setDirection(d); setPage(1) } } }}
            asyncState={{ isLoading: list.isPending, error: list.error, onRetry: () => { void list.refetch() }, emptyMessage: '검색 결과가 없습니다.' }} />
        <FormModal isOpen={formOpen} onClose={() => { if (!save.isPending) { setFormOpen(false); setEditing(null) } }}
            title={editing ? '발주 수정' : '발주 등록'} subtitle={editing ? '발주 상태의 문서만 수정할 수 있습니다.' : '발주처·품목·수량·단가를 입력하세요. 발주번호는 중복될 수 없습니다.'}
            fields={fields} values={values} onChange={(key, value) => { setValues(v => ({ ...v, [key]: value })); save.reset() }}
            onSubmit={() => { if (!save.isPending) save.mutate() }} submitLabel={editing ? '저장' : '등록'} isSubmitting={save.isPending} error={save.error ? errorContent(save.error) : undefined} />
        <Dialog open={deleting !== null} onClose={() => { if (!remove.isPending) setDeleting(null) }} className="relative z-[110]">
            <div className="fixed inset-0 bg-black/60" aria-hidden="true" /><div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="w-full max-w-md rounded-lg bg-hud-bg-secondary border border-hud-border-secondary p-6">
                    <DialogTitle className="text-lg">발주 삭제</DialogTitle><p className="my-4">{deleting?.purchaseOrderNo} · 발주 상태의 문서만 삭제할 수 있습니다. 삭제는 감사 기록에 남습니다.</p>
                    {remove.error && <div role="alert">{errorContent(remove.error)}</div>}
                    <div className="flex justify-end gap-3 mt-4"><Button variant="ghost" disabled={remove.isPending} onClick={() => setDeleting(null)}>닫기</Button>
                        <Button variant="danger" disabled={remove.isPending} onClick={() => { if (deleting && !remove.isPending) remove.mutate(deleting) }}>{remove.isPending ? '처리 중...' : '삭제 확인'}</Button></div>
                </DialogPanel>
            </div>
        </Dialog>
        <Dialog open={cancelling !== null} onClose={() => { if (!cancel.isPending) setCancelling(null) }} className="relative z-[110]">
            <div className="fixed inset-0 bg-black/60" aria-hidden="true" /><div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="w-full max-w-md rounded-lg bg-hud-bg-secondary border border-hud-border-secondary p-6">
                    <DialogTitle className="text-lg">발주 취소</DialogTitle><p className="my-4">{cancelling?.purchaseOrderNo} · 발주·부분입고 문서를 취소합니다. 입고완료·취소 문서는 취소할 수 없습니다.</p>
                    {cancel.error && <div role="alert">{errorContent(cancel.error)}</div>}
                    <div className="flex justify-end gap-3 mt-4"><Button variant="ghost" disabled={cancel.isPending} onClick={() => setCancelling(null)}>닫기</Button>
                        <Button variant="danger" disabled={cancel.isPending} onClick={() => { if (cancelling && !cancel.isPending) cancel.mutate(cancelling) }}>{cancel.isPending ? '처리 중...' : '취소 확인'}</Button></div>
                </DialogPanel>
            </div>
        </Dialog>
    </>
}
