import { useState } from 'react'
import { CreditCard, DollarSign, Wallet, Receipt, Printer, Check, QrCode } from 'lucide-react'
import HudCard from '../../components/common/HudCard'
import Button from '../../components/common/Button'

const pendingOrders = [
    {
        id: 'ORD-001',
        table: 'Table 5',
        items: [
            { name: 'Grilled Salmon', quantity: 2, price: 24.99 },
            { name: 'Caesar Salad', quantity: 1, price: 12.99 },
            { name: 'French Fries', quantity: 2, price: 6.99 },
            { name: 'Coca Cola', quantity: 2, price: 3.99 },
        ],
    },
    {
        id: 'ORD-002',
        table: 'Table 3',
        items: [
            { name: 'Beef Steak', quantity: 1, price: 32.99 },
            { name: 'Pasta Carbonara', quantity: 1, price: 18.99 },
            { name: 'Fresh Juice', quantity: 2, price: 5.99 },
        ],
    },
]

const PosCounterCheckout = () => {
    const [selectedOrder, setSelectedOrder] = useState(pendingOrders[0])
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'wallet' | null>(null)
    const [amountReceived, setAmountReceived] = useState('')

    const subtotal = selectedOrder.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const tax = subtotal * 0.1
    const total = subtotal + tax
    const change = parseFloat(amountReceived) - total

    const quickAmounts = [50, 100, 150, 200]

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            {/* Order Details */}
            <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-hud-text-primary">Counter Checkout</h1>
                        <p className="text-hud-text-muted mt-1">Process payments and complete orders.</p>
                    </div>
                </div>

                {/* Order Selection */}
                <div className="flex gap-3 overflow-x-auto pb-2">
                    {pendingOrders.map((order) => (
                        <button
                            key={order.id}
                            onClick={() => setSelectedOrder(order)}
                            className={`px-4 py-3 rounded-lg transition-hud whitespace-nowrap ${selectedOrder.id === order.id
                                    ? 'bg-hud-accent-primary text-hud-bg-primary'
                                    : 'bg-hud-bg-secondary text-hud-text-secondary hover:text-hud-text-primary'
                                }`}
                        >
                            <span className="font-mono text-sm">{order.id}</span>
                            <span className="mx-2">•</span>
                            <span className="text-sm">{order.table}</span>
                        </button>
                    ))}
                </div>

                {/* Order Items */}
                <HudCard title="Order Items" noPadding>
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-hud-border-secondary">
                                <th className="text-left px-5 py-3 text-xs font-medium text-hud-text-muted uppercase">Item</th>
                                <th className="text-center px-5 py-3 text-xs font-medium text-hud-text-muted uppercase">Qty</th>
                                <th className="text-right px-5 py-3 text-xs font-medium text-hud-text-muted uppercase">Price</th>
                                <th className="text-right px-5 py-3 text-xs font-medium text-hud-text-muted uppercase">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {selectedOrder.items.map((item, i) => (
                                <tr key={i} className="border-b border-hud-border-secondary last:border-0">
                                    <td className="px-5 py-4 text-sm text-hud-text-primary">{item.name}</td>
                                    <td className="px-5 py-4 text-sm text-hud-text-secondary text-center">{item.quantity}</td>
                                    <td className="px-5 py-4 text-sm text-hud-text-secondary text-right font-mono">${item.price.toFixed(2)}</td>
                                    <td className="px-5 py-4 text-sm text-hud-text-primary text-right font-mono">
                                        ${(item.price * item.quantity).toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </HudCard>

                {/* Payment Method */}
                <HudCard title="Payment Method">
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { id: 'cash', label: 'Cash', icon: <DollarSign size={24} /> },
                            { id: 'card', label: 'Card', icon: <CreditCard size={24} /> },
                            { id: 'wallet', label: 'E-Wallet', icon: <Wallet size={24} /> },
                        ].map((method) => (
                            <button
                                key={method.id}
                                onClick={() => setPaymentMethod(method.id as 'cash' | 'card' | 'wallet')}
                                className={`flex flex-col items-center gap-3 p-6 rounded-lg transition-hud ${paymentMethod === method.id
                                        ? 'bg-hud-accent-primary text-hud-bg-primary'
                                        : 'bg-hud-bg-primary text-hud-text-secondary hover:text-hud-text-primary'
                                    }`}
                            >
                                {method.icon}
                                <span className="text-sm font-medium">{method.label}</span>
                            </button>
                        ))}
                    </div>

                    {paymentMethod === 'cash' && (
                        <div className="mt-6 space-y-4">
                            <div>
                                <label className="block text-sm text-hud-text-secondary mb-2">Amount Received</label>
                                <input
                                    type="number"
                                    value={amountReceived}
                                    onChange={(e) => setAmountReceived(e.target.value)}
                                    placeholder="Enter amount"
                                    className="w-full px-4 py-3 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-2xl font-mono text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud text-center"
                                />
                            </div>
                            <div className="flex gap-2">
                                {quickAmounts.map((amount) => (
                                    <button
                                        key={amount}
                                        onClick={() => setAmountReceived(amount.toString())}
                                        className="flex-1 py-2 rounded-lg bg-hud-bg-primary text-hud-text-secondary hover:text-hud-accent-primary transition-hud font-mono"
                                    >
                                        ${amount}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {paymentMethod === 'wallet' && (
                        <div className="mt-6 flex justify-center">
                            <div className="p-8 bg-white rounded-lg">
                                <QrCode size={120} className="text-hud-bg-primary" />
                            </div>
                        </div>
                    )}
                </HudCard>
            </div>

            {/* Summary */}
            <div>
                <HudCard title="Payment Summary">
                    <div className="space-y-4">
                        <div className="flex justify-between text-sm">
                            <span className="text-hud-text-secondary">Subtotal</span>
                            <span className="text-hud-text-primary font-mono">${subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-hud-text-secondary">Tax (10%)</span>
                            <span className="text-hud-text-primary font-mono">${tax.toFixed(2)}</span>
                        </div>
                        <div className="h-px bg-hud-border-secondary" />
                        <div className="flex justify-between text-xl font-semibold">
                            <span className="text-hud-text-primary">Total</span>
                            <span className="text-hud-accent-primary font-mono">${total.toFixed(2)}</span>
                        </div>

                        {paymentMethod === 'cash' && amountReceived && parseFloat(amountReceived) >= total && (
                            <>
                                <div className="h-px bg-hud-border-secondary" />
                                <div className="flex justify-between text-sm">
                                    <span className="text-hud-text-secondary">Received</span>
                                    <span className="text-hud-text-primary font-mono">${parseFloat(amountReceived).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-lg">
                                    <span className="text-hud-accent-success">Change</span>
                                    <span className="text-hud-accent-success font-mono font-semibold">${change.toFixed(2)}</span>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="mt-6 space-y-3">
                        <Button
                            variant="primary"
                            fullWidth
                            glow
                            leftIcon={<Check size={18} />}
                            disabled={!paymentMethod || (paymentMethod === 'cash' && (!amountReceived || parseFloat(amountReceived) < total))}
                        >
                            Complete Payment
                        </Button>
                        <div className="grid grid-cols-2 gap-3">
                            <Button variant="ghost" leftIcon={<Receipt size={16} />}>
                                Print Bill
                            </Button>
                            <Button variant="ghost" leftIcon={<Printer size={16} />}>
                                Print Receipt
                            </Button>
                        </div>
                    </div>
                </HudCard>

                {/* Quick Stats */}
                <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="hud-card hud-card-bottom rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-hud-accent-primary font-mono">$2,847</p>
                        <p className="text-xs text-hud-text-muted mt-1">Today's Sales</p>
                    </div>
                    <div className="hud-card hud-card-bottom rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-hud-accent-info font-mono">47</p>
                        <p className="text-xs text-hud-text-muted mt-1">Orders Completed</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PosCounterCheckout
