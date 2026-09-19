type StatusTone = 'success' | 'info' | 'warning' | 'primary' | 'danger' | 'muted'

const toneClasses: Record<StatusTone, string> = {
    success: 'text-hud-accent-success bg-hud-accent-success/10',
    info: 'text-hud-accent-info bg-hud-accent-info/10',
    warning: 'text-hud-accent-warning bg-hud-accent-warning/10',
    primary: 'text-hud-accent-primary bg-hud-accent-primary/10',
    danger: 'text-hud-accent-danger bg-hud-accent-danger/10',
    muted: 'text-hud-text-muted bg-hud-bg-hover',
}

const StatusBadge = ({ tone = 'muted', children }: { tone?: StatusTone; children: React.ReactNode }) => (
    <span className={`inline-flex px-2.5 py-1 rounded text-xs font-medium ${toneClasses[tone]}`}>
        {children}
    </span>
)

export default StatusBadge
export type { StatusTone }
