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

export interface DataTableColumn<T> {
    key: string
    label: string
    render?: (row: T) => ReactNode
    sortable?: boolean
    className?: string
}

interface DataTableProps<T extends Record<string, any>> {
    title?: string
    subtitle?: string
    columns: DataTableColumn<T>[]
    data: T[]
    rowKey: string
    searchPlaceholder?: string
    initialPageSize?: number
    toolbar?: ReactNode
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
}: DataTableProps<T>) {
    const [searchQuery, setSearchQuery] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [rowsPerPage, setRowsPerPage] = useState(initialPageSize)
    const [sortColumn, setSortColumn] = useState<string | null>(null)
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

    const filteredData = useMemo(() => {
        if (!searchQuery.trim()) return data
        const q = searchQuery.toLowerCase()
        return data.filter(row =>
            columns.some(col => {
                const raw = row[col.key]
                return raw !== undefined && raw !== null && String(raw).toLowerCase().includes(q)
            })
        )
    }, [data, searchQuery, columns])

    const sortedData = useMemo(() => {
        if (!sortColumn) return filteredData
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
    }, [filteredData, sortColumn, sortDirection])

    const totalPages = Math.max(1, Math.ceil(sortedData.length / rowsPerPage))
    const paginatedData = sortedData.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
    )

    const handleSort = (column: string) => {
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
                            value={rowsPerPage}
                            onChange={(e) => {
                                setRowsPerPage(Number(e.target.value))
                                setCurrentPage(1)
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
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value)
                                    setCurrentPage(1)
                                }}
                                placeholder={searchPlaceholder}
                                className="w-full pl-9 pr-4 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                            />
                        </div>
                        <Button variant="outline" size="sm" leftIcon={<Filter size={14} />}>
                            필터
                        </Button>
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
                                {columns.map((col) => (
                                    <th
                                        key={col.key}
                                        onClick={() => col.sortable !== false && handleSort(col.key)}
                                        className={`text-left px-4 py-3 text-xs font-medium text-hud-text-muted uppercase tracking-wider ${col.sortable !== false ? 'cursor-pointer hover:text-hud-text-primary' : ''} transition-hud ${col.className ?? ''}`}
                                    >
                                        <div className="flex items-center gap-1">
                                            {col.label}
                                            {col.sortable !== false && (
                                                <span className={`${sortColumn === col.key ? 'text-hud-accent-primary' : 'text-hud-text-muted'}`}>
                                                    {sortColumn === col.key && sortDirection === 'asc' ? '↑' : '↓'}
                                                </span>
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedData.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-hud-text-muted">
                                        데이터가 없습니다.
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
                        {sortedData.length > 0
                            ? `${((currentPage - 1) * rowsPerPage) + 1}~${Math.min(currentPage * rowsPerPage, sortedData.length)} / 총 ${sortedData.length}건`
                            : '데이터 없음'}
                        {searchQuery && ` (필터됨: 원본 ${data.length}건)`}
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="p-2 rounded hover:bg-hud-bg-hover text-hud-text-muted hover:text-hud-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-hud"
                        >
                            <ChevronsLeft size={16} />
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded hover:bg-hud-bg-hover text-hud-text-muted hover:text-hud-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-hud"
                        >
                            <ChevronLeft size={16} />
                        </button>

                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum = i + 1
                            if (totalPages > 5) {
                                if (currentPage > 3) {
                                    pageNum = currentPage - 2 + i
                                }
                                if (currentPage > totalPages - 2) {
                                    pageNum = totalPages - 4 + i
                                }
                            }
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => setCurrentPage(pageNum)}
                                    className={`w-8 h-8 rounded text-sm transition-hud ${currentPage === pageNum
                                        ? 'bg-hud-accent-primary text-hud-bg-primary'
                                        : 'hover:bg-hud-bg-hover text-hud-text-secondary hover:text-hud-text-primary'
                                        }`}
                                >
                                    {pageNum}
                                </button>
                            )
                        })}

                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="p-2 rounded hover:bg-hud-bg-hover text-hud-text-muted hover:text-hud-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-hud"
                        >
                            <ChevronRight size={16} />
                        </button>
                        <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages || totalPages === 0}
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
