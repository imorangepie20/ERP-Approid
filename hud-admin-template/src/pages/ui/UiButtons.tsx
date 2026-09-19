import { Download, Heart, Star, Share2, Trash2, Edit, Plus, Check, X, ArrowRight, Loader } from 'lucide-react'
import HudCard from '../../components/common/HudCard'
import Button from '../../components/common/Button'

const UiButtons = () => {
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-hud-text-primary">Buttons</h1>
                <p className="text-hud-text-muted mt-1">Various button styles and states.</p>
            </div>

            {/* Solid Buttons */}
            <HudCard title="Solid Buttons" subtitle="Standard filled button variants">
                <div className="flex flex-wrap gap-3">
                    <button className="px-4 py-2 bg-hud-accent-primary text-hud-bg-primary rounded-lg font-medium hover:bg-hud-accent-primary/90 transition-hud">Primary</button>
                    <button className="px-4 py-2 bg-hud-accent-secondary text-white rounded-lg font-medium hover:bg-hud-accent-secondary/90 transition-hud">Secondary</button>
                    <button className="px-4 py-2 bg-hud-accent-success text-white rounded-lg font-medium hover:bg-hud-accent-success/90 transition-hud">Success</button>
                    <button className="px-4 py-2 bg-hud-accent-warning text-hud-bg-primary rounded-lg font-medium hover:bg-hud-accent-warning/90 transition-hud">Warning</button>
                    <button className="px-4 py-2 bg-hud-accent-danger text-white rounded-lg font-medium hover:bg-hud-accent-danger/90 transition-hud">Danger</button>
                    <button className="px-4 py-2 bg-hud-accent-info text-white rounded-lg font-medium hover:bg-hud-accent-info/90 transition-hud">Info</button>
                    <button className="px-4 py-2 bg-hud-bg-hover text-hud-text-primary rounded-lg font-medium hover:bg-hud-bg-primary transition-hud">Dark</button>
                </div>
            </HudCard>

            {/* Outline Buttons */}
            <HudCard title="Outline Buttons" subtitle="Border-only button variants">
                <div className="flex flex-wrap gap-3">
                    <button className="px-4 py-2 border border-hud-accent-primary text-hud-accent-primary rounded-lg font-medium hover:bg-hud-accent-primary/10 transition-hud">Primary</button>
                    <button className="px-4 py-2 border border-hud-accent-secondary text-hud-accent-secondary rounded-lg font-medium hover:bg-hud-accent-secondary/10 transition-hud">Secondary</button>
                    <button className="px-4 py-2 border border-hud-accent-success text-hud-accent-success rounded-lg font-medium hover:bg-hud-accent-success/10 transition-hud">Success</button>
                    <button className="px-4 py-2 border border-hud-accent-warning text-hud-accent-warning rounded-lg font-medium hover:bg-hud-accent-warning/10 transition-hud">Warning</button>
                    <button className="px-4 py-2 border border-hud-accent-danger text-hud-accent-danger rounded-lg font-medium hover:bg-hud-accent-danger/10 transition-hud">Danger</button>
                    <button className="px-4 py-2 border border-hud-accent-info text-hud-accent-info rounded-lg font-medium hover:bg-hud-accent-info/10 transition-hud">Info</button>
                </div>
            </HudCard>

            {/* Soft Buttons */}
            <HudCard title="Soft Buttons" subtitle="Light background variants">
                <div className="flex flex-wrap gap-3">
                    <button className="px-4 py-2 bg-hud-accent-primary/10 text-hud-accent-primary rounded-lg font-medium hover:bg-hud-accent-primary/20 transition-hud">Primary</button>
                    <button className="px-4 py-2 bg-hud-accent-secondary/10 text-hud-accent-secondary rounded-lg font-medium hover:bg-hud-accent-secondary/20 transition-hud">Secondary</button>
                    <button className="px-4 py-2 bg-hud-accent-success/10 text-hud-accent-success rounded-lg font-medium hover:bg-hud-accent-success/20 transition-hud">Success</button>
                    <button className="px-4 py-2 bg-hud-accent-warning/10 text-hud-accent-warning rounded-lg font-medium hover:bg-hud-accent-warning/20 transition-hud">Warning</button>
                    <button className="px-4 py-2 bg-hud-accent-danger/10 text-hud-accent-danger rounded-lg font-medium hover:bg-hud-accent-danger/20 transition-hud">Danger</button>
                    <button className="px-4 py-2 bg-hud-accent-info/10 text-hud-accent-info rounded-lg font-medium hover:bg-hud-accent-info/20 transition-hud">Info</button>
                </div>
            </HudCard>

            {/* Glow Buttons */}
            <HudCard title="Glow Buttons" subtitle="Buttons with glow effect">
                <div className="flex flex-wrap gap-3">
                    <button className="px-4 py-2 bg-hud-accent-primary text-hud-bg-primary rounded-lg font-medium shadow-hud-glow hover:shadow-[0_0_40px_rgba(0,255,204,0.5)] transition-all">Primary Glow</button>
                    <button className="px-4 py-2 bg-hud-accent-secondary text-white rounded-lg font-medium shadow-hud-pink hover:shadow-[0_0_40px_rgba(255,20,147,0.5)] transition-all">Pink Glow</button>
                    <button className="px-4 py-2 bg-hud-accent-info text-white rounded-lg font-medium shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_40px_rgba(99,102,241,0.5)] transition-all">Info Glow</button>
                </div>
            </HudCard>

            {/* Button Sizes */}
            <HudCard title="Button Sizes" subtitle="Different size variants">
                <div className="flex flex-wrap items-center gap-3">
                    <button className="px-3 py-1 text-xs bg-hud-accent-primary text-hud-bg-primary rounded font-medium">Extra Small</button>
                    <button className="px-3 py-1.5 text-sm bg-hud-accent-primary text-hud-bg-primary rounded-lg font-medium">Small</button>
                    <button className="px-4 py-2 text-sm bg-hud-accent-primary text-hud-bg-primary rounded-lg font-medium">Medium</button>
                    <button className="px-6 py-3 text-base bg-hud-accent-primary text-hud-bg-primary rounded-lg font-medium">Large</button>
                    <button className="px-8 py-4 text-lg bg-hud-accent-primary text-hud-bg-primary rounded-xl font-medium">Extra Large</button>
                </div>
            </HudCard>

            {/* Icon Buttons */}
            <HudCard title="Icon Buttons" subtitle="Buttons with icons">
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                        <button className="flex items-center gap-2 px-4 py-2 bg-hud-accent-primary text-hud-bg-primary rounded-lg font-medium">
                            <Download size={16} /> Download
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 bg-hud-accent-danger text-white rounded-lg font-medium">
                            <Trash2 size={16} /> Delete
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 bg-hud-accent-success text-white rounded-lg font-medium">
                            <Check size={16} /> Confirm
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 border border-hud-accent-info text-hud-accent-info rounded-lg font-medium">
                            <Edit size={16} /> Edit
                        </button>
                    </div>

                    {/* Icon Only */}
                    <div className="flex flex-wrap gap-3">
                        <button className="p-2 bg-hud-accent-primary text-hud-bg-primary rounded-lg"><Plus size={18} /></button>
                        <button className="p-2 bg-hud-accent-danger text-white rounded-lg"><X size={18} /></button>
                        <button className="p-2 bg-hud-accent-secondary text-white rounded-lg"><Heart size={18} /></button>
                        <button className="p-2 bg-hud-accent-warning text-hud-bg-primary rounded-lg"><Star size={18} /></button>
                        <button className="p-2 border border-hud-accent-primary text-hud-accent-primary rounded-lg"><Share2 size={18} /></button>
                    </div>

                    {/* Rounded Icon */}
                    <div className="flex flex-wrap gap-3">
                        <button className="p-2 bg-hud-accent-primary text-hud-bg-primary rounded-full"><Plus size={18} /></button>
                        <button className="p-2 bg-hud-accent-danger text-white rounded-full"><X size={18} /></button>
                        <button className="p-2 bg-hud-accent-secondary text-white rounded-full"><Heart size={18} /></button>
                        <button className="p-2 bg-hud-accent-warning text-hud-bg-primary rounded-full"><Star size={18} /></button>
                    </div>
                </div>
            </HudCard>

            {/* Button States */}
            <HudCard title="Button States" subtitle="Different interaction states">
                <div className="flex flex-wrap gap-3">
                    <button className="px-4 py-2 bg-hud-accent-primary text-hud-bg-primary rounded-lg font-medium">Normal</button>
                    <button className="px-4 py-2 bg-hud-accent-primary text-hud-bg-primary rounded-lg font-medium opacity-80 cursor-pointer">Hover</button>
                    <button className="px-4 py-2 bg-hud-accent-primary text-hud-bg-primary rounded-lg font-medium ring-2 ring-offset-2 ring-offset-hud-bg-secondary ring-hud-accent-primary">Focus</button>
                    <button className="px-4 py-2 bg-hud-accent-primary text-hud-bg-primary rounded-lg font-medium scale-95">Active</button>
                    <button className="px-4 py-2 bg-hud-accent-primary text-hud-bg-primary rounded-lg font-medium opacity-50 cursor-not-allowed" disabled>Disabled</button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-hud-accent-primary text-hud-bg-primary rounded-lg font-medium">
                        <Loader size={16} className="animate-spin" /> Loading
                    </button>
                </div>
            </HudCard>

            {/* Button Groups */}
            <HudCard title="Button Groups" subtitle="Group related buttons together">
                <div className="space-y-4">
                    <div className="inline-flex rounded-lg overflow-hidden">
                        <button className="px-4 py-2 bg-hud-accent-primary text-hud-bg-primary font-medium border-r border-hud-bg-primary/20">Left</button>
                        <button className="px-4 py-2 bg-hud-accent-primary text-hud-bg-primary font-medium border-r border-hud-bg-primary/20">Middle</button>
                        <button className="px-4 py-2 bg-hud-accent-primary text-hud-bg-primary font-medium">Right</button>
                    </div>

                    <div className="inline-flex rounded-lg overflow-hidden border border-hud-accent-primary">
                        <button className="px-4 py-2 bg-hud-accent-primary text-hud-bg-primary font-medium">Active</button>
                        <button className="px-4 py-2 text-hud-accent-primary font-medium hover:bg-hud-accent-primary/10 border-l border-hud-accent-primary">Link</button>
                        <button className="px-4 py-2 text-hud-accent-primary font-medium hover:bg-hud-accent-primary/10 border-l border-hud-accent-primary">Link</button>
                    </div>
                </div>
            </HudCard>
        </div>
    )
}

export default UiButtons
