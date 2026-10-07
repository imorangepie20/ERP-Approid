import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { ApiError } from '../../api/http'
import { actOnWorkOrder, completeWorkOrderOperation, fetchWorkOrder, fetchWorkOrderMaterials, fetchWorkOrderOperations,
    fetchWorkOrderPage, issueWorkOrderMaterials, returnWorkOrderMaterials, saveWorkOrder, startWorkOrderOperation,
    workOrderPriorities, workOrderStatuses,
    type MaterialMoveInput, type WorkOrderAction, type WorkOrderRow } from '../../api/workOrders'
import { useAuth } from '../../auth/AuthContext'
import { useItemSelection } from '../../hooks/useItemSelection'
import { dateAfterDays } from '../../hooks/usePartnerSelection'
import { AsyncState } from '../../components/common/AsyncState'
import Button from '../../components/common/Button'
import DataTable, { type DataTableColumn } from '../../components/common/DataTable'
import FormModal, { type ModalField } from '../../components/common/FormModal'
import RowActions from '../../components/common/RowActions'
import StatusBadge from '../../components/common/StatusBadge'
import { statusTone } from '../../store/DataContext'

const labels: Record<WorkOrderAction, string> = { progress: '실적 입력', complete: '생산완료', close: '마감', cancel: '취소', delete: '삭제' }
const sortFields: Record<string, string> = { workOrderNo: 'workOrderNo', itemNo: 'item.itemNo', qty: 'qty', goodQty: 'goodQty',
    defectQty: 'defectQty', progress: 'progress', dueDate: 'dueDate', status: 'status', assignee: 'assignee', priority: 'priority' }
