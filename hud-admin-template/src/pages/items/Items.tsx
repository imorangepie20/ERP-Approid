import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import {
    fetchItemPage,
    isItemSortColumn,
    isItemType,
    type ItemRow,
    type ItemSortColumn,
    type ItemType,
    type SortDirection,
} from '../../api/items'
import { Authorize } from '../../auth/authorization'
import { useAuth } from '../../auth/AuthContext'
import Button from '../../components/common/Button'
import DataTable, { type DataTableColumn } from '../../components/common/DataTable'
import RowActions from '../../components/common/RowActions'
import StatusBadge from '../../components/common/StatusBadge'

const SEARCH_DEBOUNCE_MS = 300
const WRITE_DEFERRED_MESSAGE = '다음 단계에서 지원'

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
    const roles = useMemo(() => user?.roles ?? [], [user?.roles])
    const [searchQuery, setSearchQuery] = useState('')
    const debouncedSearchQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS)
    const [currentPage, setCurrentPage] = useState(1)
    const [rowsPerPage, setRowsPerPage] = useState(10)
    const [itemType, setItemType] = useState<ItemType | ''>('')
    const [sortColumn, setSortColumn] = useState<ItemSortColumn>('itemNo')
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

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
            render: () => (
                <Authorize roles={roles} anyOf={['ADMIN']}>
                    <RowActions
                        onEdit={() => undefined}
                        onDelete={() => undefined}
                        disabled
                        disabledReason={WRITE_DEFERRED_MESSAGE}
                    />
                </Authorize>
            ),
        },
    ], [roles])

    return (
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
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-hud-text-muted">쓰기 기능은 다음 단계에서 지원합니다.</span>
                        <Button
                            variant="primary"
                            glow
                            leftIcon={<Plus size={18} />}
                            disabled
                            title={WRITE_DEFERRED_MESSAGE}
                        >
                            품목 등록
                        </Button>
                    </div>
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
    )
}

export default Items
