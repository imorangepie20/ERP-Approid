import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from './AuthContext'
import { safeReturnPath } from './routes'

function SessionLoading() {
    return (
        <div className="min-h-screen bg-hud-bg-primary flex items-center justify-center text-hud-text-secondary"
            role="status">
            세션을 확인하고 있습니다.
        </div>
    )
}

export function RequireAuth({ children }: { children: ReactNode }) {
    const { status } = useAuth()
    const location = useLocation()

    if (status === 'loading') return <SessionLoading />
    if (status === 'anonymous') {
        const from = `${location.pathname}${location.search}${location.hash}`
        return <Navigate to="/login" replace state={{ from }} />
    }
    return children
}

export function PublicOnly({ children }: { children: ReactNode }) {
    const { status } = useAuth()
    const location = useLocation()

    if (status === 'loading') return <SessionLoading />
    if (status === 'authenticated') {
        return <Navigate to={safeReturnPath(location.state)} replace />
    }
    return children
}
