import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider, useAuth } from './AuthContext'
import { saveSession } from './session'

const env = {
    VITE_API_CORE_URL: 'https://core.example.test/api/core',
    VITE_API_ANALYTICS_URL: 'https://analytics.example.test/api/analytics',
}

const loginPayload = {
    accessToken: 'access-token',
    tokenType: 'Bearer',
    expiresIn: 3600,
    user: { id: 1, username: 'admin', name: '관리자', roles: ['ADMIN'] },
}

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

function Probe() {
    const auth = useAuth()
    return (
        <div>
            <span>{auth.status}</span>
            <span>{auth.user?.name ?? '사용자 없음'}</span>
            <button onClick={() => void auth.login('admin', 'password')}>로그인 실행</button>
            <button onClick={() => void auth.login('user-b', 'password')}>로그인 B 실행</button>
            <button onClick={() => {
                void Promise.allSettled([auth.core.get('items'), auth.core.get('partners')])
            }}>API 실행</button>
            <button onClick={() => { void auth.core.get('items').catch(() => undefined) }}>단일 API 실행</button>
            <button onClick={auth.logout}>로그아웃 실행</button>
        </div>
    )
}

function renderProvider(fetchMock: typeof fetch, queryClient = new QueryClient()) {
    function Wrapper({ children }: PropsWithChildren) {
        return (
            <QueryClientProvider client={queryClient}>
                <AuthProvider env={env} storage={sessionStorage} fetch={fetchMock}>
                    {children}
                </AuthProvider>
            </QueryClientProvider>
        )
    }
    return { ...render(<Probe />, { wrapper: Wrapper }), queryClient }
}

