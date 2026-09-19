import { useState } from 'react'
import { Clock, Check, ChefHat, AlertTriangle } from 'lucide-react'
import HudCard from '../../components/common/HudCard'
import Button from '../../components/common/Button'

interface Order {
    id: string
    table: string
    items: { name: string; quantity: number; notes?: string }[]
    time: string
    status: 'pending' | 'cooking' | 'ready'
    priority: 'normal' | 'high'
}

const initialOrders: Order[] = [
    {
        id: 'ORD-001',
        table: 'Table 5',
        items: [
            { name: 'Grilled Salmon', quantity: 2, notes: 'No onions' },
            { name: 'Caesar Salad', quantity: 1 },
            { name: 'French Fries', quantity: 2 }
        ],
        time: '2 min ago',
        status: 'pending',
        priority: 'high'
    },
    {
        id: 'ORD-002',
        table: 'Table 3',
        items: [
            { name: 'Beef Steak', quantity: 1, notes: 'Medium rare' },
            { name: 'Pasta Carbonara', quantity: 1 }
        ],
        time: '5 min ago',
        status: 'cooking',
        priority: 'normal'
    },
    {
        id: 'ORD-003',
        table: 'Table 8',
        items: [
            { name: 'Chicken Wings', quantity: 2 },
            { name: 'French Fries', quantity: 1 }
        ],
        time: '8 min ago',
        status: 'cooking',
        priority: 'normal'
    },
    {
        id: 'ORD-004',
        table: 'Table 1',
        items: [
            { name: 'Grilled Salmon', quantity: 1 },
            { name: 'Caesar Salad', quantity: 2 }
        ],
        time: '12 min ago',
        status: 'ready',
        priority: 'normal'
    },
]

const statusColors = {
    pending: 'bg-hud-accent-warning/10 text-hud-accent-warning border-hud-accent-warning',
    cooking: 'bg-hud-accent-info/10 text-hud-accent-info border-hud-accent-info',
    ready: 'bg-hud-accent-success/10 text-hud-accent-success border-hud-accent-success',
}

const PosKitchenOrder = () => {
    const [orders, setOrders] = useState<Order[]>(initialOrders)

    const updateOrderStatus = (orderId: string, newStatus: Order['status']) => {
        setOrders(prev =>
            prev.map(order =>
                order.id === orderId ? { ...order, status: newStatus } : order
            )
        )
    }

    const getNextStatus = (status: Order['status']): Order['status'] | null => {
        if (status === 'pending') return 'cooking'
        if (status === 'cooking') return 'ready'
        return null
    }

    const pendingOrders = orders.filter(o => o.status === 'pending')
    const cookingOrders = orders.filter(o => o.status === 'cooking')
    const readyOrders = orders.filter(o => o.status === 'ready')

    const OrderCard = ({ order }: { order: Order }) => (
        <div className={`hud-card hud-card-bottom rounded-lg p-4 ${order.priority === 'high' ? 'border-hud-accent-danger' : ''}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="font-mono text-hud-accent-primary">{order.id}</span>
                    {order.priority === 'high' && (
                        <AlertTriangle size={16} className="text-hud-accent-danger" />
                    )}
                </div>
                <span className={`px-2 py-1 rounded text-xs border ${statusColors[order.status]}`}>
                    {order.status.toUpperCase()}
                </span>
            </div>

            <div className="mb-3">
                <p className="text-sm text-hud-text-secondary">{order.table}</p>
                <div className="flex items-center gap-1 text-xs text-hud-text-muted mt-1">
                    <Clock size={12} />
                    <span>{order.time}</span>
                </div>
            </div>

            <div className="space-y-2 mb-4">
                {order.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                        <span className="w-6 h-6 bg-hud-bg-primary rounded flex items-center justify-center text-xs text-hud-accent-primary font-mono">
                            {item.quantity}x
                        </span>
                        <div>
                            <p className="text-sm text-hud-text-primary">{item.name}</p>
                            {item.notes && (
                                <p className="text-xs text-hud-accent-warning">Note: {item.notes}</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {order.status !== 'ready' && (
                <Button
                    variant={order.status === 'pending' ? 'primary' : 'outline'}
                    fullWidth
                    size="sm"
                    leftIcon={order.status === 'pending' ? <ChefHat size={16} /> : <Check size={16} />}
                    onClick={() => {
                        const next = getNextStatus(order.status)
                        if (next) updateOrderStatus(order.id, next)
                    }}
                >
                    {order.status === 'pending' ? 'Start Cooking' : 'Mark Ready'}
                </Button>
            )}
        </div>
    )

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-hud-text-primary flex items-center gap-2">
                        <ChefHat className="text-hud-accent-primary" size={24} />
                        Kitchen Orders
                    </h1>
                    <p className="text-hud-text-muted mt-1">Manage incoming orders and preparation status.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-center">
                        <p className="text-2xl font-bold text-hud-accent-warning font-mono">{pendingOrders.length}</p>
                        <p className="text-xs text-hud-text-muted">Pending</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-hud-accent-info font-mono">{cookingOrders.length}</p>
                        <p className="text-xs text-hud-text-muted">Cooking</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-hud-accent-success font-mono">{readyOrders.length}</p>
                        <p className="text-xs text-hud-text-muted">Ready</p>
                    </div>
                </div>
            </div>

            {/* Kanban Board */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Pending */}
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-3 h-3 rounded-full bg-hud-accent-warning" />
                        <h2 className="font-semibold text-hud-text-primary">Pending</h2>
                        <span className="text-xs text-hud-text-muted">({pendingOrders.length})</span>
                    </div>
                    <div className="space-y-4">
                        {pendingOrders.map(order => (
                            <OrderCard key={order.id} order={order} />
                        ))}
                    </div>
                </div>

                {/* Cooking */}
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-3 h-3 rounded-full bg-hud-accent-info" />
                        <h2 className="font-semibold text-hud-text-primary">Cooking</h2>
                        <span className="text-xs text-hud-text-muted">({cookingOrders.length})</span>
                    </div>
                    <div className="space-y-4">
                        {cookingOrders.map(order => (
                            <OrderCard key={order.id} order={order} />
                        ))}
                    </div>
                </div>

                {/* Ready */}
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-3 h-3 rounded-full bg-hud-accent-success" />
                        <h2 className="font-semibold text-hud-text-primary">Ready</h2>
                        <span className="text-xs text-hud-text-muted">({readyOrders.length})</span>
                    </div>
                    <div className="space-y-4">
                        {readyOrders.map(order => (
                            <OrderCard key={order.id} order={order} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PosKitchenOrder
