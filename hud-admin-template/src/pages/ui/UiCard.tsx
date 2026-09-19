import { MoreVertical, Heart, Share2, MessageCircle, Bookmark, ExternalLink } from 'lucide-react'
import HudCard from '../../components/common/HudCard'
import Button from '../../components/common/Button'

const UiCard = () => {
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-hud-text-primary">Cards</h1>
                <p className="text-hud-text-muted mt-1">Flexible content containers with various layouts.</p>
            </div>

            {/* Basic Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="hud-card hud-card-bottom rounded-lg p-5">
                    <h3 className="font-semibold text-hud-text-primary">Basic Card</h3>
                    <p className="text-sm text-hud-text-secondary mt-2">
                        This is a simple card with just text content. Great for simple information display.
                    </p>
                </div>

                <div className="hud-card hud-card-bottom rounded-lg overflow-hidden">
                    <div className="h-32 bg-gradient-to-br from-hud-accent-primary/30 to-hud-accent-info/30" />
                    <div className="p-5">
                        <h3 className="font-semibold text-hud-text-primary">Card with Image</h3>
                        <p className="text-sm text-hud-text-secondary mt-2">Cards can include images at the top.</p>
                    </div>
                </div>

                <div className="hud-card hud-card-bottom rounded-lg">
                    <div className="p-5 border-b border-hud-border-secondary">
                        <h3 className="font-semibold text-hud-text-primary">Card with Header</h3>
                    </div>
                    <div className="p-5">
                        <p className="text-sm text-hud-text-secondary">Body content goes here.</p>
                    </div>
                    <div className="p-5 border-t border-hud-border-secondary bg-hud-bg-primary/50">
                        <p className="text-xs text-hud-text-muted">Footer content</p>
                    </div>
                </div>
            </div>

            {/* Interactive Cards */}
            <HudCard title="Interactive Cards" subtitle="Cards with actions">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Social Card */}
                    <div className="hud-card hud-card-bottom rounded-lg overflow-hidden">
                        <div className="h-40 bg-gradient-to-br from-hud-accent-secondary/30 via-hud-accent-primary/20 to-hud-accent-info/30" />
                        <div className="p-4">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-hud-accent-primary to-hud-accent-info" />
                                <div>
                                    <p className="font-medium text-hud-text-primary text-sm">John Doe</p>
                                    <p className="text-xs text-hud-text-muted">2 hours ago</p>
                                </div>
                                <button className="ml-auto p-1 text-hud-text-muted hover:text-hud-text-primary">
                                    <MoreVertical size={16} />
                                </button>
                            </div>
                            <p className="text-sm text-hud-text-secondary">Beautiful sunset captured today! 🌅</p>
                            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-hud-border-secondary">
                                <button className="flex items-center gap-1 text-sm text-hud-text-muted hover:text-hud-accent-danger transition-hud">
                                    <Heart size={16} /> 124
                                </button>
                                <button className="flex items-center gap-1 text-sm text-hud-text-muted hover:text-hud-accent-primary transition-hud">
                                    <MessageCircle size={16} /> 23
                                </button>
                                <button className="flex items-center gap-1 text-sm text-hud-text-muted hover:text-hud-accent-info transition-hud">
                                    <Share2 size={16} />
                                </button>
                                <button className="ml-auto text-hud-text-muted hover:text-hud-accent-warning transition-hud">
                                    <Bookmark size={16} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Product Card */}
                    <div className="hud-card hud-card-bottom rounded-lg overflow-hidden group">
                        <div className="relative h-40 bg-gradient-to-br from-hud-accent-info/30 to-hud-accent-primary/30 flex items-center justify-center">
                            <span className="text-5xl">🎧</span>
                            <div className="absolute inset-0 bg-hud-bg-primary/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                <button className="p-2 bg-hud-accent-primary text-hud-bg-primary rounded-full"><Heart size={16} /></button>
                                <button className="p-2 bg-hud-accent-primary text-hud-bg-primary rounded-full"><ExternalLink size={16} /></button>
                            </div>
                        </div>
                        <div className="p-4">
                            <p className="text-xs text-hud-accent-primary">Electronics</p>
                            <h3 className="font-medium text-hud-text-primary mt-1">Wireless Headphones</h3>
                            <div className="flex items-center justify-between mt-3">
                                <p className="text-lg font-bold text-hud-accent-primary font-mono">$299.99</p>
                                <Button size="sm" variant="primary">Add to Cart</Button>
                            </div>
                        </div>
                    </div>

                    {/* Stats Card */}
                    <div className="hud-card hud-card-bottom rounded-lg p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-hud-text-primary">Monthly Revenue</h3>
                            <span className="px-2 py-1 bg-hud-accent-success/10 text-hud-accent-success text-xs rounded">+12.5%</span>
                        </div>
                        <p className="text-3xl font-bold text-hud-accent-primary font-mono">$54,239</p>
                        <div className="h-16 mt-4 flex items-end justify-between gap-1">
                            {[40, 60, 45, 80, 65, 90, 75, 85, 70, 95, 80, 100].map((h, i) => (
                                <div
                                    key={i}
                                    className="flex-1 bg-gradient-to-t from-hud-accent-primary to-hud-accent-info rounded-t"
                                    style={{ height: `${h}%` }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </HudCard>

            {/* Horizontal Cards */}
            <HudCard title="Horizontal Cards" subtitle="Cards with horizontal layout">
                <div className="space-y-4">
                    {[
                        { title: 'Project Alpha', desc: 'A revolutionary new platform', progress: 75, status: 'In Progress' },
                        { title: 'Marketing Campaign', desc: 'Q4 Marketing Initiative', progress: 100, status: 'Completed' },
                        { title: 'Mobile App v2.0', desc: 'Major app redesign', progress: 30, status: 'Planning' },
                    ].map((item, i) => (
                        <div key={i} className="hud-card hud-card-bottom rounded-lg p-4 flex items-center gap-4">
                            <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-hud-accent-primary/30 to-hud-accent-info/30 flex items-center justify-center shrink-0">
                                <span className="text-2xl">📊</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-hud-text-primary">{item.title}</h3>
                                <p className="text-sm text-hud-text-muted truncate">{item.desc}</p>
                                <div className="flex items-center gap-3 mt-2">
                                    <div className="flex-1 h-1.5 bg-hud-bg-primary rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${item.progress === 100 ? 'bg-hud-accent-success' : 'bg-hud-accent-primary'}`}
                                            style={{ width: `${item.progress}%` }}
                                        />
                                    </div>
                                    <span className="text-xs text-hud-text-muted">{item.progress}%</span>
                                </div>
                            </div>
                            <span className={`px-3 py-1 rounded text-xs shrink-0 ${item.status === 'Completed' ? 'bg-hud-accent-success/10 text-hud-accent-success' :
                                    item.status === 'In Progress' ? 'bg-hud-accent-info/10 text-hud-accent-info' :
                                        'bg-hud-accent-warning/10 text-hud-accent-warning'
                                }`}>
                                {item.status}
                            </span>
                        </div>
                    ))}
                </div>
            </HudCard>

            {/* Colored Cards */}
            <HudCard title="Colored Cards" subtitle="Cards with accent colors">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { color: 'from-hud-accent-primary to-cyan-400', label: 'Primary' },
                        { color: 'from-hud-accent-secondary to-pink-400', label: 'Secondary' },
                        { color: 'from-hud-accent-success to-green-400', label: 'Success' },
                        { color: 'from-hud-accent-warning to-yellow-400', label: 'Warning' },
                    ].map((item) => (
                        <div
                            key={item.label}
                            className={`rounded-lg p-5 bg-gradient-to-br ${item.color} text-white`}
                        >
                            <h3 className="font-semibold">{item.label} Card</h3>
                            <p className="text-sm opacity-80 mt-2">With gradient background</p>
                        </div>
                    ))}
                </div>
            </HudCard>
        </div>
    )
}

export default UiCard
