import { ReactNode } from 'react'

interface HudCardProps {
    children: ReactNode
    className?: string
    title?: string
    subtitle?: string
    action?: ReactNode
    noPadding?: boolean
}

const HudCard = ({
    children,
    className = '',
    title,
    subtitle,
    action,
    noPadding = false
}: HudCardProps) => {
    return (
        <div className={`hud-card hud-card-bottom rounded-lg ${className}`}>
            {(title || action) && (
                <div className="flex items-center justify-between px-5 py-4 border-b border-hud-border-secondary">
                    <div>
                        {title && (
                            <h3 className="font-semibold text-hud-text-primary">{title}</h3>
                        )}
                        {subtitle && (
                            <p className="text-sm text-hud-text-muted mt-0.5">{subtitle}</p>
                        )}
                    </div>
                    {action && <div>{action}</div>}
                </div>
            )}
            <div className={noPadding ? '' : 'p-5'}>
                {children}
            </div>
        </div>
    )
}

export default HudCard
