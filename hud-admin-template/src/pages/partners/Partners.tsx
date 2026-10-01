import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { createPartner, deletePartner, fetchPartnerPage, partnerTypes, updatePartner,
    type CreatePartnerInput, type PartnerRow, type PartnerSort, type PartnerType } from '../../api/partners'
import { ApiError } from '../../api/http'
import { useAuth } from '../../auth/AuthContext'
import Button from '../../components/common/Button'
import DataTable, { type DataTableColumn } from '../../components/common/DataTable'
import FormModal, { type ModalField } from '../../components/common/FormModal'
import RowActions from '../../components/common/RowActions'
import StatusBadge from '../../components/common/StatusBadge'

const emptyForm = { partnerNo: '', name: '', partnerType: '', contactName: '', contact: '', paymentTerms: '30', leadTimeDays: '0' }
const sorts = new Set(['partnerNo', 'name', 'partnerType', 'contactName', 'contact', 'paymentTerms', 'leadTimeDays'])

function ErrorMessage({ error }: { error: unknown }) {
    return <><p>{error instanceof Error ? error.message : '요청을 처리하지 못했습니다.'}</p>
        {error instanceof ApiError && error.traceId && <p className="mt-1 text-xs">Trace ID: {error.traceId}</p>}</>
}

export default function Partners() {
    const { core, hasAnyRole } = useAuth()
    const cache = useQueryClient()
    const canWrite = hasAnyRole(['ADMIN', 'SALES'])
    const canDelete = hasAnyRole(['ADMIN'])
    const [search, setSearch] = useState('')
    const [keyword, setKeyword] = useState('')
    const [page, setPage] = useState(1)
    const [size, setSize] = useState(10)
    const [partnerType, setPartnerType] = useState<PartnerType | ''>('')
    const [sortColumn, setSortColumn] = useState<PartnerSort>('partnerNo')
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
    const [editing, setEditing] = useState<PartnerRow | null>(null)
    const [formOpen, setFormOpen] = useState(false)
    const [values, setValues] = useState<Record<string, string>>({ ...emptyForm })
    const [inputError, setInputError] = useState<Error | null>(null)
    const [target, setTarget] = useState<PartnerRow | null>(null)
    const [notice, setNotice] = useState('')

    useEffect(() => {
        const timer = window.setTimeout(() => setKeyword(search.trim()), 300)
        return () => window.clearTimeout(timer)
    }, [search])

    const settled = search.trim() === keyword
    const query = useQuery({ queryKey: ['partners', { keyword, page, size, partnerType, sortColumn, sortDirection }],
        queryFn: async ({ signal }) => {
            const result = await fetchPartnerPage(core, { keyword, page: page - 1, size,
                partnerType: partnerType || undefined, sortColumn, sortDirection }, signal)
            if (!signal.aborted && page > Math.max(1, result.totalPages)) setPage(Math.max(1, result.totalPages))
            return result
        }, enabled: settled })

    const save = useMutation({
        mutationFn: ({ id, input }: { id?: number; input: CreatePartnerInput }) => {
            const { partnerNo, ...patch } = input
            return id ? updatePartner(core, id, patch) : createPartner(core, { ...patch, partnerNo })
        },
        onSuccess: async (_row, command) => {
            await cache.invalidateQueries({ queryKey: ['partners'] })
            setFormOpen(false)
            setNotice(command.id ? '거래처를 수정했습니다.' : '거래처를 등록했습니다.')
        },
    })
    const remove = useMutation({ mutationFn: (row: PartnerRow) => deletePartner(core, row.id),
        onSuccess: async () => {
            await cache.invalidateQueries({ queryKey: ['partners'] })
            setTarget(null)
            setNotice('거래처를 삭제했습니다.')
        } })

    const openForm = (row: PartnerRow | null) => {
        save.reset()
        setInputError(null)
        setNotice('')
        setEditing(row)
        setValues(row ? Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value)])) : { ...emptyForm })
        setFormOpen(true)
    }
    const closeForm = () => { if (!save.isPending) setFormOpen(false) }
    const closeDelete = () => { if (!remove.isPending) setTarget(null) }
    const submit = () => {
        const paymentTerms = Number(values.paymentTerms)
        const leadTimeDays = Number(values.leadTimeDays)
        if (!partnerTypes.includes(values.partnerType as PartnerType) || !Number.isSafeInteger(paymentTerms)
            || paymentTerms < 0 || paymentTerms > 2147483647 || !Number.isSafeInteger(leadTimeDays)
            || leadTimeDays < 0 || leadTimeDays > 2147483647) {
            setInputError(new Error('거래처 유형과 숫자 입력값을 확인하세요.'))
            return
        }
        setInputError(null)
        save.mutate({ id: editing?.id, input: { partnerNo: values.partnerNo.trim(), name: values.name.trim(),
            partnerType: values.partnerType as PartnerType, contactName: values.contactName.trim(),
            contact: values.contact.trim(), paymentTerms, leadTimeDays } })
    }
    const fields: ModalField[] = [
        { key: 'partnerNo', label: '거래처 코드', type: 'text', required: true, maxLength: 32, readOnly: editing !== null },
        { key: 'name', label: '거래처명', type: 'text', required: true, maxLength: 128 },
        { key: 'partnerType', label: '유형', type: 'select', required: true, options: partnerTypes.map(type => ({ label: type, value: type })) },
        { key: 'contactName', label: '담당자', type: 'text', maxLength: 64 },
        { key: 'contact', label: '연락처', type: 'text', maxLength: 64 },
        { key: 'paymentTerms', label: '결제조건(일)', type: 'number', required: true, min: 0, step: 1 },
        { key: 'leadTimeDays', label: '리드타임(일)', type: 'number', min: 0, step: 1 },
    ]
    const columns: DataTableColumn<PartnerRow>[] = [
        { key: 'partnerNo', label: '거래처 코드', render: row => <span className="font-mono text-hud-accent-primary">{row.partnerNo}</span> },
        { key: 'name', label: '거래처명' },
        { key: 'partnerType', label: '유형', render: row => <StatusBadge tone="primary">{row.partnerType}</StatusBadge> },
        { key: 'contactName', label: '담당자' }, { key: 'contact', label: '연락처' },
        { key: 'paymentTerms', label: '결제조건', render: row => `${row.paymentTerms}일` },
        { key: 'leadTimeDays', label: '리드타임', render: row => `${row.leadTimeDays}일` },
        { key: 'actions', label: '관리', sortable: false, render: row => <RowActions
            onEdit={canWrite ? () => openForm(row) : undefined}
            onDelete={canDelete ? () => { remove.reset(); setTarget(row) } : undefined} /> },
    ]
    const data = settled ? query.data : undefined

    return <>
        {notice && <div role="status" className="mb-4 rounded-lg bg-hud-accent-success/10 p-3 text-hud-accent-success">{notice}</div>}
        <DataTable title="거래처 마스터" subtitle={`총 ${data?.totalElements ?? 0}개 거래처`} columns={columns}
            data={data?.partners ?? []} rowKey="id" searchPlaceholder="거래처 코드, 거래처명 검색..."
            toolbar={canWrite ? <Button variant="primary" leftIcon={<Plus size={18} />} onClick={() => openForm(null)}>거래처 등록</Button> : undefined}
            filter={<select aria-label="거래처 유형" value={partnerType}
                onChange={event => { setPartnerType(event.target.value as PartnerType | ''); setPage(1) }}
                className="rounded-lg border border-hud-border-secondary bg-hud-bg-primary px-3 py-2 text-sm text-hud-text-primary">
                <option value="">전체 유형</option>{partnerTypes.map(type => <option key={type}>{type}</option>)}
            </select>}
            remote={{ searchQuery: search, currentPage: page, rowsPerPage: size, totalElements: data?.totalElements ?? 0,
                totalPages: data?.totalPages ?? 0, sortColumn, sortDirection,
                onSearchQueryChange: value => { setSearch(value); setPage(1) }, onPageChange: setPage,
                onRowsPerPageChange: value => { setSize(value); setPage(1) },
                onSortChange: (column, direction) => { if (sorts.has(column)) { setSortColumn(column as PartnerSort); setSortDirection(direction); setPage(1) } } }}
            asyncState={{ isLoading: query.isPending || !settled, error: query.error,
                onRetry: () => { void query.refetch() }, loadingMessage: '거래처를 불러오는 중...', emptyMessage: '검색 결과가 없습니다.' }} />
        <FormModal isOpen={formOpen} onClose={closeForm} title={editing ? '거래처 수정' : '거래처 등록'}
            subtitle={editing ? '거래처 코드는 변경할 수 없습니다.' : '고객사·발주처·외주처의 기준 정보를 입력하세요.'}
            fields={fields} values={values} onChange={(key, value) => { setValues(previous => ({ ...previous, [key]: value })); setInputError(null); save.reset() }}
            onSubmit={submit} submitLabel={editing ? '저장' : '등록'} isSubmitting={save.isPending}
            error={inputError || save.error ? <ErrorMessage error={inputError ?? save.error} /> : undefined} />
        {target && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4" onClick={closeDelete}>
            <div role="alertdialog" aria-modal="true" aria-labelledby="partner-delete-title" aria-describedby="partner-delete-description"
                className="w-full max-w-md rounded-lg border border-hud-border-secondary bg-hud-bg-secondary p-6 text-hud-text-primary"
                onClick={event => event.stopPropagation()}>
                <h2 id="partner-delete-title" className="text-lg font-semibold">거래처 삭제</h2>
                <p id="partner-delete-description" className="mt-3 text-sm">{target.partnerNo} {target.name} 거래처를 삭제하시겠습니까?</p>
                <p className="mt-2 text-xs text-hud-text-muted">견적·수주·출하·입고 등 거래 이력이 있으면 삭제할 수 없습니다.</p>
                {remove.error && <div role="alert" className="mt-3 text-sm text-hud-accent-danger"><ErrorMessage error={remove.error} /></div>}
                <div className="mt-5 flex justify-end gap-3">
                    <Button variant="ghost" onClick={closeDelete} disabled={remove.isPending}>취소</Button>
                    <Button variant="danger" onClick={() => remove.mutate(target)} disabled={remove.isPending}>{remove.isPending ? '처리 중...' : '삭제 확인'}</Button>
                </div>
            </div>
        </div>}
    </>
}
