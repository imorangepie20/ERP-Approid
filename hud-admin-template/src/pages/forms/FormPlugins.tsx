import { useState } from 'react'
import { Calendar, Clock, Tag, Hash, AtSign, DollarSign, Star } from 'lucide-react'
import HudCard from '../../components/common/HudCard'
import Button from '../../components/common/Button'

const FormPlugins = () => {
    const [selectedDate, setSelectedDate] = useState('2026-01-15')
    const [selectedTags, setSelectedTags] = useState(['React', 'TypeScript'])
    const [rating, setRating] = useState(4)

    const availableTags = ['React', 'TypeScript', 'JavaScript', 'TailwindCSS', 'Node.js', 'Python', 'Go']

    const addTag = (tag: string) => {
        if (!selectedTags.includes(tag)) {
            setSelectedTags([...selectedTags, tag])
        }
    }

    const removeTag = (tag: string) => {
        setSelectedTags(selectedTags.filter(t => t !== tag))
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-hud-text-primary">Form Plugins</h1>
                <p className="text-hud-text-muted mt-1">Enhanced form components and widgets.</p>
            </div>

            {/* Date & Time Picker */}
            <HudCard title="Date & Time Picker" subtitle="Date and time selection inputs">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">Date Picker</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">Time Picker</label>
                        <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                            <input
                                type="time"
                                defaultValue="09:30"
                                className="w-full pl-10 pr-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">DateTime Picker</label>
                        <input
                            type="datetime-local"
                            defaultValue="2026-01-15T09:30"
                            className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                        />
                    </div>
                </div>
            </HudCard>

            {/* Tag Input */}
            <HudCard title="Tag Input" subtitle="Multi-select tag picker">
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-2 p-3 bg-hud-bg-primary border border-hud-border-secondary rounded-lg min-h-[48px]">
                        {selectedTags.map((tag) => (
                            <span
                                key={tag}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-hud-accent-primary/10 text-hud-accent-primary text-sm rounded-full"
                            >
                                {tag}
                                <button onClick={() => removeTag(tag)} className="ml-1 hover:text-hud-accent-danger">
                                    ×
                                </button>
                            </span>
                        ))}
                        <input
                            type="text"
                            placeholder="Add tag..."
                            className="flex-1 min-w-[100px] bg-transparent outline-none text-hud-text-primary placeholder-hud-text-muted text-sm"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {availableTags.filter(t => !selectedTags.includes(t)).map((tag) => (
                            <button
                                key={tag}
                                onClick={() => addTag(tag)}
                                className="px-3 py-1 bg-hud-bg-hover text-hud-text-secondary text-sm rounded-full hover:bg-hud-accent-primary/10 hover:text-hud-accent-primary transition-hud"
                            >
                                + {tag}
                            </button>
                        ))}
                    </div>
                </div>
            </HudCard>

            {/* Input Masks */}
            <HudCard title="Input Masks" subtitle="Formatted input fields">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">Phone Number</label>
                        <input
                            type="tel"
                            placeholder="(___) ___-____"
                            className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud font-mono"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">Credit Card</label>
                        <input
                            type="text"
                            placeholder="____ ____ ____ ____"
                            className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud font-mono"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">SSN</label>
                        <input
                            type="text"
                            placeholder="___-__-____"
                            className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud font-mono"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">IP Address</label>
                        <input
                            type="text"
                            placeholder="___.___.___.___"
                            className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud font-mono"
                        />
                    </div>
                </div>
            </HudCard>

            {/* Input Addons */}
            <HudCard title="Input Addons" subtitle="Input groups with prefixes and suffixes">
                <div className="space-y-4">
                    <div className="flex">
                        <span className="inline-flex items-center px-4 bg-hud-bg-hover border border-r-0 border-hud-border-secondary rounded-l-lg text-hud-text-muted">
                            <AtSign size={16} />
                        </span>
                        <input
                            type="text"
                            placeholder="username"
                            className="flex-1 px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-r-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                        />
                    </div>
                    <div className="flex">
                        <span className="inline-flex items-center px-4 bg-hud-bg-hover border border-r-0 border-hud-border-secondary rounded-l-lg text-hud-text-muted">
                            <DollarSign size={16} />
                        </span>
                        <input
                            type="number"
                            placeholder="0.00"
                            className="flex-1 px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                        />
                        <span className="inline-flex items-center px-4 bg-hud-bg-hover border border-l-0 border-hud-border-secondary rounded-r-lg text-hud-text-muted text-sm">
                            USD
                        </span>
                    </div>
                    <div className="flex">
                        <input
                            type="text"
                            placeholder="https://"
                            className="flex-1 px-4 py-2.5 bg-hud-bg-primary border border-r-0 border-hud-border-secondary rounded-l-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                        />
                        <button className="px-4 bg-hud-accent-primary text-hud-bg-primary rounded-r-lg font-medium hover:bg-hud-accent-primary/90 transition-hud">
                            Go
                        </button>
                    </div>
                </div>
            </HudCard>

            {/* Rating */}
            <HudCard title="Star Rating" subtitle="Interactive rating component">
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-3">Your Rating</label>
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={() => setRating(star)}
                                    className={`p-1 transition-hud ${star <= rating ? 'text-hud-accent-warning' : 'text-hud-text-muted hover:text-hud-accent-warning/50'
                                        }`}
                                >
                                    <Star size={28} fill={star <= rating ? 'currentColor' : 'none'} />
                                </button>
                            ))}
                            <span className="ml-3 text-hud-text-secondary">{rating} of 5</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-5 gap-4">
                        {[5, 4, 3, 2, 1].map((num) => (
                            <div key={num} className="flex items-center gap-2">
                                <span className="text-sm text-hud-text-muted">{num}</span>
                                <Star size={14} className="text-hud-accent-warning" fill="currentColor" />
                                <div className="flex-1 h-1.5 bg-hud-bg-primary rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-hud-accent-warning rounded-full"
                                        style={{ width: `${[70, 45, 20, 10, 5][5 - num]}%` }}
                                    />
                                </div>
                                <span className="text-xs text-hud-text-muted w-8">{[70, 45, 20, 10, 5][5 - num]}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </HudCard>

            {/* Color Picker */}
            <HudCard title="Color Picker" subtitle="Color selection input">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">Select Color</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="color"
                                defaultValue="#00FFCC"
                                className="w-12 h-12 rounded cursor-pointer border-0"
                            />
                            <input
                                type="text"
                                defaultValue="#00FFCC"
                                className="flex-1 px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary font-mono focus:outline-none focus:border-hud-accent-primary transition-hud"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">Preset Colors</label>
                        <div className="flex gap-2">
                            {['#00FFCC', '#FF1493', '#6366F1', '#FFA500', '#10B981', '#EF4444'].map((color) => (
                                <button
                                    key={color}
                                    className="w-10 h-10 rounded-lg transition-transform hover:scale-110 ring-2 ring-offset-2 ring-offset-hud-bg-secondary ring-transparent hover:ring-white/30"
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </HudCard>

            {/* Number Spinner */}
            <HudCard title="Number Spinner" subtitle="Numeric input with increment/decrement">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">Quantity</label>
                        <div className="flex items-center">
                            <button className="px-4 py-2.5 bg-hud-bg-hover border border-r-0 border-hud-border-secondary rounded-l-lg text-hud-text-primary hover:bg-hud-bg-primary transition-hud">
                                -
                            </button>
                            <input
                                type="number"
                                defaultValue="5"
                                className="w-20 px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary text-hud-text-primary text-center focus:outline-none focus:border-hud-accent-primary transition-hud"
                            />
                            <button className="px-4 py-2.5 bg-hud-bg-hover border border-l-0 border-hud-border-secondary rounded-r-lg text-hud-text-primary hover:bg-hud-bg-primary transition-hud">
                                +
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">Price</label>
                        <div className="flex items-center">
                            <span className="px-4 py-2.5 bg-hud-bg-hover border border-r-0 border-hud-border-secondary rounded-l-lg text-hud-text-muted">
                                $
                            </span>
                            <input
                                type="number"
                                defaultValue="99.99"
                                step="0.01"
                                className="flex-1 px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-r-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud font-mono"
                            />
                        </div>
                    </div>
                </div>
            </HudCard>
        </div>
    )
}

export default FormPlugins
