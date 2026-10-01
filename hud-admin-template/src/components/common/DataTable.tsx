import { useState, useMemo, ReactNode } from 'react'
import {
    Search,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Download,
    Filter,
} from 'lucide-react'
import HudCard from './HudCard'
import Button from './Button'
import { AsyncState, type AsyncStateProps } from './AsyncState'

export type DataTableSortDirection = 'asc' | 'desc'

export interface DataTableColumn<T> {
    key: string
    label: string
    render?: (row: T) => ReactNode
    sortable?: boolean
    className?: string
}

export interface DataTableRemoteState {
    searchQuery: string
    currentPage: number
    rowsPerPage: number
    totalElements: number
    totalPages: number
    sortColumn: string | null
    sortDirection: DataTableSortDirection
    onSearchQueryChange: (value: string) => void
    onPageChange: (page: number) => void
    onRowsPerPageChange: (size: number) => void
    onSortChange?: (column: string, direction: DataTableSortDirection) => void
}

type DataTableAsyncState = Pick<AsyncStateProps, 'isLoading' | 'error' | 'onRetry' | 'loadingMessage' | 'emptyMessage'>

interface DataTableProps<T extends Record<string, any>> {
    title?: string
    subtitle?: string
    columns: DataTableColumn<T>[]
    data: T[]
    rowKey: string
    searchPlaceholder?: string
    initialPageSize?: number
    toolbar?: ReactNode
    filter?: ReactNode
    remote?: DataTableRemoteState
    asyncState?: DataTableAsyncState
}

