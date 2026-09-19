import { ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface StatCardProps {
    title: string
    value: string | number
    change?: number
    changeLabel?: string
    icon?: ReactNode
    variant?: 'default' | 'primary' | 'secondary' | 'warning' | 'danger'
}

const StatCard = ({
    title,
    value,
    change,
    changeLabel = 'vs last month',
    icon,
    variant = 'default',
}: StatCardProps) => {
    const isPositive = change !== undefined && change >= 0

    const variantStyles = {
        default: 'from-hud-accent-primary/20 to-transparent border-hud-accent-primary/30',
        primary: 'from-hud-accent-primary/20 to-transparent border-hud-accent-primary/30',
        secondary: 'from-hud-accent-info/20 to-transparent border-hud-accent-info/30',
        warning: 'from-hud-accent-warning/20 to-transparent border-hud-accent-warning/30',
        danger: 'from-hud-accent-danger/20 to-transparent border-hud-accent-danger/30',
    }

    const iconColors = {
        default: 'text-hud-accent-primary',
        primary: 'text-hud-accent-primary',
        secondary: 'text-hud-accent-info',
        warning: 'text-hud-accent-warning',
        danger: 'text-hud-accent-danger',
    }

    return (
        <div className={`hud-card hud-card-bottom rounded-lg bg-gradient-to-br ${variantStyles[variant]} p-5`}>
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-sm text-hud-text-muted uppercase tracking-wide">{title}</p>
                    <p className="text-3xl font-bold text-hud-text-primary mt-2 font-mono">{value}</p>

                    {change !== undefined && (
                        <div className="flex items-center gap-1.5 mt-3">
                            {isPositive ? (
                                <TrendingUp size={16} className="text-hud-accent-success" />
                            ) : (
                                <TrendingDown size={16} className="text-hud-accent-danger" />
                            )}
                            <span className={`text-sm font-medium ${isPositive ? 'text-hud-accent-success' : 'text-hud-accent-danger'}`}>
                                {isPositive ? '+' : ''}{change}%
                            </span>
                            <span className="text-xs text-hud-text-muted">{changeLabel}</span>
                        </div>
                    )}
                </div>

                {icon && (
                    <div className={`p-3 rounded-lg bg-hud-bg-primary/50 ${iconColors[variant]}`}>
                        {icon}
                    </div>
                )}
            </div>
        </div>
    )
}

export default StatCard
