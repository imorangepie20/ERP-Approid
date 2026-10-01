import { useQueryClient } from '@tanstack/react-query'
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type PropsWithChildren,
} from 'react'

import { createApiClients } from '../api/clients'
import type { ApiEnvironment } from '../api/config'
import { ApiError, type HttpClient } from '../api/http'
import { hasAnyRole } from './authorization'
import { parseLoginResponse, parseUserResponse } from './contracts'
import { clearSession, readSession, saveSession, type AuthSession } from './session'
import type { AuthStatus, AuthUser, Role } from './types'

const MAX_TIMER_DELAY_MS = 2_147_483_647

interface AuthContextValue {
    status: AuthStatus
    user: AuthUser | null
    core: HttpClient
    login(username: string, password: string): Promise<AuthUser>
    logout(): void
    hasAnyRole(roles: readonly Role[]): boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps extends PropsWithChildren {
    env?: ApiEnvironment
    storage?: Storage
    fetch?: typeof globalThis.fetch
}

export function AuthProvider({
    children,
    env = import.meta.env,
    storage = window.sessionStorage,
    fetch,
}: AuthProviderProps) {
    const queryClient = useQueryClient()
    const initialSession = useMemo(() => readSession(storage), [storage])
    const [session, setSession] = useState<AuthSession | null>(initialSession)
    const sessionRef = useRef<AuthSession | null>(initialSession)
    const generationRef = useRef(initialSession ? 1 : 0)
    const [status, setStatus] = useState<AuthStatus>(initialSession ? 'loading' : 'anonymous')
    const [user, setUser] = useState<AuthUser | null>(null)

    const clearAuthentication = useCallback((expectedGeneration = generationRef.current) => {
        if (!sessionRef.current || generationRef.current !== expectedGeneration) return
        generationRef.current += 1
        sessionRef.current = null
        clearSession(storage)
        setSession(null)
        setUser(null)
        setStatus('anonymous')
        queryClient.clear()
    }, [queryClient, storage])

    const suspendAuthentication = useCallback((expectedGeneration: number) => {
        if (!sessionRef.current || generationRef.current !== expectedGeneration) return
        generationRef.current += 1
        sessionRef.current = null
        setSession(null)
        setUser(null)
        setStatus('anonymous')
        queryClient.clear()
    }, [queryClient])

    const getAccessToken = useCallback(() => sessionRef.current?.accessToken, [])
    const getAuthGeneration = useCallback(() => generationRef.current, [])

    const loginClient = useMemo(() => createApiClients(env, {
        core: { fetch },
        analytics: { fetch },
    }).core, [env, fetch])

    // The callbacks dereference auth refs only when a request starts, never during render.
    // eslint-disable-next-line react-hooks/refs
    const clients = useMemo(() => createApiClients(env, {
        core: {
            fetch,
            getAccessToken,
            getAuthGeneration,
            onUnauthorized: (_error, requestGeneration) => {
                if (requestGeneration !== undefined) clearAuthentication(requestGeneration)
            },
        },
        analytics: { fetch },
    }), [clearAuthentication, env, fetch, getAccessToken, getAuthGeneration])

    const login = useCallback(async (username: string, password: string) => {
        const hadSession = sessionRef.current !== null
        generationRef.current += 1
        const loginGeneration = generationRef.current
        sessionRef.current = null
        clearSession(storage)
        setSession(null)
        setUser(null)
        setStatus('anonymous')
        if (hadSession) queryClient.clear()
        const result = await loginClient.post<unknown>('auth/login', { username, password })
        const response = parseLoginResponse(result.data)
        if (generationRef.current !== loginGeneration) return response.user
        const nextSession = saveSession(storage, response.accessToken, response.expiresIn)
        sessionRef.current = nextSession
        setSession(nextSession)
        setUser(response.user)
        setStatus('authenticated')
        return response.user
    }, [loginClient, queryClient, storage])

    const logout = useCallback(() => {
        if (sessionRef.current) {
            clearAuthentication(generationRef.current)
            return
        }
        clearSession(storage)
        setUser(null)
        setStatus('anonymous')
        queryClient.clear()
    }, [clearAuthentication, queryClient, storage])

    useEffect(() => {
        if (!initialSession || status !== 'loading') return

        let active = true
        const bootstrapGeneration = generationRef.current
        void clients.core.get<unknown>('auth/me')
            .then(result => {
                if (!active || generationRef.current !== bootstrapGeneration) return
                setUser(parseUserResponse(result.data))
                setStatus('authenticated')
            })
            .catch(cause => {
                if (!active) return
                if (cause instanceof ApiError
                    && (cause.status === 401
                        || cause.status === 403
                        || cause.code === 'INVALID_AUTH_RESPONSE')) {
                    clearAuthentication(bootstrapGeneration)
                    return
                }
                suspendAuthentication(bootstrapGeneration)
            })

        return () => { active = false }
    }, [clearAuthentication, clients.core, initialSession, status, suspendAuthentication])

    useEffect(() => {
        if (!session) return
        const expectedGeneration = generationRef.current
        let timer: number
        const checkExpiration = () => {
            if (generationRef.current !== expectedGeneration) return
            const remaining = session.expiresAt - Date.now()
            if (remaining <= 0) {
                clearAuthentication(expectedGeneration)
                return
            }
            timer = window.setTimeout(checkExpiration, Math.min(remaining, MAX_TIMER_DELAY_MS))
        }
        const remaining = Math.max(0, session.expiresAt - Date.now())
        timer = window.setTimeout(checkExpiration, Math.min(remaining, MAX_TIMER_DELAY_MS))
        return () => window.clearTimeout(timer)
    }, [clearAuthentication, session])

    const value = useMemo<AuthContextValue>(() => ({
        status,
        user,
        core: clients.core,
        login,
        logout,
        hasAnyRole: roles => hasAnyRole(user?.roles ?? [], roles),
    }), [clients.core, login, logout, status, user])

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext)
    if (!context) throw new Error('useAuth는 AuthProvider 안에서 사용해야 합니다.')
    return context
}
