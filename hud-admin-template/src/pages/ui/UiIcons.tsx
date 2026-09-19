import { useState } from 'react'
import { Search, Copy, Check } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import HudCard from '../../components/common/HudCard'

const iconNames = [
    'Home', 'User', 'Settings', 'Bell', 'Mail', 'Calendar', 'Clock', 'Heart', 'Star', 'Search',
    'Plus', 'Minus', 'X', 'Check', 'ChevronDown', 'ChevronUp', 'ChevronLeft', 'ChevronRight',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'RefreshCw', 'Loader', 'Download', 'Upload',
    'File', 'Folder', 'Image', 'Video', 'Music', 'Camera', 'Mic', 'Phone', 'Monitor', 'Smartphone',
    'Tablet', 'Laptop', 'Wifi', 'Bluetooth', 'Battery', 'Zap', 'Sun', 'Moon', 'Cloud', 'CloudRain',
    'Trash2', 'Edit', 'Save', 'Copy', 'Clipboard', 'Lock', 'Unlock', 'Key', 'Shield', 'Eye', 'EyeOff',
    'Share2', 'Send', 'MessageCircle', 'MessageSquare', 'Info', 'AlertCircle', 'AlertTriangle', 'HelpCircle',
    'Map', 'MapPin', 'Navigation', 'Compass', 'Globe', 'Flag', 'Bookmark', 'Tag', 'Hash', 'AtSign',
    'Link', 'ExternalLink', 'Paperclip', 'Printer', 'QrCode', 'Barcode', 'Filter', 'Sliders', 'Layers',
    'Grid', 'List', 'LayoutGrid', 'LayoutList', 'Columns', 'Rows', 'Table', 'Database', 'Server', 'HardDrive',
    'Cpu', 'Activity', 'BarChart', 'BarChart2', 'PieChart', 'TrendingUp', 'TrendingDown', 'DollarSign',
    'CreditCard', 'ShoppingCart', 'ShoppingBag', 'Package', 'Gift', 'Award', 'Trophy', 'Medal', 'Crown',
    'Users', 'UserPlus', 'UserMinus', 'UserCheck', 'UserX', 'Briefcase', 'Building', 'Store', 'Warehouse',
    'Truck', 'Car', 'Plane', 'Train', 'Ship', 'Anchor', 'Rocket', 'Satellite', 'Radio', 'Tv',
    'Gamepad2', 'Joystick', 'Sword', 'Wand2', 'Sparkles', 'Ghost', 'Bot', 'Bug', 'Terminal', 'Code',
]

const UiIcons = () => {
    const [searchQuery, setSearchQuery] = useState('')
    const [copiedIcon, setCopiedIcon] = useState<string | null>(null)

    const filteredIcons = iconNames.filter(name =>
        name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const copyToClipboard = (iconName: string) => {
        navigator.clipboard.writeText(`<${iconName} />`)
        setCopiedIcon(iconName)
        setTimeout(() => setCopiedIcon(null), 2000)
    }

    const renderIcon = (name: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const IconComponent = (LucideIcons as any)[name]
        if (!IconComponent) return null
        return <IconComponent size={24} className="text-hud-text-primary" />
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-hud-text-primary">Icons</h1>
                    <p className="text-hud-text-muted mt-1">Lucide React icon library - {filteredIcons.length} icons</p>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search icons..."
                        className="w-64 pl-10 pr-4 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                    />
                </div>
            </div>

            {/* Icons Grid */}
            <HudCard noPadding>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
                    {filteredIcons.map((iconName) => (
                        <button
                            key={iconName}
                            onClick={() => copyToClipboard(iconName)}
                            className="p-4 flex flex-col items-center gap-2 border-r border-b border-hud-border-secondary hover:bg-hud-bg-hover transition-hud group relative"
                        >
                            {copiedIcon === iconName ? (
                                <Check size={24} className="text-hud-accent-success" />
                            ) : (
                                renderIcon(iconName)
                            )}
                            <span className="text-xs text-hud-text-muted truncate w-full text-center">
                                {copiedIcon === iconName ? 'Copied!' : iconName}
                            </span>

                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-hud-bg-primary border border-hud-border-secondary rounded text-xs text-hud-text-primary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                Click to copy
                            </div>
                        </button>
                    ))}
                </div>
            </HudCard>

            {/* Icon Sizes */}
            <HudCard title="Icon Sizes" subtitle="Different size variants">
                <div className="flex items-end gap-6">
                    {[16, 20, 24, 32, 40, 48, 64].map((size) => (
                        <div key={size} className="text-center">
                            <LucideIcons.Star size={size} className="text-hud-accent-primary mx-auto" />
                            <p className="text-xs text-hud-text-muted mt-2">{size}px</p>
                        </div>
                    ))}
                </div>
            </HudCard>

            {/* Icon Colors */}
            <HudCard title="Icon Colors" subtitle="Using different accent colors">
                <div className="flex items-center gap-4 flex-wrap">
                    <LucideIcons.Heart size={32} className="text-hud-accent-primary" />
                    <LucideIcons.Heart size={32} className="text-hud-accent-secondary" />
                    <LucideIcons.Heart size={32} className="text-hud-accent-success" />
                    <LucideIcons.Heart size={32} className="text-hud-accent-warning" />
                    <LucideIcons.Heart size={32} className="text-hud-accent-danger" />
                    <LucideIcons.Heart size={32} className="text-hud-accent-info" />
                    <LucideIcons.Heart size={32} className="text-hud-text-primary" />
                    <LucideIcons.Heart size={32} className="text-hud-text-secondary" />
                    <LucideIcons.Heart size={32} className="text-hud-text-muted" />
                </div>
            </HudCard>

            {/* Icon Styles */}
            <HudCard title="Icon Buttons" subtitle="Icons in different button styles">
                <div className="flex flex-wrap gap-4">
                    <button className="p-3 bg-hud-accent-primary text-hud-bg-primary rounded-lg hover:bg-hud-accent-primary/90 transition-hud">
                        <LucideIcons.Plus size={20} />
                    </button>
                    <button className="p-3 border border-hud-accent-primary text-hud-accent-primary rounded-lg hover:bg-hud-accent-primary/10 transition-hud">
                        <LucideIcons.Edit size={20} />
                    </button>
                    <button className="p-3 bg-hud-accent-primary/10 text-hud-accent-primary rounded-lg hover:bg-hud-accent-primary/20 transition-hud">
                        <LucideIcons.Heart size={20} />
                    </button>
                    <button className="p-3 bg-hud-accent-primary text-hud-bg-primary rounded-full hover:bg-hud-accent-primary/90 transition-hud">
                        <LucideIcons.Share2 size={20} />
                    </button>
                    <button className="p-3 border border-hud-accent-primary text-hud-accent-primary rounded-full hover:bg-hud-accent-primary/10 transition-hud">
                        <LucideIcons.Download size={20} />
                    </button>
                    <button className="p-3 bg-hud-accent-danger text-white rounded-lg hover:bg-hud-accent-danger/90 transition-hud">
                        <LucideIcons.Trash2 size={20} />
                    </button>
                </div>
            </HudCard>
        </div>
    )
}

export default UiIcons
