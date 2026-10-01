import type { ReactNode } from 'react'

import type { Role } from './types'

export function hasAnyRole(currentRoles: readonly Role[], requiredRoles: readonly Role[]): boolean {
    return requiredRoles.length === 0 || requiredRoles.some(role => currentRoles.includes(role))
}

interface AuthorizeProps {
    roles: readonly Role[]
    anyOf: readonly Role[]
    children: ReactNode
    fallback?: ReactNode
}

export function Authorize({ roles, anyOf, children, fallback = null }: AuthorizeProps) {
    return hasAnyRole(roles, anyOf) ? children : fallback
}
