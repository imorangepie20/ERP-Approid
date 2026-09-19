import {
    Code,
    Layers,
    Grid3X3,
    ToggleLeft,
    CheckSquare,
    AlertCircle,
    Info,
    CheckCircle,
    XCircle,
    Loader,
    ChevronDown,
} from 'lucide-react'
import HudCard from '../../components/common/HudCard'
import Button from '../../components/common/Button'

const UiBootstrap = () => {
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-hud-text-primary">Bootstrap Components</h1>
                <p className="text-hud-text-muted mt-1">Core UI components styled with HUD theme.</p>
            </div>

            {/* Alerts */}
            <HudCard title="Alerts" subtitle="Contextual feedback messages">
                <div className="space-y-3">
                    {[
                        { type: 'success', icon: <CheckCircle size={18} />, title: 'Success!', message: 'Your action was completed successfully.' },
                        { type: 'info', icon: <Info size={18} />, title: 'Info', message: 'This is an informational message.' },
                        { type: 'warning', icon: <AlertCircle size={18} />, title: 'Warning', message: 'Please review before proceeding.' },
                        { type: 'danger', icon: <XCircle size={18} />, title: 'Error', message: 'Something went wrong. Please try again.' },
                    ].map((alert) => (
                        <div
                            key={alert.type}
                            className={`flex items-start gap-3 p-4 rounded-lg border ${alert.type === 'success' ? 'bg-hud-accent-success/10 border-hud-accent-success/30 text-hud-accent-success' :
                                    alert.type === 'info' ? 'bg-hud-accent-info/10 border-hud-accent-info/30 text-hud-accent-info' :
                                        alert.type === 'warning' ? 'bg-hud-accent-warning/10 border-hud-accent-warning/30 text-hud-accent-warning' :
                                            'bg-hud-accent-danger/10 border-hud-accent-danger/30 text-hud-accent-danger'
                                }`}
                        >
                            {alert.icon}
                            <div>
                                <p className="font-semibold">{alert.title}</p>
                                <p className="text-sm opacity-80 mt-0.5">{alert.message}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </HudCard>

            {/* Badges */}
            <HudCard title="Badges" subtitle="Small count and labeling components">
                <div className="flex flex-wrap gap-3">
                    <span className="px-3 py-1 rounded-full bg-hud-accent-primary text-hud-bg-primary text-sm font-medium">Primary</span>
                    <span className="px-3 py-1 rounded-full bg-hud-accent-secondary text-white text-sm font-medium">Secondary</span>
                    <span className="px-3 py-1 rounded-full bg-hud-accent-success text-white text-sm font-medium">Success</span>
                    <span className="px-3 py-1 rounded-full bg-hud-accent-warning text-hud-bg-primary text-sm font-medium">Warning</span>
                    <span className="px-3 py-1 rounded-full bg-hud-accent-danger text-white text-sm font-medium">Danger</span>
                    <span className="px-3 py-1 rounded-full bg-hud-accent-info text-white text-sm font-medium">Info</span>
                </div>

                <div className="flex flex-wrap gap-3 mt-4">
                    <span className="px-3 py-1 rounded bg-hud-accent-primary/10 text-hud-accent-primary text-sm font-medium border border-hud-accent-primary/30">Primary</span>
                    <span className="px-3 py-1 rounded bg-hud-accent-secondary/10 text-hud-accent-secondary text-sm font-medium border border-hud-accent-secondary/30">Secondary</span>
                    <span className="px-3 py-1 rounded bg-hud-accent-success/10 text-hud-accent-success text-sm font-medium border border-hud-accent-success/30">Success</span>
                    <span className="px-3 py-1 rounded bg-hud-accent-warning/10 text-hud-accent-warning text-sm font-medium border border-hud-accent-warning/30">Warning</span>
                </div>
            </HudCard>

            {/* Progress Bars */}
            <HudCard title="Progress Bars" subtitle="Visual indicators of progress">
                <div className="space-y-4">
                    {[
                        { label: 'Default', value: 25, color: 'bg-hud-accent-primary' },
                        { label: 'Success', value: 50, color: 'bg-hud-accent-success' },
                        { label: 'Warning', value: 75, color: 'bg-hud-accent-warning' },
                        { label: 'Danger', value: 90, color: 'bg-hud-accent-danger' },
                    ].map((bar) => (
                        <div key={bar.label}>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-hud-text-secondary">{bar.label}</span>
                                <span className="text-hud-text-primary font-mono">{bar.value}%</span>
                            </div>
                            <div className="h-2 bg-hud-bg-primary rounded-full overflow-hidden">
                                <div className={`h-full ${bar.color} rounded-full transition-all duration-500`} style={{ width: `${bar.value}%` }} />
                            </div>
                        </div>
                    ))}

                    {/* Striped */}
                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-hud-text-secondary">Striped & Animated</span>
                            <span className="text-hud-text-primary font-mono">60%</span>
                        </div>
                        <div className="h-3 bg-hud-bg-primary rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-hud-accent-primary via-hud-accent-info to-hud-accent-primary bg-[length:20px_20px] rounded-full animate-pulse"
                                style={{ width: '60%' }}
                            />
                        </div>
                    </div>
                </div>
            </HudCard>

            {/* Spinners */}
            <HudCard title="Spinners" subtitle="Loading indicators">
                <div className="flex items-center gap-6">
                    <div className="w-8 h-8 border-2 border-hud-accent-primary border-t-transparent rounded-full animate-spin" />
                    <div className="w-8 h-8 border-2 border-hud-accent-info border-t-transparent rounded-full animate-spin" />
                    <div className="w-8 h-8 border-2 border-hud-accent-success border-t-transparent rounded-full animate-spin" />
                    <div className="w-8 h-8 border-2 border-hud-accent-warning border-t-transparent rounded-full animate-spin" />
                    <Loader className="w-8 h-8 text-hud-accent-primary animate-spin" />
                </div>

                <div className="flex items-center gap-6 mt-6">
                    <div className="flex gap-1">
                        <div className="w-2 h-2 bg-hud-accent-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-hud-accent-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-hud-accent-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <div className="flex gap-1">
                        <div className="w-2 h-8 bg-hud-accent-info rounded animate-pulse" />
                        <div className="w-2 h-8 bg-hud-accent-info rounded animate-pulse" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-8 bg-hud-accent-info rounded animate-pulse" style={{ animationDelay: '300ms' }} />
                    </div>
                </div>
            </HudCard>

            {/* Dropdowns */}
            <HudCard title="Dropdowns" subtitle="Toggle contextual overlays">
                <div className="flex flex-wrap gap-4">
                    <div className="relative">
                        <button className="flex items-center gap-2 px-4 py-2 bg-hud-accent-primary text-hud-bg-primary rounded-lg">
                            Dropdown
                            <ChevronDown size={16} />
                        </button>
                    </div>
                    <div className="relative">
                        <button className="flex items-center gap-2 px-4 py-2 border border-hud-accent-primary text-hud-accent-primary rounded-lg">
                            Outline
                            <ChevronDown size={16} />
                        </button>
                    </div>
                    <div className="relative">
                        <button className="flex items-center gap-2 px-4 py-2 bg-hud-bg-primary text-hud-text-secondary rounded-lg">
                            Ghost
                            <ChevronDown size={16} />
                        </button>
                    </div>
                </div>
            </HudCard>

            {/* List Group */}
            <HudCard title="List Group" subtitle="Flexible list components" noPadding>
                <div className="divide-y divide-hud-border-secondary">
                    {['Cras justo odio', 'Dapibus ac facilisis in', 'Morbi leo risus', 'Porta ac consectetur ac', 'Vestibulum at eros'].map((item, i) => (
                        <div
                            key={i}
                            className={`px-5 py-3 flex items-center justify-between hover:bg-hud-bg-hover transition-hud cursor-pointer ${i === 0 ? 'bg-hud-accent-primary/10' : ''
                                }`}
                        >
                            <span className={`text-sm ${i === 0 ? 'text-hud-accent-primary' : 'text-hud-text-primary'}`}>{item}</span>
                            {i < 3 && (
                                <span className="px-2 py-0.5 bg-hud-accent-primary text-hud-bg-primary text-xs rounded-full">
                                    {14 - i * 3}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </HudCard>
        </div>
    )
}

export default UiBootstrap
