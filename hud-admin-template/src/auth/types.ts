export const ROLE_CODES = [
    'ADMIN',
    'SALES',
    'PRODUCTION',
    'MATERIAL',
    'QUALITY',
    'ACCOUNTING',
] as const

export type Role = typeof ROLE_CODES[number]

export interface AuthUser {
    id: number
    username: string
    name: string
    roles: Role[]
}

export interface LoginResponse {
    accessToken: string
    tokenType: 'Bearer'
    expiresIn: number
    user: AuthUser
}

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'
