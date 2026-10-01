import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AuthProvider } from './AuthContext'
import { PublicOnly, RequireAuth } from './RouteGuards'
import { saveSession } from './session'

const env = {
    VITE_API_CORE_URL: 'https://core.example.test/api/core',
    VITE_API_ANALYTICS_URL: 'https://analytics.example.test/api/analytics',
}

function renderRoutes(initialEntry: string | { pathname: string; state?: unknown }, fetchMock: typeof fetch) {
    return render(
        <QueryClientProvider client={new QueryClient()}>
            <AuthProvider env={env} storage={sessionStorage} fetch={fetchMock}>
                <MemoryRouter initialEntries={[initialEntry]}>
                    <Routes>
                        <Route path="/login" element={<PublicOnly><div>로그인 페이지</div></PublicOnly>} />
                        <Route path="/sales/orders" element={<RequireAuth><div>수주 현황</div></RequireAuth>} />
                    </Routes>
                </MemoryRouter>
            </AuthProvider>
        </QueryClientProvider>,
    )
}

describe('authentication route guards', () => {
    it('redirects anonymous users from a protected route to login', async () => {
        sessionStorage.clear()
        renderRoutes('/sales/orders', vi.fn<typeof fetch>())
        expect(await screen.findByText('로그인 페이지')).toBeInTheDocument()
    })

    it('restores a session before returning an authenticated user to the intended path', async () => {
        sessionStorage.clear()
        saveSession(sessionStorage, 'token', 3600)
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
            id: 1,
            username: 'admin',
            name: '관리자',
            roles: ['ADMIN'],
        }))

        renderRoutes({ pathname: '/login', state: { from: '/sales/orders' } }, fetchMock)

        expect(await screen.findByText('수주 현황')).toBeInTheDocument()
    })
})
