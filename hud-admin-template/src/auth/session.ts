const SESSION_KEY = 'erp-approid.auth'

export interface AuthSession {
    accessToken: string
    expiresAt: number
}

function isAuthSession(value: unknown): value is AuthSession {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<AuthSession>
    return typeof candidate.accessToken === 'string'
        && candidate.accessToken.trim() !== ''
        && typeof candidate.expiresAt === 'number'
        && Number.isSafeInteger(candidate.expiresAt)
}

export function clearSession(storage: Storage): void {
    storage.removeItem(SESSION_KEY)
}

export function readSession(storage: Storage, now = Date.now()): AuthSession | null {
    const raw = storage.getItem(SESSION_KEY)
    if (!raw) return null

    try {
        const session: unknown = JSON.parse(raw)
        if (!isAuthSession(session) || session.expiresAt <= now) {
            clearSession(storage)
            return null
        }
        return session
    } catch {
        clearSession(storage)
        return null
    }
}

export function saveSession(
    storage: Storage,
    accessToken: string,
    expiresInSeconds: number,
    now = Date.now(),
): AuthSession {
    if (accessToken.trim() === '' || !Number.isSafeInteger(expiresInSeconds) || expiresInSeconds <= 0) {
        throw new Error('유효한 인증 세션만 저장할 수 있습니다.')
    }
    const expiresAt = now + expiresInSeconds * 1_000
    if (!Number.isSafeInteger(now) || !Number.isSafeInteger(expiresAt) || expiresAt <= now) {
        throw new Error('유효한 인증 세션 만료시각을 계산할 수 없습니다.')
    }
    const session = { accessToken, expiresAt }
    storage.setItem(SESSION_KEY, JSON.stringify(session))
    return session
}
