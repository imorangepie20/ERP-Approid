import { useState } from 'react'
import { Eye, EyeOff, Search, Mail, Lock, User, Calendar, Upload, X } from 'lucide-react'
import HudCard from '../../components/common/HudCard'
import Button from '../../components/common/Button'

const FormElements = () => {
    const [showPassword, setShowPassword] = useState(false)
    const [files, setFiles] = useState<string[]>([])

    const handleFileUpload = () => {
        setFiles([...files, `file_${files.length + 1}.pdf`])
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-hud-text-primary">Form Elements</h1>
                <p className="text-hud-text-muted mt-1">Input fields and form controls.</p>
            </div>

            {/* Basic Inputs */}
            <HudCard title="Basic Inputs" subtitle="Standard text input fields">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">Default Input</label>
                        <input
                            type="text"
                            placeholder="Enter text..."
                            className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">With Default Value</label>
                        <input
                            type="text"
                            defaultValue="John Doe"
                            className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">Disabled Input</label>
                        <input
                            type="text"
                            placeholder="Disabled..."
                            disabled
                            className="w-full px-4 py-2.5 bg-hud-bg-primary/50 border border-hud-border-secondary rounded-lg text-hud-text-muted cursor-not-allowed"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">Readonly Input</label>
                        <input
                            type="text"
                            value="Read only value"
                            readOnly
                            className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-secondary"
                        />
                    </div>
                </div>
            </HudCard>

            {/* Input with Icons */}
            <HudCard title="Input with Icons" subtitle="Input fields with leading or trailing icons">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">Search Input</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="w-full pl-10 pr-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">Email Input</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                            <input
                                type="email"
                                placeholder="email@example.com"
                                className="w-full pl-10 pr-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">Password Input</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Enter password"
                                className="w-full pl-10 pr-10 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-hud-text-muted hover:text-hud-text-primary"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">Date Input</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                            <input
                                type="date"
                                className="w-full pl-10 pr-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                            />
                        </div>
                    </div>
                </div>
            </HudCard>

            {/* Input Sizes */}
            <HudCard title="Input Sizes" subtitle="Different size variants">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">Small</label>
                        <input
                            type="text"
                            placeholder="Small input"
                            className="w-full px-3 py-1.5 text-sm bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">Default</label>
                        <input
                            type="text"
                            placeholder="Default input"
                            className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">Large</label>
                        <input
                            type="text"
                            placeholder="Large input"
                            className="w-full px-5 py-3.5 text-lg bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                        />
                    </div>
                </div>
            </HudCard>

            {/* Textarea */}
            <HudCard title="Textarea" subtitle="Multi-line text input">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">Default Textarea</label>
                        <textarea
                            rows={4}
                            placeholder="Enter your message..."
                            className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud resize-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">Resizable Textarea</label>
                        <textarea
                            rows={3}
                            placeholder="This textarea is resizable..."
                            className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                        />
                    </div>
                </div>
            </HudCard>

            {/* Select */}
            <HudCard title="Select" subtitle="Dropdown selection inputs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">Default Select</label>
                        <select className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud">
                            <option>Select an option</option>
                            <option>Option 1</option>
                            <option>Option 2</option>
                            <option>Option 3</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">Multiple Select</label>
                        <select multiple className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud" size={3}>
                            <option>Option 1</option>
                            <option>Option 2</option>
                            <option>Option 3</option>
                            <option>Option 4</option>
                        </select>
                    </div>
                </div>
            </HudCard>

            {/* Checkboxes and Radios */}
            <HudCard title="Checkboxes & Radios" subtitle="Selection controls">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-3">Checkboxes</label>
                        <div className="space-y-2">
                            {['Option 1', 'Option 2', 'Option 3'].map((option, i) => (
                                <label key={option} className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        defaultChecked={i === 0}
                                        className="w-4 h-4 rounded border-hud-border-secondary bg-hud-bg-primary text-hud-accent-primary focus:ring-hud-accent-primary"
                                    />
                                    <span className="text-sm text-hud-text-secondary">{option}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-3">Radio Buttons</label>
                        <div className="space-y-2">
                            {['Option A', 'Option B', 'Option C'].map((option, i) => (
                                <label key={option} className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="radio-group"
                                        defaultChecked={i === 0}
                                        className="w-4 h-4 border-hud-border-secondary bg-hud-bg-primary text-hud-accent-primary focus:ring-hud-accent-primary"
                                    />
                                    <span className="text-sm text-hud-text-secondary">{option}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </HudCard>

            {/* Toggle Switches */}
            <HudCard title="Toggle Switches" subtitle="On/off toggle controls">
                <div className="space-y-4">
                    {[
                        { label: 'Email Notifications', checked: true },
                        { label: 'Push Notifications', checked: false },
                        { label: 'Auto Updates', checked: true },
                    ].map((item) => (
                        <label key={item.label} className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm text-hud-text-secondary">{item.label}</span>
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    defaultChecked={item.checked}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-hud-bg-primary rounded-full peer peer-checked:bg-hud-accent-primary transition-colors" />
                                <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full peer-checked:translate-x-5 transition-transform" />
                            </div>
                        </label>
                    ))}
                </div>
            </HudCard>

            {/* File Upload */}
            <HudCard title="File Upload" subtitle="File input controls">
                <div className="space-y-4">
                    <div
                        onClick={handleFileUpload}
                        className="border-2 border-dashed border-hud-border-secondary rounded-lg p-8 text-center hover:border-hud-accent-primary transition-hud cursor-pointer"
                    >
                        <Upload size={40} className="mx-auto text-hud-text-muted mb-3" />
                        <p className="text-sm text-hud-text-secondary">
                            Drag and drop files here, or <span className="text-hud-accent-primary">browse</span>
                        </p>
                        <p className="text-xs text-hud-text-muted mt-1">PNG, JPG, PDF up to 10MB</p>
                    </div>

                    {files.length > 0 && (
                        <div className="space-y-2">
                            {files.map((file, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-hud-bg-primary rounded-lg">
                                    <span className="text-sm text-hud-text-primary">{file}</span>
                                    <button
                                        onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                                        className="text-hud-text-muted hover:text-hud-accent-danger"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </HudCard>

            {/* Range Slider */}
            <HudCard title="Range Slider" subtitle="Value range inputs">
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">Volume: 50%</label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            defaultValue="50"
                            className="w-full accent-hud-accent-primary"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">Brightness: 75%</label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            defaultValue="75"
                            className="w-full accent-hud-accent-info"
                        />
                    </div>
                </div>
            </HudCard>
        </div>
    )
}

export default FormElements
