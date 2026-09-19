import { useState } from 'react'
import { Search, Plus, Edit, AlertTriangle, Package } from 'lucide-react'
import HudCard from '../../components/common/HudCard'
import Button from '../../components/common/Button'

const menuItems = [
    { id: 1, name: 'Grilled Salmon', category: 'Main Course', price: 24.99, stock: 25, minStock: 10, status: 'in-stock' },
    { id: 2, name: 'Beef Steak', category: 'Main Course', price: 32.99, stock: 8, minStock: 10, status: 'low-stock' },
    { id: 3, name: 'Caesar Salad', category: 'Appetizers', price: 12.99, stock: 50, minStock: 15, status: 'in-stock' },
    { id: 4, name: 'French Fries', category: 'Appetizers', price: 6.99, stock: 100, minStock: 20, status: 'in-stock' },
    { id: 5, name: 'Coca Cola', category: 'Drinks', price: 3.99, stock: 0, minStock: 30, status: 'out-of-stock' },
    { id: 6, name: 'Fresh Juice', category: 'Drinks', price: 5.99, stock: 15, minStock: 10, status: 'in-stock' },
    { id: 7, name: 'Chocolate Cake', category: 'Desserts', price: 8.99, stock: 5, minStock: 8, status: 'low-stock' },
    { id: 8, name: 'Ice Cream', category: 'Desserts', price: 6.99, stock: 20, minStock: 10, status: 'in-stock' },
    { id: 9, name: 'Pasta Carbonara', category: 'Main Course', price: 18.99, stock: 30, minStock: 10, status: 'in-stock' },
    { id: 10, name: 'Chicken Wings', category: 'Appetizers', price: 14.99, stock: 3, minStock: 10, status: 'low-stock' },
]

const categories = ['All', 'Main Course', 'Appetizers', 'Drinks', 'Desserts']

const getStatusBadge = (status: string) => {
    switch (status) {
        case 'in-stock':
            return 'bg-hud-accent-success/10 text-hud-accent-success'
        case 'low-stock':
            return 'bg-hud-accent-warning/10 text-hud-accent-warning'
        case 'out-of-stock':
            return 'bg-hud-accent-danger/10 text-hud-accent-danger'
        default:
            return 'bg-hud-bg-hover text-hud-text-muted'
    }
}

const PosMenuStock = () => {
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('All')

    const filteredItems = menuItems.filter((item) => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory
        return matchesSearch && matchesCategory
    })

    const lowStockCount = menuItems.filter(i => i.status === 'low-stock').length
    const outOfStockCount = menuItems.filter(i => i.status === 'out-of-stock').length

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-hud-text-primary flex items-center gap-2">
                        <Package className="text-hud-accent-primary" size={24} />
                        Menu Stock
                    </h1>
                    <p className="text-hud-text-muted mt-1">Manage inventory and stock levels.</p>
                </div>
                <Button variant="primary" glow leftIcon={<Plus size={18} />}>
                    Add Item
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="hud-card hud-card-bottom rounded-lg p-4">
                    <p className="text-sm text-hud-text-muted">Total Items</p>
                    <p className="text-2xl font-bold text-hud-text-primary mt-1 font-mono">{menuItems.length}</p>
                </div>
                <div className="hud-card hud-card-bottom rounded-lg p-4">
                    <p className="text-sm text-hud-text-muted">In Stock</p>
                    <p className="text-2xl font-bold text-hud-accent-success mt-1 font-mono">
                        {menuItems.filter(i => i.status === 'in-stock').length}
                    </p>
                </div>
                <div className="hud-card hud-card-bottom rounded-lg p-4">
                    <p className="text-sm text-hud-text-muted flex items-center gap-1">
                        Low Stock <AlertTriangle size={14} className="text-hud-accent-warning" />
                    </p>
                    <p className="text-2xl font-bold text-hud-accent-warning mt-1 font-mono">{lowStockCount}</p>
                </div>
                <div className="hud-card hud-card-bottom rounded-lg p-4">
                    <p className="text-sm text-hud-text-muted">Out of Stock</p>
                    <p className="text-2xl font-bold text-hud-accent-danger mt-1 font-mono">{outOfStockCount}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search items..."
                        className="w-full pl-10 pr-4 py-2.5 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-hud ${selectedCategory === cat
                                    ? 'bg-hud-accent-primary text-hud-bg-primary'
                                    : 'bg-hud-bg-secondary text-hud-text-secondary hover:text-hud-text-primary'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <HudCard noPadding>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-hud-border-secondary">
                                <th className="text-left px-5 py-4 text-xs font-medium text-hud-text-muted uppercase">Item</th>
                                <th className="text-left px-5 py-4 text-xs font-medium text-hud-text-muted uppercase">Category</th>
                                <th className="text-right px-5 py-4 text-xs font-medium text-hud-text-muted uppercase">Price</th>
                                <th className="text-center px-5 py-4 text-xs font-medium text-hud-text-muted uppercase">Stock</th>
                                <th className="text-center px-5 py-4 text-xs font-medium text-hud-text-muted uppercase">Min. Stock</th>
                                <th className="text-center px-5 py-4 text-xs font-medium text-hud-text-muted uppercase">Status</th>
                                <th className="text-center px-5 py-4 text-xs font-medium text-hud-text-muted uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.map((item) => (
                                <tr key={item.id} className="border-b border-hud-border-secondary last:border-0 hover:bg-hud-bg-hover transition-hud">
                                    <td className="px-5 py-4">
                                        <span className="text-sm text-hud-text-primary">{item.name}</span>
                                    </td>
                                    <td className="px-5 py-4">
                                        <span className="text-sm text-hud-text-secondary">{item.category}</span>
                                    </td>
                                    <td className="px-5 py-4 text-right">
                                        <span className="text-sm font-mono text-hud-accent-primary">${item.price.toFixed(2)}</span>
                                    </td>
                                    <td className="px-5 py-4 text-center">
                                        <span className={`text-sm font-mono ${item.stock === 0 ? 'text-hud-accent-danger' :
                                                item.stock < item.minStock ? 'text-hud-accent-warning' :
                                                    'text-hud-text-primary'
                                            }`}>
                                            {item.stock}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 text-center">
                                        <span className="text-sm font-mono text-hud-text-muted">{item.minStock}</span>
                                    </td>
                                    <td className="px-5 py-4 text-center">
                                        <span className={`inline-flex px-2.5 py-1 rounded text-xs font-medium ${getStatusBadge(item.status)}`}>
                                            {item.status.replace('-', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 text-center">
                                        <button className="p-2 rounded-lg hover:bg-hud-bg-primary text-hud-text-muted hover:text-hud-accent-primary transition-hud">
                                            <Edit size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </HudCard>
        </div>
    )
}

export default PosMenuStock
