import { ArrowUpDown, ChevronDown, ChevronUp, MoreVertical, Edit, Trash2, Eye } from 'lucide-react'
import HudCard from '../../components/common/HudCard'

const basicTableData = [
    { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin', status: 'Active' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'Editor', status: 'Active' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'Viewer', status: 'Inactive' },
    { id: 4, name: 'Alice Brown', email: 'alice@example.com', role: 'Admin', status: 'Active' },
    { id: 5, name: 'Charlie Wilson', email: 'charlie@example.com', role: 'Editor', status: 'Pending' },
]

const stripedTableData = [
    { product: 'MacBook Pro', category: 'Electronics', price: '$2,499', stock: 45 },
    { product: 'iPhone 15 Pro', category: 'Electronics', price: '$999', stock: 120 },
    { product: 'AirPods Pro', category: 'Accessories', price: '$249', stock: 200 },
    { product: 'Magic Keyboard', category: 'Accessories', price: '$299', stock: 75 },
    { product: 'iPad Pro', category: 'Electronics', price: '$1,099', stock: 60 },
    { product: 'Apple Watch', category: 'Electronics', price: '$399', stock: 150 },
]

const TableElements = () => {
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-hud-text-primary">Table Elements</h1>
                <p className="text-hud-text-muted mt-1">Various table styles and layouts.</p>
            </div>

            {/* Basic Table */}
            <HudCard title="Basic Table" subtitle="Simple table with minimal styling" noPadding>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-hud-border-secondary bg-hud-bg-primary">
                                <th className="text-left px-5 py-3 text-xs font-medium text-hud-text-muted uppercase">#</th>
                                <th className="text-left px-5 py-3 text-xs font-medium text-hud-text-muted uppercase">Name</th>
                                <th className="text-left px-5 py-3 text-xs font-medium text-hud-text-muted uppercase">Email</th>
                                <th className="text-left px-5 py-3 text-xs font-medium text-hud-text-muted uppercase">Role</th>
                                <th className="text-left px-5 py-3 text-xs font-medium text-hud-text-muted uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {basicTableData.map((row) => (
                                <tr key={row.id} className="border-b border-hud-border-secondary last:border-0">
                                    <td className="px-5 py-4 text-sm text-hud-text-muted">{row.id}</td>
                                    <td className="px-5 py-4 text-sm text-hud-text-primary">{row.name}</td>
                                    <td className="px-5 py-4 text-sm text-hud-text-secondary">{row.email}</td>
                                    <td className="px-5 py-4 text-sm text-hud-text-secondary">{row.role}</td>
                                    <td className="px-5 py-4">
                                        <span className={`inline-flex px-2.5 py-1 rounded text-xs font-medium ${row.status === 'Active' ? 'bg-hud-accent-success/10 text-hud-accent-success' :
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
            </HudCard>

            {/* Striped Table */}
            <HudCard title="Striped Table" subtitle="Alternating row colors for better readability" noPadding>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-hud-border-secondary">
                                <th className="text-left px-5 py-3 text-xs font-medium text-hud-text-muted uppercase">Product</th>
                                <th className="text-left px-5 py-3 text-xs font-medium text-hud-text-muted uppercase">Category</th>
                                <th className="text-right px-5 py-3 text-xs font-medium text-hud-text-muted uppercase">Price</th>
                                <th className="text-right px-5 py-3 text-xs font-medium text-hud-text-muted uppercase">Stock</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stripedTableData.map((row, i) => (
                                <tr key={i} className={`border-b border-hud-border-secondary last:border-0 ${i % 2 === 0 ? 'bg-hud-bg-primary/50' : ''}`}>
                                    <td className="px-5 py-4 text-sm text-hud-text-primary">{row.product}</td>
                                    <td className="px-5 py-4 text-sm text-hud-text-secondary">{row.category}</td>
                                    <td className="px-5 py-4 text-sm text-hud-accent-primary font-mono text-right">{row.price}</td>
                                    <td className="px-5 py-4 text-sm text-hud-text-secondary text-right">{row.stock}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </HudCard>

            {/* Hoverable Table with Actions */}
            <HudCard title="Interactive Table" subtitle="Hoverable rows with action buttons" noPadding>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-hud-border-secondary">
                                <th className="text-left px-5 py-3 text-xs font-medium text-hud-text-muted uppercase">
                                    <input type="checkbox" className="w-4 h-4 rounded" />
                                </th>
                                <th className="text-left px-5 py-3 text-xs font-medium text-hud-text-muted uppercase">
                                    <div className="flex items-center gap-1 cursor-pointer hover:text-hud-text-primary">
                                        Name <ArrowUpDown size={14} />
                                    </div>
                                </th>
                                <th className="text-left px-5 py-3 text-xs font-medium text-hud-text-muted uppercase">Email</th>
                                <th className="text-left px-5 py-3 text-xs font-medium text-hud-text-muted uppercase">Role</th>
                                <th className="text-left px-5 py-3 text-xs font-medium text-hud-text-muted uppercase">Status</th>
                                <th className="text-center px-5 py-3 text-xs font-medium text-hud-text-muted uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {basicTableData.map((row) => (
                                <tr key={row.id} className="border-b border-hud-border-secondary last:border-0 hover:bg-hud-bg-hover transition-hud">
                                    <td className="px-5 py-4">
                                        <input type="checkbox" className="w-4 h-4 rounded" />
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-hud-accent-primary to-hud-accent-info flex items-center justify-center text-xs text-hud-bg-primary font-medium">
                                                {row.name.split(' ').map(n => n[0]).join('')}
                                            </div>
                                            <span className="text-sm text-hud-text-primary">{row.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 text-sm text-hud-text-secondary">{row.email}</td>
                                    <td className="px-5 py-4">
                                        <span className={`inline-flex px-2.5 py-1 rounded text-xs font-medium ${row.role === 'Admin' ? 'bg-hud-accent-primary/10 text-hud-accent-primary' :
                                                row.role === 'Editor' ? 'bg-hud-accent-info/10 text-hud-accent-info' :
                                                    'bg-hud-bg-hover text-hud-text-muted'
                                            }`}>
                                            {row.role}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4">
                                        <span className={`inline-flex px-2.5 py-1 rounded text-xs font-medium ${row.status === 'Active' ? 'bg-hud-accent-success/10 text-hud-accent-success' :
                                                row.status === 'Pending' ? 'bg-hud-accent-warning/10 text-hud-accent-warning' :
                                                    'bg-hud-bg-hover text-hud-text-muted'
                                            }`}>
                                            {row.status}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center justify-center gap-2">
                                            <button className="p-1.5 rounded hover:bg-hud-accent-info/10 text-hud-text-muted hover:text-hud-accent-info transition-hud">
                                                <Eye size={16} />
                                            </button>
                                            <button className="p-1.5 rounded hover:bg-hud-accent-primary/10 text-hud-text-muted hover:text-hud-accent-primary transition-hud">
                                                <Edit size={16} />
                                            </button>
                                            <button className="p-1.5 rounded hover:bg-hud-accent-danger/10 text-hud-text-muted hover:text-hud-accent-danger transition-hud">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </HudCard>

            {/* Bordered Table */}
            <HudCard title="Bordered Table" subtitle="Table with visible cell borders" noPadding>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className="border border-hud-border-secondary bg-hud-bg-primary px-4 py-3 text-left text-xs font-medium text-hud-text-muted uppercase">Header 1</th>
                                <th className="border border-hud-border-secondary bg-hud-bg-primary px-4 py-3 text-left text-xs font-medium text-hud-text-muted uppercase">Header 2</th>
                                <th className="border border-hud-border-secondary bg-hud-bg-primary px-4 py-3 text-left text-xs font-medium text-hud-text-muted uppercase">Header 3</th>
                                <th className="border border-hud-border-secondary bg-hud-bg-primary px-4 py-3 text-left text-xs font-medium text-hud-text-muted uppercase">Header 4</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[1, 2, 3, 4].map((row) => (
                                <tr key={row}>
                                    <td className="border border-hud-border-secondary px-4 py-3 text-sm text-hud-text-primary">Row {row}, Cell 1</td>
                                    <td className="border border-hud-border-secondary px-4 py-3 text-sm text-hud-text-secondary">Row {row}, Cell 2</td>
                                    <td className="border border-hud-border-secondary px-4 py-3 text-sm text-hud-text-secondary">Row {row}, Cell 3</td>
                                    <td className="border border-hud-border-secondary px-4 py-3 text-sm text-hud-text-secondary">Row {row}, Cell 4</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </HudCard>

            {/* Responsive Table */}
            <HudCard title="Responsive Cards" subtitle="Table that converts to cards on mobile">
                <div className="hidden md:block overflow-x-auto -mx-5 -mb-5">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-hud-border-secondary">
                                <th className="text-left px-5 py-3 text-xs font-medium text-hud-text-muted uppercase">Product</th>
                                <th className="text-left px-5 py-3 text-xs font-medium text-hud-text-muted uppercase">Category</th>
                                <th className="text-right px-5 py-3 text-xs font-medium text-hud-text-muted uppercase">Price</th>
                                <th className="text-right px-5 py-3 text-xs font-medium text-hud-text-muted uppercase">Stock</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stripedTableData.slice(0, 3).map((row, i) => (
                                <tr key={i} className="border-b border-hud-border-secondary last:border-0">
                                    <td className="px-5 py-4 text-sm text-hud-text-primary">{row.product}</td>
                                    <td className="px-5 py-4 text-sm text-hud-text-secondary">{row.category}</td>
                                    <td className="px-5 py-4 text-sm text-hud-accent-primary font-mono text-right">{row.price}</td>
                                    <td className="px-5 py-4 text-sm text-hud-text-secondary text-right">{row.stock}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="md:hidden space-y-3">
                    {stripedTableData.slice(0, 3).map((row, i) => (
                        <div key={i} className="bg-hud-bg-primary rounded-lg p-4 space-y-2">
                            <div className="flex justify-between items-start">
                                <span className="font-medium text-hud-text-primary">{row.product}</span>
                                <span className="text-hud-accent-primary font-mono">{row.price}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-hud-text-muted">Category</span>
                                <span className="text-hud-text-secondary">{row.category}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-hud-text-muted">In Stock</span>
                                <span className="text-hud-text-secondary">{row.stock}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </HudCard>
        </div>
    )
}

export default TableElements
