import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { Plus } from 'lucide-react'
import { ApiError } from '../../api/http'
import { closeProductionPlan, confirmProductionPlan, createProductionPlan, fetchProductionPlanPage,
    productionPlanStatuses, updateProductionPlan, type ProductionPlanRow } from '../../api/productionPlans'
import { useAuth } from '../../auth/AuthContext'
import { useItemSelection } from '../../hooks/useItemSelection'
import Button from '../../components/common/Button'
import DataTable, { type DataTableColumn } from '../../components/common/DataTable'
import FormModal, { type ModalField } from '../../components/common/FormModal'
import RowActions from '../../components/common/RowActions'
import StatusBadge from '../../components/common/StatusBadge'
import { statusTone } from '../../store/DataContext'

const sorts: Record<string, string> = { planNo: 'planNo', planMonth: 'planMonth', planQty: 'planQty', status: 'status' }
const currentMonth = () => new Date().toISOString().slice(0, 7)
const newPlanNo = () => `PL-${currentMonth().replace('-', '')}-${Math.floor(1000 + Math.random() * 9000)}`
function errorContent(error: unknown) {
    const api = error instanceof ApiError ? error : undefined
    return <><p>{api?.message ?? '요청을 처리하지 못했습니다.'}</p>{api?.traceId && <p>Trace ID: {api.traceId}</p>}</>
}
export default function ProductionPlan() {
    const { core, user } = useAuth()
    const canWrite = user?.roles.some(r => r === 'ADMIN' || r === 'PRODUCTION') ?? false
    const cache = useQueryClient()
    const items = useItemSelection()
    const [planMonth, setPlanMonth] = useState('')
    const [status, setStatus] = useState('')
    const [keyword, setKeyword] = useState('')
    const [page, setPage] = useState(1)
    const [size, setSize] = useState(10)
    const [sort, setSort] = useState('planNo')
    const [direction, setDirection] = useState<'asc' | 'desc'>('desc')
    const [formOpen, setFormOpen] = useState(false)
    const [editing, setEditing] = useState<ProductionPlanRow | null>(null)
    const [values, setValues] = useState<Record<string, string>>({})
    const [confirming, setConfirming] = useState<ProductionPlanRow | null>(null)
    const [closing, setClosing] = useState<ProductionPlanRow | null>(null)
    const [notice, setNotice] = useState('')
    const list = useQuery({ queryKey: ['production-plans', { planMonth, status, page, size, sort, direction }],
        queryFn: async ({ signal }) => {
            const result = await fetchProductionPlanPage(core, { planMonth: planMonth || undefined,
                status: status || undefined, page: page - 1, size, sort: `${sorts[sort]},${direction}` }, signal)
            if (!signal.aborted && page > Math.max(1, result.totalPages)) setPage(Math.max(1, result.totalPages))
            return result
        } })
    const visible = (list.data?.rows ?? []).filter(r => {
        const q = keyword.trim().toLowerCase()
        return !q || [r.planNo, r.itemNo, r.itemName].some(v => v.toLowerCase().includes(q))
    })
    const invalidate = () => cache.invalidateQueries({ queryKey: ['production-plans'] })
    const buildInput = () => {
        const input: Record<string, number | string> = { planNo: values.planNo.trim(), itemId: Number(values.itemId),
            planMonth: values.planMonth.trim(), planQty: Number(values.planQty) }
        if (values.orderQty !== '' && values.orderQty !== undefined) input.orderQty = Number(values.orderQty)
        if (values.stockQty !== '' && values.stockQty !== undefined) input.stockQty = Number(values.stockQty)
        if (values.gapQty !== '' && values.gapQty !== undefined) input.gapQty = Number(values.gapQty)
        return input as Parameters<typeof createProductionPlan>[1]
    }
    const save = useMutation({
        mutationFn: () => editing ? updateProductionPlan(core, editing.id, buildInput()) : createProductionPlan(core, buildInput()),
        onSuccess: async row => { await invalidate(); setFormOpen(false); setEditing(null); setNotice(editing ? `계획을 수정했습니다. ${row.planNo}` : `계획을 등록했습니다. ${row.planNo}`) },
        onError: () => { void invalidate() },
    })
    const confirm = useMutation({
        mutationFn: (row: ProductionPlanRow) => confirmProductionPlan(core, row.id),
        onSuccess: async row => { await invalidate(); setConfirming(null); setNotice(`계획을 확정했습니다. ${row.planNo}`) },
        onError: () => { void invalidate() },
    })
    const close = useMutation({
        mutationFn: (row: ProductionPlanRow) => closeProductionPlan(core, row.id),
        onSuccess: async row => { await invalidate(); setClosing(null); setNotice(`계획을 종결했습니다. ${row.planNo}`) },
        onError: () => { void invalidate() },
    })
    const openCreate = () => {
        save.reset(); setNotice(''); setEditing(null)
        setValues({ planNo: newPlanNo(), itemId: '', planMonth: currentMonth(), planQty: '1', orderQty: '', stockQty: '', gapQty: '' })
        setFormOpen(true)
    }
    const openEdit = (row: ProductionPlanRow) => {
        save.reset(); setNotice(''); setEditing(row)
        setValues({ planNo: row.planNo, itemId: String(row.itemId), planMonth: row.planMonth,
            planQty: String(row.planQty), orderQty: String(row.orderQty), stockQty: String(row.stockQty), gapQty: String(row.gapQty) })
        setFormOpen(true)
    }
    const fields: ModalField[] = [
        { key: 'planNo', label: '계획번호', type: 'text', required: true, maxLength: 32, readOnly: editing !== null },
        { key: 'itemId', label: '품목', type: 'select', required: true,
            options: items.items.map(i => ({ label: `${i.itemNo} · ${i.name} (${i.unit})`, value: i.id })) },
        { key: 'planMonth', label: '계획월', type: 'text', required: true, maxLength: 7, placeholder: 'YYYY-MM' },
        { key: 'planQty', label: '계획수량', type: 'number', required: true, min: 0.0001, step: 0.0001 },
        { key: 'orderQty', label: '수주수량', type: 'number', min: 0, step: 0.0001 },
        { key: 'stockQty', label: '현재고', type: 'number', min: 0, step: 0.0001 },
        { key: 'gapQty', label: '생산필요량', type: 'number', step: 0.0001 },
    ]
    const columns: DataTableColumn<ProductionPlanRow>[] = [
        { key: 'planNo', label: '계획번호', render: r => <span className="font-mono text-hud-accent-primary">{r.planNo}</span> },
        { key: 'itemNo', label: '품목', sortable: false, render: r => `${r.itemNo} · ${r.itemName}` },
        { key: 'planMonth', label: '계획월' },
        { key: 'planQty', label: '계획수량', render: r => <span className="font-mono">{r.planQty.toLocaleString()}</span> },
        { key: 'orderQty', label: '수주수량', sortable: false, render: r => <span className="font-mono">{r.orderQty.toLocaleString()}</span> },
        { key: 'stockQty', label: '현재고', sortable: false, render: r => <span className="font-mono">{r.stockQty.toLocaleString()}</span> },
        { key: 'gapQty', label: '생산필요량', sortable: false, render: r => (
            <span className={`font-mono ${r.gapQty > 0 ? 'text-hud-accent-warning' : 'text-hud-accent-success'}`}>
                {r.gapQty > 0 ? `+${r.gapQty.toLocaleString()}` : r.gapQty.toLocaleString()}
            </span>
        ) },
        { key: 'status', label: '상태', render: r => <StatusBadge tone={statusTone[r.status] ?? 'muted'}>{r.status}</StatusBadge> },
        { key: 'actions', label: '관리', sortable: false, render: r => <div className="flex justify-end gap-1">
            {canWrite && r.status === '계획' && <>
                <RowActions onEdit={() => openEdit(r)} />
                <Button size="sm" variant="ghost" onClick={() => { confirm.reset(); setNotice(''); setConfirming(r) }}>확정</Button>
            </>}
            {canWrite && r.status === '확정' && <Button size="sm" variant="ghost"
                onClick={() => { close.reset(); setNotice(''); setClosing(r) }}>종결</Button>}
        </div> },
    ]
    return <>
        {notice && <div role="status" className="mb-4 text-hud-accent-success">{notice}</div>}
        {items.status}
        <DataTable<ProductionPlanRow> title="생산계획" subtitle={`총 ${list.data?.totalElements ?? 0}건 · 실제 DB 기준`}
            columns={columns} data={visible} rowKey="id" searchPlaceholder="현재 페이지 검색..."
            toolbar={canWrite && <Button variant="primary" glow leftIcon={<Plus size={18} />} disabled={!items.ready} onClick={openCreate}>계획 등록</Button>}
            filter={<div className="flex gap-2">
                <input aria-label="계획월 필터" value={planMonth} onChange={e => { setPlanMonth(e.target.value); setPage(1) }} placeholder="계획월 (YYYY-MM)"
                    className="bg-hud-bg-primary border border-hud-border-secondary rounded-lg px-3 py-2 text-sm w-40" />
                <select aria-label="계획 상태 필터" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="bg-hud-bg-primary border border-hud-border-secondary rounded-lg px-3 py-2 text-sm">
                    <option value="">전체 상태</option>{productionPlanStatuses.map(s => <option key={s}>{s}</option>)}
                </select>
            </div>}
            remote={{ searchQuery: keyword, currentPage: page, rowsPerPage: size, totalElements: list.data?.totalElements ?? 0, totalPages: list.data?.totalPages ?? 0,
                sortColumn: sort, sortDirection: direction, onSearchQueryChange: v => setKeyword(v), onPageChange: setPage,
                onRowsPerPageChange: v => { setSize(v); setPage(1) }, onSortChange: (s, d) => { if (sorts[s]) { setSort(s); setDirection(d); setPage(1) } } }}
            asyncState={{ isLoading: list.isPending, error: list.error, onRetry: () => { void list.refetch() }, emptyMessage: '검색 결과가 없습니다.' }} />
        <FormModal isOpen={formOpen} onClose={() => { if (!save.isPending) { setFormOpen(false); setEditing(null) } }}
            title={editing ? '생산계획 수정' : '생산계획 등록'} subtitle={editing ? '계획 상태의 문서만 수정할 수 있습니다.' : '품목·계획월·계획수량을 입력하세요. 같은 품목·월의 계획은 중복될 수 없습니다.'}
            fields={fields} values={values} onChange={(key, value) => { setValues(v => ({ ...v, [key]: value })); save.reset() }}
            onSubmit={() => { if (!save.isPending) save.mutate() }} submitLabel={editing ? '저장' : '등록'} isSubmitting={save.isPending} error={save.error ? errorContent(save.error) : undefined} />
        <Dialog open={confirming !== null} onClose={() => { if (!confirm.isPending) setConfirming(null) }} className="relative z-[110]">
            <div className="fixed inset-0 bg-black/60" aria-hidden="true" /><div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="w-full max-w-md rounded-lg bg-hud-bg-secondary border border-hud-border-secondary p-6">
                    <DialogTitle className="text-lg">계획 확정</DialogTitle><p className="my-4">{confirming?.planNo} · 계획 상태의 문서를 확정합니다. 확정 후에는 종결만 가능합니다.</p>
                    {confirm.error && <div role="alert">{errorContent(confirm.error)}</div>}
                    <div className="flex justify-end gap-3 mt-4"><Button variant="ghost" disabled={confirm.isPending} onClick={() => setConfirming(null)}>닫기</Button>
                        <Button variant="primary" disabled={confirm.isPending} onClick={() => { if (confirming && !confirm.isPending) confirm.mutate(confirming) }}>{confirm.isPending ? '처리 중...' : '확정 확인'}</Button></div>
                </DialogPanel>
            </div>
        </Dialog>
        <Dialog open={closing !== null} onClose={() => { if (!close.isPending) setClosing(null) }} className="relative z-[110]">
            <div className="fixed inset-0 bg-black/60" aria-hidden="true" /><div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="w-full max-w-md rounded-lg bg-hud-bg-secondary border border-hud-border-secondary p-6">
                    <DialogTitle className="text-lg">계획 종결</DialogTitle><p className="my-4">{closing?.planNo} · 확정 상태의 문서를 종결합니다. 종결 후에는 변경할 수 없습니다.</p>
                    {close.error && <div role="alert">{errorContent(close.error)}</div>}
                    <div className="flex justify-end gap-3 mt-4"><Button variant="ghost" disabled={close.isPending} onClick={() => setClosing(null)}>닫기</Button>
                        <Button variant="primary" disabled={close.isPending} onClick={() => { if (closing && !close.isPending) close.mutate(closing) }}>{close.isPending ? '처리 중...' : '종결 확인'}</Button></div>
                </DialogPanel>
            </div>
        </Dialog>
    </>
}
