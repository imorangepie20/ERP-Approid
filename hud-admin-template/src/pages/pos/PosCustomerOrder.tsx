import { useState } from 'react'
import { Search, Plus, Minus, ShoppingCart, Trash2, CreditCard, DollarSign } from 'lucide-react'
import HudCard from '../../components/common/HudCard'
import Button from '../../components/common/Button'

const categories = ['All', 'Main Course', 'Appetizers', 'Drinks', 'Desserts']

const menuItems = [
    { id: 1, name: 'Grilled Salmon', price: 24.99, category: 'Main Course', image: '🐟' },
    { id: 2, name: 'Beef Steak', price: 32.99, category: 'Main Course', image: '🥩' },
    { id: 3, name: 'Caesar Salad', price: 12.99, category: 'Appetizers', image: '🥗' },
    { id: 4, name: 'French Fries', price: 6.99, category: 'Appetizers', image: '🍟' },
    { id: 5, name: 'Coca Cola', price: 3.99, category: 'Drinks', image: '🥤' },
    { id: 6, name: 'Fresh Juice', price: 5.99, category: 'Drinks', image: '🧃' },
    { id: 7, name: 'Chocolate Cake', price: 8.99, category: 'Desserts', image: '🍰' },
    { id: 8, name: 'Ice Cream', price: 6.99, category: 'Desserts', image: '🍨' },
    { id: 9, name: 'Pasta Carbonara', price: 18.99, category: 'Main Course', image: '🍝' },
    { id: 10, name: 'Chicken Wings', price: 14.99, category: 'Appetizers', image: '🍗' },
    { id: 11, name: 'Lemonade', price: 4.99, category: 'Drinks', image: '🍋' },
    { id: 12, name: 'Cheesecake', price: 9.99, category: 'Desserts', image: '🧁' },
]

interface CartItem {
    id: number
    name: string
    price: number
    quantity: number
    image: string
}

const PosCustomerOrder = () => {
    const [selectedCategory, setSelectedCategory] = useState('All')
    const [searchQuery, setSearchQuery] = useState('')
    const [cart, setCart] = useState<CartItem[]>([])

    const filteredItems = menuItems.filter((item) => {
        const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase())
        return matchesCategory && matchesSearch
    })

    const addToCart = (item: typeof menuItems[0]) => {
        setCart((prev) => {
            const existing = prev.find((i) => i.id === item.id)
            if (existing) {
                return prev.map((i) =>
                    i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
                )
            }
            return [...prev, { ...item, quantity: 1 }]
        })
    }

    const updateQuantity = (id: number, delta: number) => {
        setCart((prev) =>
            prev
                .map((item) =>
                    item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
                )
                .filter((item) => item.quantity > 0)
        )
    }

    const removeFromCart = (id: number) => {
        setCart((prev) => prev.filter((item) => item.id !== id))
    }

    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const tax = subtotal * 0.1
    const total = subtotal + tax

    return (
        <div className="h-[calc(100vh-8rem)] flex gap-6 animate-fade-in">
            {/* Menu Section */}
            <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-2xl font-bold text-hud-text-primary">Customer Order</h1>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search menu..."
                            className="w-64 pl-10 pr-4 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                        />
                    </div>
                </div>

                {/* Categories */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
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

                {/* Menu Grid */}
                <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {filteredItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => addToCart(item)}
                                className="hud-card hud-card-bottom p-4 rounded-lg text-left hover:border-hud-accent-primary transition-hud group"
                            >
                                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">
                                    {item.image}
                                </div>
                                <h3 className="font-medium text-hud-text-primary text-sm">{item.name}</h3>
                                <p className="text-hud-accent-primary font-mono mt-1">${item.price.toFixed(2)}</p>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Cart Section */}
            <div className="w-96 flex flex-col">
                <HudCard className="flex-1 flex flex-col" noPadding>
                    {/* Cart Header */}
                    <div className="p-4 border-b border-hud-border-secondary flex items-center gap-3">
                        <ShoppingCart className="text-hud-accent-primary" size={20} />
                        <h2 className="font-semibold text-hud-text-primary">Current Order</h2>
                        <span className="ml-auto text-sm text-hud-text-muted">{cart.length} items</span>
                    </div>

                    {/* Cart Items */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center">
                                <ShoppingCart size={48} className="text-hud-text-muted/30 mb-4" />
                                <p className="text-hud-text-muted">Cart is empty</p>
                                <p className="text-xs text-hud-text-muted mt-1">Click items to add</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {cart.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center gap-3 p-3 bg-hud-bg-primary rounded-lg"
                                    >
                                        <span className="text-2xl">{item.image}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-hud-text-primary truncate">{item.name}</p>
                                            <p className="text-xs text-hud-accent-primary font-mono">
                                                ${(item.price * item.quantity).toFixed(2)}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => updateQuantity(item.id, -1)}
                                                className="w-7 h-7 rounded bg-hud-bg-secondary flex items-center justify-center text-hud-text-secondary hover:text-hud-accent-primary transition-hud"
                                            >
                                                <Minus size={14} />
                                            </button>
                                            <span className="w-6 text-center text-sm text-hud-text-primary font-mono">
                                                {item.quantity}
                                            </span>
                                            <button
                                                onClick={() => updateQuantity(item.id, 1)}
                                                className="w-7 h-7 rounded bg-hud-bg-secondary flex items-center justify-center text-hud-text-secondary hover:text-hud-accent-primary transition-hud"
                                            >
                                                <Plus size={14} />
                                            </button>
                                            <button
                                                onClick={() => removeFromCart(item.id)}
                                                className="w-7 h-7 rounded flex items-center justify-center text-hud-text-muted hover:text-hud-accent-danger transition-hud"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Cart Summary */}
                    <div className="p-4 border-t border-hud-border-secondary space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-hud-text-secondary">Subtotal</span>
                            <span className="text-hud-text-primary font-mono">${subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-hud-text-secondary">Tax (10%)</span>
                            <span className="text-hud-text-primary font-mono">${tax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-lg font-semibold pt-2 border-t border-hud-border-secondary">
                            <span className="text-hud-text-primary">Total</span>
                            <span className="text-hud-accent-primary font-mono">${total.toFixed(2)}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <Button variant="outline" leftIcon={<DollarSign size={16} />}>
                                Cash
                            </Button>
                            <Button variant="primary" glow leftIcon={<CreditCard size={16} />}>
                                Card
                            </Button>
                        </div>
                    </div>
                </HudCard>
            </div>
        </div>
    )
}

export default PosCustomerOrder
