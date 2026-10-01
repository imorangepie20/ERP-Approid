import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
    createItem,
    deleteItem,
    fetchItemPage,
    isItemSortColumn,
    isItemType,
    updateItem,
    type CreateItemInput,
    type ItemRow,
    type ItemSortColumn,
    type ItemType,
    type SortDirection,
    type UpdateItemInput,
} from '../../api/items'
import { ApiError } from '../../api/http'
import { Authorize } from '../../auth/authorization'
import { useAuth } from '../../auth/AuthContext'
import Button from '../../components/common/Button'
import DataTable, { type DataTableColumn } from '../../components/common/DataTable'
import FormModal, { type ModalField } from '../../components/common/FormModal'
import RowActions from '../../components/common/RowActions'
import StatusBadge from '../../components/common/StatusBadge'

const SEARCH_DEBOUNCE_MS = 300

type ItemFormMode = 'create' | 'edit'
type ItemFormValues = Record<
    'itemNo' | 'name' | 'spec' | 'category' | 'itemType' | 'unit' | 'price' | 'safetyStock' | 'leadTimeDays',
    string
>
type SaveItemCommand =
    | { mode: 'create'; input: CreateItemInput }
    | { mode: 'edit'; id: number; input: UpdateItemInput }

const EMPTY_ITEM_FORM: ItemFormValues = {
    itemNo: '',
    name: '',
    spec: '',
    category: '',
    itemType: '',
    unit: '',
    price: '',
    safetyStock: '',
    leadTimeDays: '',
}

function toFormValues(item: ItemRow): ItemFormValues {
    return {
        itemNo: item.itemNo,
        name: item.name,
        spec: item.spec,
        category: item.category,
        itemType: item.itemType,
        unit: item.unit,
        price: String(item.price),
        safetyStock: String(item.safetyStock),
        leadTimeDays: String(item.leadTimeDays),
    }
}

function optionalNumber(value: string) {
    return value.trim() === '' ? 0 : Number(value)
}

function writeErrorContent(error: unknown) {
    const apiError = error instanceof ApiError ? error : undefined
    return (
        <>
            <p>{apiError?.message ?? '요청을 처리하지 못했습니다.'}</p>
            {apiError?.traceId && <p className="mt-1 text-xs text-hud-text-muted">Trace ID: {apiError.traceId}</p>}
            {apiError?.errors?.map(fieldError => (
                <p key={`${fieldError.field}-${fieldError.reason}`} className="mt-1 text-xs">
                    {fieldError.field}: {fieldError.reason}
                </p>
            ))}
        </>
    )
}

function formatWon(value: number) {
    return `${value.toLocaleString('ko-KR')}원`
}

function formatQuantity(value: number) {
    return value.toLocaleString('ko-KR', { maximumFractionDigits: 4 })
}

function useDebouncedValue(value: string, delay: number) {
    const [debouncedValue, setDebouncedValue] = useState(value)

    useEffect(() => {
        const timer = window.setTimeout(() => setDebouncedValue(value), delay)
        return () => window.clearTimeout(timer)
    }, [delay, value])

    return debouncedValue
}