function errorContent(error: unknown) {
    const api = error instanceof ApiError ? error : undefined
    return <><p>{api?.message ?? '요청을 처리하지 못했습니다.'}</p>
        {api?.traceId && <p className="mt-1 text-xs">Trace ID: {api.traceId}</p>}
        {api?.errors?.map(e => <p key={`${e.field}-${e.reason}`}>{e.field}: {e.reason}</p>)}</>
}
export default function ProductionOrders() {
    const { core, user } = useAuth()
    const canWrite = user?.roles.some(role => role === 'PRODUCTION' || role === 'ADMIN') ?? false
    const cache = useQueryClient()
    const selection = useItemSelection()
    const producible = selection.items.filter(i => i.itemType !== '자재')
    const ready = selection.ready && producible.length > 0
    const [searchParams] = useSearchParams()
    const [keyword, setKeyword] = useState(() => searchParams.get('keyword') ?? '')
    const [status, setStatus] = useState('')
    const [itemId, setItemId] = useState('')
    const [page, setPage] = useState(1)
    const [size, setSize] = useState(10)
    const [sortColumn, setSortColumn] = useState('workOrderNo')
    const [direction, setDirection] = useState<'asc' | 'desc'>('desc')
    const [formOpen, setFormOpen] = useState(false)
    const [editing, setEditing] = useState<WorkOrderRow | null>(null)
    const [values, setValues] = useState<Record<string, string>>({})
    const [target, setTarget] = useState<{ row: WorkOrderRow; action: WorkOrderAction } | null>(null)
    const [actuals, setActuals] = useState<Record<string, string>>({})
    const [detailId, setDetailId] = useState<number | null>(null)
    const [notice, setNotice] = useState('')
    const [materialChild, setMaterialChild] = useState('')
    const [materialLot, setMaterialLot] = useState('')
    const [materialQty, setMaterialQty] = useState('')
    const [opTarget, setOpTarget] = useState<number | null>(null)
    const [opGood, setOpGood] = useState('')
    const [opDefect, setOpDefect] = useState('')
    const query = useQuery({ queryKey: ['work-orders', { keyword, status, itemId, page, size, sortColumn, direction }],
        queryFn: async ({ signal }) => {
            const result = await fetchWorkOrderPage(core, { keyword, status, itemId: itemId ? Number(itemId) : undefined,
                page: page - 1, size, sort: `${sortFields[sortColumn]},${direction}` }, signal)
            if (!signal.aborted && page > Math.max(1, result.totalPages)) setPage(Math.max(1, result.totalPages))
            return result
        } })
    const detail = useQuery({ queryKey: ['work-orders', 'detail', detailId], enabled: detailId !== null,
        queryFn: ({ signal }) => fetchWorkOrder(core, detailId!, signal) })
    const materials = useQuery({ queryKey: ['work-orders', 'materials', detailId], enabled: detailId !== null,
        queryFn: ({ signal }) => fetchWorkOrderMaterials(core, detailId!, signal) })
    const move = useMutation({ mutationFn: (request: { kind: 'issue' | 'return'; input: MaterialMoveInput }) =>
        request.kind === 'issue' ? issueWorkOrderMaterials(core, detailId!, request.input) : returnWorkOrderMaterials(core, detailId!, request.input),
        onSuccess: async (result, request) => {
            await Promise.all([cache.invalidateQueries({ queryKey: ['work-orders'] }), cache.invalidateQueries({ queryKey: ['inventory'] }),
                cache.invalidateQueries({ queryKey: ['lots'] }), cache.invalidateQueries({ queryKey: ['items'] })])
            await materials.refetch()
            setNotice(request.kind === 'issue'
                ? `자재 불출했습니다. ${result.childItemNo} · ${result.qty} · ${result.txnNo}`
                : `자재 반납했습니다. ${result.childItemNo} · ${result.qty} · ${result.txnNo}`)
        },
        onError: () => { void invalidate() } })
    const openDetail = (id: number) => {
        setDetailId(id); move.reset(); setNotice('')
        setMaterialChild(''); setMaterialLot(''); setMaterialQty('')
        setOpTarget(null); setOpGood(''); setOpDefect('')
    }
    const operations = useQuery({ queryKey: ['work-orders', 'operations', detailId], enabled: detailId !== null,
        queryFn: ({ signal }) => fetchWorkOrderOperations(core, detailId!, signal) })
    const opAction = useMutation({ mutationFn: (request: { seq: number; kind: 'start' | 'complete' }) =>
        request.kind === 'start' ? startWorkOrderOperation(core, detailId!, request.seq)
            : completeWorkOrderOperation(core, detailId!, request.seq, { goodQty: Number(opGood), defectQty: Number(opDefect) }),
        onSuccess: async (step, request) => {
            await Promise.all([cache.invalidateQueries({ queryKey: ['work-orders'] }), operations.refetch()])
            setOpTarget(null)
            setNotice(request.kind === 'start' ? `공정을 착수했습니다. ${step.seq}`
                : `공정을 완료했습니다. ${step.seq} · 양품 ${step.actualGoodQty} · 불량 ${step.actualDefectQty}`)
        },
        onError: () => { void invalidate() } })
    const invalidate = async () => {
        await Promise.all(['work-orders', 'items', 'inventory', 'lots', 'sales-orders'].map(key => cache.invalidateQueries({ queryKey: [key] })))
    }
    const save = useMutation({ mutationFn: () => {
        const editable = { qty: Number(values.qty), startDate: values.startDate, dueDate: values.dueDate,
            assignee: values.assignee, priority: Number(values.priority) }
        return saveWorkOrder(core, editing?.id ?? null, editing ? editable : { ...editable, workOrderNo: values.workOrderNo, itemId: Number(values.itemId) })
    }, onSuccess: async () => { await invalidate(); setFormOpen(false); setNotice(`작업오더를 ${editing ? '수정' : '등록'}했습니다.`) } })
    const action = useMutation({ mutationFn: (request: { row: WorkOrderRow; action: WorkOrderAction }) =>
        actOnWorkOrder(core, request.row.id, request.action,
            request.action === 'progress' || request.action === 'complete' ? { goodQty: Number(actuals.goodQty), defectQty: Number(actuals.defectQty) } : undefined),
        onSuccess: async message => { await invalidate(); setTarget(null); setNotice(message) },
        onError: () => { void invalidate() } })
    const openForm = (row: WorkOrderRow | null) => {
        setEditing(row)
        setValues(row ? Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value == null ? '' : String(value)]))
            : { workOrderNo: '', itemId: '', qty: '1', startDate: dateAfterDays(0), dueDate: dateAfterDays(7), assignee: '', priority: '1' })
        save.reset(); setNotice(''); setFormOpen(true)
    }
    const ask = (row: WorkOrderRow, requested: WorkOrderAction) => {
        action.reset(); setNotice(''); setActuals({ goodQty: String(row.goodQty), defectQty: String(row.defectQty) }); setTarget({ row, action: requested })
    }
    const fields: ModalField[] = [
        { key: 'workOrderNo', label: '작업오더 번호', type: 'text', required: true, maxLength: 32, readOnly: editing !== null },
        { key: 'itemId', label: '품목', type: 'select', required: true, readOnly: editing !== null,
            options: producible.map(i => ({ label: `${i.itemNo} · ${i.name} (${i.unit})`, value: i.id })) },
        { key: 'qty', label: '지시수량', type: 'number', required: true, min: 0.0001, step: 0.0001, readOnly: editing?.salesOrderId != null },
        { key: 'startDate', label: '착수일', type: 'date', required: true },
        { key: 'dueDate', label: '완료예정', type: 'date', required: true },
        { key: 'assignee', label: '담당자', type: 'text', maxLength: 64 },
        { key: 'priority', label: '우선순위', type: 'select', required: true,
            options: Object.entries(workOrderPriorities).map(([value, label]) => ({ value, label })) },
    ]
    const columns: DataTableColumn<WorkOrderRow>[] = [
        { key: 'workOrderNo', label: '작업오더', render: row => <span className="font-mono text-hud-accent-primary">{row.workOrderNo}</span> },
        { key: 'salesOrderNo', label: '연결 수주', sortable: false, render: row => row.salesOrderNo ?? '독립 오더' },
        { key: 'itemNo', label: '품목', render: row => `${row.itemNo} · ${row.itemName}` },
        { key: 'qty', label: '지시수량', render: row => row.qty.toLocaleString() },
        { key: 'goodQty', label: '양품', render: row => row.goodQty.toLocaleString() },
        { key: 'defectQty', label: '불량', render: row => row.defectQty.toLocaleString() },
        { key: 'progress', label: '진척률', render: row => `${row.progress}%` },
        { key: 'dueDate', label: '완료예정', render: row => <>{row.dueDate}{row.delayed && <span className="ml-2 text-hud-accent-danger">지연</span>}</> },
        { key: 'assignee', label: '담당자', render: row => row.assignee || '미배정' },
        { key: 'priority', label: '우선순위', render: row => workOrderPriorities[row.priority] },
        { key: 'status', label: '상태', render: row => <StatusBadge tone={statusTone[row.status] ?? 'muted'}>{row.status}</StatusBadge> },
        { key: 'actions', label: '관리', sortable: false, render: row => {
            const independent = row.salesOrderId === null && row.goodQty === 0 && row.defectQty === 0
            return <div className="flex justify-end items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => openDetail(row.id)}>상세</Button>
                {canWrite && <>
                    <RowActions onEdit={row.status === '지시' && ready ? () => openForm(row) : undefined}
                        onDelete={row.status === '지시' && independent ? () => ask(row, 'delete') : undefined} />
                    {['지시', '진행중'].includes(row.status) && <>
                        <Button size="sm" variant="ghost" onClick={() => ask(row, 'progress')}>실적 입력</Button>
                        <Button size="sm" variant="ghost" onClick={() => ask(row, 'complete')}>생산완료</Button>
                    </>}
                    {row.status === '완료' && <Button size="sm" variant="ghost" onClick={() => ask(row, 'close')}>마감</Button>}
                    {row.status === '지시' && independent && <Button size="sm" variant="ghost" onClick={() => ask(row, 'cancel')}>취소</Button>}
                </>}
            </div>
        } },
    ]
    const actualForm = target && (target.action === 'progress' || target.action === 'complete')
    const actualFields: ModalField[] = [
        { key: 'goodQty', label: '누적 양품', type: 'number', required: true, min: 0, step: 0.0001 },
        { key: 'defectQty', label: '누적 불량', type: 'number', required: true, min: 0, step: 0.0001 },
    ]
    return <>
        {notice && <div role="status" className="mb-4 text-hud-accent-success">{notice}</div>}
        {selection.status}
        {selection.ready && producible.length === 0 && <p role="status">선택할 제품/반제품이 없습니다.</p>}
        <DataTable<WorkOrderRow> title="작업오더" subtitle={`총 ${query.data?.totalElements ?? 0}건 · 실제 DB 기준`}
            columns={columns} data={query.data?.rows ?? []} rowKey="id" searchPlaceholder="작업오더, 수주, 품번, 담당자 검색..."
            toolbar={canWrite && <Button variant="primary" leftIcon={<Plus size={18} />} disabled={!ready} onClick={() => openForm(null)}>오더 등록</Button>}
            filter={<div className="flex gap-2">
                <select aria-label="작업오더 상태 필터" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
                    className="bg-hud-bg-primary border border-hud-border-secondary rounded-lg px-3 py-2 text-sm">
                    <option value="">전체 상태</option>{workOrderStatuses.map(s => <option key={s}>{s}</option>)}
                </select>
                <select aria-label="품목 필터" value={itemId} onChange={e => { setItemId(e.target.value); setPage(1) }}
                    className="bg-hud-bg-primary border border-hud-border-secondary rounded-lg px-3 py-2 text-sm">
                    <option value="">전체 품목</option>{selection.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            </div>}
            remote={{ searchQuery: keyword, currentPage: page, rowsPerPage: size,
                totalElements: query.data?.totalElements ?? 0, totalPages: query.data?.totalPages ?? 0, sortColumn, sortDirection: direction,
                onSearchQueryChange: value => { setKeyword(value); setPage(1) }, onPageChange: setPage,
                onRowsPerPageChange: value => { setSize(value); setPage(1) },
                onSortChange: (column, dir) => { if (sortFields[column]) { setSortColumn(column); setDirection(dir); setPage(1) } } }}
            asyncState={{ isLoading: query.isPending, error: query.error, onRetry: () => { void query.refetch() }, emptyMessage: '검색 결과가 없습니다.' }} />
        <FormModal isOpen={formOpen} onClose={() => { if (!save.isPending) setFormOpen(false) }}
            title={`작업오더 ${editing ? '수정' : '등록'}`} subtitle="독립 오더를 등록합니다. 수주 연결 오더는 수주 확정 시 자동 생성됩니다."
            fields={fields} values={values} onChange={(key, value) => { setValues(v => ({ ...v, [key]: value })); save.reset() }}
            onSubmit={() => { if (!save.isPending) save.mutate() }} submitLabel={editing ? '저장' : '등록'} isSubmitting={save.isPending}
            error={save.error ? errorContent(save.error) : undefined} />
        <FormModal isOpen={!!actualForm} onClose={() => { if (!action.isPending) setTarget(null) }}
            title={target ? labels[target.action] : '실적 입력'}
            subtitle={target ? `${target.row.workOrderNo} · 지시수량 ${target.row.qty} · 누적 합계를 입력하세요. 완료 시 양품+불량은 지시수량과 같아야 합니다.` : ''}
            fields={actualFields} values={actuals} onChange={(key, value) => { setActuals(v => ({ ...v, [key]: value })); action.reset() }}
            onSubmit={() => { if (target && !action.isPending) action.mutate(target) }} submitLabel={target ? `${labels[target.action]} 확인` : '저장'}
            isSubmitting={action.isPending} error={action.error ? errorContent(action.error) : undefined}>
            {target?.action === 'complete' && <p className="sm:col-span-2 text-sm">양품 Lot·생산입고·현재고를 함께 저장합니다. 원가 집계는 후속 기능입니다.</p>}
        </FormModal>
        {target && !actualForm && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4">
            <div role="alertdialog" aria-modal="true" aria-label={`작업오더 ${labels[target.action]}`}
                className="w-full max-w-md rounded-lg bg-hud-bg-secondary border border-hud-border-secondary p-6">
                <h2 className="text-lg">작업오더 {labels[target.action]}</h2><p className="my-4">{target.row.workOrderNo} · {labels[target.action]}하시겠습니까?</p>
                {action.error && <div role="alert" className="text-hud-accent-danger">{errorContent(action.error)}</div>}
                <div className="flex justify-end gap-3 mt-4"><Button variant="ghost" disabled={action.isPending} onClick={() => setTarget(null)}>닫기</Button>
                    <Button variant={target.action === 'close' ? 'primary' : 'danger'} disabled={action.isPending}
                        onClick={() => { if (!action.isPending) action.mutate(target) }}>{labels[target.action]} 확인</Button></div>
            </div>
        </div>}
        {detailId !== null && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
            <div role="dialog" aria-modal="true" aria-label="작업오더 상세" className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg bg-hud-bg-secondary border border-hud-border-secondary p-6">
                <h2 className="text-lg mb-4">작업오더 상세</h2>
                <AsyncState isLoading={detail.isPending} error={detail.error} onRetry={() => { void detail.refetch() }} />
                {detail.data && <>
                    <p>{detail.data.workOrderNo} · {detail.data.itemNo} · {detail.data.itemName} · {detail.data.status}</p>
                    <p className="my-2">연결 수주: {detail.data.salesOrderNo ?? '독립 오더'} · 담당자: {detail.data.assignee || '미배정'} · {workOrderPriorities[detail.data.priority]}</p>
                    <p className="my-2">계획시간 {detail.data.plannedTimeHours}h · 외주시간 {detail.data.subcontractTimeHours}h</p>
                    <h3 className="mt-4 mb-2">생성 당시 공정</h3>
                    {detail.data.routingSteps.length === 0 ? <p>보관된 공정이 없습니다. 과거 오더 또는 공정 미등록 품목입니다.</p>
                        : <table className="w-full text-left text-sm"><thead><tr><th>순서</th><th>공정</th><th>작업장</th><th>단위 표준시간(h)</th><th>외주</th></tr></thead>
                            <tbody>{detail.data.routingSteps.map(step => <tr key={step.routingId}>
                                <td>{step.seq}</td><td>{step.process}</td><td>{step.workCenter}</td><td>{step.stdTime}</td><td>{step.isSubcontract ? '예' : '아니오'}</td>
                            </tr>)}</tbody></table>}
                    <h3 className="mt-4 mb-2">공정 실적</h3>
                    {operations.isPending ? <p>공정 실적을 조회하는 중...</p>
                        : operations.error ? <div role="alert"><p>공정 실적을 조회하지 못했습니다.</p>
                            <Button size="sm" variant="ghost" onClick={() => { void operations.refetch() }}>다시 시도</Button></div>
                        : operations.data.steps.length === 0 ? <p>보관된 공정이 없어 공정 실적 없이 완료할 수 있습니다.</p>
                        : <><table className="w-full text-left text-sm"><thead><tr><th>순서·공정</th><th>상태·일자</th><th>실적</th><th>관리</th></tr></thead>
                            <tbody>{operations.data.steps.map(step => <tr key={step.seq}>
                                <td>{step.seq} · {step.process} ({step.workCenter})</td>
                                <td>{step.opStatus}{step.startedAt && ` · 착수 ${step.startedAt}`}{step.completedAt && ` · 완료 ${step.completedAt}`}</td>
                                <td>{step.actualGoodQty == null ? '미기록' : `양품 ${step.actualGoodQty} · 불량 ${step.actualDefectQty}`}</td>
                                <td>{canWrite && ['지시', '진행중'].includes(detail.data.status) && <>
                                    {step.opStatus === '대기' && <Button size="sm" variant="ghost" disabled={opAction.isPending}
                                        onClick={() => { opAction.reset(); setNotice(''); setOpTarget(null); opAction.mutate({ seq: step.seq, kind: 'start' }) }}>착수</Button>}
                                    {(step.opStatus === '진행중' || (step.opStatus === '완료' && opTarget === step.seq)) && <>
                                        <label className="text-sm">공정 양품<input aria-label="공정 양품"
                                            className="bg-hud-bg-primary border border-hud-border-secondary rounded-lg px-3 py-2 text-sm"
                                            value={opTarget === step.seq || step.opStatus === '진행중' ? opGood : ''}
                                            disabled={opAction.isPending} onChange={e => { setOpTarget(step.seq); setOpGood(e.target.value); opAction.reset() }} /></label>
                                        <label className="text-sm">공정 불량<input aria-label="공정 불량"
                                            className="bg-hud-bg-primary border border-hud-border-secondary rounded-lg px-3 py-2 text-sm"
                                            value={opTarget === step.seq || step.opStatus === '진행중' ? opDefect : ''}
                                            disabled={opAction.isPending} onChange={e => { setOpTarget(step.seq); setOpDefect(e.target.value); opAction.reset() }} /></label>
                                        <Button size="sm" variant="ghost" disabled={opAction.isPending || !opGood || !opDefect}
                                            onClick={() => { if (!opAction.isPending) opAction.mutate({ seq: step.seq, kind: 'complete' }) }}>완료 확인</Button>
                                    </>}
                                    {step.opStatus === '완료' && opTarget !== step.seq && <Button size="sm" variant="ghost" disabled={opAction.isPending}
                                        onClick={() => { opAction.reset(); setNotice(''); setOpTarget(step.seq); setOpGood(String(step.actualGoodQty ?? '')); setOpDefect(String(step.actualDefectQty ?? '')) }}>다시 기록</Button>}
                                </>}</td>
                            </tr>)}</tbody></table>
                            <p className="mt-2 text-sm">{`공정 합계 양품 ${operations.data.sumGoodQty} · 불량 ${operations.data.sumDefectQty} · 헤더 양품 ${operations.data.goodQty} · 불량 ${operations.data.defectQty} · ${operations.data.matched ? '일치' : '불일치'}`}</p>
                            <ul className="list-disc pl-5 mt-2 text-sm text-hud-text-secondary">{operations.data.notes.map(n => <li key={n}>{n}</li>)}</ul>
                            {opAction.error && <div role="alert" className="mt-2 text-hud-accent-danger">{errorContent(opAction.error)}</div>}</>}
                    <h3 className="mt-4 mb-2">소요 자재</h3>
                    {materials.isPending ? <p>소요 자재를 조회하는 중...</p>
                        : materials.error ? <div role="alert"><p>소요 자재를 조회하지 못했습니다.</p>
                            <Button size="sm" variant="ghost" onClick={() => { void materials.refetch() }}>다시 시도</Button></div>
                        : materials.data.requirements.length === 0 ? <p>BOM 구성품이 없습니다. 불출 없이 완료할 수 있습니다.</p>
                        : <><table className="w-full text-left text-sm"><thead><tr><th>구성품</th><th>소요·불출·잔량</th><th>BOM 기준</th></tr></thead>
                            <tbody>{materials.data.requirements.map(r => <tr key={r.bomId}>
                                <td>{r.childItemNo} · {r.childName} ({r.unit})</td>
                                <td>소요 {r.requiredQty} · 순불출 {r.netIssuedQty} · 잔량 {r.remainingQty} (불출 {r.issuedQty} · 반납 {r.returnedQty})</td>
                                <td>개당 {r.bomQty} · 손실 {r.lossRate}%</td>
                            </tr>)}</tbody></table>
                            <ul className="list-disc pl-5 mt-2 text-sm text-hud-text-secondary">{materials.data.notes.map(n => <li key={n}>{n}</li>)}</ul>
                            {canWrite && ['지시', '진행중'].includes(detail.data.status) && <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={e => e.preventDefault()}>
                                <label className="text-sm">구성품<select aria-label="구성품" className="bg-hud-bg-primary border border-hud-border-secondary rounded-lg px-3 py-2 text-sm"
                                    value={materialChild} disabled={move.isPending} onChange={e => { setMaterialChild(e.target.value); move.reset() }}>
                                    <option value="">선택하세요</option>{materials.data.requirements.map(r => <option key={r.childItemId} value={r.childItemId}>{r.childItemNo} · 잔량 {r.remainingQty}</option>)}
                                </select></label>
                                <label className="text-sm">Lot ID<input aria-label="Lot ID" className="bg-hud-bg-primary border border-hud-border-secondary rounded-lg px-3 py-2 text-sm"
                                    value={materialLot} disabled={move.isPending} onChange={e => { setMaterialLot(e.target.value); move.reset() }} /></label>
                                <label className="text-sm">수량<input aria-label="수량" className="bg-hud-bg-primary border border-hud-border-secondary rounded-lg px-3 py-2 text-sm"
                                    value={materialQty} disabled={move.isPending} onChange={e => { setMaterialQty(e.target.value); move.reset() }} /></label>
                                <Button size="sm" variant="ghost" disabled={move.isPending || !materialChild || !materialLot || !materialQty}
                                    onClick={() => { if (!move.isPending) move.mutate({ kind: 'issue', input: { childItemId: Number(materialChild), lotId: Number(materialLot), qty: Number(materialQty) } }) }}>불출 확인</Button>
                                <Button size="sm" variant="ghost" disabled={move.isPending || !materialChild || !materialLot || !materialQty}
                                    onClick={() => { if (!move.isPending) move.mutate({ kind: 'return', input: { childItemId: Number(materialChild), lotId: Number(materialLot), qty: Number(materialQty) } }) }}>반납 확인</Button>
                            </form>}
                            {move.error && <div role="alert" className="mt-2 text-hud-accent-danger">{errorContent(move.error)}</div>}</>}
                </>}
                <div className="mt-4 text-right"><Button variant="ghost" onClick={() => setDetailId(null)}>닫기</Button></div>
            </div>
        </div>}
    </>
}
