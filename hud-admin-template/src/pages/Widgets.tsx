import {
    Activity,
    Users,
    DollarSign,
    TrendingUp,
    Clock,
    AlertTriangle,
    CheckCircle,
    Zap,
    Gauge,
    Wifi,
    Database,
    Server,
} from 'lucide-react'
import HudCard from '../components/common/HudCard'
import StatCard from '../components/common/StatCard'

const activityLog = [
    { action: 'System backup completed', time: '2 min ago', status: 'success' },
    { action: 'New user registration', time: '5 min ago', status: 'info' },
    { action: 'Payment processed', time: '8 min ago', status: 'success' },
    { action: 'API rate limit warning', time: '15 min ago', status: 'warning' },
    { action: 'Database query optimized', time: '20 min ago', status: 'success' },
]

const quickStats = [
    { label: 'Uptime', value: '99.98%', icon: <Clock size={16} />, trend: '+0.02%' },
    { label: 'Response Time', value: '124ms', icon: <Zap size={16} />, trend: '-12ms' },
    { label: 'Error Rate', value: '0.02%', icon: <AlertTriangle size={16} />, trend: '-0.01%' },
    { label: 'Throughput', value: '1.2K/s', icon: <Activity size={16} />, trend: '+150' },
]

const Widgets = () => {
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold text-hud-text-primary">Widgets</h1>
                <p className="text-hud-text-muted mt-1">Pre-built widget components for your dashboard.</p>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Revenue"
                    value="$84,254"
                    change={15.3}
                    icon={<DollarSign size={24} />}
                    variant="primary"
                />
                <StatCard
                    title="Active Users"
                    value="12,847"
                    change={8.7}
                    icon={<Users size={24} />}
                    variant="secondary"
                />
                <StatCard
                    title="Conversion"
                    value="4.28%"
                    change={-2.1}
                    icon={<TrendingUp size={24} />}
                    variant="warning"
                />
                <StatCard
                    title="Avg. Order"
                    value="$156.32"
                    change={12.4}
                    icon={<Activity size={24} />}
                    variant="default"
                />
            </div>

            {/* Quick Stats and Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Quick Stats */}
                <HudCard title="Quick Stats" subtitle="Real-time metrics">
                    <div className="space-y-4">
                        {quickStats.map((stat) => (
                            <div key={stat.label} className="flex items-center justify-between p-3 bg-hud-bg-primary rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-hud-accent-primary/10 rounded-lg text-hud-accent-primary">
                                        {stat.icon}
                                    </div>
                                    <div>
                                        <p className="text-sm text-hud-text-muted">{stat.label}</p>
                                        <p className="text-lg font-bold font-mono text-hud-text-primary">{stat.value}</p>
                                    </div>
                                </div>
                                <span className="text-sm font-mono text-hud-accent-success">{stat.trend}</span>
                            </div>
                        ))}
                    </div>
                </HudCard>

                {/* Activity Feed */}
                <HudCard title="Activity Log" subtitle="Recent system events" className="lg:col-span-2">
                    <div className="space-y-3">
                        {activityLog.map((item, i) => (
                            <div key={i} className="flex items-center gap-4 p-3 bg-hud-bg-primary rounded-lg">
                                <div className={`p-2 rounded-lg ${item.status === 'success' ? 'bg-hud-accent-success/10 text-hud-accent-success' :
                                        item.status === 'warning' ? 'bg-hud-accent-warning/10 text-hud-accent-warning' :
                                            'bg-hud-accent-info/10 text-hud-accent-info'
                                    }`}>
                                    {item.status === 'success' ? <CheckCircle size={18} /> :
                                        item.status === 'warning' ? <AlertTriangle size={18} /> :
                                            <Activity size={18} />}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm text-hud-text-primary">{item.action}</p>
                                </div>
                                <span className="text-xs text-hud-text-muted">{item.time}</span>
                            </div>
                        ))}
                    </div>
                </HudCard>
            </div>

            {/* System Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { name: 'API Server', status: 'Operational', icon: <Server size={24} />, uptime: '99.99%' },
                    { name: 'Database', status: 'Operational', icon: <Database size={24} />, uptime: '99.95%' },
                    { name: 'CDN', status: 'Operational', icon: <Wifi size={24} />, uptime: '100%' },
                    { name: 'Workers', status: 'Degraded', icon: <Gauge size={24} />, uptime: '98.5%' },
                ].map((service) => (
                    <HudCard key={service.name}>
                        <div className="text-center">
                            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${service.status === 'Operational'
                                    ? 'bg-hud-accent-success/10 text-hud-accent-success'
                                    : 'bg-hud-accent-warning/10 text-hud-accent-warning'
                                }`}>
                                {service.icon}
                            </div>
                            <h3 className="font-semibold text-hud-text-primary">{service.name}</h3>
                            <p className={`text-sm mt-1 ${service.status === 'Operational' ? 'text-hud-accent-success' : 'text-hud-accent-warning'
                                }`}>
                                {service.status}
                            </p>
                            <p className="text-xs text-hud-text-muted mt-2">Uptime: {service.uptime}</p>
                        </div>
                    </HudCard>
                ))}
            </div>

            {/* Progress Widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Circular Progress */}
                <HudCard title="Storage Usage" subtitle="4.5TB of 10TB used">
                    <div className="flex items-center justify-center py-4">
                        <div className="relative w-40 h-40">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="40"
                                    fill="none"
                                    stroke="rgba(255,255,255,0.1)"
                                    strokeWidth="10"
                                />
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="40"
                                    fill="none"
                                    stroke="url(#gradient)"
                                    strokeWidth="10"
                                    strokeDasharray={`${45 * 2.51} 251`}
                                    strokeLinecap="round"
                                />
                                <defs>
                                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#00FFCC" />
                                        <stop offset="100%" stopColor="#6366F1" />
                                    </linearGradient>
                                </defs>
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl font-bold text-hud-text-primary">45%</span>
                                <span className="text-sm text-hud-text-muted">Used</span>
                            </div>
                        </div>
                    </div>
                </HudCard>

                {/* Progress Bars */}
                <HudCard title="Project Progress" subtitle="Current sprint status">
                    <div className="space-y-4">
                        {[
                            { name: 'UI Design', progress: 100, color: 'from-hud-accent-success to-green-400' },
                            { name: 'Backend API', progress: 75, color: 'from-hud-accent-primary to-cyan-400' },
                            { name: 'Testing', progress: 45, color: 'from-hud-accent-warning to-yellow-400' },
                            { name: 'Documentation', progress: 20, color: 'from-hud-accent-secondary to-pink-400' },
                        ].map((item) => (
                            <div key={item.name}>
                                <div className="flex justify-between text-sm mb-1.5">
                                    <span className="text-hud-text-secondary">{item.name}</span>
                                    <span className="text-hud-text-primary font-mono">{item.progress}%</span>
                                </div>
                                <div className="h-2 bg-hud-bg-primary rounded-full overflow-hidden">
                                    <div
                                        className={`h-full bg-gradient-to-r ${item.color} rounded-full transition-all duration-500`}
                                        style={{ width: `${item.progress}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </HudCard>

                {/* Todo Widget */}
                <HudCard title="Quick Tasks" subtitle="Things to do today">
                    <div className="space-y-3">
                        {[
                            { task: 'Review pull requests', done: true },
                            { task: 'Update documentation', done: true },
                            { task: 'Deploy to staging', done: false },
                            { task: 'Team standup meeting', done: false },
                            { task: 'Client presentation', done: false },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-3 p-2">
                                <input
                                    type="checkbox"
                                    checked={item.done}
                                    readOnly
                                    className="w-4 h-4 rounded border-hud-border-secondary bg-hud-bg-primary text-hud-accent-primary focus:ring-hud-accent-primary"
                                />
                                <span className={`text-sm ${item.done ? 'text-hud-text-muted line-through' : 'text-hud-text-primary'}`}>
                                    {item.task}
                                </span>
                            </div>
                        ))}
                    </div>
                </HudCard>
            </div>
        </div>
    )
}

export default Widgets
