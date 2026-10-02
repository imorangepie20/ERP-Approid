import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { HttpClient } from '../../api/http'
import { ApiError } from '../../api/http'
import type { MasterListParams, MasterPage } from '../../api/masterPage'
import { useAuth } from '../../auth/AuthContext'
import { Authorize } from '../../auth/authorization'
import { useItemSelection } from '../../hooks/useItemSelection'
import type { ItemRow } from '../../api/items'
import Button from './Button'
import DataTable, { type DataTableColumn } from './DataTable'
import FormModal, { type ModalField } from './FormModal'
import RowActions from './RowActions'

type Values = Record<string, string>
interface Props<T extends { id: number }> {
    resource: string
    title: string
    name: string
    subtitle: string
    code: (row: T) => string
    initialValues: Values
    toValues: (row: T) => Values
    fields: (editing: boolean, items: ItemRow[]) => ModalField[]
    columns: DataTableColumn<T>[]
    sortColumns: Record<string, string>
    defaultSort: string
    filterLabel: string
    fetchPage: (client: HttpClient, params: MasterListParams, signal?: AbortSignal) => Promise<MasterPage<T>>
    save: (client: HttpClient, row: T | null, values: Values) => Promise<unknown>
    remove: (client: HttpClient, id: number) => Promise<void>
}
function errorContent(error: unknown) {
    const api = error instanceof ApiError ? error : undefined
    return <><p>{api?.message ?? '요청을 처리하지 못했습니다.'}</p>
        {api?.traceId && <p className="mt-1 text-xs">Trace ID: {api.traceId}</p>}
        {api?.errors?.map(e => <p key={`${e.field}-${e.reason}`}>{e.field}: {e.reason}</p>)}</>
}
export default function MasterDataPage<T extends { id: number }>(props: Props<T>) {
    const { core, user } = useAuth()
    const client = useQueryClient()
    const selection = useItemSelection()
    const [keyword, setKeyword] = useState('')
    const [page, setPage] = useState(1)
    const [size, setSize] = useState(10)
    const [itemId, setItemId] = useState('')
    const [sortColumn, setSortColumn] = useState(props.defaultSort)
    const [direction, setDirection] = useState<'asc' | 'desc'>('asc')
    const [formOpen, setFormOpen] = useState(false)
    const [editing, setEditing] = useState<T | null>(null)
    const [values, setValues] = useState<Values>(props.initialValues)
    const [deleteTarget, setDeleteTarget] = useState<T | null>(null)
    const [notice, setNotice] = useState('')
    const query = useQuery({ queryKey: [props.resource, { keyword, page, size, itemId, sortColumn, direction }],
        queryFn: async ({ signal }) => {
            const result = await props.fetchPage(core, { keyword, page: page - 1, size,
                sort: `${props.sortColumns[sortColumn]},${direction}`, itemId: itemId ? Number(itemId) : undefined }, signal)
            if (!signal.aborted && page > Math.max(1, result.totalPages)) setPage(Math.max(1, result.totalPages))
            return result
        } })
    const save = useMutation({ mutationFn: () => props.save(core, editing, values),
        onSuccess: async () => {
            await client.invalidateQueries({ queryKey: [props.resource] })
            setFormOpen(false)
            setNotice(`${props.name}을 ${editing ? '수정' : '등록'}했습니다.`)
        } })
    const remove = useMutation({ mutationFn: (row: T) => props.remove(core, row.id),
        onSuccess: async () => {
            await client.invalidateQueries({ queryKey: [props.resource] })
            setDeleteTarget(null)
            setNotice(`${props.name}을 삭제했습니다.`)
        } })
    const openForm = (row: T | null) => {
        setEditing(row)
        setValues(row ? props.toValues(row) : { ...props.initialValues })
        save.reset()
        setNotice('')
        setFormOpen(true)
    }
    const roles = user?.roles ?? []
    const columns: DataTableColumn<T>[] = [...props.columns, {
        key: 'actions', label: '관리', sortable: false,
        render: row => <div className="flex justify-end gap-1">
            <Authorize roles={roles} anyOf={['ADMIN', 'PRODUCTION']}>
                <RowActions onEdit={() => openForm(row)} />
            </Authorize>
            <Authorize roles={roles} anyOf={['ADMIN']}>
                <RowActions onDelete={() => { remove.reset(); setNotice(''); setDeleteTarget(row) }} />
            </Authorize>
        </div>,
    }]
    return <>
        {notice && <div role="status" className="mb-4 text-hud-accent-success">{notice}</div>}
        {selection.status}
        <DataTable<T> title={props.title} subtitle={`총 ${query.data?.totalElements ?? 0}건 · ${props.subtitle}`}
            columns={columns} data={query.data?.rows ?? []} rowKey="id" searchPlaceholder="품번, 품목명 검색..."
            filter={<select aria-label={props.filterLabel} value={itemId}
                onChange={e => { setItemId(e.target.value); setPage(1) }}
                className="bg-hud-bg-primary border border-hud-border-secondary rounded-lg px-3 py-2 text-sm">
                <option value="">전체 품목</option>
                {selection.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>}
            toolbar={<Authorize roles={roles} anyOf={['ADMIN', 'PRODUCTION']}>
                <Button variant="primary" leftIcon={<Plus size={18} />} disabled={!selection.ready} onClick={() => openForm(null)}>
                    {props.name} 등록
                </Button>
            </Authorize>}
            remote={{ searchQuery: keyword, currentPage: page, rowsPerPage: size,
                totalElements: query.data?.totalElements ?? 0, totalPages: query.data?.totalPages ?? 0,
                sortColumn, sortDirection: direction,
                onSearchQueryChange: value => { setKeyword(value); setPage(1) }, onPageChange: setPage,
                onRowsPerPageChange: value => { setSize(value); setPage(1) },
                onSortChange: (column, dir) => {
                    if (props.sortColumns[column]) { setSortColumn(column); setDirection(dir); setPage(1) }
                } }}
            asyncState={{ isLoading: query.isPending, error: query.error, onRetry: () => { void query.refetch() },
                emptyMessage: '검색 결과가 없습니다.' }} />
        <FormModal isOpen={formOpen} onClose={() => { if (!save.isPending) setFormOpen(false) }}
            title={`${props.name} ${editing ? '수정' : '등록'}`} subtitle={props.subtitle}
            fields={props.fields(editing !== null, selection.items)} values={values}
            onChange={(key, value) => { setValues(v => ({ ...v, [key]: value })); save.reset() }}
            onSubmit={() => { if (!save.isPending) save.mutate() }} submitLabel={editing ? '저장' : '등록'}
            isSubmitting={save.isPending} error={save.error ? errorContent(save.error) : undefined} />
        {deleteTarget && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4">
            <div role="alertdialog" aria-modal="true" aria-label={`${props.name} 삭제`}
                className="w-full max-w-md rounded-lg bg-hud-bg-secondary border border-hud-border-secondary p-6">
                <h2 className="text-lg">{props.name} 삭제</h2>
                <p className="my-4">{props.code(deleteTarget)}을 삭제하시겠습니까?</p>
                {remove.error && <div role="alert" className="text-hud-accent-danger">{errorContent(remove.error)}</div>}
                <div className="flex justify-end gap-3 mt-4">
                    <Button variant="ghost" disabled={remove.isPending} onClick={() => setDeleteTarget(null)}>취소</Button>
                    <Button variant="danger" disabled={remove.isPending}
                        onClick={() => { if (!remove.isPending) remove.mutate(deleteTarget) }}>삭제 확인</Button>
                </div>
            </div>
        </div>}
    </>
}
