import { useState } from 'react'
import {
    User,
    Bell,
    Lock,
    Palette,
    Globe,
    Shield,
    CreditCard,
    Mail,
    Smartphone,
    Moon,
    Sun,
    Save,
} from 'lucide-react'
import HudCard from '../components/common/HudCard'
import Button from '../components/common/Button'

const settingsSections = [
    { id: 'profile', label: 'Profile', icon: <User size={18} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
    { id: 'security', label: 'Security', icon: <Lock size={18} /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette size={18} /> },
    { id: 'language', label: 'Language', icon: <Globe size={18} /> },
    { id: 'privacy', label: 'Privacy', icon: <Shield size={18} /> },
    { id: 'billing', label: 'Billing', icon: <CreditCard size={18} /> },
]

const Settings = () => {
    const [activeSection, setActiveSection] = useState('profile')
    const [darkMode, setDarkMode] = useState(true)

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-hud-text-primary">Settings</h1>
                    <p className="text-hud-text-muted mt-1">Manage your account and preferences.</p>
                </div>
                <Button variant="primary" glow leftIcon={<Save size={18} />}>
                    Save Changes
                </Button>
            </div>

            <div className="flex gap-6">
                {/* Sidebar */}
                <div className="w-56 flex-shrink-0">
                    <HudCard noPadding>
                        <div className="py-2">
                            {settingsSections.map((section) => (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 transition-hud ${activeSection === section.id
                                            ? 'bg-hud-accent-primary/10 text-hud-accent-primary border-l-2 border-hud-accent-primary'
                                            : 'text-hud-text-secondary hover:bg-hud-bg-hover hover:text-hud-text-primary'
                                        }`}
                                >
                                    {section.icon}
                                    <span className="text-sm">{section.label}</span>
                                </button>
                            ))}
                        </div>
                    </HudCard>
                </div>

                {/* Content */}
                <div className="flex-1 space-y-6">
                    {activeSection === 'profile' && (
                        <HudCard title="Profile Settings" subtitle="Update your personal information">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">First Name</label>
                                    <input
                                        type="text"
                                        defaultValue="Admin"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">Last Name</label>
                                    <input
                                        type="text"
                                        defaultValue="User"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">Email</label>
                                    <input
                                        type="email"
                                        defaultValue="admin@hudadmin.com"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">Phone</label>
                                    <input
                                        type="tel"
                                        defaultValue="+1 (555) 123-4567"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm text-hud-text-secondary mb-2">Bio</label>
                                    <textarea
                                        rows={4}
                                        defaultValue="Senior Full Stack Developer with 8+ years of experience."
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud resize-none"
                                    />
                                </div>
                            </div>
                        </HudCard>
                    )}

                    {activeSection === 'notifications' && (
                        <HudCard title="Notification Preferences" subtitle="Manage how you receive notifications">
                            <div className="space-y-6">
                                {[
                                    { icon: <Mail size={18} />, title: 'Email Notifications', desc: 'Receive email updates about your account' },
                                    { icon: <Bell size={18} />, title: 'Push Notifications', desc: 'Get push notifications on your devices' },
                                    { icon: <Smartphone size={18} />, title: 'SMS Notifications', desc: 'Receive SMS for important updates' },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-hud-bg-primary rounded-lg">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-hud-accent-primary/10 rounded-lg text-hud-accent-primary">
                                                {item.icon}
                                            </div>
                                            <div>
                                                <p className="text-sm text-hud-text-primary">{item.title}</p>
                                                <p className="text-xs text-hud-text-muted">{item.desc}</p>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" defaultChecked className="sr-only peer" />
                                            <div className="w-11 h-6 bg-hud-bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-hud-accent-primary"></div>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </HudCard>
                    )}

                    {activeSection === 'appearance' && (
                        <HudCard title="Appearance" subtitle="Customize the look and feel">
                            <div className="space-y-6">
                                {/* Theme Toggle */}
                                <div className="flex items-center justify-between p-4 bg-hud-bg-primary rounded-lg">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-hud-accent-primary/10 rounded-lg text-hud-accent-primary">
                                            {darkMode ? <Moon size={18} /> : <Sun size={18} />}
                                        </div>
                                        <div>
                                            <p className="text-sm text-hud-text-primary">Dark Mode</p>
                                            <p className="text-xs text-hud-text-muted">Toggle dark/light theme</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={darkMode}
                                            onChange={() => setDarkMode(!darkMode)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-hud-bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-hud-accent-primary"></div>
                                    </label>
                                </div>

                                {/* Accent Color */}
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-3">Accent Color</label>
                                    <div className="flex gap-3">
                                        {['#00FFCC', '#6366F1', '#FF1493', '#FFA500', '#10B981', '#EF4444'].map((color) => (
                                            <button
                                                key={color}
                                                className={`w-10 h-10 rounded-lg transition-transform hover:scale-110 ${color === '#00FFCC' ? 'ring-2 ring-offset-2 ring-offset-hud-bg-secondary ring-white' : ''}`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Font Size */}
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-3">Font Size</label>
                                    <div className="flex gap-2">
                                        {['Small', 'Medium', 'Large'].map((size) => (
                                            <button
                                                key={size}
                                                className={`px-4 py-2 rounded-lg text-sm transition-hud ${size === 'Medium'
                                                        ? 'bg-hud-accent-primary text-hud-bg-primary'
                                                        : 'bg-hud-bg-primary text-hud-text-secondary hover:text-hud-text-primary'
                                                    }`}
                                            >
                                                {size}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </HudCard>
                    )}

                    {activeSection === 'security' && (
                        <HudCard title="Security Settings" subtitle="Protect your account">
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">Current Password</label>
                                    <input
                                        type="password"
                                        placeholder="Enter current password"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">New Password</label>
                                    <input
                                        type="password"
                                        placeholder="Enter new password"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">Confirm Password</label>
                                    <input
                                        type="password"
                                        placeholder="Confirm new password"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>

                                <div className="pt-4 border-t border-hud-border-secondary">
                                    <div className="flex items-center justify-between p-4 bg-hud-bg-primary rounded-lg">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-hud-accent-primary/10 rounded-lg text-hud-accent-primary">
                                                <Shield size={18} />
                                            </div>
                                            <div>
                                                <p className="text-sm text-hud-text-primary">Two-Factor Authentication</p>
                                                <p className="text-xs text-hud-text-muted">Add an extra layer of security</p>
                                            </div>
                                        </div>
                                        <Button variant="outline" size="sm">Enable</Button>
                                    </div>
                                </div>
                            </div>
                        </HudCard>
                    )}

                    {(activeSection !== 'profile' && activeSection !== 'notifications' && activeSection !== 'appearance' && activeSection !== 'security') && (
                        <HudCard title={settingsSections.find(s => s.id === activeSection)?.label} subtitle="Settings coming soon">
                            <div className="py-12 text-center">
                                <p className="text-hud-text-muted">This section is under development.</p>
                            </div>
                        </HudCard>
                    )}
                </div>
            </div>
        </div>
    )
}

export default Settings
