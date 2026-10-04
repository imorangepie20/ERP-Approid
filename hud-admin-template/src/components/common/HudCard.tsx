import { ReactNode } from 'react'

interface HudCardProps {
    children: ReactNode
    className?: string
    title?: string
    headingLevel?: 2 | 3
    subtitle?: string
    action?: ReactNode
    noPadding?: boolean
}

const HudCard = ({
    children,
    className = '',
    title,
    headingLevel = 3,
    subtitle,
    action,
    noPadding = false
}: HudCardProps) => {
    const Heading = headingLevel === 2 ? 'h2' : 'h3'
    return (
        <div className={`hud-card hud-card-bottom rounded-lg ${className}`}>
            {(title || action) && (
                <div className="flex items-center justify-between px-5 py-4 border-b border-hud-border-secondary">
                    <div>
                        {title && (
                            <Heading className="font-semibold text-hud-text-primary">{title}</Heading>
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
