import { useState } from 'react'
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, Filter, Columns } from 'lucide-react'
import HudCard from '../../components/common/HudCard'
import Button from '../../components/common/Button'

const tableData = Array.from({ length: 50 }, (_, i) => ({
    id: i + 1,
    name: ['John Doe', 'Jane Smith', 'Bob Johnson', 'Alice Brown', 'Charlie Wilson'][i % 5],
    email: `user${i + 1}@example.com`,
    department: ['Engineering', 'Marketing', 'Sales', 'HR', 'Design'][i % 5],
    salary: `$${(50000 + (i * 1000)).toLocaleString()}`,
    startDate: `2024-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
    status: ['Active', 'Active', 'Active', 'Inactive', 'Pending'][i % 5],
}))

const TablePlugins = () => {
    const [searchQuery, setSearchQuery] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [rowsPerPage, setRowsPerPage] = useState(10)
    const [sortColumn, setSortColumn] = useState<string | null>(null)
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

    // Filter data based on search
    const filteredData = tableData.filter(row =>
        row.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.department.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Sort data
    const sortedData = [...filteredData].sort((a, b) => {
        if (!sortColumn) return 0
        const aValue = a[sortColumn as keyof typeof a]
        const bValue = b[sortColumn as keyof typeof b]
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
        return 0
    })

    // Paginate data
    const totalPages = Math.ceil(sortedData.length / rowsPerPage)
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

    const SortIcon = ({ column }: { column: string }) => (
        <span className={`ml-1 ${sortColumn === column ? 'text-hud-accent-primary' : 'text-hud-text-muted'}`}>
            {sortColumn === column && sortDirection === 'asc' ? '↑' : '↓'}
        </span>
    )

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-hud-text-primary">Table Plugins</h1>
                <p className="text-hud-text-muted mt-1">Advanced data table with search, sort, and pagination.</p>
            </div>

            {/* DataTable */}
            <HudCard noPadding>
                {/* Toolbar */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 border-b border-hud-border-secondary">
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-hud-text-secondary">Show</span>
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
                        <span className="text-sm text-hud-text-secondary">entries</span>
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
                                placeholder="Search..."
                                className="w-full pl-9 pr-4 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                            />
                        </div>
                        <Button variant="outline" size="sm" leftIcon={<Filter size={14} />}>
                            Filter
                        </Button>
                        <Button variant="outline" size="sm" leftIcon={<Download size={14} />}>
                            Export
                        </Button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-hud-border-secondary bg-hud-bg-primary">
                                <th className="text-left px-4 py-3 text-xs font-medium text-hud-text-muted uppercase">
                                    <input type="checkbox" className="w-4 h-4 rounded" />
                                </th>
                                {['id', 'name', 'email', 'department', 'salary', 'startDate', 'status'].map((col) => (
                                    <th
                                        key={col}
                                        onClick={() => handleSort(col)}
                                        className="text-left px-4 py-3 text-xs font-medium text-hud-text-muted uppercase cursor-pointer hover:text-hud-text-primary transition-hud"
                                    >
                                        <div className="flex items-center">
                                            {col === 'startDate' ? 'Start Date' : col.charAt(0).toUpperCase() + col.slice(1)}
                                            <SortIcon column={col} />
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedData.map((row) => (
                                <tr key={row.id} className="border-b border-hud-border-secondary last:border-0 hover:bg-hud-bg-hover transition-hud">
                                    <td className="px-4 py-3">
                                        <input type="checkbox" className="w-4 h-4 rounded" />
                                    </td>
                                    <td className="px-4 py-3 text-sm text-hud-text-muted font-mono">{row.id}</td>
                                    <td className="px-4 py-3 text-sm text-hud-text-primary">{row.name}</td>
                                    <td className="px-4 py-3 text-sm text-hud-text-secondary">{row.email}</td>
                                    <td className="px-4 py-3 text-sm text-hud-text-secondary">{row.department}</td>
                                    <td className="px-4 py-3 text-sm text-hud-accent-primary font-mono">{row.salary}</td>
                                    <td className="px-4 py-3 text-sm text-hud-text-secondary">{row.startDate}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${row.status === 'Active' ? 'bg-hud-accent-success/10 text-hud-accent-success' :
                                                row.status === 'Pending' ? 'bg-hud-accent-warning/10 text-hud-accent-warning' :
                                                    'bg-hud-bg-hover text-hud-text-muted'
                                            }`}>
                                            {row.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border-t border-hud-border-secondary">
                    <div className="text-sm text-hud-text-secondary">
                        Showing {((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, sortedData.length)} of {sortedData.length} entries
                        {searchQuery && ` (filtered from ${tableData.length} total entries)`}
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
                            disabled={currentPage === totalPages}
                            className="p-2 rounded hover:bg-hud-bg-hover text-hud-text-muted hover:text-hud-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-hud"
                        >
                            <ChevronRight size={16} />
                        </button>
                        <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
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

export default TablePlugins