const Items = () => {
    const { core, user } = useAuth()
    const queryClient = useQueryClient()
    const roles = useMemo(() => user?.roles ?? [], [user?.roles])
    const [searchQuery, setSearchQuery] = useState('')
    const debouncedSearchQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS)
    const [currentPage, setCurrentPage] = useState(1)
    const [rowsPerPage, setRowsPerPage] = useState(10)
    const [itemType, setItemType] = useState<ItemType | ''>('')
    const [sortColumn, setSortColumn] = useState<ItemSortColumn>('itemNo')
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
    const [formMode, setFormMode] = useState<ItemFormMode | null>(null)
    const [editingItem, setEditingItem] = useState<ItemRow | null>(null)
    const [formValues, setFormValues] = useState<ItemFormValues>(EMPTY_ITEM_FORM)
    const [formError, setFormError] = useState<unknown>(null)
    const [deleteTarget, setDeleteTarget] = useState<ItemRow | null>(null)
    const [notice, setNotice] = useState<string | null>(null)

    const saveMutation = useMutation({
        mutationFn: (command: SaveItemCommand) => command.mode === 'create'
            ? createItem(core, command.input)
            : updateItem(core, command.id, command.input),
        onSuccess: async (_saved, command) => {
            await queryClient.invalidateQueries({ queryKey: ['items'] })
            setFormMode(null)
            setEditingItem(null)
            setNotice(command.mode === 'create' ? '품목을 등록했습니다.' : '품목을 수정했습니다.')
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (item: ItemRow) => deleteItem(core, item.id),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['items'] })
            setDeleteTarget(null)
            setNotice('품목을 삭제했습니다.')
        },
    })

    const openCreate = useCallback(() => {
        saveMutation.reset()
        setFormError(null)
        setNotice(null)
        setEditingItem(null)
        setFormValues({ ...EMPTY_ITEM_FORM })
        setFormMode('create')
    }, [saveMutation])

    const openEdit = useCallback((item: ItemRow) => {
        saveMutation.reset()
        setFormError(null)
        setNotice(null)
        setEditingItem(item)
        setFormValues(toFormValues(item))
        setFormMode('edit')
    }, [saveMutation])

    const requestDelete = useCallback((item: ItemRow) => {
        deleteMutation.reset()
        setNotice(null)
        setDeleteTarget(item)
    }, [deleteMutation])

    const closeForm = useCallback(() => {
        if (saveMutation.isPending) return
        setFormMode(null)
        setEditingItem(null)
        setFormError(null)
        saveMutation.reset()
    }, [saveMutation])

    const closeDelete = useCallback(() => {
        if (deleteMutation.isPending) return
        setDeleteTarget(null)
        deleteMutation.reset()
    }, [deleteMutation])

    const query = useQuery({
        queryKey: [
            'items',
            {
                keyword: debouncedSearchQuery.trim(),
                page: currentPage - 1,
                size: rowsPerPage,
                itemType,
                sortColumn,
                sortDirection,
            },
        ],
        queryFn: async ({ signal }) => {
            const page = await fetchItemPage(core, {
                keyword: debouncedSearchQuery,
                page: currentPage - 1,
                size: rowsPerPage,
                itemType: itemType || undefined,
                sortColumn,
                sortDirection,
            }, signal)
            if (!signal.aborted && page.items.length === 0) {
                const lastValidPage = Math.max(1, page.totalPages)
                if (currentPage > lastValidPage) setCurrentPage(lastValidPage)
            }
            return page
        },
        enabled: searchQuery.trim() === debouncedSearchQuery.trim(),
    })

    const searchIsSettled = searchQuery.trim() === debouncedSearchQuery.trim()
    const activePage = searchIsSettled ? query.data : undefined
    const items = activePage?.items ?? []
    const lowStockCount = items.filter(item => item.stock < item.safetyStock).length
    const totalElements = activePage?.totalElements ?? 0
    const totalPages = activePage?.totalPages ?? 0

    const formFields = useMemo<ModalField[]>(() => [
        { key: 'itemNo', label: '품번', type: 'text', required: true, maxLength: 32, readOnly: formMode === 'edit' },
        { key: 'name', label: '품목명', type: 'text', required: true, maxLength: 128 },
        { key: 'spec', label: '규격', type: 'text', maxLength: 128 },
        { key: 'category', label: '분류', type: 'text', maxLength: 64 },
        {
            key: 'itemType',
            label: '유형',
            type: 'select',
            required: true,
            options: [
                { label: '제품', value: '제품' },
                { label: '반제품', value: '반제품' },
                { label: '자재', value: '자재' },
            ],
        },
        { key: 'unit', label: '단위', type: 'text', required: true, maxLength: 16, placeholder: 'EA, KG, M 등' },
        { key: 'price', label: '단가', type: 'number', required: true, min: 0, step: 1 },
        { key: 'safetyStock', label: '안전재고', type: 'number', min: 0, step: 0.0001 },
        { key: 'leadTimeDays', label: '리드타임(일)', type: 'number', min: 0, step: 1 },
    ], [formMode])

    const submitItem = useCallback(() => {
        const price = optionalNumber(formValues.price)
        const safetyStock = optionalNumber(formValues.safetyStock)
        const leadTimeDays = optionalNumber(formValues.leadTimeDays)
        if (
            !isItemType(formValues.itemType)
            || !Number.isSafeInteger(price)
            || price < 0
            || !Number.isFinite(safetyStock)
            || safetyStock < 0
            || !Number.isSafeInteger(leadTimeDays)
            || leadTimeDays < 0
        ) {
            setFormError(new ApiError({
                status: 0,
                code: 'INVALID_ITEM_INPUT',
                message: '품목 유형과 숫자 입력값을 확인해 주세요.',
            }))
            return
        }

        const input: UpdateItemInput = {
            name: formValues.name.trim(),
            spec: formValues.spec.trim(),
            category: formValues.category.trim(),
            itemType: formValues.itemType,
            unit: formValues.unit.trim(),
            price,
            safetyStock,
            leadTimeDays,
        }
        setFormError(null)
        if (formMode === 'create') {
            saveMutation.mutate({
                mode: 'create',
                input: { ...input, itemNo: formValues.itemNo.trim() } as CreateItemInput,
            })
        } else if (formMode === 'edit' && editingItem) {
            saveMutation.mutate({ mode: 'edit', id: editingItem.id, input })
        }
    }, [editingItem, formMode, formValues, saveMutation])

    const columns = useMemo<DataTableColumn<ItemRow>[]>(() => [
        {
            key: 'itemNo',
            label: '품번',
            render: row => <span className="font-mono text-hud-accent-primary">{row.itemNo}</span>,
        },
        {
            key: 'name',
            label: '품목',
            render: row => <span className="text-hud-text-primary">{row.name}</span>,
        },
        { key: 'spec', label: '규격' },
        {
            key: 'itemType',
            label: '유형',
            render: row => (
                <StatusBadge tone={row.itemType === '제품' ? 'primary' : row.itemType === '반제품' ? 'info' : 'muted'}>
                    {row.itemType}
                </StatusBadge>
            ),
        },
        { key: 'unit', label: '단위' },
        {
            key: 'price',
            label: '단가',
            render: row => <span className="font-mono">{formatWon(row.price)}</span>,
        },
        {
            key: 'stock',
            label: '현재고',
            render: row => (
                <span className={`font-mono ${row.stock < row.safetyStock ? 'text-hud-accent-danger' : 'text-hud-text-primary'}`}>
                    {formatQuantity(row.stock)}
                </span>
            ),
        },
        {
            key: 'safetyStock',
            label: '안전재고',
            render: row => <span className="font-mono text-hud-text-muted">{formatQuantity(row.safetyStock)}</span>,
        },
        {
            key: 'actions',
            label: '관리',
            sortable: false,
            render: row => (
                <Authorize roles={roles} anyOf={['ADMIN']}>
                    <RowActions
                        onEdit={() => openEdit(row)}
                        onDelete={() => requestDelete(row)}
                    />
                </Authorize>
            ),
        },
    ], [openEdit, requestDelete, roles])

    return (
        <>
            {notice && (
                <div role="status" aria-live="polite" className="mb-4 rounded-lg border border-hud-accent-success/40 bg-hud-accent-success/10 px-4 py-3 text-sm text-hud-accent-success">
                    {notice}
                </div>
            )}
            <DataTable<ItemRow>
            title="품목 마스터"
            subtitle={`총 ${totalElements}품목 · 현재 페이지 미달 ${lowStockCount}건`}
            columns={columns}
            data={items}
            rowKey="id"
            searchPlaceholder="품번, 품명 검색..."
            filter={(
                <select
                    aria-label="품목 유형"
                    value={itemType}
                    onChange={event => {
                        const value = event.target.value
                        if (value !== '' && !isItemType(value)) return
                        setItemType(value)
                        setCurrentPage(1)
                    }}
                    className="px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:border-hud-accent-primary"
                >
                    <option value="">전체 유형</option>
                    <option value="제품">제품</option>
                    <option value="반제품">반제품</option>
                    <option value="자재">자재</option>
                </select>
            )}
            toolbar={(
                <Authorize roles={roles} anyOf={['ADMIN']}>
                    <Button
                        variant="primary"
                        glow
                        leftIcon={<Plus size={18} />}
                        onClick={openCreate}
                    >
                        품목 등록
                    </Button>
                </Authorize>
            )}
            remote={{
                searchQuery,
                currentPage,
                rowsPerPage,
                totalElements,
                totalPages,
                sortColumn,
                sortDirection,
                onSearchQueryChange: value => {
                    setSearchQuery(value)
                    setCurrentPage(1)
                },
                onPageChange: setCurrentPage,
                onRowsPerPageChange: size => {
                    setRowsPerPage(size)
                    setCurrentPage(1)
                },
                onSortChange: (column, direction) => {
                    if (!isItemSortColumn(column)) return
                    setSortColumn(column)
                    setSortDirection(direction)
                    setCurrentPage(1)
                },
            }}
            asyncState={{
                isLoading: query.isPending || !searchIsSettled,
                error: query.error,
                onRetry: () => { void query.refetch() },
                loadingMessage: '품목을 불러오는 중...',
                emptyMessage: '검색 결과가 없습니다.',
            }}
            />

            <FormModal
                isOpen={formMode !== null}
                onClose={closeForm}
                title={formMode === 'edit' ? '품목 수정' : '품목 등록'}
                subtitle={formMode === 'edit' ? '품번은 변경할 수 없습니다.' : '새 품목의 기준 정보를 입력하세요.'}
                fields={formFields}
                values={formValues}
                onChange={(key, value) => {
                    setFormValues(current => ({ ...current, [key]: value }))
                    setFormError(null)
                    saveMutation.reset()
                }}
                onSubmit={submitItem}
                submitLabel={formMode === 'edit' ? '저장' : '등록'}
                isSubmitting={saveMutation.isPending}
                error={(formError || saveMutation.error)
                    ? writeErrorContent(formError ?? saveMutation.error)
                    : undefined}
            />

            {deleteTarget && (
                <div
                    className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                    onClick={closeDelete}
                >
                    <div
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="item-delete-title"
                        aria-describedby="item-delete-description"
                        className="w-full max-w-md rounded-lg border border-hud-border-secondary bg-hud-bg-secondary p-6 shadow-2xl"
                        onClick={event => event.stopPropagation()}
                    >
                        <h2 id="item-delete-title" className="text-lg font-semibold text-hud-text-primary">품목 삭제</h2>
                        <p id="item-delete-description" className="mt-2 text-sm text-hud-text-secondary">
                            <span className="font-mono text-hud-accent-primary">{deleteTarget.itemNo}</span>
                            {' '}{deleteTarget.name} 품목을 삭제하시겠습니까?
                        </p>
                        <p className="mt-2 text-xs text-hud-text-muted">BOM 또는 재고 이력이 있으면 서버에서 삭제를 거부합니다.</p>
                        {deleteMutation.error && (
                            <div role="alert" className="mt-4 rounded-lg border border-hud-accent-danger/40 bg-hud-accent-danger/10 px-4 py-3 text-sm text-hud-accent-danger">
                                {writeErrorContent(deleteMutation.error)}
                            </div>
                        )}
                        <div className="mt-6 flex justify-end gap-3">
                            <Button variant="ghost" type="button" onClick={closeDelete} disabled={deleteMutation.isPending}>
                                취소
                            </Button>
                            <Button
                                variant="danger"
                                type="button"
                                onClick={() => deleteMutation.mutate(deleteTarget)}
                                disabled={deleteMutation.isPending}
                            >
                                {deleteMutation.isPending ? '처리 중...' : '삭제 확인'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default Items