function DataTable<T extends Record<string, any>>({
    title,
    subtitle,
    columns,
    data,
    rowKey,
    searchPlaceholder = '검색...',
    initialPageSize = 10,
    toolbar,
    filter,
    remote,
    asyncState,
}: DataTableProps<T>) {
    const [searchQuery, setSearchQuery] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [rowsPerPage, setRowsPerPage] = useState(initialPageSize)
    const [sortColumn, setSortColumn] = useState<string | null>(null)
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

    const effectiveSearchQuery = remote?.searchQuery ?? searchQuery
    const effectiveCurrentPage = remote?.currentPage ?? currentPage
    const effectiveRowsPerPage = remote?.rowsPerPage ?? rowsPerPage
    const effectiveSortColumn = remote?.sortColumn ?? sortColumn
    const effectiveSortDirection = remote?.sortDirection ?? sortDirection

    const filteredData = useMemo(() => {
        if (remote) return data
        if (!searchQuery.trim()) return data
        const q = searchQuery.toLowerCase()
        return data.filter(row =>
            columns.some(col => {
                const raw = row[col.key]
                return raw !== undefined && raw !== null && String(raw).toLowerCase().includes(q)
            })
        )
    }, [data, searchQuery, columns, remote])

    const sortedData = useMemo(() => {
        if (remote || !sortColumn) return filteredData
        return [...filteredData].sort((a, b) => {
            const aValue = a[sortColumn]
            const bValue = b[sortColumn]
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
            }
            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
            return 0
        })
    }, [filteredData, sortColumn, sortDirection, remote])

    const totalPages = Math.max(1, remote?.totalPages ?? Math.ceil(sortedData.length / rowsPerPage))
    const paginatedData = remote
        ? sortedData
        : sortedData.slice(
            (currentPage - 1) * rowsPerPage,
            currentPage * rowsPerPage,
        )
    const totalElements = remote?.totalElements ?? sortedData.length

    const handleSort = (column: string) => {
        if (remote) {
            if (!remote.onSortChange) return
            remote.onSortChange(
                column,
                effectiveSortColumn === column && effectiveSortDirection === 'asc' ? 'desc' : 'asc',
            )
            return
        }
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
        } else {
            setSortColumn(column)
            setSortDirection('asc')
        }
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {title && (
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-hud-text-primary">{title}</h1>
                        {subtitle && (
                            <p className="text-hud-text-muted mt-1">{subtitle}</p>
                        )}
                    </div>
                    {toolbar}
                </div>
            )}

            <HudCard noPadding>
                {/* Toolbar */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 border-b border-hud-border-secondary">
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-hud-text-secondary">표시</span>
                        <select
                            aria-label="페이지당 표시 건수"
                            value={effectiveRowsPerPage}
                            onChange={(e) => {
                                const size = Number(e.target.value)
                                if (remote) {
                                    remote.onRowsPerPageChange(size)
                                } else {
                                    setRowsPerPage(size)
                                    setCurrentPage(1)
                                }
                            }}
                            className="px-3 py-1.5 bg-hud-bg-primary border border-hud-border-secondary rounded text-sm text-hud-text-primary focus:outline-none focus:border-hud-accent-primary"
                        >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                        </select>
                        <span className="text-sm text-hud-text-secondary">건</span>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-hud-text-muted" size={16} />
                            <input
                                type="text"
                                value={effectiveSearchQuery}
                                onChange={(e) => {
                                    if (remote) {
                                        remote.onSearchQueryChange(e.target.value)
                                    } else {
                                        setSearchQuery(e.target.value)
                                        setCurrentPage(1)
                                    }
                                }}
                                placeholder={searchPlaceholder}
                                className="w-full pl-9 pr-4 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                            />
                        </div>
                        {filter ?? (
                            <Button variant="outline" size="sm" leftIcon={<Filter size={14} />}>
                                필터
                            </Button>
                        )}
                        <Button variant="outline" size="sm" leftIcon={<Download size={14} />}>
                            내보내기
                        </Button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-hud-border-secondary bg-hud-bg-primary">
                                {columns.map((col) => {
                                    const sortable = col.sortable !== false && (!remote || !!remote.onSortChange)
                                    const activeSort = effectiveSortColumn === col.key
                                    const ariaSort = sortable
                                        ? activeSort
                                            ? effectiveSortDirection === 'asc' ? 'ascending' : 'descending'
                                            : 'none'
                                        : undefined
                                    return (
                                    <th
                                        key={col.key}
                                        aria-label={col.label}
                                        aria-sort={ariaSort}
                                        className={`text-left px-4 py-3 text-xs font-medium text-hud-text-muted uppercase tracking-wider transition-hud ${col.className ?? ''}`}
                                    >
                                        {sortable ? (
                                            <button
                                                type="button"
                                                aria-label={`${col.label} 정렬`}
                                                onClick={() => handleSort(col.key)}
                                                className="flex items-center gap-1 hover:text-hud-text-primary"
                                            >
                                                <span aria-hidden="true">{col.label}</span>
                                                <span aria-hidden="true" className={activeSort ? 'text-hud-accent-primary' : 'text-hud-text-muted'}>
                                                    {activeSort && effectiveSortDirection === 'asc' ? '↑' : '↓'}
                                                </span>
                                            </button>
                                        ) : (
                                            <span>{col.label}</span>
                                        )}
                                    </th>
                                    )
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {asyncState?.isLoading || asyncState?.error || paginatedData.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length}>
                                        <AsyncState
                                            isLoading={asyncState?.isLoading}
                                            error={asyncState?.error}
                                            onRetry={asyncState?.onRetry}
                                            loadingMessage={asyncState?.loadingMessage}
                                            isEmpty={!asyncState?.isLoading && !asyncState?.error && paginatedData.length === 0}
                                            emptyMessage={asyncState?.emptyMessage ?? '데이터가 없습니다.'}
                                        />
                                    </td>
                                </tr>
                            ) : (
                                paginatedData.map((row) => (
                                    <tr key={row[rowKey]} className="border-b border-hud-border-secondary last:border-0 hover:bg-hud-bg-hover transition-hud">
                                        {columns.map((col) => (
                                            <td key={col.key} className={`px-4 py-3 text-sm text-hud-text-secondary ${col.className ?? ''}`}>
                                                {col.render ? col.render(row) : String(row[col.key] ?? '')}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border-t border-hud-border-secondary">
                    <div className="text-sm text-hud-text-secondary">
                        {totalElements > 0
                            ? `${((effectiveCurrentPage - 1) * effectiveRowsPerPage) + 1}~${Math.min(((effectiveCurrentPage - 1) * effectiveRowsPerPage) + paginatedData.length, totalElements)} / 총 ${totalElements}건`
                            : '데이터 없음'}
                        {!remote && searchQuery && ` (필터됨: 원본 ${data.length}건)`}
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            aria-label="첫 페이지"
                            onClick={() => remote ? remote.onPageChange(1) : setCurrentPage(1)}
                            disabled={effectiveCurrentPage === 1}
                            className="p-2 rounded hover:bg-hud-bg-hover text-hud-text-muted hover:text-hud-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-hud"
                        >
                            <ChevronsLeft size={16} />
                        </button>
                        <button
                            type="button"
                            aria-label="이전 페이지"
                            onClick={() => remote ? remote.onPageChange(Math.max(1, effectiveCurrentPage - 1)) : setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={effectiveCurrentPage === 1}
                            className="p-2 rounded hover:bg-hud-bg-hover text-hud-text-muted hover:text-hud-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-hud"
                        >
                            <ChevronLeft size={16} />
                        </button>

                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum = i + 1
                            if (totalPages > 5) {
                                if (effectiveCurrentPage > 3) {
                                    pageNum = effectiveCurrentPage - 2 + i
                                }
                                if (effectiveCurrentPage > totalPages - 2) {
                                    pageNum = totalPages - 4 + i
                                }
                            }
                            return (
                                <button
                                    key={pageNum}
                                    type="button"
                                    onClick={() => remote ? remote.onPageChange(pageNum) : setCurrentPage(pageNum)}
                                    className={`w-8 h-8 rounded text-sm transition-hud ${effectiveCurrentPage === pageNum
                                        ? 'bg-hud-accent-primary text-hud-bg-primary'
                                        : 'hover:bg-hud-bg-hover text-hud-text-secondary hover:text-hud-text-primary'
                                        }`}
                                >
                                    {pageNum}
                                </button>
                            )
                        })}

                        <button
                            type="button"
                            aria-label="다음 페이지"
                            onClick={() => remote ? remote.onPageChange(Math.min(totalPages, effectiveCurrentPage + 1)) : setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={effectiveCurrentPage === totalPages || totalElements === 0}
                            className="p-2 rounded hover:bg-hud-bg-hover text-hud-text-muted hover:text-hud-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-hud"
                        >
                            <ChevronRight size={16} />
                        </button>
                        <button
                            type="button"
                            aria-label="마지막 페이지"
                            onClick={() => remote ? remote.onPageChange(totalPages) : setCurrentPage(totalPages)}
                            disabled={effectiveCurrentPage === totalPages || totalElements === 0}
                            className="p-2 rounded hover:bg-hud-bg-hover text-hud-text-muted hover:text-hud-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-hud"
                        >
                            <ChevronsRight size={16} />
                        </button>
                    </div>
                </div>
            </HudCard>
        </div>
    )
}

export default DataTable