describe('AuthProvider', () => {
    beforeEach(() => sessionStorage.clear())
    afterEach(() => vi.useRealTimers())

    it('logs in, validates the response and stores no user profile', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(loginPayload))
        renderProvider(fetchMock)

        await user.click(screen.getByRole('button', { name: '로그인 실행' }))

        expect(await screen.findByText('관리자')).toBeInTheDocument()
        expect(screen.getByText('authenticated')).toBeInTheDocument()
        const stored = JSON.parse(sessionStorage.getItem('erp-approid.auth')!)
        expect(stored).toEqual({ accessToken: 'access-token', expiresAt: expect.any(Number) })
        expect(stored).not.toHaveProperty('user')
        expect(fetchMock.mock.calls[0][0]).toBe('https://core.example.test/api/core/auth/login')
        expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
            username: 'admin',
            password: 'password',
        })
    })

    it('restores a valid session through /auth/me with a bearer token', async () => {
        saveSession(sessionStorage, 'restored-token', 3600)
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(loginPayload.user))
        renderProvider(fetchMock)

        expect(await screen.findByText('관리자')).toBeInTheDocument()
        expect(fetchMock.mock.calls[0][0]).toBe('https://core.example.test/api/core/auth/me')
        expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Authorization'))
            .toBe('Bearer restored-token')
    })

    it('clears an unusable bootstrap session on 403', async () => {
        saveSession(sessionStorage, 'restored-token', 3600)
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
            code: 'FORBIDDEN',
            message: '권한이 없습니다.',
        }, 403))
        renderProvider(fetchMock)

        await waitFor(() => expect(screen.getByText('anonymous')).toBeInTheDocument())
        expect(sessionStorage).toHaveLength(0)
        expect(screen.getByText('사용자 없음')).toBeInTheDocument()
    })

    it('suspends a bootstrap session on a network failure without sending its token again', async () => {
        saveSession(sessionStorage, 'restored-token', 3600)
        const fetchMock = vi.fn<typeof fetch>()
            .mockRejectedValueOnce(new TypeError('offline'))
            .mockResolvedValueOnce(jsonResponse({ service: 'core' }))
        renderProvider(fetchMock)

        await waitFor(() => expect(screen.getByText('anonymous')).toBeInTheDocument())
        expect(sessionStorage.getItem('erp-approid.auth')).toContain('restored-token')

        await userEvent.setup().click(screen.getByRole('button', { name: '단일 API 실행' }))
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
        expect(new Headers(fetchMock.mock.calls[1][1]?.headers).has('Authorization')).toBe(false)
    })

    it('clears session and query cache once when concurrent requests return 401', async () => {
        const user = userEvent.setup()
        const unauthorized = { code: 'UNAUTHORIZED', message: '인증이 필요합니다.' }
        const fetchMock = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(jsonResponse(loginPayload))
            .mockResolvedValue(jsonResponse(unauthorized, 401))
        const queryClient = new QueryClient()
        const clearSpy = vi.spyOn(queryClient, 'clear')
        queryClient.setQueryData(['private'], { secret: true })
        renderProvider(fetchMock, queryClient)
        await user.click(screen.getByRole('button', { name: '로그인 실행' }))
        await screen.findByText('관리자')

        await user.click(screen.getByRole('button', { name: 'API 실행' }))

        await waitFor(() => expect(screen.getByText('anonymous')).toBeInTheDocument())
        expect(sessionStorage).toHaveLength(0)
        expect(queryClient.getQueryData(['private'])).toBeUndefined()
        expect(clearSpy).toHaveBeenCalledOnce()
    })

    it('ignores a late 401 from session A after session B has logged in', async () => {
        const user = userEvent.setup()
        let resolveOldRequest!: (response: Response) => void
        const oldRequest = new Promise<Response>(resolve => { resolveOldRequest = resolve })
        const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
            const url = String(input)
            if (url.endsWith('/auth/login')) {
                const username = JSON.parse(String(init?.body)).username as string
                return jsonResponse({
                    ...loginPayload,
                    accessToken: username === 'user-b' ? 'token-b' : 'token-a',
                    user: { ...loginPayload.user, username, name: username === 'user-b' ? '사용자 B' : '관리자' },
                })
            }
            return oldRequest
        })
        const queryClient = new QueryClient()
        const clearSpy = vi.spyOn(queryClient, 'clear')
        renderProvider(fetchMock, queryClient)

        await user.click(screen.getByRole('button', { name: '로그인 실행' }))
        await screen.findByText('관리자')
        await user.click(screen.getByRole('button', { name: '단일 API 실행' }))
        await user.click(screen.getByRole('button', { name: '로그인 B 실행' }))
        expect(await screen.findByText('사용자 B')).toBeInTheDocument()

        const clearsBeforeLateResponse = clearSpy.mock.calls.length
        await act(async () => {
            resolveOldRequest(jsonResponse({ code: 'UNAUTHORIZED', message: '인증이 필요합니다.' }, 401))
            await oldRequest
        })

        expect(screen.getByText('authenticated')).toBeInTheDocument()
        expect(sessionStorage.getItem('erp-approid.auth')).toContain('token-b')
        expect(clearSpy).toHaveBeenCalledTimes(clearsBeforeLateResponse)
    })

    it('clears storage, cache and authentication when the active session expires', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-01T00:00:00Z'))
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
            ...loginPayload,
            expiresIn: 1,
        }))
        const queryClient = new QueryClient()
        queryClient.setQueryData(['private'], { secret: true })
        const clearSpy = vi.spyOn(queryClient, 'clear')
        renderProvider(fetchMock, queryClient)
        fireEvent.click(screen.getByRole('button', { name: '로그인 실행' }))
        await act(async () => { await Promise.resolve() })
        expect(screen.getByText('관리자')).toBeInTheDocument()

        await act(async () => { await vi.advanceTimersByTimeAsync(1_000) })

        expect(screen.getByText('anonymous')).toBeInTheDocument()
        expect(sessionStorage).toHaveLength(0)
        expect(queryClient.getQueryData(['private'])).toBeUndefined()
        expect(clearSpy).toHaveBeenCalledOnce()
    })

    it('chunks expiration timers that exceed the browser maximum delay', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-01T00:00:00Z'))
        const thirtyDaysInSeconds = 30 * 24 * 60 * 60
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
            ...loginPayload,
            expiresIn: thirtyDaysInSeconds,
        }))
        renderProvider(fetchMock)
        fireEvent.click(screen.getByRole('button', { name: '로그인 실행' }))
        await act(async () => { await Promise.resolve() })

        await act(async () => { await vi.advanceTimersByTimeAsync(2_147_483_647) })
        expect(screen.getByText('authenticated')).toBeInTheDocument()

        const remaining = thirtyDaysInSeconds * 1_000 - 2_147_483_647
        await act(async () => { await vi.advanceTimersByTimeAsync(remaining) })
        expect(screen.getByText('anonymous')).toBeInTheDocument()
    })

    it('retains authentication on 403 and clears it on explicit logout', async () => {
        const user = userEvent.setup()
        const forbidden = { code: 'FORBIDDEN', message: '권한이 없습니다.' }
        const fetchMock = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(jsonResponse(loginPayload))
            .mockResolvedValue(jsonResponse(forbidden, 403))
        renderProvider(fetchMock)
        await user.click(screen.getByRole('button', { name: '로그인 실행' }))
        await screen.findByText('관리자')

        await user.click(screen.getByRole('button', { name: 'API 실행' }))
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
        expect(screen.getByText('authenticated')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: '로그아웃 실행' }))
        expect(screen.getByText('anonymous')).toBeInTheDocument()
        expect(sessionStorage).toHaveLength(0)
    })
})
