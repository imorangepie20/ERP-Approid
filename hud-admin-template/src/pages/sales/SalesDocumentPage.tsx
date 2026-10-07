import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { ApiError } from '../../api/http'
import { actOnSalesDocument, fetchSalesPage, saveSalesDocument, salesStatuses,
    type QuotationRow, type SalesAction, type SalesDocumentRow, type SalesOrderRow, type SalesResource } from '../../api/salesDocuments'
import { useAuth } from '../../auth/AuthContext'
import { useItemSelection } from '../../hooks/useItemSelection'
import { dateAfterDays, usePartnerSelection } from '../../hooks/usePartnerSelection'
import Button from '../../components/common/Button'
import DataTable, { type DataTableColumn } from '../../components/common/DataTable'
import FormModal, { type ModalField } from '../../components/common/FormModal'
import RowActions from '../../components/common/RowActions'
import StatusBadge from '../../components/common/StatusBadge'
import { formatWon, statusTone } from '../../store/DataContext'

const actionLabels: Record<SalesAction, string> = { send: '발송', convert: '수주 전환', confirm: '수주 확정', cancel: '수주 취소', delete: '삭제' }
function errorContent(error: unknown) {
    const api = error instanceof ApiError ? error : undefined
    return <><p>{api?.message ?? '요청을 처리하지 못했습니다.'}</p>
        {api?.traceId && <p className="mt-1 text-xs">Trace ID: {api.traceId}</p>}
        {api?.errors?.map(e => <p key={`${e.field}-${e.reason}`}>{e.field}: {e.reason}</p>)}</>
}
export default function SalesDocumentPage({ resource }: { resource: SalesResource }) {
    const quotation = resource === 'quotations'
    const name = quotation ? '견적' : '수주'
    const codeKey = quotation ? 'quotationNo' : 'salesOrderNo'
    const code = (row: SalesDocumentRow) => quotation ? (row as QuotationRow).quotationNo : (row as SalesOrderRow).salesOrderNo
    const { core, user } = useAuth()
    const canWrite = user?.roles.some(role => role === 'SALES' || role === 'ADMIN') ?? false
    const cache = useQueryClient()
    const items = useItemSelection()
    const customers = usePartnerSelection('고객사')
    const selectableItems = items.items.filter(item => item.itemType === '제품')
    const ready = items.ready && customers.ready && selectableItems.length > 0
    const [searchParams] = useSearchParams()
    const [keyword, setKeyword] = useState(searchParams.get('keyword') ?? '')
    const [status, setStatus] = useState('')
    const [customerId, setCustomerId] = useState('')
    const [page, setPage] = useState(1)
    const [size, setSize] = useState(10)
    const [sortColumn, setSortColumn] = useState(codeKey)
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
    const [formOpen, setFormOpen] = useState(false)
    const [editing, setEditing] = useState<SalesDocumentRow | null>(null)
    const [values, setValues] = useState<Record<string, string>>({})
    const [target, setTarget] = useState<{ row: SalesDocumentRow; action: SalesAction } | null>(null)
    const [notice, setNotice] = useState('')
    const sortFields: Record<string, string> = { [codeKey]: codeKey, customerName: 'customer.name', itemNo: 'item.itemNo',
        qty: 'qty', unitPrice: 'unitPrice', amount: 'amount', dueDate: 'dueDate', validUntil: 'validUntil', orderedAt: 'orderedAt', status: 'status' }
    const query = useQuery({ queryKey: [resource, { keyword, status, customerId, page, size, sortColumn, sortDirection }],
        queryFn: async ({ signal }) => {
            const result = await fetchSalesPage(core, resource, { keyword, status, customerId: customerId ? Number(customerId) : undefined,
                page: page - 1, size, sort: `${sortFields[sortColumn]},${sortDirection}` }, signal)
            if (!signal.aborted && page > Math.max(1, result.totalPages)) setPage(Math.max(1, result.totalPages))
            return result
        } })
    const invalidate = async () => {
        await Promise.all(['quotations', 'sales-orders', 'work-orders'].map(key => cache.invalidateQueries({ queryKey: [key] })))
    }
    const save = useMutation({ mutationFn: () => {
        const editable = { qty: Number(values.qty), unitPrice: Number(values.unitPrice), dueDate: values.dueDate,
            ...(quotation ? { validUntil: values.validUntil } : {}) }
        const input = editing ? editable : { ...editable, [codeKey]: values[codeKey],
            customerId: Number(values.customerId), itemId: Number(values.itemId),
            ...(quotation ? {} : { orderedAt: values.orderedAt }) }
        return saveSalesDocument(core, resource, editing?.id ?? null, input)
    }, onSuccess: async () => { await invalidate(); setFormOpen(false); setNotice(`${quotation ? '견적을' : '수주를'} ${editing ? '수정' : '등록'}했습니다.`) } })
    const action = useMutation({ mutationFn: (request: { row: SalesDocumentRow; action: SalesAction }) =>
        actOnSalesDocument(core, resource, request.row.id, request.action),
        onSuccess: async message => { await invalidate(); setTarget(null); setNotice(message) },
        onError: () => { void invalidate() } })
    const openForm = (row: SalesDocumentRow | null) => {
        setEditing(row)
        setValues(row ? Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value == null ? '' : String(value)]))
            : { [codeKey]: '', customerId: '', itemId: '', qty: '1', unitPrice: '', dueDate: dateAfterDays(7),
                validUntil: dateAfterDays(14), orderedAt: dateAfterDays(0), paymentTerms: '', leadTimeDays: '' })
        save.reset(); setNotice(''); setFormOpen(true)
    }
    const ask = (row: SalesDocumentRow, requested: SalesAction) => { action.reset(); setNotice(''); setTarget({ row, action: requested }) }
    const fields: ModalField[] = [
        { key: codeKey, label: `${name}번호`, type: 'text', required: true, maxLength: 32, readOnly: editing !== null },
        { ...customers.field('customerId', '고객사'), readOnly: editing !== null },
        ...customers.termsFields,
        { key: 'itemId', label: '품목', type: 'select', required: true, readOnly: editing !== null,
            options: selectableItems.map(item => ({ label: `${item.itemNo} · ${item.name} (${item.unit})`, value: item.id })),
            onChange: (id, setField) => { const item = selectableItems.find(i => String(i.id) === id); if (item) setField('unitPrice', item.price) } },
        { key: 'qty', label: '수량', type: 'number', required: true, min: 0.0001, step: 0.0001 },
        { key: 'unitPrice', label: '단가(원)', type: 'number', required: true, min: 1, step: 1 },
        { key: 'dueDate', label: '납기', type: 'date', required: true },
        ...(quotation ? [{ key: 'validUntil', label: '유효기간', type: 'date', required: true } as ModalField]
            : [{ key: 'orderedAt', label: '수주일', type: 'date', required: true, readOnly: editing !== null } as ModalField]),
    ]
    const columns: DataTableColumn<SalesDocumentRow>[] = [
        { key: codeKey, label: `${name}번호`, render: row => <span className="font-mono text-hud-accent-primary">{code(row)}</span> },
        { key: 'customerName', label: '고객사' },
        { key: 'itemNo', label: '품목', render: row => <>{row.itemNo} · {row.itemName}</> },
        { key: 'qty', label: '수량', render: row => row.qty.toLocaleString() },
        { key: 'unitPrice', label: '단가', render: row => formatWon(row.unitPrice) },
        { key: 'amount', label: '금액', render: row => formatWon(row.amount) },
        { key: 'dueDate', label: '납기' },
        ...(quotation ? [{ key: 'validUntil', label: '유효기간' }] : [
            { key: 'quotationNo', label: '원견적', sortable: false, render: (row: SalesDocumentRow) => (row as SalesOrderRow).quotationNo ?? '직접 수주' },
            { key: 'workOrderNos', label: '작업오더', sortable: false, render: (row: SalesDocumentRow) => (row as SalesOrderRow).workOrderNos.join(', ') || '—' },
        ]),
        { key: 'paymentTerms', label: '결제조건', sortable: false, render: row => `${row.paymentTerms}일` },
        { key: 'status', label: '상태', render: row => <StatusBadge tone={statusTone[row.status] ?? 'muted'}>{row.status}</StatusBadge> },
        { key: 'actions', label: '관리', sortable: false, render: row => {
            if (!canWrite) return null
            const editable = row.status === (quotation ? '작성중' : '대기')
            const requestButtons: SalesAction[] = quotation
                ? row.status === '작성중' ? ['send'] : row.status === '발송완료' ? ['convert'] : []
                : row.status === '대기' ? ['confirm', 'cancel'] : row.status === '확정' ? ['cancel'] : []
            return <div className="flex justify-end items-center gap-1">
                <RowActions onEdit={editable && ready ? () => openForm(row) : undefined}
                    onDelete={editable && (quotation || !(row as SalesOrderRow).quotationId) ? () => ask(row, 'delete') : undefined} />
                {requestButtons.map(requested => <Button key={requested} size="sm" variant="ghost"
                    onClick={() => ask(row, requested)}>{actionLabels[requested]}</Button>)}
            </div>
        } },
    ]
    return <>
        {notice && <div role="status" className="mb-4 text-hud-accent-success">{notice}
            {notice.startsWith('수주를 생성') && <Link to="/sales/orders" className="ml-3 underline">수주 보기</Link>}
            {notice.startsWith('작업오더를 생성') && <Link to={`/production/orders?keyword=${encodeURIComponent(notice.split(': ')[1] ?? '')}`}
                className="ml-3 underline">작업오더 보기</Link>}
        </div>}
        {customers.status}{items.status}
        {items.ready && selectableItems.length === 0 && <p role="status">선택할 제품이 없습니다. 품목 마스터에서 등록하세요.</p>}
        <DataTable<SalesDocumentRow> title={quotation ? '견적 관리' : '수주 현황'}
            subtitle={`총 ${query.data?.totalElements ?? 0}건 · 실제 DB 기준`}
            columns={columns} data={query.data?.rows ?? []} rowKey="id" searchPlaceholder={`${name}번호, 고객사, 품번 검색...`}
            toolbar={canWrite && <Button variant="primary" leftIcon={<Plus size={18} />} disabled={!ready} onClick={() => openForm(null)}>{name} 등록</Button>}
            filter={<div className="flex gap-2">
                <select aria-label={`${name} 상태 필터`} value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
                    className="bg-hud-bg-primary border border-hud-border-secondary rounded-lg px-3 py-2 text-sm">
                    <option value="">전체 상태</option>{salesStatuses[resource].map(s => <option key={s}>{s}</option>)}
                </select>
                <select aria-label="고객사 필터" value={customerId} onChange={e => { setCustomerId(e.target.value); setPage(1) }}
                    className="bg-hud-bg-primary border border-hud-border-secondary rounded-lg px-3 py-2 text-sm">
                    <option value="">전체 고객사</option>{customers.partners.map(p => <option key={p.id} value={p.id}>{p.partnerNo} · {p.name}</option>)}
                </select>
            </div>}
            remote={{ searchQuery: keyword, currentPage: page, rowsPerPage: size,
                totalElements: query.data?.totalElements ?? 0, totalPages: query.data?.totalPages ?? 0, sortColumn, sortDirection,
                onSearchQueryChange: value => { setKeyword(value); setPage(1) }, onPageChange: setPage,
                onRowsPerPageChange: value => { setSize(value); setPage(1) },
                onSortChange: (column, direction) => { if (sortFields[column]) { setSortColumn(column); setSortDirection(direction); setPage(1) } } }}
            asyncState={{ isLoading: query.isPending, error: query.error, onRetry: () => { void query.refetch() }, emptyMessage: '검색 결과가 없습니다.' }} />
        <FormModal isOpen={formOpen} onClose={() => { if (!save.isPending) setFormOpen(false) }}
            title={`${name} ${editing ? '수정' : '등록'}`} subtitle="번호·고객사·품목은 등록 후 변경할 수 없습니다. 금액은 서버가 계산합니다."
            fields={fields} values={values} onChange={(key, value) => { setValues(v => ({ ...v, [key]: value })); save.reset() }}
            onSubmit={() => { if (!save.isPending) save.mutate() }} submitLabel={editing ? '저장' : '등록'} isSubmitting={save.isPending}
            error={save.error ? errorContent(save.error) : undefined} />
        {target && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4">
            <div role="alertdialog" aria-modal="true" aria-label={actionLabels[target.action]}
                className="w-full max-w-md rounded-lg bg-hud-bg-secondary border border-hud-border-secondary p-6">
                <h2 className="text-lg">{actionLabels[target.action]}</h2>
                <p className="my-4">{code(target.row)} · {actionLabels[target.action]}하시겠습니까?</p>
                {target.action === 'send' && <p className="mb-4 text-sm">발송완료 상태로 저장합니다. 이메일 전송은 포함하지 않습니다.</p>}
                {target.action === 'confirm' && <p className="mb-4 text-sm">작업오더가 생성됩니다. 작업 전 확정 건은 보상 취소할 수 있습니다.</p>}
                {target.action === 'cancel' && !quotation && (target.row as SalesOrderRow).status === '확정'
                    && <p className="mb-4 text-sm">작업 전 확정 건만 취소되며 연결 작업오더도 함께 취소됩니다. 진척·출하가 있으면 차단됩니다.</p>}
                {action.error && <div role="alert" className="text-hud-accent-danger">{errorContent(action.error)}</div>}
                <div className="flex justify-end gap-3 mt-4">
                    <Button variant="ghost" disabled={action.isPending} onClick={() => setTarget(null)}>닫기</Button>
                    <Button variant={target.action === 'delete' || target.action === 'cancel' ? 'danger' : 'primary'} disabled={action.isPending}
                        onClick={() => { if (!action.isPending) action.mutate(target) }}>{actionLabels[target.action]} 확인</Button>
                </div>
            </div>
        </div>}
    </>
}
