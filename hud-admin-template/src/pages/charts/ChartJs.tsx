import HudCard from '../../components/common/HudCard'

const ChartJs = () => {
    // Sample data for charts
    const barData = [40, 65, 59, 80, 81, 56, 72]
    const lineData = [28, 48, 40, 58, 86, 75, 90]
    const maxValue = Math.max(...barData, ...lineData)

    const pieData = [
        { label: 'Desktop', value: 45, color: '#00FFCC' },
        { label: 'Mobile', value: 35, color: '#6366F1' },
        { label: 'Tablet', value: 20, color: '#FF1493' },
    ]

    const doughnutData = [
        { label: 'Direct', value: 35 },
        { label: 'Organic', value: 30 },
        { label: 'Referral', value: 20 },
        { label: 'Social', value: 15 },
    ]

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-hud-text-primary">Chart.js</h1>
                <p className="text-hud-text-muted mt-1">Flexible JavaScript charting with CSS visualizations.</p>
            </div>

            {/* Line & Bar Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar Chart */}
                <HudCard title="Bar Chart" subtitle="Monthly performance">
                    <div className="h-64 flex items-end justify-between gap-3">
                        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'].map((month, i) => (
                            <div key={month} className="flex-1 flex flex-col items-center gap-2">
                                <div
                                    className="w-full bg-gradient-to-t from-hud-accent-primary to-hud-accent-info rounded-t transition-all duration-500 hover:opacity-80"
                                    style={{ height: `${(barData[i] / maxValue) * 100}%` }}
                                />
                                <span className="text-xs text-hud-text-muted">{month}</span>
                            </div>
                        ))}
                    </div>
                </HudCard>

                {/* Line Chart */}
                <HudCard title="Line Chart" subtitle="Weekly trends">
                    <div className="h-64 relative">
                        {/* Grid lines */}
                        <div className="absolute inset-0 flex flex-col justify-between">
                            {[100, 75, 50, 25, 0].map((val) => (
                                <div key={val} className="flex items-center">
                                    <span className="text-xs text-hud-text-muted w-8">{val}</span>
                                    <div className="flex-1 h-px bg-hud-border-secondary" />
                                </div>
                            ))}
                        </div>

                        {/* Line chart */}
                        <svg className="absolute inset-0 w-full h-full ml-8" viewBox="0 0 300 200" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="#00FFCC" stopOpacity="0.3" />
                                    <stop offset="100%" stopColor="#00FFCC" stopOpacity="0" />
                                </linearGradient>
                            </defs>

                            {/* Area fill */}
                            <path
                                d={`M 0 ${200 - (lineData[0] / 100) * 200} ${lineData.map((d, i) =>
                                    `L ${(i / (lineData.length - 1)) * 300} ${200 - (d / 100) * 200}`
                                ).join(' ')} L 300 200 L 0 200 Z`}
                                fill="url(#lineGradient)"
                            />

                            {/* Line */}
                            <path
                                d={`M 0 ${200 - (lineData[0] / 100) * 200} ${lineData.map((d, i) =>
                                    `L ${(i / (lineData.length - 1)) * 300} ${200 - (d / 100) * 200}`
                                ).join(' ')}`}
                                fill="none"
                                stroke="#00FFCC"
                                strokeWidth="2"
                            />

                            {/* Points */}
                            {lineData.map((d, i) => (
                                <circle
                                    key={i}
                                    cx={(i / (lineData.length - 1)) * 300}
                                    cy={200 - (d / 100) * 200}
                                    r="4"
                                    fill="#00FFCC"
                                    className="hover:r-6 transition-all"
                                />
                            ))}
                        </svg>
                    </div>
                </HudCard>
            </div>

            {/* Pie & Doughnut Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pie Chart */}
                <HudCard title="Pie Chart" subtitle="Traffic by device">
                    <div className="flex items-center gap-8">
                        <div className="relative w-48 h-48">
                            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                {pieData.reduce((acc, slice, i) => {
                                    const startAngle = acc.angle
                                    const sliceAngle = (slice.value / 100) * 360
                                    const endAngle = startAngle + sliceAngle

                                    const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180)
                                    const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180)
                                    const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180)
                                    const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180)
                                    const largeArc = sliceAngle > 180 ? 1 : 0

                                    acc.paths.push(
                                        <path
                                            key={i}
                                            d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`}
                                            fill={slice.color}
                                            className="hover:opacity-80 transition-opacity cursor-pointer"
                                        />
                                    )
                                    acc.angle = endAngle
                                    return acc
                                }, { paths: [] as JSX.Element[], angle: 0 }).paths}
                            </svg>
                        </div>
                        <div className="space-y-3">
                            {pieData.map((item) => (
                                <div key={item.label} className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span className="text-sm text-hud-text-secondary">{item.label}</span>
                                    <span className="text-sm text-hud-text-primary font-mono ml-auto">{item.value}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </HudCard>

                {/* Doughnut Chart */}
                <HudCard title="Doughnut Chart" subtitle="Traffic sources">
                    <div className="flex items-center gap-8">
                        <div className="relative w-48 h-48">
                            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                {doughnutData.reduce((acc, slice, i) => {
                                    const startAngle = acc.angle
                                    const sliceAngle = (slice.value / 100) * 360
                                    const endAngle = startAngle + sliceAngle
                                    const colors = ['#00FFCC', '#6366F1', '#FF1493', '#FFA500']

                                    const outerR = 45
                                    const innerR = 30

                                    const x1o = 50 + outerR * Math.cos((startAngle * Math.PI) / 180)
                                    const y1o = 50 + outerR * Math.sin((startAngle * Math.PI) / 180)
                                    const x2o = 50 + outerR * Math.cos((endAngle * Math.PI) / 180)
                                    const y2o = 50 + outerR * Math.sin((endAngle * Math.PI) / 180)
                                    const x1i = 50 + innerR * Math.cos((endAngle * Math.PI) / 180)
                                    const y1i = 50 + innerR * Math.sin((endAngle * Math.PI) / 180)
                                    const x2i = 50 + innerR * Math.cos((startAngle * Math.PI) / 180)
                                    const y2i = 50 + innerR * Math.sin((startAngle * Math.PI) / 180)
                                    const largeArc = sliceAngle > 180 ? 1 : 0

                                    acc.paths.push(
                                        <path
                                            key={i}
                                            d={`M ${x1o} ${y1o} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2i} ${y2i} Z`}
                                            fill={colors[i]}
                                            className="hover:opacity-80 transition-opacity cursor-pointer"
                                        />
                                    )
                                    acc.angle = endAngle
                                    return acc
                                }, { paths: [] as JSX.Element[], angle: 0 }).paths}
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-2xl font-bold text-hud-text-primary">12.4K</span>
                                <span className="text-xs text-hud-text-muted">Visitors</span>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {doughnutData.map((item, i) => (
                                <div key={item.label} className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ['#00FFCC', '#6366F1', '#FF1493', '#FFA500'][i] }} />
                                    <span className="text-sm text-hud-text-secondary">{item.label}</span>
                                    <span className="text-sm text-hud-text-primary font-mono ml-auto">{item.value}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </HudCard>
            </div>

            {/* Area & Radar */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Stacked Bar */}
                <HudCard title="Stacked Bar Chart" subtitle="Revenue breakdown">
                    <div className="h-64 flex items-end justify-between gap-3">
                        {['Q1', 'Q2', 'Q3', 'Q4'].map((quarter, i) => {
                            const data1 = [30, 40, 35, 50][i]
                            const data2 = [25, 30, 40, 35][i]
                            const data3 = [15, 20, 15, 25][i]
                            return (
                                <div key={quarter} className="flex-1 flex flex-col items-center gap-2">
                                    <div className="w-full flex flex-col" style={{ height: `${data1 + data2 + data3}%` }}>
                                        <div className="flex-1 bg-hud-accent-primary rounded-t" style={{ flexBasis: `${data1}%` }} />
                                        <div className="flex-1 bg-hud-accent-info" style={{ flexBasis: `${data2}%` }} />
                                        <div className="flex-1 bg-hud-accent-secondary rounded-b" style={{ flexBasis: `${data3}%` }} />
                                    </div>
                                    <span className="text-xs text-hud-text-muted">{quarter}</span>
                                </div>
                            )
                        })}
                    </div>
                    <div className="flex items-center justify-center gap-6 mt-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-hud-accent-primary" />
                            <span className="text-xs text-hud-text-muted">Products</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-hud-accent-info" />
                            <span className="text-xs text-hud-text-muted">Services</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-hud-accent-secondary" />
                            <span className="text-xs text-hud-text-muted">Subscriptions</span>
                        </div>
                    </div>
                </HudCard>

                {/* Horizontal Bar */}
                <HudCard title="Horizontal Bar Chart" subtitle="Top products">
                    <div className="space-y-4">
                        {[
                            { name: 'MacBook Pro', value: 85 },
                            { name: 'iPhone 15', value: 72 },
                            { name: 'iPad Pro', value: 58 },
                            { name: 'AirPods', value: 45 },
                            { name: 'Apple Watch', value: 32 },
                        ].map((item) => (
                            <div key={item.name}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-hud-text-secondary">{item.name}</span>
                                    <span className="text-hud-text-primary font-mono">{item.value}%</span>
                                </div>
                                <div className="h-3 bg-hud-bg-primary rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-hud-accent-primary to-hud-accent-info rounded-full transition-all duration-500"
                                        style={{ width: `${item.value}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </HudCard>
            </div>
        </div>
    )
}

export default ChartJs
